import { WeeklyDayName } from "../types/lesson";

export interface WeeklyProgressionDay {
  day: WeeklyDayName;
  instructionalPurpose: string;
  bloomLevels: string[];
  preferredActionVerbs: string[];
  preferredActivityTypes: string[];
  preferredAssessmentTypes: string[];
  preferredHomeworkTypes: string[];
  defaultDurations: {
    presentation: number;
    guidedPractice: number;
    exitTicket: number;
  };
}

export const defaultWeeklyProgression: WeeklyProgressionDay[] = [
  {
    day: "Monday",
    instructionalPurpose: "Introduction and foundational knowledge",
    bloomLevels: ["remember", "understand"],
    preferredActionVerbs: ["identify", "define", "list", "label", "recognize"],
    preferredActivityTypes: ["direct instruction", "visual explanation", "guided questioning"],
    preferredAssessmentTypes: ["oral questioning", "notebook check"],
    preferredHomeworkTypes: ["vocabulary review", "short examples"],
    defaultDurations: { presentation: 18, guidedPractice: 20, exitTicket: 7 }
  },
  {
    day: "Tuesday",
    instructionalPurpose: "Development and explanation",
    bloomLevels: ["understand", "analyze"],
    preferredActionVerbs: ["explain", "classify", "compare", "describe", "demonstrate"],
    preferredActivityTypes: ["worked example", "concept sorting", "peer explanation"],
    preferredAssessmentTypes: ["mini whiteboard response", "worksheet review"],
    preferredHomeworkTypes: ["classification exercise", "reading task"],
    defaultDurations: { presentation: 15, guidedPractice: 23, exitTicket: 7 }
  },
  {
    day: "Wednesday",
    instructionalPurpose: "Skill building and guided application",
    bloomLevels: ["apply"],
    preferredActionVerbs: ["apply", "calculate", "solve", "construct", "demonstrate"],
    preferredActivityTypes: ["problem modelling", "scaffolded problem set", "board practice"],
    preferredAssessmentTypes: ["problem-solving task", "teacher conference"],
    preferredHomeworkTypes: ["problem set", "practice quiz"],
    defaultDurations: { presentation: 12, guidedPractice: 26, exitTicket: 7 }
  },
  {
    day: "Thursday",
    instructionalPurpose: "Independent application, analysis, or investigation",
    bloomLevels: ["analyze", "evaluate"],
    preferredActionVerbs: ["investigate", "analyze", "distinguish", "interpret", "justify"],
    preferredActivityTypes: ["case study", "error analysis", "small-group task"],
    preferredAssessmentTypes: ["performance task", "rubric"],
    preferredHomeworkTypes: ["real-life observation", "correction of errors"],
    defaultDurations: { presentation: 10, guidedPractice: 28, exitTicket: 7 }
  },
  {
    day: "Friday",
    instructionalPurpose: "Review, consolidation, assessment, and reflection",
    bloomLevels: ["evaluate", "create"],
    preferredActionVerbs: ["review", "synthesize", "assess", "reflect", "present"],
    preferredActivityTypes: ["mixed review", "reflection", "presentation"],
    preferredAssessmentTypes: ["short quiz", "self-assessment", "exit ticket analysis"],
    preferredHomeworkTypes: ["review task", "reflection", "extension task"],
    defaultDurations: { presentation: 10, guidedPractice: 20, exitTicket: 15 }
  }
];

export const getProgressionDay = (index: number, progression = defaultWeeklyProgression) =>
  progression[index] || progression[progression.length - 1];
