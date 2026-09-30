import { FormEvent, useEffect, useMemo, useState } from "react";
import { Edit3, Mail, Search, Send, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Input, Select, Textarea } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../components/Toast";
import { useAuth } from "../contexts/AuthContext";
import { AppMessage, MessageAudience, messageRepository, roleTargetOptions } from "../services/messageRepository";
import { roleLabels } from "../types/user";

export const Messages = () => {
  const { currentUser, users, can } = useAuth();
  const { notify } = useToast();
  const [audience, setAudience] = useState<MessageAudience>("all");
  const [target, setTarget] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [senderFilter, setSenderFilter] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [readFilter, setReadFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openMessage, setOpenMessage] = useState<AppMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<AppMessage | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!currentUser) return;
    let mounted = true;
    messageRepository.listForUserAsync(currentUser).then((nextMessages) => {
      if (mounted) setMessages(nextMessages);
    }).catch((error) => notify(error instanceof Error ? error.message : "Unable to load messages."));
    return () => {
      mounted = false;
    };
  }, [currentUser, notify, version]);

  const filteredMessages = useMemo(() => {
    if (!currentUser) return [];
    const terms = query.toLowerCase().split(/\s+/).map((term) => term.trim()).filter(Boolean);
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NaN;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Number.NaN;
    return messages.filter((message) => {
      const haystack = [
        message.subject,
        message.body,
        message.senderName,
        message.audience,
        message.target,
        new Date(message.createdAt).toLocaleString()
      ].join(" ").toLowerCase();
      const createdTime = new Date(message.createdAt).getTime();
      const isUnread = !message.readBy.includes(currentUser.id);
      return (
        terms.every((term) => haystack.includes(term)) &&
        (!senderFilter || message.senderId === senderFilter) &&
        (!audienceFilter || message.audience === audienceFilter) &&
        (!readFilter || (readFilter === "unread" ? isUnread : !isUnread)) &&
        (!dateFrom || (!Number.isNaN(createdTime) && createdTime >= fromTime)) &&
        (!dateTo || (!Number.isNaN(createdTime) && createdTime <= toTime))
      );
    });
  }, [audienceFilter, currentUser, dateFrom, dateTo, messages, query, readFilter, senderFilter]);
  const departments = useMemo(() => Array.from(new Set(users.map((user) => user.department).filter(Boolean))).sort(), [users]);
  const canBroadcast = Boolean(currentUser && (can("users:manage") || ["administrator", "principal", "vice-principal", "head-of-department"].includes(currentUser.role)));
  const ownVisibleMessageIds = useMemo(() => currentUser ? filteredMessages.filter((message) => message.senderId === currentUser.id).map((message) => message.id) : [], [currentUser, filteredMessages]);
  const selectedOwnMessageIds = useMemo(() => selectedIds.filter((id) => ownVisibleMessageIds.includes(id)), [ownVisibleMessageIds, selectedIds]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentUser) return;
    if (!subject.trim() || !body.trim() || sending) return;
    setSending(true);
    try {
      await messageRepository.sendAsync({
        sender: currentUser,
        audience: canBroadcast ? audience : "role",
        target: canBroadcast ? target : "administrator",
        subject,
        body
      });
      setSubject("");
      setBody("");
      setVersion((value) => value + 1);
      notify("Message sent");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const startEdit = (message: AppMessage) => {
    setEditingMessage(message);
    setEditSubject(message.subject);
    setEditBody(message.body);
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingMessage || !currentUser || !editSubject.trim() || !editBody.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const updated = await messageRepository.updateAsync(editingMessage.id, currentUser.id, {
        subject: editSubject,
        body: editBody
      });
      setEditingMessage(null);
      setOpenMessage((message) => message?.id === updated?.id ? updated || message : message);
      setVersion((value) => value + 1);
      notify("Message updated");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update message.");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteMessage = async (message: AppMessage) => {
    if (!currentUser || message.senderId !== currentUser.id || deleting) return;
    const confirmed = window.confirm("Delete this message for everyone?");
    if (!confirmed) return;
    setDeleting(true);
    try {
      await messageRepository.deleteAsync(message.id, currentUser.id);
      setOpenMessage((current) => current?.id === message.id ? null : current);
      setEditingMessage((current) => current?.id === message.id ? null : current);
      setSelectedIds((ids) => ids.filter((id) => id !== message.id));
      setVersion((value) => value + 1);
      notify("Message deleted");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to delete message.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  };

  const toggleAllOwnVisible = () => {
    setSelectedIds((ids) => {
      const allSelected = ownVisibleMessageIds.length > 0 && ownVisibleMessageIds.every((id) => ids.includes(id));
      return allSelected
        ? ids.filter((id) => !ownVisibleMessageIds.includes(id))
        : Array.from(new Set([...ids, ...ownVisibleMessageIds]));
    });
  };

  const deleteSelectedMessages = async () => {
    if (!currentUser || selectedOwnMessageIds.length === 0 || deleting) return;
    const confirmed = window.confirm(`Delete ${selectedOwnMessageIds.length} selected message${selectedOwnMessageIds.length === 1 ? "" : "s"} for everyone?`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      await messageRepository.deleteManyAsync(selectedOwnMessageIds, currentUser.id);
      setOpenMessage((message) => message && selectedOwnMessageIds.includes(message.id) ? null : message);
      setEditingMessage((message) => message && selectedOwnMessageIds.includes(message.id) ? null : message);
      setSelectedIds((ids) => ids.filter((id) => !selectedOwnMessageIds.includes(id)));
      setVersion((value) => value + 1);
      notify("Selected messages deleted");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to delete selected messages.");
    } finally {
      setDeleting(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <Card className="p-4">
        <h1 className="flex items-center gap-2 text-2xl font-black text-white"><Mail size={22} /> Communication</h1>
        <form className="mt-4 space-y-3" onSubmit={submit}>
          {canBroadcast && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Audience">
                <Select value={audience} onChange={(event) => { setAudience(event.target.value as MessageAudience); setTarget(""); }}>
                  <option value="all">Everyone</option>
                  <option value="role">Role</option>
                  <option value="department">Department</option>
                  <option value="user">User</option>
                </Select>
              </Field>
              <Field label="Target">
                <Select value={target} onChange={(event) => setTarget(event.target.value)} disabled={audience === "all"}>
                  <option value="">Choose target</option>
                  {audience === "role" && roleTargetOptions.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  {audience === "department" && departments.map((department) => <option key={department} value={department}>{department}</option>)}
                  {audience === "user" && users.map((user) => <option key={user.id} value={user.id}>{user.name} - {roleLabels[user.role]}</option>)}
                </Select>
              </Field>
            </div>
          )}
          <Field label="Subject"><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
          <Field label="Message"><Textarea className="min-h-36" value={body} onChange={(event) => setBody(event.target.value)} /></Field>
          <Button type="submit" disabled={sending || !subject.trim() || !body.trim() || (canBroadcast && audience !== "all" && !target)}>
            <Send size={16} /> Send
          </Button>
        </form>
      </Card>
      <div className="space-y-3">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Search size={17} className="text-cyan-200" />
            <p className="text-sm font-black text-white">Search messages</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Keywords"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="subject, content, sender..." /></Field>
            <Field label="Sender">
              <Select value={senderFilter} onChange={(event) => setSenderFilter(event.target.value)}>
                <option value="">Any sender</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </Select>
            </Field>
            <Field label="Audience">
              <Select value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value)}>
                <option value="">Any audience</option>
                <option value="all">Everyone</option>
                <option value="role">Role</option>
                <option value="department">Department</option>
                <option value="user">User</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={readFilter} onChange={(event) => setReadFilter(event.target.value)}>
                <option value="">Read and unread</option>
                <option value="unread">Unread only</option>
                <option value="read">Read only</option>
              </Select>
            </Field>
            <Field label="From"><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></Field>
            <Field label="To"><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-muted-foreground">{filteredMessages.length} of {messages.length} message{messages.length === 1 ? "" : "s"} shown</p>
            <div className="flex flex-wrap gap-2">
              {ownVisibleMessageIds.length > 0 && (
                <>
                  <Button variant="outline" className="h-8 px-3" onClick={toggleAllOwnVisible}>
                    {ownVisibleMessageIds.every((id) => selectedIds.includes(id)) ? "Clear selection" : "Select sent"}
                  </Button>
                  <Button variant="outline" className="h-8 px-3" disabled={deleting || selectedOwnMessageIds.length === 0} onClick={deleteSelectedMessages}>
                    <Trash2 size={14} /> Delete selected
                  </Button>
                </>
              )}
              <Button variant="outline" className="h-8 px-3" onClick={() => { setQuery(""); setSenderFilter(""); setAudienceFilter(""); setReadFilter(""); setDateFrom(""); setDateTo(""); }}>Clear filters</Button>
            </div>
          </div>
        </Card>
        {filteredMessages.map((message) => (
          <Card
            key={message.id}
            className="cursor-pointer p-4 transition hover:border-cyan-300/35 hover:bg-cyan-500/10"
            onClick={async () => {
              await messageRepository.markReadAsync(message.id, currentUser.id).catch((error) => notify(error instanceof Error ? error.message : "Unable to mark message as read."));
              setOpenMessage(message);
              setVersion((value) => value + 1);
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-3">
                {message.senderId === currentUser.id && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-cyan-300"
                    checked={selectedIds.includes(message.id)}
                    aria-label="Select message"
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => toggleSelection(message.id)}
                  />
                )}
                <div className="min-w-0">
                  <p className="break-words font-black text-white">{message.subject}</p>
                  <p className="text-xs font-bold text-cyan-100">{message.senderName} - {new Date(message.createdAt).toLocaleString()}{message.updatedAt && message.updatedAt !== message.createdAt ? " - edited" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {message.senderId === currentUser.id && (
                  <>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      title="Edit message"
                      onClick={(event) => {
                        event.stopPropagation();
                        startEdit(message);
                      }}
                    >
                      <Edit3 size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      disabled={deleting}
                      title="Delete message"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteMessage(message);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </>
                )}
                {!message.readBy.includes(currentUser.id) && <span className="rounded-sm bg-amber-400 px-2 py-1 text-xs font-black text-slate-950">New</span>}
              </div>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{message.body}</p>
          </Card>
        ))}
        {filteredMessages.length === 0 && <Card className="p-8 text-center text-muted-foreground">No messages match this search.</Card>}
      </div>
      <Dialog open={Boolean(openMessage)} title={openMessage?.subject || "Message"} onClose={() => setOpenMessage(null)} size="message">
        {openMessage && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="shrink-0 rounded-md border border-cyan-300/15 bg-white/[0.04] p-3">
              <p className="text-sm font-black text-white">{openMessage.subject}</p>
              <p className="mt-1 text-xs font-bold text-cyan-100">From {openMessage.senderName} - {new Date(openMessage.createdAt).toLocaleString()}{openMessage.updatedAt && openMessage.updatedAt !== openMessage.createdAt ? " - edited" : ""}</p>
              <p className="mt-1 text-xs text-muted-foreground">Audience: {audienceLabel(openMessage.audience)}{openMessage.target ? ` - ${resolveTargetLabel(openMessage, users)}` : ""}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-md border border-cyan-300/15 bg-card/80 p-4">
              <p className="whitespace-pre-line text-sm leading-6 text-foreground">{openMessage.body}</p>
            </div>
            {openMessage.senderId === currentUser.id && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="outline" onClick={() => startEdit(openMessage)}><Edit3 size={16} /> Edit</Button>
                <Button variant="outline" onClick={() => deleteMessage(openMessage)}><Trash2 size={16} /> Delete</Button>
              </div>
            )}
          </div>
        )}
      </Dialog>
      <Dialog open={Boolean(editingMessage)} title="Edit message" onClose={() => setEditingMessage(null)} size="message">
        <form className="flex h-full min-h-0 flex-col gap-3" onSubmit={saveEdit}>
          <div className="shrink-0">
            <Field label="Subject"><Input value={editSubject} onChange={(event) => setEditSubject(event.target.value)} /></Field>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <Label>Message</Label>
            <Textarea className="min-h-0 flex-1 resize-none overflow-auto" value={editBody} onChange={(event) => setEditBody(event.target.value)} />
          </div>
          <div className="relative z-10 flex shrink-0 flex-wrap gap-2 border-t border-cyan-300/15 pt-3">
            <Button type="submit" disabled={savingEdit || !editSubject.trim() || !editBody.trim()}><Edit3 size={16} /> Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditingMessage(null)}>Cancel</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

const audienceLabel = (audience: MessageAudience) => ({
  all: "Everyone",
  role: "Role",
  department: "Department",
  user: "User"
})[audience];

const resolveTargetLabel = (message: AppMessage, users: ReturnType<typeof useAuth>["users"]) => {
  if (message.audience === "role") return roleLabels[message.target as keyof typeof roleLabels] || message.target;
  if (message.audience === "user") return users.find((user) => user.id === message.target)?.name || message.target;
  return message.target;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="space-y-1">
    <Label>{label}</Label>
    {children}
  </label>
);
