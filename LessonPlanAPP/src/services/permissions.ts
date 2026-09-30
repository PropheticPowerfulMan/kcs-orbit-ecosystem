import { LessonPlan } from "../types/lesson";
import { Permission, UserProfile, UserRole } from "../types/user";

const permissionsByRole: Record<UserRole, Permission[]> = {
  administrator: [
    "lesson:create",
    "lesson:read:any",
    "lesson:update:any",
    "lesson:delete:any",
    "lesson:review:department",
    "lesson:final-approve",
    "curriculum:read",
    "curriculum:manage",
    "dashboard:view",
    "reports:view",
    "users:manage",
    "system:manage",
    "backup:manage"
  ],
  principal: ["lesson:create", "lesson:read:any", "lesson:update:any", "lesson:delete:any", "lesson:final-approve", "curriculum:read", "curriculum:manage", "dashboard:view", "reports:view", "backup:manage"],
  "vice-principal": ["lesson:create", "lesson:read:any", "lesson:update:any", "lesson:delete:any", "curriculum:read", "curriculum:manage", "dashboard:view", "reports:view", "backup:manage"],
  "head-of-department": ["lesson:create", "lesson:read:department", "lesson:update:own", "lesson:delete:own", "lesson:review:department", "curriculum:read", "curriculum:manage", "dashboard:view"],
  teacher: ["lesson:create", "lesson:read:own", "lesson:update:own", "lesson:delete:own", "curriculum:read", "dashboard:view"]
};

export const hasPermission = (user: UserProfile | null | undefined, permission: Permission) => {
  if (!user || user.status !== "active") return false;
  return permissionsByRole[user.role].includes(permission);
};

export const isLessonOwner = (user: UserProfile | null | undefined, lesson: Pick<LessonPlan, "ownerId" | "teachers">) => {
  if (!user) return false;
  return lesson.ownerId === user.id || lesson.teachers.trim().toLowerCase() === user.name.trim().toLowerCase();
};

export const isDepartmentLesson = (user: UserProfile | null | undefined, lesson: Pick<LessonPlan, "department" | "subject">) => {
  if (!user) return false;
  const departmentMatch = Boolean(lesson.department && lesson.department === user.department);
  const subjectMatch = user.subjects.some((subject) => subject.toLowerCase() === lesson.subject.toLowerCase());
  return departmentMatch || subjectMatch;
};

export const canViewLesson = (user: UserProfile | null | undefined, lesson: LessonPlan) =>
  hasPermission(user, "lesson:read:any") ||
  (hasPermission(user, "lesson:read:department") && isDepartmentLesson(user, lesson)) ||
  (hasPermission(user, "lesson:read:own") && isLessonOwner(user, lesson));

export const canEditLesson = (user: UserProfile | null | undefined, lesson: LessonPlan) =>
  hasPermission(user, "lesson:update:any") || (hasPermission(user, "lesson:update:own") && isLessonOwner(user, lesson));

export const canDeleteLesson = (user: UserProfile | null | undefined, lesson: LessonPlan) =>
  hasPermission(user, "lesson:delete:any") || (hasPermission(user, "lesson:delete:own") && isLessonOwner(user, lesson));

export const canReviewLesson = (user: UserProfile | null | undefined, lesson: LessonPlan) =>
  hasPermission(user, "lesson:update:any") || (hasPermission(user, "lesson:review:department") && isDepartmentLesson(user, lesson));

export const canFinalApproveLesson = (user: UserProfile | null | undefined, lesson: LessonPlan) =>
  canViewLesson(user, lesson) && hasPermission(user, "lesson:final-approve");

export const applyLessonVisibility = (user: UserProfile | null | undefined, lessons: LessonPlan[]) => lessons.filter((lesson) => canViewLesson(user, lesson));

export const prepareNewLessonForUser = <T extends LessonPlan>(lesson: T, user: UserProfile): T => ({
  ...lesson,
  ownerId: user.id,
  ownerName: user.name,
  teachers: lesson.teachers || user.name,
  department: lesson.department || user.department,
  subject: lesson.subject || "",
  gradeClass: lesson.gradeClass || ""
});
