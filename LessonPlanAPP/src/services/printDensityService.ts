import { LessonPlan } from "../types/lesson";

export type PrintDensity = "comfortable" | "compact" | "ultra-compact";

export const getPrintDensity = (lesson: LessonPlan): PrintDensity => {
  const chars = (lesson.weeklyPlan || [])
    .flatMap((day) => [day.lesson, day.objectives, day.introduction, day.presentation, day.guidedPractice, day.exitTicket, day.assessment, day.homework])
    .join(" ").length;
  if (chars > 5200) return "ultra-compact";
  if (chars > 3600) return "compact";
  return "comfortable";
};

export const isLikelyOversizedForOnePage = (lesson: LessonPlan) => getPrintDensity(lesson) === "ultra-compact";
