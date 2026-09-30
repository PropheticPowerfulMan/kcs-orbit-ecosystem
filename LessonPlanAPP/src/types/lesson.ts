export type Language = "en" | "fr";

export type LessonStageName =
  | "Starter"
  | "Introduction"
  | "Presentation"
  | "Guided Practice"
  | "Independent Practice"
  | "Collaborative Activity"
  | "Assessment"
  | "Closure"
  | "Homework"
  | "Reflection";

export type LessonStatus = "draft" | "submitted" | "under-review" | "revision-requested" | "approved" | "final-approved" | "rejected" | "archived" | "published";
export type LessonPlanType = "weekly" | "daily";
export type LessonActivityAction =
  | "created"
  | "updated"
  | "status-changed"
  | "submitted"
  | "review-started"
  | "approved"
  | "rejected"
  | "revision-requested"
  | "final-approved"
  | "reviewer-comment"
  | "published"
  | "archived"
  | "unarchived"
  | "duplicated"
  | "soft-deleted"
  | "restored"
  | "revision-note";

export type LessonWorkflowAction =
  | "submitted"
  | "review-started"
  | "hod-approved"
  | "revision-requested"
  | "rejected"
  | "final-approved";

export type WeeklyDayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";

export interface RepeatableItem {
  id: string;
  value: string;
}

export interface LessonStage {
  id: string;
  name: LessonStageName;
  duration: string;
  teacherActivities: string;
  studentActivities: string;
  resources: string;
  notes: string;
  attachments: string[];
  images: string[];
}

export interface WeeklyPlanDay {
  day: WeeklyDayName;
  lesson: string;
  objectives: string;
  introduction: string;
  presentation: string;
  guidedPractice: string;
  exitTicket: string;
  assessment: string;
  homework: string;
  activityDurations?: {
    introduction?: number;
    presentation?: number;
    guidedPractice?: number;
    exitTicket?: number;
  };
  lockedFields?: Partial<Record<keyof Omit<WeeklyPlanDay, "day" | "activityDurations" | "lockedFields" | "editedFields">, boolean>>;
  editedFields?: Partial<Record<keyof Omit<WeeklyPlanDay, "day" | "activityDurations" | "lockedFields" | "editedFields">, boolean>>;
}

export interface BloomQuestions {
  remember: string[];
  understand: string[];
  apply: string[];
  analyze: string[];
  evaluate: string[];
  create: string[];
}

export interface Differentiation {
  strugglingLearners: string;
  eslSupport: string;
  giftedLearners: string;
  specialNeeds: string;
  inclusiveStrategies: string;
}

export interface AssessmentPlan {
  diagnostic: string;
  formative: string;
  summative: string;
  observationChecklist: string;
  rubric: string;
  exitTicket: string;
  teacherComments: string;
}

export interface ReflectionPlan {
  whatWentWell: string;
  challenges: string;
  improvements: string;
  followUpActivities: string;
  teacherNotes: string;
}

export interface LessonVersion {
  id: string;
  savedAt: string;
  summary: string;
  snapshot: LessonPlan;
}

export interface LessonActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: LessonActivityAction;
  timestamp: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  description: string;
}

export interface LessonRevisionNote {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  note: string;
}

export interface LessonWorkflowEvent {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: LessonWorkflowAction;
  timestamp: string;
  fromStatus: LessonStatus;
  toStatus: LessonStatus;
  comment: string;
}

export interface LessonPlan {
  id: string;
  ownerId: string;
  ownerName: string;
  department: string;
  lessonNumber: string;
  planType: LessonPlanType;
  status: LessonStatus;
  tags: string[];
  schoolName: string;
  schoolYear: string;
  semester: string;
  quarter: string;
  chapter: string;
  teachers: string;
  subject: string;
  gradeClass: string;
  date: string;
  week: string;
  weekStartDate: string;
  weekEndDate: string;
  term: string;
  duration: string;
  classroom: string;
  numberOfStudents: string;
  topic: string;
  subtopic: string;
  referenceBook: string;
  learningArea: string;
  biblicalIntegration?: string;
  crossCurricularConnections: string;
  learningObjectives: RepeatableItem[];
  learningOutcomes: RepeatableItem[];
  successCriteria: RepeatableItem[];
  materialsResources: RepeatableItem[];
  vocabulary: RepeatableItem[];
  safetyConsiderations: RepeatableItem[];
  stages: LessonStage[];
  blooms: BloomQuestions;
  differentiation: Differentiation;
  assessment: AssessmentPlan;
  reflection: ReflectionPlan;
  weeklyPlan: WeeklyPlanDay[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
  deletedByName?: string;
  activityLogs: LessonActivityLog[];
  revisionNotes: LessonRevisionNote[];
  reviewerComments: LessonRevisionNote[];
  revisionRequests: LessonRevisionNote[];
  approvalHistory: LessonWorkflowEvent[];
  workflowHistory: LessonWorkflowEvent[];
  versions: LessonVersion[];
}

export interface LessonFilters {
  query: string;
  teacher: string;
  subject: string;
  grade: string;
  date: string;
  dateFrom: string;
  dateTo: string;
  topic: string;
  week: string;
  month: string;
  year: string;
  term: string;
  tags: string;
  status: "all" | LessonStatus;
}

export interface LessonTemplate {
  id: string;
  name: string;
  subject: string;
  gradeClass: string;
  learningArea: string;
  tags: string[];
  prefill: Partial<LessonPlan>;
}
