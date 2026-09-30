import { LessonPlan, WeeklyPlanDay } from "../types/lesson";

export interface QualityWarning {
  id: string;
  severity: "info" | "warning";
  message: string;
  field?: string;
  suggestion: string;
}

const measurableVerbs = ["identify", "define", "list", "label", "describe", "explain", "summarize", "compare", "classify", "demonstrate", "calculate", "solve", "apply", "investigate", "analyze", "distinguish", "interpret", "justify", "evaluate", "design", "construct", "formulate", "present", "reflect", "revise", "synthesize", "assess", "create"];
const vagueWords = ["understand", "learn about", "know", "become familiar"];
const evidenceWords = ["exit ticket", "assessment", "quiz", "rubric", "check", "observe", "oral", "written", "exercise", "task", "homework", "test", "question"];
const teachingWords = ["model", "explain", "demonstrate", "present", "guide", "practice", "example", "discuss", "review", "teach", "show"];

export const analyzePlanQuality = (lesson: LessonPlan): QualityWarning[] => {
  const isDaily = lesson.planType === "daily";
  const plan = isDaily ? (lesson.weeklyPlan || []).slice(0, 1) : lesson.weeklyPlan || [];
  const warnings: QualityWarning[] = [];
  if (!isDaily) {
    checkRepeated(plan, "objectives", warnings);
    checkRepeated(plan, "assessment", warnings);
    checkRepeated(plan, "homework", warnings);
  }

  if (!lesson.teachers?.trim()) {
    warnings.push(createWarning("teacher-missing", "Setup", "Teacher is missing.", "Add the teacher name before submitting or printing the lesson plan."));
  }
  if (!lesson.subject?.trim()) {
    warnings.push(createWarning("subject-missing", "Setup", "Subject is missing.", "Choose the subject so the objectives, activities, and assessment match the curriculum."));
  }
  if (!lesson.gradeClass?.trim()) {
    warnings.push(createWarning("grade-missing", "Setup", "Grade/Class is missing.", "Choose the grade or class to keep the level of work appropriate."));
  }
  if (!lesson.chapter?.trim()) {
    warnings.push(createWarning("unit-missing", "Unit", "Unit or chapter is missing.", "Add the unit/chapter so the lesson has a clear curriculum anchor."));
  }

  if (isDaily && !lesson.date?.trim()) {
    warnings.push(createWarning("date-missing", "Date", "Daily lesson date is missing.", "Select the lesson date so the daily plan is properly scheduled."));
  }
  if (!isDaily && (!lesson.week?.trim() || !lesson.weekStartDate?.trim() || !lesson.weekEndDate?.trim())) {
    warnings.push(createWarning("week-range-missing", "Week", "Weekly schedule is incomplete.", "Add the week number, start date, and end date for a complete weekly plan."));
  }

  plan.forEach((day) => {
    const dayLabel = isDaily ? "Daily lesson" : day.day;
    const objective = normalizeText(day.objectives);
    const teachingText = normalizeText(`${day.introduction} ${day.presentation} ${day.guidedPractice}`);
    const assessmentText = normalizeText(`${day.exitTicket} ${day.assessment}`);
    if (!day.lesson?.trim()) {
      warnings.push(createWarning(`${day.day}-lesson-missing`, `${dayLabel} lesson`, `${dayLabel} has no lesson focus.`, "Write a short lesson focus that names the skill, concept, or task learners will work on."));
    }
    if (!day.objectives?.trim()) {
      warnings.push(createWarning(`${day.day}-objective-missing`, `${dayLabel} objectives`, `${dayLabel} has no objective.`, "Write one measurable objective that starts with a clear action verb."));
    }
    if (vagueWords.some((word) => objective.includes(word)) && !hasMeasurableVerb(objective)) {
      warnings.push(createWarning(`${day.day}-vague-objective`, `${dayLabel} objectives`, `${dayLabel} objective uses vague wording.`, "Replace words like understand/know with measurable verbs such as explain, demonstrate, apply, or evaluate."));
    }
    if (day.objectives?.trim() && !hasMeasurableVerb(objective)) {
      warnings.push(createWarning(`${day.day}-missing-verb`, `${dayLabel} objectives`, `${dayLabel} objective may be missing a measurable action verb.`, "Start the objective with an observable action such as identify, compare, solve, create, justify, or evaluate."));
    }
    if (!hasMeaningfulText(teachingText, teachingWords)) {
      warnings.push(createWarning(`${day.day}-teaching-missing`, `${dayLabel} teaching`, `${dayLabel} needs a teaching and practice sequence.`, "Add how the teacher will introduce the concept and how learners will practice it with support."));
    }
    if (!hasMeaningfulText(assessmentText, evidenceWords)) {
      warnings.push(createWarning(`${day.day}-assessment-missing`, `${dayLabel} assessment`, `${dayLabel} has no visible evidence check.`, "Add an exit ticket, oral check, written task, rubric, or short assessment to confirm learning."));
    }
    Object.entries(day).forEach(([key, value]) => {
      if (key !== "day" && typeof value === "string" && value.length > 260) {
        warnings.push({
          id: `${day.day}-${key}-long`,
          severity: "info",
          field: `${dayLabel} ${label(key)}`,
          message: `${dayLabel} ${label(key)} is long and may crowd the final PDF.`,
          suggestion: "Shorten it to the essential teacher action, learner action, and expected evidence."
        });
      }
    });
  });

  return warnings.slice(0, 12);
};

export const analyzeWeeklyPlanQuality = analyzePlanQuality;

type TextWeeklyKey = keyof Omit<WeeklyPlanDay, "day" | "activityDurations" | "lockedFields" | "editedFields">;

const checkRepeated = (plan: WeeklyPlanDay[], key: TextWeeklyKey, warnings: QualityWarning[]) => {
  const normalized = plan
    .map((day) => normalizeText(day[key]))
    .filter((value) => value.length > 24 && !["the selected unit", "the subject", "the class"].some((marker) => value.includes(marker)));
  if (normalized.length > 2 && new Set(normalized).size < normalized.length) {
    warnings.push(createWarning(`${key}-repeated`, label(key), `Some ${label(key)} entries repeat across days.`, "Regenerate the row or edit repeated cells so each day shows real progression."));
  }
};

const label = (key: string) => key.replace(/([A-Z])/g, " $1").toLowerCase();
const normalizeText = (value?: string) => (value || "").trim().replace(/\s+/g, " ").toLowerCase();
const hasMeasurableVerb = (value: string) => measurableVerbs.some((verb) => new RegExp(`\\b${verb}\\b`).test(value));
const hasMeaningfulText = (value: string, markers: string[]) => value.length > 18 || markers.some((marker) => value.includes(marker));

const createWarning = (id: string, field: string, message: string, suggestion: string): QualityWarning => ({
  id,
  field,
  message,
  suggestion,
  severity: "warning"
});
