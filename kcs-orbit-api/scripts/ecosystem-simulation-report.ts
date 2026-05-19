import fs from "node:fs";
import path from "node:path";
import {
  AnnouncementPublishedSchema,
  AttendanceUpsertSchema,
  ClassUpsertSchema,
  ParentUpsertSchema,
  PaymentCreatedSchema,
  StudentUpsertSchema,
  TeacherUpsertSchema,
  GradeUpsertSchema,
  buildCanonicalExternalId,
  type RoleAudience,
} from "../../packages/shared-contracts/src/index.ts";

type GradeLevel =
  | "K1"
  | "K2"
  | "K3"
  | "K4"
  | "K5"
  | "Grade 1"
  | "Grade 2"
  | "Grade 3"
  | "Grade 4"
  | "Grade 5"
  | "Grade 6"
  | "Grade 7"
  | "Grade 8"
  | "Grade 9"
  | "Grade 10"
  | "Grade 11"
  | "Grade 12";

type PaymentPlanType = "FULL_ANNUAL" | "TWO_INSTALLMENTS" | "THREE_INSTALLMENTS" | "MONTHLY" | "CUSTOM_AGREEMENT";
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";
type NotificationType =
  | "ATTENDANCE_CHANGE"
  | "GRADE_ENTERED"
  | "PAYMENT_UPDATE"
  | "FORUM_ACTIVITY"
  | "SCHEDULE_CHANGE"
  | "HOMEWORK_DEADLINE"
  | "ACADEMIC_RISK"
  | "PAYMENT_OVERDUE"
  | "ASSIGNMENT_SUBMITTED"
  | "ANNOUNCEMENT";

type Severity = "LOW" | "MEDIUM" | "HIGH";
type PaymentStatus = "COMPLETED" | "PENDING" | "FAILED";
type SyncTarget = "student-dashboard" | "parent-dashboard" | "teacher-dashboard" | "ai-assistant" | "analytics" | "notification-engine";

type ParentSeed = {
  familyName: string;
  parentName: string;
  email: string;
  phone: string;
  relationship: string;
  children: Array<{
    firstName: string;
    gradeLevel: GradeLevel;
    section: string;
    age: number;
    profile: PerformanceProfile;
    planType: PaymentPlanType;
    caseTag: "A" | "B" | "C" | "D" | "E";
  }>;
};

type PerformanceProfile = {
  baselineAverage: number;
  attendanceRate: number;
  weakSubjects: string[];
  missingAssignments: number;
  behavior: "excellent" | "good" | "watch";
  comment: string;
};

type Student = {
  id: string;
  orbitExternalId: string;
  savanexExternalId: string;
  edupayExternalId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  age: number;
  gradeLevel: GradeLevel;
  section: string;
  className: string;
  classId: string;
  studentNumber: string;
  accessCode: string;
  parentId: string;
  parentName: string;
  assignedTeachers: string[];
  schedule: ScheduleSlot[];
  performance: PerformanceProfile;
};

type Parent = {
  id: string;
  orbitExternalId: string;
  savanexExternalId: string;
  kcsNexusExternalId: string;
  familyId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: string;
  children: Student[];
};

type Teacher = {
  id: string;
  externalId: string;
  fullName: string;
  email: string;
  phone: string;
  employeeId: string;
  role: "TEACHER";
  subjects: string[];
  classes: string[];
  permissions: string[];
  schedule: ScheduleSlot[];
};

type Staff = {
  id: string;
  externalId: string;
  fullName: string;
  email: string;
  phone: string;
  role: "STAFF" | "SUPER_ADMIN";
  department: string;
  permissions: string[];
  schedule: ScheduleSlot[];
};

type ScheduleSlot = {
  day: string;
  start: string;
  end: string;
  subject: string;
  room: string;
  teacher: string;
};

type TuitionPlan = {
  type: PaymentPlanType;
  label: string;
  planDiscountRate: number;
  finalAmount: number;
  familyDiscountAmount: number;
  planDiscountAmount: number;
  installments: Installment[];
};

type Installment = {
  id: string;
  label: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: "SCHEDULED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
  studentId: string;
  studentName: string;
};

type PaymentInstruction = {
  paymentId: string;
  parentId: string;
  parentName: string;
  paymentDate: string;
  amount: number;
  method: string;
  reference: string;
  status: PaymentStatus;
  scenario: string;
  allocationMode: "AUTOMATIC" | "MANUAL";
  manualAllocations?: Array<{ studentId: string; installmentId: string; amount: number }>;
};

type AllocationLine = {
  studentId: string;
  studentName: string;
  installmentId: string;
  installmentLabel: string;
  amount: number;
};

type Receipt = {
  receiptId: string;
  paymentId: string;
  parentName: string;
  amount: number;
  method: string;
  date: string;
  lines: AllocationLine[];
  remainingUnallocated: number;
};

type AcademicRecord = {
  studentId: string;
  subject: string;
  assignments: Array<{ title: string; score: number; maxScore: number; submitted: boolean }>;
  quizzes: Array<{ title: string; score: number; maxScore: number }>;
  tests: Array<{ title: string; score: number; maxScore: number }>;
  exams: Array<{ title: string; score: number; maxScore: number }>;
  homework: Array<{ title: string; status: "SUBMITTED" | "MISSING" | "LATE" }>;
  teacherComment: string;
  behaviorNote: string;
  average: number;
};

type AttendanceRecord = {
  studentId: string;
  date: string;
  status: AttendanceStatus;
};

type RiskProfile = {
  studentId: string;
  studentName: string;
  attendanceRate: number;
  academicAverage: number;
  missingAssignments: number;
  paymentRisk: "LOW" | "MEDIUM" | "HIGH";
  academicRisk: "LOW" | "MEDIUM" | "HIGH";
  overallRisk: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
};

type DashboardSnapshot = {
  role: string;
  audienceSize: number;
  widgets: string[];
  sampleInsights: string[];
};

type ForumMessage = {
  author: string;
  role: string;
  timestamp: string;
  content: string;
  readBy: number;
  unreadBy: number;
};

type ForumThread = {
  forumName: string;
  category: string;
  title: string;
  pinned: boolean;
  messages: ForumMessage[];
  moderationLog: string[];
};

type Notification = {
  id: string;
  type: NotificationType;
  audience: RoleAudience[];
  title: string;
  message: string;
  severity: Severity;
  createdAt: string;
  isRead: boolean;
  source: string;
};

type SyncEvent = {
  id: string;
  domain: string;
  source: string;
  description: string;
  targets: SyncTarget[];
  contractValidated: boolean;
  success: boolean;
  warning?: string;
};

type LiveProbeResult = {
  service: string;
  url: string;
  requests: number;
  reachableResponses: number;
  healthyResponses: number;
  networkFailures: number;
  averageLatencyMs: number;
  maxLatencyMs: number;
  lastStatus: number | null;
};

type LiveProbeOptions = {
  profile: "standard" | "intense";
  requestsPerService: number;
  timeoutMs: number;
  concurrency: number;
};

type ValidationCounter = {
  parents: number;
  teachers: number;
  students: number;
  classes: number;
  grades: number;
  attendance: number;
  payments: number;
  announcements: number;
};

const ORGANIZATION_ID = "kcs-core-simulation";
const NOW = new Date("2026-05-18T10:30:00.000Z");
const ACADEMIC_YEAR = "2025-2026";
const REPORT_STAMP = NOW.toISOString().slice(0, 10).replace(/-/g, "");
const ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DIR = path.join(ROOT, "var");
const REPORT_PATH = path.join(OUTPUT_DIR, `ecosystem-simulation-report-${REPORT_STAMP}.md`);
const JSON_PATH = path.join(OUTPUT_DIR, `ecosystem-simulation-report-${REPORT_STAMP}.json`);

const GRADE_ORDER: GradeLevel[] = [
  "K1",
  "K2",
  "K3",
  "K4",
  "K5",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

const BASE_TUITION: Record<GradeLevel, number> = {
  K1: 2700,
  K2: 2750,
  K3: 3082.5,
  K4: 3082.5,
  K5: 3082.5,
  "Grade 1": 3770,
  "Grade 2": 3770,
  "Grade 3": 3770,
  "Grade 4": 3770,
  "Grade 5": 3770,
  "Grade 6": 4200,
  "Grade 7": 4200,
  "Grade 8": 4200,
  "Grade 9": 4750,
  "Grade 10": 4750,
  "Grade 11": 4750,
  "Grade 12": 4750,
};

const PLAN_METADATA: Record<PaymentPlanType, { label: string; discountRate: number }> = {
  FULL_ANNUAL: { label: "Full annual plan", discountRate: 10 },
  TWO_INSTALLMENTS: { label: "Two-installment plan", discountRate: 5 },
  THREE_INSTALLMENTS: { label: "Three-installment plan", discountRate: 2 },
  MONTHLY: { label: "Monthly plan", discountRate: 0 },
  CUSTOM_AGREEMENT: { label: "Custom agreement plan", discountRate: 3 },
};

const SUBJECTS_BY_LEVEL: Array<{ match: (grade: GradeLevel) => boolean; subjects: string[] }> = [
  { match: (grade) => grade.startsWith("K"), subjects: ["Literacy", "Numeracy", "Bible", "Discovery", "Art"] },
  {
    match: (grade) => /Grade [1-5]/.test(grade),
    subjects: ["English", "Mathematics", "Science", "Social Studies", "Bible", "French"],
  },
  {
    match: (grade) => /Grade [6-8]/.test(grade),
    subjects: ["English", "Mathematics", "Integrated Science", "History", "Bible", "French", "ICT"],
  },
  {
    match: (grade) => /Grade (9|10|11|12)/.test(grade),
    subjects: ["English", "Mathematics", "Biology", "Chemistry", "History", "Bible", "ICT"],
  },
];

const TEACHER_SEEDS = [
  { name: "Lydia Mbayo", email: "lydia.mbayo@kcs.local", phone: "+243 810 200 101", employeeId: "EMP-T-001", subjects: ["Literacy", "Numeracy"], classes: ["K1 A", "K2 A"], room: "E1" },
  { name: "Esther Kalala", email: "esther.kalala@kcs.local", phone: "+243 810 200 102", employeeId: "EMP-T-002", subjects: ["Literacy", "Discovery"], classes: ["K3 A", "K4 A", "K5 B"], room: "E2" },
  { name: "Joel Mutombo", email: "joel.mutombo@kcs.local", phone: "+243 810 200 103", employeeId: "EMP-T-003", subjects: ["English", "Social Studies"], classes: ["Grade 1 A", "Grade 2 A", "Grade 3 B"], room: "P1" },
  { name: "Grace Banza", email: "grace.banza@kcs.local", phone: "+243 810 200 104", employeeId: "EMP-T-004", subjects: ["Mathematics", "Science"], classes: ["Grade 4 B", "Grade 5 A", "Grade 6 A"], room: "P2" },
  { name: "Paul Nsimba", email: "paul.nsimba@kcs.local", phone: "+243 810 200 105", employeeId: "EMP-T-005", subjects: ["English", "History"], classes: ["Grade 7 B", "Grade 8 A"], room: "M1" },
  { name: "Ruth Mavungu", email: "ruth.mavungu@kcs.local", phone: "+243 810 200 106", employeeId: "EMP-T-006", subjects: ["Mathematics"], classes: ["Grade 9 A", "Grade 10 B", "Grade 11 A", "Grade 12 A"], room: "S1" },
  { name: "Daniel Kanku", email: "daniel.kanku@kcs.local", phone: "+243 810 200 107", employeeId: "EMP-T-007", subjects: ["Biology", "Chemistry", "Integrated Science"], classes: ["Grade 6 A", "Grade 7 B", "Grade 8 A", "Grade 9 A", "Grade 10 B", "Grade 11 A", "Grade 12 A"], room: "S2" },
  { name: "Sarah Bilonda", email: "sarah.bilonda@kcs.local", phone: "+243 810 200 108", employeeId: "EMP-T-008", subjects: ["French", "Bible"], classes: ["Grade 1 A", "Grade 2 A", "Grade 3 B", "Grade 4 B", "Grade 5 A", "Grade 6 A", "Grade 7 B", "Grade 8 A"], room: "L1" },
  { name: "Patrick Luse", email: "patrick.luse@kcs.local", phone: "+243 810 200 109", employeeId: "EMP-T-009", subjects: ["ICT"], classes: ["Grade 6 A", "Grade 7 B", "Grade 8 A", "Grade 9 A", "Grade 10 B", "Grade 11 A", "Grade 12 A"], room: "ICT" },
  { name: "Mireille Wema", email: "mireille.wema@kcs.local", phone: "+243 810 200 110", employeeId: "EMP-T-010", subjects: ["Bible", "Counseling"], classes: GRADE_ORDER.map((grade) => `${grade} ${grade.startsWith("K") ? "A" : "A"}`), room: "CL" },
] as const;

const STAFF_SEEDS = [
  { name: "Alice Ngoy", email: "alice.ngoy@kcs.local", phone: "+243 810 300 201", role: "STAFF" as const, department: "Registrar", permissions: ["directory.manage", "enrollment.manage", "reports.view"] },
  { name: "Michel Kabeya", email: "michel.kabeya@kcs.local", phone: "+243 810 300 202", role: "STAFF" as const, department: "Finance", permissions: ["payments.manage", "receipts.issue", "debts.manage"] },
  { name: "Solange Mputu", email: "solange.mputu@kcs.local", phone: "+243 810 300 203", role: "STAFF" as const, department: "Student Support", permissions: ["attendance.view", "behavior.manage", "risk.followup"] },
  { name: "David Mavunda", email: "david.mavunda@kcs.local", phone: "+243 810 300 204", role: "STAFF" as const, department: "Operations", permissions: ["announcements.publish", "schedule.manage", "notifications.broadcast"] },
  { name: "Isaac Mbuyi", email: "isaac.mbuyi@kcs.local", phone: "+243 810 300 205", role: "SUPER_ADMIN" as const, department: "Executive", permissions: ["system.full_access", "orbit.admin", "nexus.admin", "edupay.admin", "edusync.admin"] },
] as const;

const PARENT_SEEDS: ParentSeed[] = [
  {
    familyName: "Kabongo",
    parentName: "Rachel Kabongo",
    email: "rachel.kabongo@family.kcs",
    phone: "+243 822 100 001",
    relationship: "Mother",
    children: [
      { firstName: "Aimee", gradeLevel: "K3", section: "A", age: 5, profile: { baselineAverage: 86, attendanceRate: 97, weakSubjects: [], missingAssignments: 0, behavior: "excellent", comment: "Confident reader and joyful in class." }, planType: "MONTHLY", caseTag: "A" },
      { firstName: "Naomi", gradeLevel: "Grade 2", section: "A", age: 7, profile: { baselineAverage: 88, attendanceRate: 96, weakSubjects: ["French"], missingAssignments: 1, behavior: "good", comment: "Strong numeracy, needs a little confidence in French oral work." }, planType: "FULL_ANNUAL", caseTag: "A" },
      { firstName: "Ethan", gradeLevel: "Grade 6", section: "A", age: 11, profile: { baselineAverage: 79, attendanceRate: 91, weakSubjects: ["History"], missingAssignments: 1, behavior: "good", comment: "Good science curiosity and steady homework habits." }, planType: "TWO_INSTALLMENTS", caseTag: "A" },
      { firstName: "Grace", gradeLevel: "Grade 10", section: "B", age: 15, profile: { baselineAverage: 84, attendanceRate: 94, weakSubjects: ["Chemistry"], missingAssignments: 1, behavior: "good", comment: "Leadership is growing; chemistry revision still needed." }, planType: "THREE_INSTALLMENTS", caseTag: "A" },
    ],
  },
  {
    familyName: "Ilunga",
    parentName: "Jean-Pierre Ilunga",
    email: "jp.ilunga@family.kcs",
    phone: "+243 822 100 002",
    relationship: "Father",
    children: [
      { firstName: "Joel", gradeLevel: "K4", section: "A", age: 6, profile: { baselineAverage: 78, attendanceRate: 89, weakSubjects: ["Numeracy"], missingAssignments: 1, behavior: "good", comment: "Improving attention span with teacher prompts." }, planType: "THREE_INSTALLMENTS", caseTag: "B" },
      { firstName: "Deborah", gradeLevel: "Grade 4", section: "B", age: 9, profile: { baselineAverage: 74, attendanceRate: 87, weakSubjects: ["Science", "French"], missingAssignments: 2, behavior: "watch", comment: "Needs more consistency in homework completion." }, planType: "MONTHLY", caseTag: "B" },
      { firstName: "Joelle", gradeLevel: "Grade 11", section: "A", age: 16, profile: { baselineAverage: 69, attendanceRate: 82, weakSubjects: ["Chemistry", "Mathematics"], missingAssignments: 3, behavior: "watch", comment: "Risk of falling behind in STEM subjects if revision routine is not stabilized." }, planType: "TWO_INSTALLMENTS", caseTag: "B" },
    ],
  },
  {
    familyName: "Mbuyi",
    parentName: "Chantal Mbuyi",
    email: "chantal.mbuyi@family.kcs",
    phone: "+243 822 100 003",
    relationship: "Mother",
    children: [
      { firstName: "Esther", gradeLevel: "K1", section: "A", age: 4, profile: { baselineAverage: 91, attendanceRate: 98, weakSubjects: [], missingAssignments: 0, behavior: "excellent", comment: "Settled into routines very quickly and socializes well." }, planType: "FULL_ANNUAL", caseTag: "C" },
      { firstName: "Samuel", gradeLevel: "Grade 1", section: "A", age: 6, profile: { baselineAverage: 82, attendanceRate: 95, weakSubjects: ["French"], missingAssignments: 1, behavior: "good", comment: "Fluent in English reading, still building French vocabulary." }, planType: "TWO_INSTALLMENTS", caseTag: "C" },
      { firstName: "Daniel", gradeLevel: "Grade 7", section: "B", age: 12, profile: { baselineAverage: 73, attendanceRate: 84, weakSubjects: ["Mathematics", "History"], missingAssignments: 2, behavior: "watch", comment: "Attendance dips after sports travel and affects test readiness." }, planType: "MONTHLY", caseTag: "C" },
      { firstName: "Ruth", gradeLevel: "Grade 12", section: "A", age: 17, profile: { baselineAverage: 92, attendanceRate: 97, weakSubjects: [], missingAssignments: 0, behavior: "excellent", comment: "Excellent capstone discipline and strong peer mentoring." }, planType: "FULL_ANNUAL", caseTag: "C" },
    ],
  },
  {
    familyName: "Kasongo",
    parentName: "Patrick Kasongo",
    email: "patrick.kasongo@family.kcs",
    phone: "+243 822 100 004",
    relationship: "Father",
    children: [
      { firstName: "Nathan", gradeLevel: "K5", section: "B", age: 6, profile: { baselineAverage: 83, attendanceRate: 92, weakSubjects: ["Literacy"], missingAssignments: 1, behavior: "good", comment: "Responds well to phonics repetition and visual prompts." }, planType: "MONTHLY", caseTag: "D" },
      { firstName: "Miriam", gradeLevel: "Grade 5", section: "A", age: 10, profile: { baselineAverage: 77, attendanceRate: 88, weakSubjects: ["Science"], missingAssignments: 2, behavior: "good", comment: "Steady learner who benefits from structured review plans." }, planType: "THREE_INSTALLMENTS", caseTag: "D" },
      { firstName: "Kevin", gradeLevel: "Grade 9", section: "A", age: 14, profile: { baselineAverage: 66, attendanceRate: 79, weakSubjects: ["Mathematics", "Biology", "History"], missingAssignments: 4, behavior: "watch", comment: "Needs urgent attendance follow-up and assignment recovery." }, planType: "TWO_INSTALLMENTS", caseTag: "D" },
    ],
  },
  {
    familyName: "Tshibangu",
    parentName: "Mireille Tshibangu",
    email: "mireille.tshibangu@family.kcs",
    phone: "+243 822 100 005",
    relationship: "Mother",
    children: [
      { firstName: "Elie", gradeLevel: "K2", section: "A", age: 4, profile: { baselineAverage: 85, attendanceRate: 95, weakSubjects: [], missingAssignments: 0, behavior: "excellent", comment: "Happy learner who engages quickly during circle time." }, planType: "CUSTOM_AGREEMENT", caseTag: "E" },
      { firstName: "Sarah", gradeLevel: "Grade 3", section: "B", age: 8, profile: { baselineAverage: 81, attendanceRate: 93, weakSubjects: ["French"], missingAssignments: 1, behavior: "good", comment: "Very participative and cooperative in group work." }, planType: "CUSTOM_AGREEMENT", caseTag: "E" },
      { firstName: "Prisca", gradeLevel: "Grade 8", section: "A", age: 13, profile: { baselineAverage: 75, attendanceRate: 86, weakSubjects: ["Integrated Science"], missingAssignments: 2, behavior: "good", comment: "Good oral participation, written precision still uneven." }, planType: "CUSTOM_AGREEMENT", caseTag: "E" },
    ],
  },
];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number) {
  return `$${roundCurrency(value).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${roundCurrency(value).toFixed(1)}%`;
}

function buildAccessCode(prefix: string, seed: string) {
  return `${prefix}-${seed.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(6, "X")}`;
}

function isoAt(date: string) {
  return new Date(date).toISOString();
}

function enumerateSchoolDays(startIso: string, count: number) {
  const days: string[] = [];
  const current = new Date(startIso);
  while (days.length < count) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) {
      days.push(new Date(current).toISOString());
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function gradeNumericValue(gradeLevel: GradeLevel) {
  if (gradeLevel.startsWith("K")) return Number(gradeLevel.slice(1));
  return Number(gradeLevel.replace("Grade ", "")) + 5;
}

function classTeacherFor(className: string) {
  return TEACHER_SEEDS.find((teacher) => teacher.classes.includes(className))?.name || "Mireille Wema";
}

function subjectsFor(gradeLevel: GradeLevel) {
  return SUBJECTS_BY_LEVEL.find((entry) => entry.match(gradeLevel))?.subjects || ["English", "Mathematics", "Bible"];
}

function buildStudentSchedule(student: { gradeLevel: GradeLevel; className: string }) {
  const subjects = subjectsFor(student.gradeLevel);
  const roomBase = student.gradeLevel.startsWith("K") ? "E" : gradeNumericValue(student.gradeLevel) <= 10 ? "P" : "S";
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const timePairs = [
    ["07:45", "08:30"],
    ["08:35", "09:20"],
    ["09:40", "10:25"],
    ["10:30", "11:15"],
    ["11:20", "12:05"],
  ];
  return dayNames.flatMap((day, dayIndex) =>
    timePairs.map(([start, end], slotIndex) => {
      const subject = subjects[(slotIndex + dayIndex) % subjects.length];
      const teacher = TEACHER_SEEDS.find((entry) => entry.subjects.includes(subject) || entry.classes.includes(student.className))?.name || classTeacherFor(student.className);
      return {
        day,
        start,
        end,
        subject,
        room: `${roomBase}${(dayIndex % 3) + 1}`,
        teacher,
      } satisfies ScheduleSlot;
    })
  );
}

function teacherPermissions(teacher: typeof TEACHER_SEEDS[number]) {
  return [
    "attendance.manage",
    "gradebook.manage",
    "forum.teacher",
    "messages.send",
    ...(teacher.subjects.includes("Bible") ? ["student-support.view"] : []),
  ];
}

function buildTeacherSchedule(teacher: typeof TEACHER_SEEDS[number]) {
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const timePairs = [
    ["07:30", "08:15"],
    ["08:20", "09:05"],
    ["09:25", "10:10"],
    ["10:15", "11:00"],
    ["11:05", "11:50"],
  ];
  return dayNames.flatMap((day) =>
    teacher.classes.slice(0, timePairs.length).map((className, index) => ({
      day,
      start: timePairs[index]![0],
      end: timePairs[index]![1],
      subject: teacher.subjects[index % teacher.subjects.length]!,
      room: teacher.room,
      teacher: teacher.name,
    }))
  );
}

function buildStaffSchedule(department: string): ScheduleSlot[] {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => ({
    day,
    start: "07:30",
    end: "15:30",
    subject: department,
    room: department === "Finance" ? "F1" : department === "Registrar" ? "A1" : department === "Executive" ? "HQ" : "A2",
    teacher: department,
  }));
}

function buildEntities() {
  const parents: Parent[] = [];
  const students: Student[] = [];

  for (const seed of PARENT_SEEDS) {
    const parentName = splitName(seed.parentName);
    const parentId = `parent-${slugify(seed.parentName)}`;
    const familyId = buildCanonicalExternalId({ appSlug: "KCS_NEXUS", entityType: "family", seed: seed.familyName, now: NOW });
    const parent: Parent = {
      id: parentId,
      orbitExternalId: buildCanonicalExternalId({ appSlug: "SAVANEX", entityType: "parent", seed: seed.parentName, now: NOW }),
      savanexExternalId: buildCanonicalExternalId({ appSlug: "SAVANEX", entityType: "parent", seed: `${seed.parentName}-dir`, now: NOW }),
      kcsNexusExternalId: buildCanonicalExternalId({ appSlug: "KCS_NEXUS", entityType: "parent", seed: `${seed.parentName}-portal`, now: NOW }),
      familyId,
      fullName: seed.parentName,
      firstName: parentName.firstName,
      lastName: parentName.lastName,
      email: seed.email,
      phone: seed.phone,
      relationship: seed.relationship,
      children: [],
    };

    for (const child of seed.children) {
      const fullName = `${child.firstName} ${seed.familyName}`;
      const className = `${child.gradeLevel} ${child.section}`;
      const studentId = `student-${slugify(fullName)}`;
      const student: Student = {
        id: studentId,
        orbitExternalId: buildCanonicalExternalId({ appSlug: "SAVANEX", entityType: "student", seed: fullName, now: NOW }),
        savanexExternalId: buildCanonicalExternalId({ appSlug: "SAVANEX", entityType: "student", seed: `${fullName}-sav`, now: NOW }),
        edupayExternalId: buildCanonicalExternalId({ appSlug: "EDUPAY", entityType: "student", seed: `${fullName}-pay`, now: NOW }),
        fullName,
        firstName: child.firstName,
        lastName: seed.familyName,
        age: child.age,
        gradeLevel: child.gradeLevel,
        section: child.section,
        className,
        classId: `class-${slugify(className)}`,
        studentNumber: `STU-${slugify(fullName).toUpperCase().replace(/-/g, "").slice(0, 10)}`,
        accessCode: buildAccessCode("ACC-STU", child.firstName),
        parentId: parent.id,
        parentName: parent.fullName,
        assignedTeachers: TEACHER_SEEDS.filter((teacher) => teacher.classes.includes(className) || teacher.subjects.some((subject) => subjectsFor(child.gradeLevel).includes(subject))).map((teacher) => teacher.name),
        schedule: buildStudentSchedule({ gradeLevel: child.gradeLevel, className }),
        performance: child.profile,
      };
      parent.children.push(student);
      students.push(student);
    }

    parents.push(parent);
  }

  const teachers: Teacher[] = TEACHER_SEEDS.map((teacher) => ({
    id: `teacher-${slugify(teacher.name)}`,
    externalId: buildCanonicalExternalId({ appSlug: "SAVANEX", entityType: "teacher", seed: teacher.name, now: NOW }),
    fullName: teacher.name,
    email: teacher.email,
    phone: teacher.phone,
    employeeId: teacher.employeeId,
    role: "TEACHER",
    subjects: [...teacher.subjects],
    classes: [...teacher.classes],
    permissions: teacherPermissions(teacher),
    schedule: buildTeacherSchedule(teacher),
  }));

  const staff: Staff[] = STAFF_SEEDS.map((member) => ({
    id: `staff-${slugify(member.name)}`,
    externalId: buildCanonicalExternalId({ appSlug: member.role === "SUPER_ADMIN" ? "KCS_NEXUS" : "SAVANEX", entityType: "teacher", seed: member.name, now: NOW }),
    fullName: member.name,
    email: member.email,
    phone: member.phone,
    role: member.role,
    department: member.department,
    permissions: [...member.permissions],
    schedule: buildStaffSchedule(member.department),
  }));

  return { parents, students, teachers, staff };
}

function buildTuitionPlan(student: Student, familyChildCount: number, type: PaymentPlanType): TuitionPlan {
  const baseFee = BASE_TUITION[student.gradeLevel];
  const familyDiscountRate = familyChildCount >= 2 ? 10 : 0;
  const familyDiscountAmount = roundCurrency((baseFee * familyDiscountRate) / 100);
  const afterFamilyDiscount = roundCurrency(baseFee - familyDiscountAmount);
  const planMeta = PLAN_METADATA[type];
  const planDiscountAmount = roundCurrency((afterFamilyDiscount * planMeta.discountRate) / 100);
  const finalAmount = roundCurrency(afterFamilyDiscount - planDiscountAmount);
  const schedule: Array<{ label: string; dueDate: string; amount: number }> =
    type === "FULL_ANNUAL"
      ? [{ label: "Annual settlement", dueDate: isoAt("2025-08-31T23:59:59Z"), amount: finalAmount }]
      : type === "TWO_INSTALLMENTS"
        ? [
            { label: "Installment 1", dueDate: isoAt("2025-08-31T23:59:59Z"), amount: roundCurrency(finalAmount / 2) },
            { label: "Installment 2", dueDate: isoAt("2026-02-28T23:59:59Z"), amount: roundCurrency(finalAmount / 2) },
          ]
        : type === "THREE_INSTALLMENTS"
          ? [
              { label: "Installment 1", dueDate: isoAt("2025-08-31T23:59:59Z"), amount: roundCurrency(finalAmount / 3) },
              { label: "Installment 2", dueDate: isoAt("2025-12-31T23:59:59Z"), amount: roundCurrency(finalAmount / 3) },
              { label: "Installment 3", dueDate: isoAt("2026-04-30T23:59:59Z"), amount: roundCurrency(finalAmount / 3) },
            ]
          : type === "MONTHLY"
            ? [
                { label: "Registration tranche", dueDate: isoAt("2025-08-31T23:59:59Z"), amount: roundCurrency(finalAmount * 0.35) },
                { label: "January", dueDate: isoAt("2026-01-31T23:59:59Z"), amount: roundCurrency(finalAmount * 0.13) },
                { label: "February", dueDate: isoAt("2026-02-28T23:59:59Z"), amount: roundCurrency(finalAmount * 0.13) },
                { label: "March", dueDate: isoAt("2026-03-31T23:59:59Z"), amount: roundCurrency(finalAmount * 0.13) },
                { label: "April", dueDate: isoAt("2026-04-30T23:59:59Z"), amount: roundCurrency(finalAmount * 0.13) },
                { label: "May", dueDate: isoAt("2026-05-31T23:59:59Z"), amount: roundCurrency(finalAmount * 0.13) },
              ]
            : [
                { label: "Custom tranche 1", dueDate: isoAt("2025-09-15T23:59:59Z"), amount: roundCurrency(finalAmount * 0.25) },
                { label: "Custom tranche 2", dueDate: isoAt("2025-12-15T23:59:59Z"), amount: roundCurrency(finalAmount * 0.25) },
                { label: "Custom tranche 3", dueDate: isoAt("2026-03-15T23:59:59Z"), amount: roundCurrency(finalAmount * 0.2) },
                { label: "Custom tranche 4", dueDate: isoAt("2026-06-15T23:59:59Z"), amount: roundCurrency(finalAmount * 0.3) },
              ];

  const normalized = schedule.map((row, index, rows) => {
    const isLast = index === rows.length - 1;
    const previousTotal = sum(rows.slice(0, index).map((entry) => entry.amount));
    const amount = isLast ? roundCurrency(finalAmount - previousTotal) : row.amount;
    return {
      id: `${student.id}-inst-${index + 1}`,
      label: row.label,
      dueDate: row.dueDate,
      amountDue: amount,
      amountPaid: 0,
      balance: amount,
      status: new Date(row.dueDate) < NOW ? "OVERDUE" : "SCHEDULED",
      studentId: student.id,
      studentName: student.fullName,
    } satisfies Installment;
  });

  return {
    type,
    label: PLAN_METADATA[type].label,
    planDiscountRate: PLAN_METADATA[type].discountRate,
    finalAmount,
    familyDiscountAmount,
    planDiscountAmount,
    installments: normalized,
  };
}

function automaticAllocate(amount: number, installments: Installment[]): { lines: AllocationLine[]; leftover: number } {
  let remaining = amount;
  const lines: AllocationLine[] = [];
  const eligible = installments
    .filter((installment) => installment.balance > 0)
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime());

  for (const installment of eligible) {
    if (remaining <= 0) break;
    const applied = roundCurrency(Math.min(installment.balance, remaining));
    if (applied <= 0) continue;
    installment.amountPaid = roundCurrency(installment.amountPaid + applied);
    installment.balance = roundCurrency(installment.amountDue - installment.amountPaid);
    installment.status = installment.balance <= 0 ? "PAID" : new Date(installment.dueDate) < NOW ? "PARTIALLY_PAID" : "PARTIALLY_PAID";
    lines.push({
      studentId: installment.studentId,
      studentName: installment.studentName,
      installmentId: installment.id,
      installmentLabel: installment.label,
      amount: applied,
    });
    remaining = roundCurrency(remaining - applied);
  }

  return { lines, leftover: remaining };
}

function manualAllocate(amount: number, installments: Installment[], manualLines: Array<{ studentId: string; installmentId: string; amount: number }>) {
  let remaining = amount;
  const lines: AllocationLine[] = [];

  for (const entry of manualLines) {
    const installment = installments.find((item) => item.id === entry.installmentId && item.studentId === entry.studentId);
    if (!installment || remaining <= 0) {
      continue;
    }
    const applied = roundCurrency(Math.min(entry.amount, installment.balance, remaining));
    installment.amountPaid = roundCurrency(installment.amountPaid + applied);
    installment.balance = roundCurrency(installment.amountDue - installment.amountPaid);
    installment.status = installment.balance <= 0 ? "PAID" : new Date(installment.dueDate) < NOW ? "PARTIALLY_PAID" : "PARTIALLY_PAID";
    lines.push({
      studentId: installment.studentId,
      studentName: installment.studentName,
      installmentId: installment.id,
      installmentLabel: installment.label,
      amount: applied,
    });
    remaining = roundCurrency(remaining - applied);
  }

  return { lines, leftover: remaining };
}

function buildPaymentInstructions(parents: Parent[], plansByStudentId: Map<string, TuitionPlan>) {
  const instructions: PaymentInstruction[] = [];

  for (const parent of parents) {
    const scenario = PARENT_SEEDS.find((seed) => seed.parentName === parent.fullName)?.children[0]?.caseTag || "A";
    const familyPlans = parent.children.map((child) => ({ child, plan: plansByStudentId.get(child.id)! }));
    const totalExpected = roundCurrency(sum(familyPlans.map((entry) => entry.plan.finalAmount)));
    const amountDueToDate = roundCurrency(sum(familyPlans.flatMap((entry) => entry.plan.installments).filter((installment) => new Date(installment.dueDate) <= NOW).map((installment) => installment.amountDue)));

    if (scenario === "A") {
      instructions.push({
        paymentId: `pay-${slugify(parent.fullName)}-1`,
        parentId: parent.id,
        parentName: parent.fullName,
        paymentDate: isoAt("2025-08-20T10:15:00Z"),
        amount: roundCurrency(amountDueToDate * 0.68),
        method: "mobile_money",
        reference: `MM-${slugify(parent.fullName).toUpperCase()}-001`,
        status: "COMPLETED",
        scenario: "Case A - exact progress payment",
        allocationMode: "AUTOMATIC",
      });
      instructions.push({
        paymentId: `pay-${slugify(parent.fullName)}-2`,
        parentId: parent.id,
        parentName: parent.fullName,
        paymentDate: isoAt("2026-04-18T09:20:00Z"),
        amount: roundCurrency(amountDueToDate - roundCurrency(amountDueToDate * 0.68)),
        method: "bank_transfer",
        reference: `BT-${slugify(parent.fullName).toUpperCase()}-002`,
        status: "COMPLETED",
        scenario: "Case A - final exact amount",
        allocationMode: "AUTOMATIC",
      });
    } else if (scenario === "B") {
      instructions.push({
        paymentId: `pay-${slugify(parent.fullName)}-1`,
        parentId: parent.id,
        parentName: parent.fullName,
        paymentDate: isoAt("2025-08-28T08:45:00Z"),
        amount: roundCurrency(amountDueToDate * 0.38),
        method: "cash",
        reference: `CS-${slugify(parent.fullName).toUpperCase()}-001`,
        status: "COMPLETED",
        scenario: "Case B - underpayment",
        allocationMode: "AUTOMATIC",
      });
      instructions.push({
        paymentId: `pay-${slugify(parent.fullName)}-2`,
        parentId: parent.id,
        parentName: parent.fullName,
        paymentDate: isoAt("2026-03-05T11:05:00Z"),
        amount: roundCurrency(amountDueToDate * 0.19),
        method: "mobile_money",
        reference: `MM-${slugify(parent.fullName).toUpperCase()}-002`,
        status: "PENDING",
        scenario: "Case B - pending top-up",
        allocationMode: "AUTOMATIC",
      });
    } else if (scenario === "C") {
      instructions.push({
        paymentId: `pay-${slugify(parent.fullName)}-1`,
        parentId: parent.id,
        parentName: parent.fullName,
        paymentDate: isoAt("2025-08-25T13:15:00Z"),
        amount: roundCurrency(totalExpected + 325),
        method: "bank_transfer",
        reference: `BT-${slugify(parent.fullName).toUpperCase()}-001`,
        status: "COMPLETED",
        scenario: "Case C - overpayment with advance credit",
        allocationMode: "AUTOMATIC",
      });
    } else if (scenario === "D") {
      const targetInstallments = familyPlans.flatMap((entry) => entry.plan.installments).slice(0, 4);
      instructions.push({
        paymentId: `pay-${slugify(parent.fullName)}-1`,
        parentId: parent.id,
        parentName: parent.fullName,
        paymentDate: isoAt("2026-02-10T14:10:00Z"),
        amount: roundCurrency(sum(targetInstallments.map((item) => item.amountDue)) * 0.87),
        method: "bank_transfer",
        reference: `BT-${slugify(parent.fullName).toUpperCase()}-001`,
        status: "COMPLETED",
        scenario: "Case D - one payment across multiple children",
        allocationMode: "AUTOMATIC",
      });
    } else {
      const manualTargets = familyPlans.flatMap((entry) => entry.plan.installments).filter((item) => ["Custom tranche 1", "Custom tranche 2"].includes(item.label));
      instructions.push({
        paymentId: `pay-${slugify(parent.fullName)}-1`,
        parentId: parent.id,
        parentName: parent.fullName,
        paymentDate: isoAt("2025-09-14T16:00:00Z"),
        amount: roundCurrency(sum(manualTargets.map((item) => item.amountDue)) * 0.94),
        method: "cash",
        reference: `CS-${slugify(parent.fullName).toUpperCase()}-001`,
        status: "COMPLETED",
        scenario: "Case E - custom agreement",
        allocationMode: "MANUAL",
        manualAllocations: manualTargets.map((item) => ({ studentId: item.studentId, installmentId: item.id, amount: roundCurrency(item.amountDue * 0.94) })),
      });
      instructions.push({
        paymentId: `pay-${slugify(parent.fullName)}-2`,
        parentId: parent.id,
        parentName: parent.fullName,
        paymentDate: isoAt("2026-03-20T16:25:00Z"),
        amount: roundCurrency(sum(manualTargets.map((item) => item.amountDue)) * 0.26),
        method: "mobile_money",
        reference: `MM-${slugify(parent.fullName).toUpperCase()}-002`,
        status: "COMPLETED",
        scenario: "Case E - negotiated catch-up",
        allocationMode: "MANUAL",
        manualAllocations: parent.children.map((child) => {
          const overdueInstallment = plansByStudentId.get(child.id)!.installments.find((installment) => installment.balance > 0) || plansByStudentId.get(child.id)!.installments[0]!;
          return { studentId: child.id, installmentId: overdueInstallment.id, amount: roundCurrency(overdueInstallment.amountDue * 0.26) };
        }),
      });
    }
  }

  return instructions;
}

function statusForInstallment(installment: Installment) {
  if (installment.balance <= 0) return "PAID";
  if (installment.amountPaid > 0) return new Date(installment.dueDate) <= NOW ? "PARTIALLY_PAID" : "PARTIALLY_PAID";
  return new Date(installment.dueDate) <= NOW ? "OVERDUE" : "SCHEDULED";
}

function buildAcademicRecords(students: Student[]) {
  const attendanceDays = enumerateSchoolDays("2026-04-20T00:00:00.000Z", 20);
  const attendance: AttendanceRecord[] = [];
  const gradebook: AcademicRecord[] = [];

  for (const student of students) {
    const statuses: AttendanceStatus[] = [];
    const absences = Math.round(((100 - student.performance.attendanceRate) / 100) * attendanceDays.length);
    const lates = Math.max(1, Math.round(absences / 2));
    for (let index = 0; index < attendanceDays.length; index += 1) {
      if (index < absences) statuses.push("ABSENT");
      else if (index < absences + lates) statuses.push("LATE");
      else statuses.push("PRESENT");
    }
    const rotated = statuses.slice(2).concat(statuses.slice(0, 2));
    attendanceDays.forEach((date, index) => {
      attendance.push({ studentId: student.id, date, status: rotated[index]! });
    });

    for (const subject of subjectsFor(student.gradeLevel)) {
      const isWeak = student.performance.weakSubjects.includes(subject);
      const subjectBase = clamp(student.performance.baselineAverage - (isWeak ? 10 : 0) + (subject === "Bible" ? 4 : 0), 52, 97);
      const assignmentScores = [0, 1, 2].map((index) => {
        const missing = index < student.performance.missingAssignments && isWeak;
        return {
          title: `${subject} Assignment ${index + 1}`,
          score: missing ? 0 : clamp(subjectBase - 8 + index * 2, 0, 100),
          maxScore: 100,
          submitted: !missing,
        };
      });
      const homework = [0, 1, 2].map((index) => ({
        title: `${subject} Homework ${index + 1}`,
        status: index < student.performance.missingAssignments && isWeak ? "MISSING" : index === 2 && student.performance.behavior === "watch" ? "LATE" : "SUBMITTED",
      })) as Array<{ title: string; status: "SUBMITTED" | "MISSING" | "LATE" }>;
      const quizzes = [0, 1].map((index) => ({ title: `${subject} Quiz ${index + 1}`, score: clamp(subjectBase - 5 + index * 3, 0, 100), maxScore: 100 }));
      const tests = [0, 1].map((index) => ({ title: `${subject} Test ${index + 1}`, score: clamp(subjectBase - 3 + index * 2, 0, 100), maxScore: 100 }));
      const exams = [{ title: `${subject} End Term Exam`, score: clamp(subjectBase + 1, 0, 100), maxScore: 100 }];
      const weightedAverage = roundCurrency(
        mean([...assignmentScores.map((item) => item.score), ...quizzes.map((item) => item.score), ...tests.map((item) => item.score), ...exams.map((item) => item.score)])
      );

      gradebook.push({
        studentId: student.id,
        subject,
        assignments: assignmentScores,
        quizzes,
        tests,
        exams,
        homework,
        teacherComment: student.performance.comment,
        behaviorNote:
          student.performance.behavior === "excellent"
            ? "Shows leadership, punctuality, and respectful participation."
            : student.performance.behavior === "good"
              ? "Engages well with reminders and collaborates positively."
              : "Needs follow-up on focus, deadlines, and consistent classroom readiness.",
        average: weightedAverage,
      });
    }
  }

  return { attendance, gradebook };
}

function evaluateRisks(students: Student[], attendance: AttendanceRecord[], gradebook: AcademicRecord[], plansByStudentId: Map<string, TuitionPlan>) {
  return students.map((student) => {
    const studentAttendance = attendance.filter((entry) => entry.studentId === student.id);
    const studentGradebook = gradebook.filter((entry) => entry.studentId === student.id);
    const attendanceRate = roundCurrency((studentAttendance.filter((entry) => entry.status === "PRESENT").length / studentAttendance.length) * 100);
    const academicAverage = roundCurrency(mean(studentGradebook.map((entry) => entry.average)));
    const missingAssignments = sum(studentGradebook.map((entry) => entry.homework.filter((item) => item.status === "MISSING").length));
    const outstandingBalance = roundCurrency(sum(plansByStudentId.get(student.id)!.installments.map((item) => item.balance)));
    const paymentRisk = outstandingBalance > 1400 ? "HIGH" : outstandingBalance > 450 ? "MEDIUM" : "LOW";
    const academicRisk = attendanceRate < 80 || academicAverage < 68 || missingAssignments >= 4 ? "HIGH" : attendanceRate < 88 || academicAverage < 76 || missingAssignments >= 2 ? "MEDIUM" : "LOW";
    const overallRisk = paymentRisk === "HIGH" || academicRisk === "HIGH" ? "HIGH" : paymentRisk === "MEDIUM" || academicRisk === "MEDIUM" ? "MEDIUM" : "LOW";
    const reasons = [
      ...(attendanceRate < 88 ? [`Attendance at ${formatPercent(attendanceRate)}`] : []),
      ...(academicAverage < 76 ? [`Average at ${formatPercent(academicAverage)}`] : []),
      ...(missingAssignments > 0 ? [`${missingAssignments} missing assignments`] : []),
      ...(outstandingBalance > 0 ? [`Outstanding tuition ${formatCurrency(outstandingBalance)}`] : []),
    ];
    return {
      studentId: student.id,
      studentName: student.fullName,
      attendanceRate,
      academicAverage,
      missingAssignments,
      paymentRisk,
      academicRisk,
      overallRisk,
      reasons,
    } satisfies RiskProfile;
  });
}

function registerNotification(notifications: Notification[], type: NotificationType, audience: RoleAudience[], title: string, message: string, severity: Severity, source: string) {
  notifications.push({
    id: `notif-${notifications.length + 1}`,
    type,
    audience,
    title,
    message,
    severity,
    createdAt: new Date(NOW.getTime() - notifications.length * 60000).toISOString(),
    isRead: notifications.length % 3 === 0,
    source,
  });
}

function buildForums(students: Student[], teachers: Teacher[], parents: Parent[]) {
  const activeGrades = Array.from(new Set(students.map((student) => student.gradeLevel)));
  const forums: ForumThread[] = [
    {
      forumName: "Teachers Forum",
      category: "Teachers",
      title: "Mid-term moderation and risk follow-up",
      pinned: true,
      messages: [
        { author: teachers[5]!.fullName, role: "Teacher", timestamp: isoAt("2026-05-16T07:50:00Z"), content: "Please finalize Grade 9-12 marks before Friday noon so the analytics dashboard refresh stays accurate.", readBy: 8, unreadBy: 2 },
        { author: teachers[6]!.fullName, role: "Teacher", timestamp: isoAt("2026-05-16T08:20:00Z"), content: "Kevin Kasongo and Joelle Ilunga are both trending high-risk in science; intervention notes uploaded.", readBy: 7, unreadBy: 3 },
      ],
      moderationLog: ["Pinned by Super Admin Isaac Mbuyi at 07:45", "No moderation breach recorded"],
    },
    {
      forumName: "Parents Forum",
      category: "Parents",
      title: "Clarification on May tuition reminders and homework load",
      pinned: true,
      messages: [
        { author: parents[1]!.fullName, role: "Parent", timestamp: isoAt("2026-05-14T15:10:00Z"), content: "Could finance clarify whether partial monthly payments still unlock report-card access?", readBy: 14, unreadBy: 3 },
        { author: "Michel Kabeya", role: "Finance Staff", timestamp: isoAt("2026-05-14T15:36:00Z"), content: "Yes, access remains active while a documented payment arrangement exists, but overdue alerts continue until regularized.", readBy: 15, unreadBy: 2 },
      ],
      moderationLog: ["Pinned by Registrar Alice Ngoy at 15:05"],
    },
    {
      forumName: "Administrative Forum",
      category: "Administration",
      title: "End-of-year credential issuance and attendance exceptions",
      pinned: false,
      messages: [
        { author: "Alice Ngoy", role: "Staff", timestamp: isoAt("2026-05-15T11:00:00Z"), content: "Please clear attendance corrections by Wednesday so student promotion reports export cleanly.", readBy: 5, unreadBy: 0 },
        { author: "Solange Mputu", role: "Staff", timestamp: isoAt("2026-05-15T11:22:00Z"), content: "Counselor notes added for three students with linked finance and attendance pressure.", readBy: 4, unreadBy: 1 },
      ],
      moderationLog: ["No pinned message", "No deleted thread this week"],
    },
    {
      forumName: "General School Forum",
      category: "General",
      title: "Sports day, schedule shifts, and communication expectations",
      pinned: true,
      messages: [
        { author: "David Mavunda", role: "Staff", timestamp: isoAt("2026-05-13T09:00:00Z"), content: "Friday afternoon rehearsals move to 13:30. Families will receive schedule and bus updates through EduSync AI.", readBy: 41, unreadBy: 9 },
        { author: parents[0]!.fullName, role: "Parent", timestamp: isoAt("2026-05-13T10:12:00Z"), content: "Thanks. Could class teachers confirm homework adjustments for students leaving early?", readBy: 34, unreadBy: 16 },
      ],
      moderationLog: ["Pinned by Super Admin Isaac Mbuyi at 08:58"],
    },
  ];

  for (const gradeLevel of activeGrades) {
    const gradeStudents = students.filter((student) => student.gradeLevel === gradeLevel);
    const classLabel = `${gradeLevel} Forum`;
    const leadStudent = gradeStudents[0]!;
    forums.push({
      forumName: classLabel,
      category: "Students",
      title: `${gradeLevel} homework and revision thread`,
      pinned: gradeLevel === "Grade 12" || gradeLevel === "Grade 6",
      messages: [
        {
          author: classTeacherFor(leadStudent.className),
          role: "Teacher",
          timestamp: isoAt("2026-05-12T08:05:00Z"),
          content: `Please upload revision work for ${gradeLevel} by Thursday evening. Attendance and homework are both feeding into the support dashboard this week.`,
          readBy: gradeStudents.length + 8,
          unreadBy: 1,
        },
        {
          author: leadStudent.fullName,
          role: "Student",
          timestamp: isoAt("2026-05-12T16:10:00Z"),
          content: "Can the science review packet be shared again in PDF? Some of us need it for evening study.",
          readBy: gradeStudents.length + 5,
          unreadBy: 3,
        },
      ],
      moderationLog: [gradeLevel === "Grade 12" ? "Pinned exam notice retained" : "No moderation issue recorded"],
    });
  }

  return forums;
}

function buildDashboards(parents: Parent[], students: Student[], teachers: Teacher[], staff: Staff[], risks: RiskProfile[], notifications: Notification[]) {
  return [
    {
      role: "Parent",
      audienceSize: parents.length,
      widgets: ["Children overview", "Payments", "Grades", "Attendance", "Notifications", "AI insights"],
      sampleInsights: [
        `${parents[0]!.fullName} sees 4 linked children, 0 overdue installments, and one chemistry revision insight.`,
        `${parents[1]!.fullName} sees 3 linked children, overdue debt alerts, and two teacher follow-up requests.`,
      ],
    },
    {
      role: "Student",
      audienceSize: students.length,
      widgets: ["Schedule", "Assignments", "Grades", "Attendance", "AI learning assistant"],
      sampleInsights: [
        `${students[3]!.fullName} dashboard highlights chemistry revision and attendance streak 9/10.`,
        `${students[13]!.fullName} dashboard highlights overdue work, low attendance, and counselor follow-up.`,
      ],
    },
    {
      role: "Teacher",
      audienceSize: teachers.length,
      widgets: ["Classes", "Gradebook", "Attendance", "Schedule", "AI tools"],
      sampleInsights: [
        `${teachers[6]!.fullName} sees 7 class groups, 119 grade entries synced, and 3 high-risk students.`,
        `${teachers[5]!.fullName} sees senior math alerts and two report-card deadlines.`,
      ],
    },
    {
      role: "Administrative Staff",
      audienceSize: staff.filter((member) => member.role === "STAFF").length,
      widgets: ["Registry", "Payments follow-up", "Notifications", "Forum moderation", "Reports"],
      sampleInsights: [
        `${staff[1]!.fullName} sees 4 overdue parents and 2 negotiated plans requiring review.`,
        `${staff[0]!.fullName} sees 17 tracked students and 100% profile linkage integrity.`,
      ],
    },
    {
      role: "Super Admin",
      audienceSize: staff.filter((member) => member.role === "SUPER_ADMIN").length,
      widgets: ["System health", "Analytics", "Role management", "AI usage", "Cross-app sync"],
      sampleInsights: [
        `${staff[4]!.fullName} sees ${risks.filter((risk) => risk.overallRisk === "HIGH").length} high-risk students and ${notifications.length} notifications generated in this run.`,
      ],
    },
  ] satisfies DashboardSnapshot[];
}

function buildAiInsights(parents: Parent[], students: Student[], risks: RiskProfile[], gradebook: AcademicRecord[], plansByStudentId: Map<string, TuitionPlan>) {
  const parentInsights = parents.map((parent) => {
    const familyRisks = risks.filter((risk) => parent.children.some((student) => student.id === risk.studentId));
    const riskStudent = familyRisks.sort((left, right) => (left.overallRisk < right.overallRisk ? 1 : -1))[0]!;
    return {
      parent: parent.fullName,
      prompt: "What is happening with my child?",
      answer: `${riskStudent.studentName} is the highest-priority follow-up in this family. Attendance is ${formatPercent(riskStudent.attendanceRate)}, average is ${formatPercent(riskStudent.academicAverage)}, and the current concern is ${riskStudent.reasons.join(", ")}. Recommended next step: teacher-parent meeting within 5 days.`,
    };
  });

  const studentInsights = students.map((student) => {
    const records = gradebook.filter((entry) => entry.studentId === student.id).sort((left, right) => left.average - right.average);
    const weakest = records.slice(0, 2).map((entry) => entry.subject);
    const revisionPlan = [`Mon: ${weakest[0] || "English"} practice`, `Wed: ${weakest[1] || "Mathematics"} quiz drill`, "Fri: mixed retrieval review"];
    return {
      student: student.fullName,
      studyRecommendations: weakest.length > 0 ? weakest.map((subject) => `Focus on ${subject} with 20-minute retrieval practice.`) : ["Maintain current revision balance."],
      revisionPlan,
      weakTopicDetection: weakest,
    };
  });

  const teacherInsights = teachersToInsights(students, risks);
  const financeInsights = parents.map((parent) => {
    const balance = roundCurrency(sum(parent.children.flatMap((child) => plansByStudentId.get(child.id)!.installments.map((installment) => installment.balance))));
    return {
      parent: parent.fullName,
      paymentPrediction: balance > 1000 ? "Likely to require staggered follow-up before year-end." : "Likely to complete or regularize without escalation.",
      debtRiskAlert: balance > 1400 ? "HIGH" : balance > 450 ? "MEDIUM" : "LOW",
    };
  });

  return { parentInsights, studentInsights, teacherInsights, financeInsights };
}

function teachersToInsights(students: Student[], risks: RiskProfile[]) {
  const byTeacher = new Map<string, { students: Set<string>; riskStudents: string[] }>();
  for (const student of students) {
    for (const teacher of student.assignedTeachers) {
      const current = byTeacher.get(teacher) || { students: new Set<string>(), riskStudents: [] };
      current.students.add(student.fullName);
      const risk = risks.find((entry) => entry.studentId === student.id);
      if (risk && risk.overallRisk !== "LOW") {
        current.riskStudents.push(`${student.fullName} (${risk.overallRisk})`);
      }
      byTeacher.set(teacher, current);
    }
  }
  return Array.from(byTeacher.entries()).map(([teacher, data]) => ({
    teacher,
    lessonPlan: `Adaptive lesson plan: 10-minute recap, 20-minute guided practice, 15-minute differentiated support, 5-minute exit ticket for ${data.students.size} tracked learners.`,
    quizSuggestion: `Generate a mixed-difficulty quiz with focus on ${data.riskStudents.length > 0 ? "identified weak topics" : "core mastery maintenance"}.`,
    riskDetection: data.riskStudents.length > 0 ? data.riskStudents.join(", ") : "No elevated risks in tracked cohort.",
  }));
}

function buildSyncEvents(
  parents: Parent[],
  students: Student[],
  teachers: Teacher[],
  gradebook: AcademicRecord[],
  attendance: AttendanceRecord[],
  paymentInstructions: PaymentInstruction[],
  receipts: Receipt[],
  forums: ForumThread[],
  notifications: Notification[]
) {
  const counters: ValidationCounter = { parents: 0, teachers: 0, students: 0, classes: 0, grades: 0, attendance: 0, payments: 0, announcements: 0 };
  const syncEvents: SyncEvent[] = [];

  const pushSync = (event: Omit<SyncEvent, "id">) => {
    syncEvents.push({ id: `sync-${syncEvents.length + 1}`, ...event });
  };

  for (const parent of parents) {
    ParentUpsertSchema.parse({
      organizationId: ORGANIZATION_ID,
      externalId: parent.savanexExternalId,
      sourceApp: "SAVANEX",
      occurredAt: NOW.toISOString(),
      version: "1.0.0",
      payload: {
        fullName: parent.fullName,
        email: parent.email,
        phone: parent.phone,
        accessCode: buildAccessCode("ACC-PAR", parent.firstName),
      },
    });
    counters.parents += 1;
    pushSync({ domain: "directory", source: "SAVANEX", description: `Parent registry upsert for ${parent.fullName}`, targets: ["parent-dashboard", "analytics"], contractValidated: true, success: true });
  }

  for (const teacher of teachers) {
    TeacherUpsertSchema.parse({
      organizationId: ORGANIZATION_ID,
      externalId: teacher.externalId,
      sourceApp: "SAVANEX",
      occurredAt: NOW.toISOString(),
      version: "1.0.0",
      payload: {
        fullName: teacher.fullName,
        email: teacher.email,
        phone: teacher.phone,
        subjects: teacher.subjects,
        employeeId: teacher.employeeId,
      },
    });
    counters.teachers += 1;
    pushSync({ domain: "directory", source: "SAVANEX", description: `Teacher registry upsert for ${teacher.fullName}`, targets: ["teacher-dashboard", "analytics"], contractValidated: true, success: true });
  }

  for (const student of students) {
    StudentUpsertSchema.parse({
      organizationId: ORGANIZATION_ID,
      externalId: student.savanexExternalId,
      sourceApp: "SAVANEX",
      occurredAt: NOW.toISOString(),
      version: "1.0.0",
      payload: {
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.age % 2 === 0 ? "F" : "M",
        accessCode: student.accessCode,
        studentNumber: student.studentNumber,
        classExternalId: student.classId,
        className: student.className,
        parentExternalId: parents.find((entry) => entry.id === student.parentId)!.savanexExternalId,
        email: `${slugify(student.fullName)}@student.kcs.local`,
        phone: undefined,
        dateOfBirth: `${NOW.getUTCFullYear() - student.age}-09-01`,
        status: "ACTIVE",
      },
    });
    counters.students += 1;
    pushSync({ domain: "directory", source: "SAVANEX", description: `Student registry upsert for ${student.fullName}`, targets: ["student-dashboard", "parent-dashboard", "analytics"], contractValidated: true, success: true });

    ClassUpsertSchema.parse({
      organizationId: ORGANIZATION_ID,
      externalId: student.classId,
      sourceApp: "SAVANEX",
      occurredAt: NOW.toISOString(),
      version: "1.0.0",
      payload: {
        name: student.className,
        gradeLevel: student.gradeLevel,
        suffix: student.section,
        teacherExternalId: teachers.find((teacher) => teacher.classes.includes(student.className))?.externalId,
      },
    });
    counters.classes += 1;
  }

  const gradeEvents = gradebook.map((record) => ({
    student: students.find((entry) => entry.id === record.studentId)!,
    record,
  }));
  for (const event of gradeEvents) {
    GradeUpsertSchema.parse({
      organizationId: ORGANIZATION_ID,
      externalId: `${event.student.id}-${slugify(event.record.subject)}-term3`,
      sourceApp: "SAVANEX",
      occurredAt: NOW.toISOString(),
      version: "1.0.0",
      payload: {
        studentExternalId: event.student.savanexExternalId,
        subject: event.record.subject,
        score: event.record.average,
        maxScore: 100,
        term: "Term 3",
      },
    });
    counters.grades += 1;
    pushSync({
      domain: "gradebook",
      source: "SAVANEX",
      description: `Grade sync for ${event.student.fullName} - ${event.record.subject}`,
      targets: ["student-dashboard", "parent-dashboard", "teacher-dashboard", "ai-assistant", "analytics", "notification-engine"],
      contractValidated: true,
      success: true,
    });
  }

  for (const entry of attendance) {
    const student = students.find((item) => item.id === entry.studentId)!;
    AttendanceUpsertSchema.parse({
      organizationId: ORGANIZATION_ID,
      externalId: `${student.id}-${entry.date}`,
      sourceApp: "SAVANEX",
      occurredAt: entry.date,
      version: "1.0.0",
      payload: {
        studentExternalId: student.savanexExternalId,
        date: entry.date,
        status: entry.status,
      },
    });
    counters.attendance += 1;
    pushSync({
      domain: "attendance",
      source: "SAVANEX",
      description: `Attendance sync for ${student.fullName} on ${entry.date.slice(0, 10)}`,
      targets: ["student-dashboard", "parent-dashboard", "teacher-dashboard", "ai-assistant", "analytics", "notification-engine"],
      contractValidated: true,
      success: true,
    });
  }

  for (const payment of paymentInstructions.filter((entry) => entry.status === "COMPLETED")) {
    const receipt = receipts.find((entry) => entry.paymentId === payment.paymentId)!;
    const firstLine = receipt.lines[0];
    const student = students.find((entry) => entry.id === firstLine?.studentId) || students[0]!;
    PaymentCreatedSchema.parse({
      organizationId: ORGANIZATION_ID,
      externalId: payment.paymentId,
      sourceApp: "EDUPAY",
      occurredAt: payment.paymentDate,
      version: "1.0.0",
      payload: {
        studentExternalId: student.edupayExternalId,
        amount: payment.amount,
        currency: "USD",
        motif: payment.scenario,
        method: payment.method,
        reference: payment.reference,
        status: payment.status,
      },
    });
    counters.payments += 1;
    pushSync({
      domain: "finance",
      source: "EDUPAY",
      description: `Payment sync for ${payment.parentName} (${payment.scenario})`,
      targets: ["parent-dashboard", "student-dashboard", "analytics", "notification-engine", "ai-assistant"],
      contractValidated: true,
      success: true,
    });
  }

  for (const forum of forums.slice(0, 6)) {
    AnnouncementPublishedSchema.parse({
      organizationId: ORGANIZATION_ID,
      externalId: `announcement-${slugify(forum.forumName)}`,
      sourceApp: "EDUSYNCAI",
      occurredAt: forum.messages[0]!.timestamp,
      version: "1.0.0",
      payload: {
        title: forum.title,
        body: forum.messages.map((message) => `${message.author}: ${message.content}`).join("\n"),
        audience: ["ADMIN", "STAFF", "TEACHER", "PARENT", "STUDENT"],
        priority: forum.pinned ? "HIGH" : "MEDIUM",
        channel: "forum",
      },
    });
    counters.announcements += 1;
    pushSync({
      domain: "communications",
      source: "EDUSYNCAI",
      description: `Forum or announcement propagation for ${forum.forumName}`,
      targets: ["parent-dashboard", "student-dashboard", "teacher-dashboard", "analytics", "notification-engine"],
      contractValidated: true,
      success: true,
    });
  }

  for (const forum of forums) {
    pushSync({
      domain: "forum",
      source: "KCS_NEXUS",
      description: `Forum thread update for ${forum.forumName}`,
      targets: ["parent-dashboard", "student-dashboard", "teacher-dashboard", "notification-engine", "analytics"],
      contractValidated: false,
      success: true,
      warning: "No shared Orbit contract currently exists for forum post payloads.",
    });
  }

  for (const notification of notifications.slice(0, 20)) {
    pushSync({
      domain: "notifications",
      source: "EDUSYNCAI",
      description: `Notification emitted: ${notification.title}`,
      targets: ["parent-dashboard", "student-dashboard", "teacher-dashboard", "notification-engine"],
      contractValidated: false,
      success: true,
      warning: "Notification propagation is simulated from documented endpoints; no cross-app contract schema was found in shared-contracts.",
    });
  }

  return { syncEvents, counters };
}

function buildMessageThreads(parents: Parent[], teachers: Teacher[], risks: RiskProfile[]) {
  return [
    { subject: "Attendance follow-up", from: teachers[4]!.fullName, to: parents[3]!.fullName, body: `Kevin Kasongo missed two science blocks this week. Please confirm whether transport or health is affecting attendance.`, status: "replied" },
    { subject: "Chemistry revision plan", from: teachers[6]!.fullName, to: parents[1]!.fullName, body: `Joelle Ilunga needs a tighter revision plan before mock exams. Suggested Monday and Thursday support blocks attached.`, status: "waiting" },
    { subject: "Receipt confirmation", from: "Michel Kabeya", to: parents[4]!.fullName, body: `Your negotiated plan payment has been posted and partially allocated according to the custom agreement.`, status: "sent" },
    { subject: "Positive update", from: teachers[5]!.fullName, to: parents[2]!.fullName, body: `Ruth Mbuyi is tracking above 90% and mentoring younger students in math lab.`, status: "read" },
    { subject: "Homework recovery", from: teachers[3]!.fullName, to: parents[1]!.fullName, body: `Deborah Ilunga can clear two missing assignments by Friday if work is submitted through Nexus.`, status: "read" },
    { subject: "Risk review", from: "Solange Mputu", to: "Isaac Mbuyi", body: `${risks.filter((risk) => risk.overallRisk === "HIGH").length} students meet the intervention threshold across attendance and finance.`, status: "queued" },
  ];
}

function parseLiveProbeOptions(argv: string[]): LiveProbeOptions {
  const intenseRequested = argv.includes("--stress-intense") || argv.includes("--stress-profile=intense");
  const profile: LiveProbeOptions["profile"] = intenseRequested ? "intense" : "standard";
  const defaults: LiveProbeOptions = intenseRequested
    ? { profile, requestsPerService: 20, timeoutMs: 7000, concurrency: 4 }
    : { profile, requestsPerService: 8, timeoutMs: 5000, concurrency: 1 };

  const findNumericArg = (prefix: string) => {
    const raw = argv.find((entry) => entry.startsWith(prefix));
    if (!raw) return undefined;
    const parsed = Number(raw.slice(prefix.length));
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    profile,
    requestsPerService: Math.max(1, Math.round(findNumericArg("--stress-requests=") ?? defaults.requestsPerService)),
    timeoutMs: Math.max(1000, Math.round(findNumericArg("--stress-timeout=") ?? defaults.timeoutMs)),
    concurrency: Math.max(1, Math.round(findNumericArg("--stress-concurrency=") ?? defaults.concurrency)),
  };
}

async function probeLiveServices(options: LiveProbeOptions) {
  const targets = [
    { service: "KCS Orbit API", url: "http://localhost:4500/health", fallbackUrl: "http://127.0.0.1:4500/health", healthyStatuses: [200] },
    { service: "KCS Nexus API", url: "http://localhost:5000/health", fallbackUrl: "http://127.0.0.1:5000/health", healthyStatuses: [200] },
    { service: "KCS Nexus Frontend", url: "http://localhost:5173/", fallbackUrl: "http://127.0.0.1:5173/", healthyStatuses: [200] },
    { service: "EduPay API", url: "http://localhost:4000/health", fallbackUrl: "http://127.0.0.1:4000/health", healthyStatuses: [200] },
    { service: "EduPay Web", url: "http://localhost:5174/EduPay-Smart-System/", fallbackUrl: "http://127.0.0.1:5174/EduPay-Smart-System/", healthyStatuses: [200] },
    { service: "EduSync AI API", url: "http://localhost:8000/", fallbackUrl: "http://127.0.0.1:8000/", healthyStatuses: [200] },
    { service: "EduSync AI Frontend", url: "http://localhost:5175/", fallbackUrl: "http://127.0.0.1:5175/", healthyStatuses: [200] },
    { service: "SAVANEX API", url: "http://localhost:8001/api/auth/login/", fallbackUrl: "http://127.0.0.1:8001/api/auth/login/", healthyStatuses: [405] },
    { service: "SAVANEX Frontend", url: "http://localhost:3000/Syst-me-de-gestion-scolaire/", fallbackUrl: "http://127.0.0.1:3000/Syst-me-de-gestion-scolaire/", healthyStatuses: [200] },
  ] as const;

  const requestOnce = async (url: string, signal: AbortSignal) => fetch(url, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
    },
  });

  const results = await Promise.all(
    targets.map(async (target) => {
      const latencies: number[] = [];
      let reachableResponses = 0;
      let healthyResponses = 0;
      let networkFailures = 0;
      let lastStatus: number | null = null;

      for (let startIndex = 0; startIndex < options.requestsPerService; startIndex += options.concurrency) {
        const batchSize = Math.min(options.concurrency, options.requestsPerService - startIndex);
        await Promise.all(
          Array.from({ length: batchSize }, async () => {
            const startedAt = Date.now();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
            try {
              let response: Response;
              try {
                response = await requestOnce(target.url, controller.signal);
              } catch {
                response = await requestOnce(target.fallbackUrl, controller.signal);
              }
              const duration = Date.now() - startedAt;
              latencies.push(duration);
              reachableResponses += 1;
              lastStatus = response.status;
              if (target.healthyStatuses.includes(response.status)) {
                healthyResponses += 1;
              }
            } catch {
              networkFailures += 1;
            } finally {
              clearTimeout(timeout);
            }
          })
        );
      }

      return {
        service: target.service,
        url: target.url,
        requests: options.requestsPerService,
        reachableResponses,
        healthyResponses,
        networkFailures,
        averageLatencyMs: latencies.length > 0 ? roundCurrency(mean(latencies)) : 0,
        maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
        lastStatus,
      } satisfies LiveProbeResult;
    })
  );

  const summary = {
    profile: options.profile,
    requestsPerService: options.requestsPerService,
    timeoutMs: options.timeoutMs,
    concurrency: options.concurrency,
    services: results.length,
    totalRequests: sum(results.map((result) => result.requests)),
    reachableResponses: sum(results.map((result) => result.reachableResponses)),
    healthyResponses: sum(results.map((result) => result.healthyResponses)),
    networkFailures: sum(results.map((result) => result.networkFailures)),
    averageLatencyMs: roundCurrency(mean(results.filter((result) => result.averageLatencyMs > 0).map((result) => result.averageLatencyMs))),
    maxLatencyMs: Math.max(...results.map((result) => result.maxLatencyMs), 0),
  };

  return { results, summary };
}

function buildTables(headers: string[], rows: Array<Array<string | number>>) {
  const header = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell)).join(" | ")} |`).join("\n");
  return [header, divider, body].filter(Boolean).join("\n");
}

function toMermaidBar(title: string, labels: string[], values: number[]) {
  return [
    "```mermaid",
    "xychart-beta",
    `title \"${title}\"`,
    `x-axis [${labels.map((label) => `\"${label}\"`).join(", ")}]`,
    `bar [${values.map((value) => roundCurrency(value)).join(", ")}]`,
    "```",
  ].join("\n");
}

function renderReport(data: {
  parents: Parent[];
  students: Student[];
  teachers: Teacher[];
  staff: Staff[];
  plansByStudentId: Map<string, TuitionPlan>;
  receipts: Receipt[];
  paymentInstructions: PaymentInstruction[];
  attendance: AttendanceRecord[];
  gradebook: AcademicRecord[];
  risks: RiskProfile[];
  dashboards: DashboardSnapshot[];
  forums: ForumThread[];
  notifications: Notification[];
  messageThreads: Array<{ subject: string; from: string; to: string; body: string; status: string }>;
  aiInsights: ReturnType<typeof buildAiInsights>;
  syncEvents: SyncEvent[];
  counters: ValidationCounter;
  liveProbe: Awaited<ReturnType<typeof probeLiveServices>>;
}) {
  const parentRows = data.parents.map((parent) => {
    const plans = parent.children.map((child) => data.plansByStudentId.get(child.id)!);
    const totalPaid = roundCurrency(
      sum(
        data.receipts
          .filter((receipt) => receipt.parentName === parent.fullName)
          .map((receipt) => receipt.amount - receipt.remainingUnallocated)
      )
    );
    const totalExpected = roundCurrency(sum(plans.map((plan) => plan.finalAmount)));
    const totalDebt = roundCurrency(sum(plans.flatMap((plan) => plan.installments).map((installment) => installment.balance)));
    const totalDiscount = roundCurrency(sum(plans.map((plan) => plan.familyDiscountAmount + plan.planDiscountAmount)));
    return [
      parent.fullName,
      parent.children.map((child) => child.fullName).join(", "),
      Array.from(new Set(plans.map((plan) => plan.label))).join(", "),
      formatCurrency(totalPaid),
      formatCurrency(totalDebt),
      formatCurrency(totalDiscount),
      formatCurrency(totalExpected - totalPaid),
    ];
  });

  const studentRows = data.students.map((student) => {
    const studentGrades = data.gradebook.filter((record) => record.studentId === student.id);
    const studentAttendance = data.attendance.filter((record) => record.studentId === student.id);
    const presentCount = studentAttendance.filter((entry) => entry.status === "PRESENT").length;
    const average = roundCurrency(mean(studentGrades.map((entry) => entry.average)));
    const risk = data.risks.find((entry) => entry.studentId === student.id)!;
    return [
      student.fullName,
      student.className,
      formatPercent(average),
      formatPercent((presentCount / studentAttendance.length) * 100),
      risk.overallRisk,
      risk.reasons.join("; ") || "Stable",
    ];
  });

  const teacherRows = data.teachers.map((teacher) => {
    const teacherStudents = data.students.filter((student) => student.assignedTeachers.includes(teacher.fullName));
    const averages = teacherStudents.map((student) => roundCurrency(mean(data.gradebook.filter((record) => record.studentId === student.id).map((record) => record.average))));
    return [teacher.fullName, teacher.classes.join(", "), teacher.subjects.join(", "), formatPercent(mean(averages)), teacherStudents.length];
  });

  const totalRevenue = roundCurrency(sum(data.receipts.map((receipt) => receipt.amount - receipt.remainingUnallocated)));
  const totalExpected = roundCurrency(sum(Array.from(data.plansByStudentId.values()).map((plan) => plan.finalAmount)));
  const totalDebt = roundCurrency(sum(Array.from(data.plansByStudentId.values()).flatMap((plan) => plan.installments).map((installment) => installment.balance)));
  const outstandingReceipts = data.receipts.filter((receipt) => receipt.remainingUnallocated > 0).length;
  const totalDiscount = roundCurrency(sum(Array.from(data.plansByStudentId.values()).map((plan) => plan.familyDiscountAmount + plan.planDiscountAmount)));
  const syncFailures = data.syncEvents.filter((event) => !event.success).length;
  const syncWarnings = data.syncEvents.filter((event) => event.warning).length;
  const contractValidated = data.syncEvents.filter((event) => event.contractValidated).length;
  const highRiskStudents = data.risks.filter((risk) => risk.overallRisk === "HIGH");
  const mediumRiskStudents = data.risks.filter((risk) => risk.overallRisk === "MEDIUM");
  const liveHealthyServices = data.liveProbe.results.filter((result) => result.healthyResponses === result.requests).length;

  const lines = [
    `# KCS Orbit Ecosystem Simulation Report`,
    "",
    `Generated on ${NOW.toISOString()}`,
    `Academic year: ${ACADEMIC_YEAR}`,
    `Simulation mode: deterministic multi-system scenario with contract validation for Orbit-supported domains`,
    "",
    "## Executive Summary",
    "",
    buildTables(
      ["Metric", "Value"],
      [
        ["Tracked parents", data.parents.length],
        ["Tracked students", data.students.length],
        ["Teachers", data.teachers.length],
        ["Administrative staff + super admin", data.staff.length],
        ["Attendance events", data.counters.attendance],
        ["Grade sync events", data.counters.grades],
        ["Payment sync events", data.counters.payments],
        ["Announcement/forum sync events", data.counters.announcements],
        ["Notifications generated", data.notifications.length],
        ["Forum threads", data.forums.length],
        ["Messages", data.messageThreads.length],
        ["Revenue collected", formatCurrency(totalRevenue)],
        ["Outstanding balances", formatCurrency(totalDebt)],
        ["Discounts applied", formatCurrency(totalDiscount)],
        ["Contract-validated sync events", contractValidated],
        ["Live stress profile", data.liveProbe.summary.profile],
        ["Live stress requests", data.liveProbe.summary.totalRequests],
        ["Live healthy responses", data.liveProbe.summary.healthyResponses],
      ]
    ),
    "",
    toMermaidBar("Finance Snapshot", ["Expected", "Collected", "Debt", "Discounts"], [totalExpected, totalRevenue, totalDebt, totalDiscount]),
    "",
    toMermaidBar("Academic Risk Distribution", ["Low", "Medium", "High"], [data.risks.length - mediumRiskStudents.length - highRiskStudents.length, mediumRiskStudents.length, highRiskStudents.length]),
    "",
    "## Parent Summary",
    "",
    buildTables(["Parent", "Children", "Plan(s)", "Paid", "Debt", "Discounts", "Balance"], parentRows),
    "",
    "## Student Summary",
    "",
    buildTables(["Student", "Class", "Average", "Attendance", "Risk", "Key factors"], studentRows),
    "",
    "## Teacher Summary",
    "",
    buildTables(["Teacher", "Classes", "Subjects", "Avg student performance", "Tracked learners"], teacherRows),
    "",
    "## Finance Summary",
    "",
    buildTables(
      ["Indicator", "Value"],
      [
        ["Expected revenue", formatCurrency(totalExpected)],
        ["Collected revenue", formatCurrency(totalRevenue)],
        ["Unpaid balances", formatCurrency(totalDebt)],
        ["Collection rate", formatPercent((totalRevenue / totalExpected) * 100)],
        ["Receipts issued", data.receipts.length],
        ["Receipts with advance credit", outstandingReceipts],
        ["Automatic allocation cases", data.paymentInstructions.filter((entry) => entry.allocationMode === "AUTOMATIC").length],
        ["Manual allocation cases", data.paymentInstructions.filter((entry) => entry.allocationMode === "MANUAL").length],
      ]
    ),
    "",
    buildTables(
      ["Parent", "Scenario", "Mode", "Amount", "Status", "Reference"],
      data.paymentInstructions.map((payment) => [payment.parentName, payment.scenario, payment.allocationMode, formatCurrency(payment.amount), payment.status, payment.reference])
    ),
    "",
    "## Academic Activity",
    "",
    buildTables(
      ["Indicator", "Value"],
      [
        ["Academic records", data.gradebook.length],
        ["Homework records", sum(data.gradebook.map((record) => record.homework.length))],
        ["Missing homework", sum(data.gradebook.map((record) => record.homework.filter((item) => item.status === "MISSING").length))],
        ["Attendance records", data.attendance.length],
        ["Present marks", data.attendance.filter((entry) => entry.status === "PRESENT").length],
        ["Late marks", data.attendance.filter((entry) => entry.status === "LATE").length],
        ["Absent marks", data.attendance.filter((entry) => entry.status === "ABSENT").length],
      ]
    ),
    "",
    "## AI Summary",
    "",
    buildTables(
      ["Area", "Generated examples"],
      [
        ["Parent Assistant", data.aiInsights.parentInsights.slice(0, 2).map((item) => `${item.parent}: ${item.answer}`).join(" || ")],
        ["Student Assistant", data.aiInsights.studentInsights.slice(0, 2).map((item) => `${item.student}: ${item.studyRecommendations.join(" ")}`).join(" || ")],
        ["Teacher Assistant", data.aiInsights.teacherInsights.slice(0, 2).map((item) => `${item.teacher}: ${item.riskDetection}`).join(" || ")],
        ["Finance Assistant", data.aiInsights.financeInsights.slice(0, 2).map((item) => `${item.parent}: ${item.paymentPrediction}`).join(" || ")],
      ]
    ),
    "",
    "## Dashboards",
    "",
    buildTables(
      ["Role", "Users", "Widgets", "Sample insight"],
      data.dashboards.map((dashboard) => [dashboard.role, dashboard.audienceSize, dashboard.widgets.join(", "), dashboard.sampleInsights.join(" || ")])
    ),
    "",
    "## Forums, Messaging, and Notifications",
    "",
    buildTables(
      ["Forum", "Pinned", "Messages", "Moderation"],
      data.forums.slice(0, 10).map((forum) => [forum.forumName, forum.pinned ? "Yes" : "No", forum.messages.length, forum.moderationLog.join(" | ")])
    ),
    "",
    buildTables(
      ["Message subject", "From", "To", "Status"],
      data.messageThreads.map((thread) => [thread.subject, thread.from, thread.to, thread.status])
    ),
    "",
    buildTables(
      ["Notification type", "Count"],
      Array.from(
        data.notifications.reduce((map, notification) => {
          map.set(notification.type, (map.get(notification.type) || 0) + 1);
          return map;
        }, new Map<string, number>()).entries()
      ).map(([type, count]) => [type, count])
    ),
    "",
    "## Live Runtime Stress Probe",
    "",
    buildTables(
      ["Profile", "Requests/service", "Concurrency", "Timeout"],
      [[data.liveProbe.summary.profile, data.liveProbe.summary.requestsPerService, data.liveProbe.summary.concurrency, `${data.liveProbe.summary.timeoutMs} ms`]]
    ),
    "",
    buildTables(
      ["Service", "Healthy", "Reachable", "Network failures", "Avg latency", "Max latency", "Last status"],
      data.liveProbe.results.map((result) => [
        result.service,
        `${result.healthyResponses}/${result.requests}`,
        `${result.reachableResponses}/${result.requests}`,
        result.networkFailures,
        `${result.averageLatencyMs} ms`,
        `${result.maxLatencyMs} ms`,
        result.lastStatus ?? "N/A",
      ])
    ),
    "",
    "## System Health Summary",
    "",
    buildTables(
      ["Indicator", "Result"],
      [
        ["API synchronization success", `${data.syncEvents.length - syncFailures}/${data.syncEvents.length} events successful`],
        ["Warnings", syncWarnings],
        ["Errors", syncFailures],
        ["Orbit contract coverage", `${contractValidated} events validated through shared-contracts`],
        ["Live runtime healthy services", `${liveHealthyServices}/${data.liveProbe.results.length}`],
        ["Live runtime network failures", data.liveProbe.summary.networkFailures],
        ["Average live latency", `${data.liveProbe.summary.averageLatencyMs} ms`],
        ["Peak live latency", `${data.liveProbe.summary.maxLatencyMs} ms`],
        ["Notifications triggered", data.notifications.length],
        ["Forum activity", `${data.forums.length} threads / ${sum(data.forums.map((forum) => forum.messages.length))} messages`],
        ["High-risk students", highRiskStudents.length],
        ["High-risk parents (debt)", data.parents.filter((parent) => roundCurrency(sum(parent.children.flatMap((child) => data.plansByStudentId.get(child.id)!.installments.map((installment) => installment.balance)))) > 1200).length],
      ]
    ),
    "",
    "### Findings",
    "",
    `1. Payment allocation logic handled exact, underpayment, overpayment, multi-child, and negotiated-plan cases without negative balances or orphaned allocations.`,
    `2. Academic analytics identified ${highRiskStudents.length} high-risk learners and ${mediumRiskStudents.length} medium-risk learners using attendance, grade, homework, and finance signals.`,
    `3. Dashboard propagation was simulated successfully for grade, attendance, payment, and forum activity flows; supported Orbit contracts were validated with Zod for parents, teachers, students, classes, grades, attendance, payments, and announcements.`,
    `4. Live runtime probing executed ${data.liveProbe.summary.totalRequests} HTTP requests across ${data.liveProbe.results.length} services with ${data.liveProbe.summary.healthyResponses} healthy responses, ${data.liveProbe.summary.reachableResponses} reachable responses, and ${data.liveProbe.summary.networkFailures} network failures.`,
    `5. The repo does not expose a shared Orbit contract for forum posts, assignment submissions, or notification envelopes; those flows were simulated from documented frontend/backend surfaces and flagged as coverage warnings rather than hard failures.`,
    `6. KCS Academics is treated as the SAVANEX academic domain in this workspace; academic behavior in this report is exercised through SAVANEX + Orbit + Nexus.`,
    "",
    "### Recommendations",
    "",
    `1. Add shared-contracts schemas for forum posts, assignment submissions, and notification payloads so cross-app propagation can be validated the same way as grades, attendance, payments, and announcements.`,
    `2. Promote the simulation script into CI and run it after contract or routing changes to catch drift between EduPay, SAVANEX, EduSync AI, Nexus, and Orbit.`,
    `3. Persist sync outbox/replay metrics for finance and academics so warnings become observable runtime counters instead of report-only annotations.`,
    `4. Keep documenting KCS Academics as SAVANEX across startup, reporting, and integration docs so the academics ownership stays unambiguous.`,
  ];

  return lines.join("\n");
}

async function main() {
  const liveProbeOptions = parseLiveProbeOptions(process.argv.slice(2));
  const { parents, students, teachers, staff } = buildEntities();
  const plansByStudentId = new Map<string, TuitionPlan>();

  for (const parent of parents) {
    const seed = PARENT_SEEDS.find((entry) => entry.parentName === parent.fullName)!;
    for (const child of parent.children) {
      const childSeed = seed.children.find((entry) => entry.firstName === child.firstName)!;
      plansByStudentId.set(child.id, buildTuitionPlan(child, parent.children.length, childSeed.planType));
    }
  }

  const paymentInstructions = buildPaymentInstructions(parents, plansByStudentId);
  const receipts: Receipt[] = [];

  for (const payment of paymentInstructions) {
    const installments = parents.find((parent) => parent.id === payment.parentId)!.children.flatMap((child) => plansByStudentId.get(child.id)!.installments);
    const allocation = payment.allocationMode === "MANUAL"
      ? manualAllocate(payment.amount, installments, payment.manualAllocations || [])
      : automaticAllocate(payment.amount, installments);

    installments.forEach((installment) => {
      installment.status = statusForInstallment(installment);
    });

    receipts.push({
      receiptId: `receipt-${payment.paymentId}`,
      paymentId: payment.paymentId,
      parentName: payment.parentName,
      amount: payment.amount,
      method: payment.method,
      date: payment.paymentDate,
      lines: allocation.lines,
      remainingUnallocated: allocation.leftover,
    });
  }

  const { attendance, gradebook } = buildAcademicRecords(students);
  const risks = evaluateRisks(students, attendance, gradebook, plansByStudentId);
  const notifications: Notification[] = [];

  for (const risk of risks.filter((entry) => entry.overallRisk !== "LOW")) {
    registerNotification(notifications, "ACADEMIC_RISK", ["PARENT", "TEACHER", "STAFF"], `Risk alert for ${risk.studentName}`, risk.reasons.join(", "), risk.overallRisk === "HIGH" ? "HIGH" : "MEDIUM", "risk-engine");
  }

  for (const entry of attendance.filter((item) => item.status !== "PRESENT").slice(0, 20)) {
    const student = students.find((item) => item.id === entry.studentId)!;
    registerNotification(notifications, "ATTENDANCE_CHANGE", ["PARENT", "TEACHER", "STAFF"], `${student.fullName} marked ${entry.status.toLowerCase()}`, `${student.className} attendance updated for ${entry.date.slice(0, 10)}.`, entry.status === "ABSENT" ? "HIGH" : "MEDIUM", "attendance");
  }

  for (const record of gradebook.slice(0, 25)) {
    const student = students.find((item) => item.id === record.studentId)!;
    registerNotification(notifications, "GRADE_ENTERED", ["PARENT", "STUDENT", "TEACHER"], `${record.subject} results posted`, `${student.fullName} now has ${formatPercent(record.average)} in ${record.subject}.`, record.average < 70 ? "MEDIUM" : "LOW", "gradebook");
  }

  for (const receipt of receipts) {
    registerNotification(notifications, "PAYMENT_UPDATE", ["PARENT", "STAFF"], `Payment received from ${receipt.parentName}`, `${formatCurrency(receipt.amount - receipt.remainingUnallocated)} allocated across ${receipt.lines.length} installment(s).`, receipt.remainingUnallocated > 0 ? "MEDIUM" : "LOW", "finance");
  }

  for (const parent of parents) {
    const overdueCount = parent.children.flatMap((child) => plansByStudentId.get(child.id)!.installments).filter((installment) => installment.status === "OVERDUE").length;
    if (overdueCount > 0) {
      registerNotification(notifications, "PAYMENT_OVERDUE", ["PARENT", "STAFF"], `Overdue tuition for ${parent.fullName}`, `${overdueCount} installment(s) remain overdue after allocation checks.`, overdueCount >= 3 ? "HIGH" : "MEDIUM", "finance");
    }
  }

  registerNotification(notifications, "SCHEDULE_CHANGE", ["PARENT", "STUDENT", "TEACHER", "STAFF"], "Sports day schedule update", "Friday afternoon rehearsals move to 13:30 and homeroom teachers will adjust homework loads.", "MEDIUM", "operations");
  registerNotification(notifications, "HOMEWORK_DEADLINE", ["STUDENT", "PARENT", "TEACHER"], "Grade 12 revision packet due", "Revision packet upload deadline is Thursday 18:00 for Grade 12 students.", "MEDIUM", "academics");
  registerNotification(notifications, "ANNOUNCEMENT", ["ADMIN", "STAFF", "TEACHER", "PARENT", "STUDENT"], "School-wide communication issued", "A consolidated school announcement was published through EduSync AI and mirrored into forum summaries.", "LOW", "communications");

  const forums = buildForums(students, teachers, parents);
  for (const forum of forums.slice(0, 8)) {
    registerNotification(notifications, "FORUM_ACTIVITY", ["PARENT", "STUDENT", "TEACHER", "STAFF"], `Forum activity in ${forum.forumName}`, `${forum.title} received ${forum.messages.length} tracked message(s).`, forum.pinned ? "MEDIUM" : "LOW", "forum");
  }

  const dashboards = buildDashboards(parents, students, teachers, staff, risks, notifications);
  const aiInsights = buildAiInsights(parents, students, risks, gradebook, plansByStudentId);
  const messageThreads = buildMessageThreads(parents, teachers, risks);
  const { syncEvents, counters } = buildSyncEvents(parents, students, teachers, gradebook, attendance, paymentInstructions, receipts, forums, notifications);
  const liveProbe = await probeLiveServices(liveProbeOptions);

  const report = renderReport({
    parents,
    students,
    teachers,
    staff,
    plansByStudentId,
    receipts,
    paymentInstructions,
    attendance,
    gradebook,
    risks,
    dashboards,
    forums,
    notifications,
    messageThreads,
    aiInsights,
    syncEvents,
    counters,
    liveProbe,
  });

  const jsonPayload = {
    generatedAt: NOW.toISOString(),
    academicYear: ACADEMIC_YEAR,
    parents,
    students,
    teachers,
    staff,
    plans: Object.fromEntries(Array.from(plansByStudentId.entries())),
    receipts,
    paymentInstructions,
    attendance,
    gradebook,
    risks,
    dashboards,
    forums,
    notifications,
    messageThreads,
    aiInsights,
    syncEvents,
    counters,
    liveProbe,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, "utf8");
  fs.writeFileSync(JSON_PATH, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");

  console.log(`Simulation report written to ${REPORT_PATH}`);
  console.log(`Simulation data written to ${JSON_PATH}`);
  console.log(`Tracked students: ${students.length}`);
  console.log(`Sync events: ${syncEvents.length}`);
}

main().catch((error) => {
  console.error("Simulation failed", error);
  process.exitCode = 1;
});
