export type UserRole = "administrator" | "principal" | "vice-principal" | "head-of-department" | "teacher";

export type UserStatus = "active" | "inactive";

export type AuthMode = "cloud" | "local";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  subjects: string[];
  gradeClasses: string[];
  status: UserStatus;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SignUpProfileInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: string;
  subjects: string[];
  gradeClasses: string[];
}

export type Permission =
  | "lesson:create"
  | "lesson:read:any"
  | "lesson:read:department"
  | "lesson:read:own"
  | "lesson:update:any"
  | "lesson:update:own"
  | "lesson:delete:any"
  | "lesson:delete:own"
  | "lesson:review:department"
  | "lesson:final-approve"
  | "curriculum:read"
  | "curriculum:manage"
  | "dashboard:view"
  | "reports:view"
  | "users:manage"
  | "system:manage"
  | "backup:manage";

export const roleLabels: Record<UserRole, string> = {
  administrator: "Administrator",
  principal: "Principal",
  "vice-principal": "Vice Principal",
  "head-of-department": "Head of Department",
  teacher: "Teacher"
};
