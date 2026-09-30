const resetVersionKey = "powerful-lesson-planner:final-reset-version";
const finalResetVersion = "2026-07-14-final-production-data-reset";

const keysToReset = [
  "powerful-lesson-planner:lessons",
  "powerful-lesson-planner:curriculum",
  "powerful-lesson-planner:curriculum-version",
  "powerful-lesson-planner:supabase-session",
  "powerful-lesson-planner:current-user-id",
  "powerful-lesson-planner:users",
  "powerful-lesson-planner:user-passwords",
  "powerful-lesson-planner:users-version"
];

export const applyFinalProductionReset = () => {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(resetVersionKey) === finalResetVersion) return;

  keysToReset.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(resetVersionKey, finalResetVersion);
};
