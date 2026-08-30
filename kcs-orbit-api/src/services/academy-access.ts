export const ACADEMY_ALLOWED_ROLES = ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;
export type AcademyRole = typeof ACADEMY_ALLOWED_ROLES[number];
const allowed = new Set<string>(ACADEMY_ALLOWED_ROLES);
export function isAcademyRole(role: string): role is AcademyRole { return allowed.has(role); }
