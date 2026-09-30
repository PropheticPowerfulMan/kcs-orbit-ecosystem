import { LessonPlan, WeeklyPlanDay } from "../types/lesson";
import { getProgressionDay } from "./weeklyProgressionService";

export interface DurationWarning {
  id: string;
  message: string;
}

export const getActivityDurations = (day: WeeklyPlanDay, index: number) => {
  const defaults = getProgressionDay(index).defaultDurations;
  const introduction = day.activityDurations?.introduction ?? Math.max(5, Math.round((defaults.presentation + defaults.guidedPractice + defaults.exitTicket) * 0.15));
  return {
    introduction,
    presentation: day.activityDurations?.presentation ?? defaults.presentation,
    guidedPractice: day.activityDurations?.guidedPractice ?? defaults.guidedPractice,
    exitTicket: day.activityDurations?.exitTicket ?? defaults.exitTicket
  };
};

export const distributeActivityDurations = (totalMinutes: number, day: WeeklyPlanDay, index: number) => {
  if (!hasCustomActivityDurations(day)) {
    return createDefaultActivityDurations(totalMinutes, index);
  }

  const current = getActivityDurations(day, index);
  const currentTotal = current.introduction + current.presentation + current.guidedPractice + current.exitTicket;
  const source = currentTotal > 0 ? current : getActivityDurations({ ...day, activityDurations: undefined }, index);
  const sourceTotal = source.introduction + source.presentation + source.guidedPractice + source.exitTicket || 1;
  const introduction = Math.max(0, Math.round((totalMinutes * source.introduction) / sourceTotal));
  const presentation = Math.max(0, Math.round((totalMinutes * source.presentation) / sourceTotal));
  const guidedPractice = Math.max(0, Math.round((totalMinutes * source.guidedPractice) / sourceTotal));
  const exitTicket = Math.max(0, totalMinutes - introduction - presentation - guidedPractice);

  return {
    introduction,
    presentation,
    guidedPractice,
    exitTicket
  };
};

export const createDefaultActivityDurations = (totalMinutes: number, index: number) => {
  const minutes = Math.max(1, Math.round(totalMinutes));
  const isReviewOrAssessmentDay = index >= 4;
  const ratios = isReviewOrAssessmentDay
    ? { introduction: 0.1, presentation: 0.22, guidedPractice: 0.48, exitTicket: 0.2 }
    : { introduction: 0.1, presentation: 0.3, guidedPractice: 0.5, exitTicket: 0.1 };

  const minimums = {
    introduction: minutes >= 30 ? 4 : 2,
    presentation: minutes >= 30 ? 8 : 4,
    guidedPractice: minutes >= 30 ? 10 : 5,
    exitTicket: minutes >= 30 ? 4 : 2
  };

  const introduction = clampRounded(minutes * ratios.introduction, minimums.introduction, minutes);
  const presentation = clampRounded(minutes * ratios.presentation, minimums.presentation, minutes - introduction);
  const guidedPractice = clampRounded(minutes * ratios.guidedPractice, minimums.guidedPractice, minutes - introduction - presentation);
  const exitTicket = Math.max(0, minutes - introduction - presentation - guidedPractice);

  return {
    introduction,
    presentation,
    guidedPractice,
    exitTicket
  };
};

export const analyzeDurationAllocation = (lesson: LessonPlan): DurationWarning[] => {
  const stated = parseMinutes(lesson.duration);
  if (!stated) return [];
  return (lesson.weeklyPlan || []).map((day, index) => {
    const durations = getActivityDurations(day, index);
    const total = durations.introduction + durations.presentation + durations.guidedPractice + durations.exitTicket;
    const diff = stated - total;
    if (Math.abs(diff) < 5) return undefined;
    return {
      id: `${day.day}-duration`,
      message: diff > 0 ? `${day.day}: ${diff} minutes unallocated.` : `${day.day}: activities exceed lesson duration by ${Math.abs(diff)} minutes.`
    };
  }).filter(Boolean) as DurationWarning[];
};

const hasCustomActivityDurations = (day: WeeklyPlanDay) =>
  Boolean(day.activityDurations && Object.values(day.activityDurations).some((value) => typeof value === "number"));

const clampRounded = (value: number, minimum: number, maximum: number) => {
  if (maximum <= 0) return 0;
  return Math.min(maximum, Math.max(Math.min(minimum, maximum), Math.round(value)));
};

export const parseMinutes = (value?: string) => {
  if (!value) return 0;
  const text = value.toLowerCase().replace(/\s+/g, "");
  const hourMatch = text.match(/^(\d+)h(?:(\d+))?$/);
  if (hourMatch) return Number(hourMatch[1]) * 60 + Number(hourMatch[2] || 0);
  const minMatch = text.match(/(\d+)/);
  return minMatch ? Number(minMatch[1]) : 0;
};
