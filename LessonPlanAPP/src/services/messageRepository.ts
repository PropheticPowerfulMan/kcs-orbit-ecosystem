import { UserProfile, UserRole } from "../types/user";
import { cloudAuthService } from "./cloudAuthService";

export type MessageAudience = "all" | "role" | "department" | "user";

export interface AppMessage {
  id: string;
  senderId: string;
  senderName: string;
  audience: MessageAudience;
  target: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  readBy: string[];
}

const key = "powerful-lesson-planner:messages";

const read = (): AppMessage[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as AppMessage[];
  } catch {
    return [];
  }
};

const write = (messages: AppMessage[]) => localStorage.setItem(key, JSON.stringify(messages));

const cloudHeaders = (extra: Record<string, string> = {}) => ({
  ...cloudAuthService.baseHeaders(cloudAuthService.getAccessToken()),
  ...extra
});

const cloudRequest = async <T>(path: string, options: RequestInit = {}) => {
  const response = await fetch(cloudAuthService.restUrl(path), {
    ...options,
    headers: {
      ...cloudHeaders(),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.msg || data?.error_description || "Message cloud request failed";
    throw new Error(message);
  }
  return data as T;
};

const toCloudRow = (message: AppMessage) => ({
  id: message.id,
  sender_id: message.senderId,
  sender_name: message.senderName,
  audience: message.audience,
  target: message.target,
  subject: message.subject,
  body: message.body,
  read_by: message.readBy,
  created_at: message.createdAt
});

const fromCloudRow = (row: Record<string, unknown>): AppMessage => ({
  id: String(row.id || ""),
  senderId: String(row.sender_id || ""),
  senderName: String(row.sender_name || ""),
  audience: String(row.audience || "all") as MessageAudience,
  target: String(row.target || ""),
  subject: String(row.subject || ""),
  body: String(row.body || ""),
  createdAt: String(row.created_at || new Date().toISOString()),
  updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  readBy: Array.isArray(row.read_by) ? row.read_by.map(String) : []
});

const normalizeMessage = (message: AppMessage): AppMessage => {
  if (message.audience === "user" && message.target === "administrator") {
    return { ...message, audience: "role", target: "administrator" };
  }
  return message;
};

const canReceive = (message: AppMessage, user: UserProfile) => {
  if (message.senderId === user.id) return true;
  if (message.audience === "all") return true;
  if (message.audience === "user") return message.target === user.id;
  if (message.audience === "role") return message.target === user.role;
  if (message.audience === "department") return message.target === user.department;
  return false;
};

export const messageRepository = {
  listForUser(user: UserProfile) {
    return read()
      .map(normalizeMessage)
      .filter((message) => canReceive(message, user))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async listForUserAsync(user: UserProfile) {
    if (!cloudAuthService.enabled) return this.listForUser(user);
    const rows = await cloudRequest<Record<string, unknown>[]>("app_messages?select=*&order=created_at.desc");
    const messages = rows.map(fromCloudRow).map(normalizeMessage);
    write(messages);
    return messages.filter((message) => canReceive(message, user));
  },
  send(input: { sender: UserProfile; audience: MessageAudience; target: string; subject: string; body: string }) {
    const now = new Date().toISOString();
    const message: AppMessage = {
      id: crypto.randomUUID(),
      senderId: input.sender.id,
      senderName: input.sender.name,
      audience: input.audience,
      target: input.target,
      subject: input.subject.trim(),
      body: input.body.trim(),
      createdAt: now,
      updatedAt: now,
      readBy: [input.sender.id]
    };
    write([message, ...read()]);
    return message;
  },
  async sendAsync(input: { sender: UserProfile; audience: MessageAudience; target: string; subject: string; body: string }) {
    const message = this.send(input);
    if (!cloudAuthService.enabled) return message;
    const rows = await cloudRequest<Record<string, unknown>[]>("app_messages?select=*", {
      method: "POST",
      headers: cloudHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(toCloudRow(message))
    });
    const cloudMessage = rows[0] ? fromCloudRow(rows[0]) : message;
    write([cloudMessage, ...read().filter((item) => item.id !== message.id)]);
    return cloudMessage;
  },
  markRead(id: string, userId: string) {
    write(read().map((message) => message.id === id ? { ...normalizeMessage(message), readBy: Array.from(new Set([...message.readBy, userId])) } : normalizeMessage(message)));
  },
  async markReadAsync(id: string, userId: string) {
    const message = read().find((item) => item.id === id);
    const readBy = Array.from(new Set([...(message?.readBy || []), userId]));
    this.markRead(id, userId);
    if (!cloudAuthService.enabled) return;
    await cloudRequest(`app_messages?id=eq.${id}`, {
      method: "PATCH",
      headers: cloudHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ read_by: readBy })
    });
  },
  async updateAsync(id: string, userId: string, input: { subject: string; body: string }) {
    const updatedAt = new Date().toISOString();
    const applyLocalUpdate = (messages: AppMessage[]) => messages.map((message) => {
      const normalized = normalizeMessage(message);
      return normalized.id === id && normalized.senderId === userId
        ? { ...normalized, subject: input.subject.trim(), body: input.body.trim(), updatedAt }
        : normalized;
    });
    if (!cloudAuthService.enabled) {
      const messages = applyLocalUpdate(read());
      write(messages);
      return messages.find((message) => message.id === id);
    }
    const rows = await cloudRequest<Record<string, unknown>[]>(`app_messages?id=eq.${id}&sender_id=eq.${userId}&select=*`, {
      method: "PATCH",
      headers: cloudHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify({
        subject: input.subject.trim(),
        body: input.body.trim()
      })
    });
    if (!rows[0]) throw new Error("This message could not be updated. It may have been deleted or you may not be the sender.");
    const cloudMessage = { ...fromCloudRow(rows[0]), updatedAt };
    write(read().map((message) => message.id === id ? cloudMessage : normalizeMessage(message)));
    return cloudMessage;
  },
  async deleteAsync(id: string, userId: string) {
    if (!cloudAuthService.enabled) {
      write(read().filter((message) => !(message.id === id && message.senderId === userId)).map(normalizeMessage));
      return;
    }
    const rows = await cloudRequest<Record<string, unknown>[]>(`app_messages?id=eq.${id}&sender_id=eq.${userId}&select=id`, {
      method: "DELETE",
      headers: cloudHeaders({ Prefer: "return=representation" })
    });
    if (!rows[0]) throw new Error("This message could not be deleted. It may have been deleted already or you may not be the sender.");
    write(read().filter((message) => message.id !== id).map(normalizeMessage));
  },
  async deleteManyAsync(ids: string[], userId: string) {
    for (const id of ids) {
      await this.deleteAsync(id, userId);
    }
  },
  unreadCount(user: UserProfile) {
    return this.listForUser(user).filter((message) => !message.readBy.includes(user.id)).length;
  }
};

export const roleTargetOptions: UserRole[] = ["administrator", "principal", "vice-principal", "head-of-department", "teacher"];
