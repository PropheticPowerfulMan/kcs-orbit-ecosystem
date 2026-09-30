import { SignUpProfileInput, UserProfile } from "../types/user";
import { createTemporaryPassword } from "./passwordService";

const currentUserKey = "powerful-lesson-planner:current-user-id";
const usersKey = "powerful-lesson-planner:users";
const passwordsKey = "powerful-lesson-planner:user-passwords";
const usersVersionKey = "powerful-lesson-planner:users-version";
const usersVersion = "2";
const demoPassword = "kcs2026";
const now = "2026-07-09T00:00:00.000Z";

export const mockUsers: UserProfile[] = [
  {
    id: "user-admin",
    name: "System Administrator",
    email: "admin@kcs.local",
    role: "administrator",
    department: "Administration",
    subjects: [],
    gradeClasses: [],
    status: "active",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "user-principal",
    name: "KCS Principal",
    email: "principal@kcs.local",
    role: "principal",
    department: "Administration",
    subjects: [],
    gradeClasses: [],
    status: "active",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "user-vp",
    name: "Vice Principal",
    email: "viceprincipal@kcs.local",
    role: "vice-principal",
    department: "Administration",
    subjects: [],
    gradeClasses: [],
    status: "active",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "user-hod-english",
    name: "English HOD",
    email: "english.hod@kcs.local",
    role: "head-of-department",
    department: "English",
    subjects: ["English", "English (Writing and Grammar)"],
    gradeClasses: ["Grade 7", "Grade 8", "Grade 9"],
    status: "active",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "user-teacher",
    name: "Teacher",
    email: "teacher@kcs.local",
    role: "teacher",
    department: "Teaching",
    subjects: ["English", "Mathematics", "Science"],
    gradeClasses: ["K3", "K4", "K5", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"],
    status: "active",
    createdAt: now,
    updatedAt: now
  }
];

const readUsers = (): UserProfile[] => {
  try {
    if (localStorage.getItem(usersVersionKey) !== usersVersion) return seedUsers();
    const stored = JSON.parse(localStorage.getItem(usersKey) || "[]") as UserProfile[];
    return stored.length ? stored : seedUsers();
  } catch {
    return seedUsers();
  }
};

const seedUsers = () => {
  localStorage.setItem(usersKey, JSON.stringify(mockUsers));
  localStorage.setItem(usersVersionKey, usersVersion);
  return mockUsers;
};

const readCurrentUserId = () => localStorage.getItem(currentUserKey);

const parseList = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);

const readPasswords = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(passwordsKey) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

const writePasswords = (passwords: Record<string, string>) => localStorage.setItem(passwordsKey, JSON.stringify(passwords));

export const mockAuthService = {
  demoPassword,
  listUsers() {
    return readUsers();
  },
  getCurrentUser() {
    const currentUserId = readCurrentUserId();
    if (!currentUserId) return null;
    const users = readUsers();
    return users.find((user) => user.id === currentUserId && user.status === "active") || null;
  },
  signIn(email: string, password: string) {
    const user = readUsers().find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (user && user.status !== "active") throw new Error("This account is waiting for activation by the school authority.");
    const passwords = readPasswords();
    const expectedPassword = passwords[user?.id || ""] || demoPassword;
    if (!user || password !== expectedPassword) throw new Error("Invalid email or password");
    localStorage.setItem(currentUserKey, user.id);
    return user;
  },
  signUp(input: SignUpProfileInput) {
    const users = readUsers();
    if (users.some((user) => user.email.toLowerCase() === input.email.trim().toLowerCase())) {
      throw new Error("An account already exists for this email.");
    }
    const now = new Date().toISOString();
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      department: input.department.trim() || (input.role === "teacher" ? "Teaching" : "Administration"),
      subjects: parseList(input.subjects),
      gradeClasses: parseList(input.gradeClasses),
      status: "inactive",
      createdAt: now,
      updatedAt: now
    };
    localStorage.setItem(usersKey, JSON.stringify([profile, ...users]));
    writePasswords({ ...readPasswords(), [profile.id]: input.password });
    return profile;
  },
  resetPassword(email: string) {
    const user = readUsers().find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      throw new Error("No account found for this email.");
    }
    const temporaryPassword = createTemporaryPassword();
    writePasswords({ ...readPasswords(), [user.id]: temporaryPassword });
    return temporaryPassword;
  },
  changePassword(userId: string, currentPassword: string, nextPassword: string) {
    const passwords = readPasswords();
    const expectedPassword = passwords[userId] || demoPassword;
    if (currentPassword !== expectedPassword) throw new Error("Current password is incorrect.");
    writePasswords({ ...passwords, [userId]: nextPassword });
  },
  setUserPassword(userId: string, nextPassword?: string) {
    const temporaryPassword = nextPassword?.trim() || createTemporaryPassword();
    writePasswords({ ...readPasswords(), [userId]: temporaryPassword });
    return temporaryPassword;
  },
  signOut() {
    localStorage.removeItem(currentUserKey);
  },
  updateProfile(profile: UserProfile) {
    const users = readUsers().map((user) => (user.id === profile.id ? { ...profile, updatedAt: new Date().toISOString() } : user));
    localStorage.setItem(usersKey, JSON.stringify(users));
    return users.find((user) => user.id === profile.id) || profile;
  },
  deleteUser(id: string) {
    const users = readUsers().filter((user) => user.id !== id);
    const passwords = readPasswords();
    delete passwords[id];
    localStorage.setItem(usersKey, JSON.stringify(users));
    writePasswords(passwords);
    return users;
  }
};
