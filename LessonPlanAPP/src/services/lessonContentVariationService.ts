import { LessonPlan, WeeklyPlanDay } from "../types/lesson";
import { getProgressionDay } from "./weeklyProgressionService";
import { getSubjectStrategy } from "./subjectStrategyService";

export type WeeklyGenerationContext = Pick<Partial<LessonPlan>,
  "subject" | "gradeClass" | "chapter" | "topic" | "subtopic" | "duration" | "classroom" | "numberOfStudents" |
  "learningObjectives" | "learningOutcomes" | "successCriteria" | "vocabulary" | "materialsResources" | "assessment"
>;

export const createVariedWeeklyPlan = (context: WeeklyGenerationContext = {}): WeeklyPlanDay[] => {
  const subject = clean(context.subject, "the subject");
  const grade = clean(context.gradeClass, "the class");
  const unit = clean(stripPlanTitle(context.chapter || context.topic), "the selected unit");
  const conceptSource = [context.subtopic, context.chapter].filter(Boolean).join("; ") || stripPlanTitle(context.topic);
  const concepts = splitConcepts(conceptSource) || [unit];
  const vocabulary = listValues(context.vocabulary).slice(0, 3).join(", ");
  const materials = listValues(context.materialsResources).slice(0, 2).join(", ") || "board and learner notebooks";
  const strategy = getSubjectStrategy(subject);

  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day, index) => {
    const progression = getProgressionDay(index);
    const concept = concepts[index] || concepts[concepts.length - 1] || unit;
    const nextConcept = concepts[index + 1] || unit;
    const verb = progression.preferredActionVerbs[index % progression.preferredActionVerbs.length];
    const secondVerb = progression.preferredActionVerbs[(index + 2) % progression.preferredActionVerbs.length];
    const presentationMethod = strategy.presentationMethods[index % strategy.presentationMethods.length];
    const practiceMethod = strategy.practiceMethods[index % strategy.practiceMethods.length];
    const assessmentMethod = progression.preferredAssessmentTypes[index % progression.preferredAssessmentTypes.length];
    const homeworkType = progression.preferredHomeworkTypes[index % progression.preferredHomeworkTypes.length];

    return {
      day: day as WeeklyPlanDay["day"],
      lesson: `${concept} - ${progression.instructionalPurpose}`,
      objectives: objectiveForDay(index, grade, verb, secondVerb, concept, subject),
      introduction: `Begin with a short question, example, or review link that connects learners' prior knowledge to ${concept}.`,
      presentation: `Use ${presentationMethod} to connect ${concept} to ${subject}; refer to ${materials}${vocabulary ? ` and key vocabulary (${vocabulary})` : ""}.`,
      guidedPractice: `Learners complete a ${practiceMethod} task on ${concept}; the teacher prompts, checks ${strategy.evidence}, and gives immediate corrective feedback.`,
      exitTicket: exitTicketForDay(index, concept, verb),
      assessment: `Use ${assessmentMethod} to collect evidence of ${strategy.evidence}; use the result to adjust ${index < 4 ? nextConcept : "follow-up review"}.`,
      homework: `${homeworkType}: complete a realistic ${grade} task connected to ${concept}${index < 4 ? ` and prepare for ${nextConcept}` : " and revise the week's learning"}.`
    };
  });
};

export const createSuggestedWeeklyDay = (context: WeeklyGenerationContext, index: number) =>
  createVariedWeeklyPlan(context)[index];

const objectiveForDay = (index: number, grade: string, verb: string, secondVerb: string, concept: string, subject: string) => {
  const forms = [
    `Learners in ${grade} will ${verb} ${concept} using accurate ${subject} language.`,
    `Students are expected to ${verb} and ${secondVerb} examples related to ${concept}.`,
    `By completing the guided task, learners will ${verb} ${concept} and describe their reasoning.`,
    `At the end of the session, students will ${verb} ${concept} and justify one response.`,
    `Learners will ${verb}, ${secondVerb}, and reflect on their mastery of ${concept}.`
  ];
  return forms[index] || forms[0];
};

const exitTicketForDay = (index: number, concept: string, verb: string) => [
  `Write one precise definition or labelled example that shows you can ${verb} ${concept}.`,
  `Classify two examples of ${concept} and give one reason for each answer.`,
  `Solve or complete one short application task using ${concept}.`,
  `Correct one error about ${concept} and justify the correction.`,
  `Write a short reflection naming one mastered idea and one remaining question about ${concept}.`
][index] || `Complete one check-for-understanding task on ${concept}.`;

const listValues = (items?: { value?: string }[]) => (items || []).map((item) => item.value?.trim()).filter(Boolean) as string[];

const splitConcepts = (value: string) => {
  const parts = value
    .split(/\s*(?:\/|,|;|\band\b|\&|\+|\n)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? Array.from(new Set(parts)) : undefined;
};

const clean = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;

const stripPlanTitle = (value: unknown) => {
  if (typeof value !== "string") return "";
  const text = value.trim();
  const parts = text.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (/^(daily|weekly)\s+lesson\s+plan$/i.test(parts[0] || "")) {
    return parts[parts.length - 1] || "";
  }
  return /^(daily|weekly)\s+lesson\s+plan/i.test(text) ? "" : text;
};
