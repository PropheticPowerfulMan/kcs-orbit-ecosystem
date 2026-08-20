import { z } from "zod";
export * from "./academic-year.js";

const TrimmedStringSchema = z.string().trim().min(1);

export const AppSlugSchema = z.enum([
  "KCS_NEXUS",
  "EDUPAY",
  "EDUSYNCAI",
  "SAVANEX"
]);

export const RegistryEntityTypeSchema = z.enum([
  "family",
  "parent",
  "student",
  "teacher"
]);

export const CanonicalIdAppPrefix = {
  KCS_NEXUS: "KCSNEX",
  EDUPAY: "EDUPAY",
  EDUSYNCAI: "EDUSAI",
  SAVANEX: "SAV"
} as const;

export const CanonicalIdEntityPrefix = {
  family: "FAM",
  parent: "PAR",
  student: "STU",
  teacher: "TEA"
} as const;

export function buildCanonicalExternalId(input: {
  appSlug: z.infer<typeof AppSlugSchema>;
  entityType: z.infer<typeof RegistryEntityTypeSchema>;
  seed?: string;
  now?: Date;
}) {
  const appPrefix = CanonicalIdAppPrefix[input.appSlug];
  const entityPrefix = CanonicalIdEntityPrefix[input.entityType];
  const now = input.now || new Date();
  const datePart = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0")
  ].join("");
  const entropy = (input.seed || Math.random().toString(36).slice(2))
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .padEnd(6, "0")
    .slice(0, 6);

  return `${appPrefix}-${entityPrefix}-${datePart}-${entropy}`;
}

export function pickPreferredExternalId(
  externalIds: Array<{ appSlug: string; externalId: string }>,
  fallback: string,
  priority = ["SAVANEX", "KCS_NEXUS", "EDUPAY", "EDUSYNCAI"]
) {
  for (const appSlug of priority) {
    const match = externalIds.find((entry) => entry.appSlug === appSlug && entry.externalId.trim());
    if (match) {
      return match.externalId.trim();
    }
  }

  return externalIds.find((entry) => entry.externalId.trim())?.externalId.trim() || fallback;
}

export const RoleAudienceSchema = z.enum([
  "ADMIN",
  "STAFF",
  "TEACHER",
  "PARENT",
  "STUDENT"
]);

export const EventVersionSchema = z.string().min(1).default("1.0.0");

export const IntegrationEnvelopeSchema = z.object({
  organizationId: z.string().min(1),
  externalId: z.string().min(1),
  orbitId: z.string().min(1).optional(),
  sourceApp: AppSlugSchema,
  occurredAt: z.string().datetime(),
  version: EventVersionSchema,
  payload: z.record(z.unknown())
});

export const CanonicalIdentitySchema = z.object({
  firstName: TrimmedStringSchema.optional(),
  middleName: TrimmedStringSchema.optional(),
  lastName: TrimmedStringSchema.optional(),
  fullName: TrimmedStringSchema.optional()
}).superRefine((value, ctx) => {
  if (value.fullName) {
    return;
  }

  if (!value.firstName || !value.lastName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either fullName or both firstName and lastName are required",
    });
  }
});

export const StudentPayloadSchema = z.object({
  firstName: TrimmedStringSchema,
  middleName: TrimmedStringSchema.optional(),
  lastName: TrimmedStringSchema,
  gender: TrimmedStringSchema,
  accessCode: TrimmedStringSchema.optional(),
  studentNumber: TrimmedStringSchema.optional(),
  classExternalId: TrimmedStringSchema.optional(),
  className: TrimmedStringSchema.optional(),
  parentExternalId: TrimmedStringSchema.optional(),
  email: z.string().email().optional(),
  phone: TrimmedStringSchema.optional(),
  dateOfBirth: TrimmedStringSchema.optional(),
  status: TrimmedStringSchema.optional(),
  mustChangePassword: z.boolean().optional(),
  photoData: z.string().optional(),
  photoSource: TrimmedStringSchema.optional()
});

export const ClassPayloadSchema = z.object({
  name: z.string().min(1),
  gradeLevel: z.string().min(1).optional(),
  suffix: TrimmedStringSchema.optional(),
  teacherExternalId: z.string().min(1).optional()
});

export const ParentPayloadSchema = z.object({
  firstName: TrimmedStringSchema.optional(),
  middleName: TrimmedStringSchema.optional(),
  lastName: TrimmedStringSchema.optional(),
  fullName: TrimmedStringSchema.optional(),
  accessCode: TrimmedStringSchema.optional(),
  email: z.string().email().optional(),
  phone: TrimmedStringSchema.optional(),
  physicalAddress: TrimmedStringSchema.optional(),
  mustChangePassword: z.boolean().optional(),
  photoData: z.string().optional(),
  photoSource: TrimmedStringSchema.optional()
}).superRefine((value, ctx) => {
  if (value.fullName || (value.firstName && value.lastName)) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Parent payload requires fullName or firstName and lastName",
  });
});

export const TeacherPayloadSchema = z.object({
  firstName: TrimmedStringSchema.optional(),
  middleName: TrimmedStringSchema.optional(),
  lastName: TrimmedStringSchema.optional(),
  fullName: TrimmedStringSchema.optional(),
  accessCode: TrimmedStringSchema.optional(),
  email: z.string().email().optional(),
  phone: TrimmedStringSchema.optional(),
  physicalAddress: TrimmedStringSchema.optional(),
  subject: TrimmedStringSchema.optional(),
  subjects: z.array(TrimmedStringSchema).optional(),
  employeeId: TrimmedStringSchema.optional(),
  employeeType: TrimmedStringSchema.optional(),
  department: TrimmedStringSchema.optional(),
  jobTitle: TrimmedStringSchema.optional(),
  mustChangePassword: z.boolean().optional(),
  photoData: z.string().optional(),
  photoSource: TrimmedStringSchema.optional()
}).superRefine((value, ctx) => {
  if (value.fullName || (value.firstName && value.lastName)) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Teacher payload requires fullName or firstName and lastName",
  });
});

export const PaymentPayloadSchema = z.object({
  studentExternalId: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default("USD"),
  motif: z.string().min(1),
  method: z.string().min(1).optional(),
  reference: z.string().min(1).optional(),
  status: z.string().min(1).optional()
});

export const AnnouncementPayloadSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: z.array(RoleAudienceSchema).min(1),
  priority: z.string().min(1).optional(),
  channel: z.string().min(1).optional()
});

export const GradePayloadSchema = z.object({
  studentExternalId: z.string().min(1),
  subject: z.string().min(1),
  score: z.number(),
  maxScore: z.number().positive(),
  term: z.string().min(1).optional()
});

export const AttendancePayloadSchema = z.object({
  studentExternalId: z.string().min(1),
  date: z.string().datetime(),
  status: z.string().min(1)
});

export const StudentUpsertSchema = IntegrationEnvelopeSchema.extend({
  sourceApp: z.literal("SAVANEX"),
  payload: StudentPayloadSchema
});

export const ClassUpsertSchema = IntegrationEnvelopeSchema.extend({
  sourceApp: z.literal("SAVANEX"),
  payload: ClassPayloadSchema
});

export const ParentUpsertSchema = IntegrationEnvelopeSchema.extend({
  sourceApp: z.literal("SAVANEX"),
  payload: ParentPayloadSchema
});

export const TeacherUpsertSchema = IntegrationEnvelopeSchema.extend({
  sourceApp: z.literal("SAVANEX"),
  payload: TeacherPayloadSchema
});

export const PaymentCreatedSchema = IntegrationEnvelopeSchema.extend({
  sourceApp: z.literal("EDUPAY"),
  payload: PaymentPayloadSchema
});

export const AnnouncementPublishedSchema = IntegrationEnvelopeSchema.extend({
  sourceApp: z.literal("EDUSYNCAI"),
  payload: AnnouncementPayloadSchema
});

export const GradeUpsertSchema = IntegrationEnvelopeSchema.extend({
  sourceApp: z.literal("SAVANEX"),
  payload: GradePayloadSchema
});

export const AttendanceUpsertSchema = IntegrationEnvelopeSchema.extend({
  sourceApp: z.literal("SAVANEX"),
  payload: AttendancePayloadSchema
});

export type AppSlug = z.infer<typeof AppSlugSchema>;
export type RoleAudience = z.infer<typeof RoleAudienceSchema>;
export type IntegrationEnvelope = z.infer<typeof IntegrationEnvelopeSchema>;
export type StudentUpsert = z.infer<typeof StudentUpsertSchema>;
export type ClassUpsert = z.infer<typeof ClassUpsertSchema>;
export type ParentUpsert = z.infer<typeof ParentUpsertSchema>;
export type TeacherUpsert = z.infer<typeof TeacherUpsertSchema>;
export type PaymentCreated = z.infer<typeof PaymentCreatedSchema>;
export type AnnouncementPublished = z.infer<typeof AnnouncementPublishedSchema>;
export type GradeUpsert = z.infer<typeof GradeUpsertSchema>;
export type AttendanceUpsert = z.infer<typeof AttendanceUpsertSchema>;

export const DomainEventSchemas = {
  studentUpsert: StudentUpsertSchema,
  classUpsert: ClassUpsertSchema,
  parentUpsert: ParentUpsertSchema,
  teacherUpsert: TeacherUpsertSchema,
  paymentCreated: PaymentCreatedSchema,
  announcementPublished: AnnouncementPublishedSchema,
  gradeUpsert: GradeUpsertSchema,
  attendanceUpsert: AttendanceUpsertSchema
};

/** Shared, deterministic academic-year progression rules used by Orbit and the portals. */
export type AcademicProgressionOverride = {
  studentId: string;
  decision: "PROMOTE" | "REPEAT" | "GRADUATE" | "MANUAL_TRANSFER";
  targetClassId?: string;
  reason?: string;
};

export const AcademicProgressionOverrideSchema = z.object({
  studentId: z.string().min(1),
  decision: z.enum(["PROMOTE", "REPEAT", "GRADUATE", "MANUAL_TRANSFER"]),
  targetClassId: z.string().min(1).optional(),
  reason: z.string().trim().optional()
});

export type CanonicalIdentity = {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
};

/** Administrative display: Nom, Postnom, Prenom. */
export function composeCanonicalFullName(identity: CanonicalIdentity) {
  const structured = [identity.lastName, identity.middleName, identity.firstName]
    .map((part) => part?.trim().replace(/\s+/g, " ") || "")
    .filter(Boolean)
    .join(" ");

  return structured || identity.fullName?.trim().replace(/\s+/g, " ") || "";
}

type AcademicStudent = { id: string; firstName: string; lastName: string; classId?: string | null; className?: string | null; status?: string | null; averagePercent?: number | null };
type AcademicClass = { id: string; name: string; gradeLevel?: string | null; suffix?: string | null };

const numericGrade = (value?: string | null) => Number((value || "").match(/\d+/)?.[0] || 0);
const academicYearFor = (date: Date) => {
  const year = date.getUTCFullYear();
  const startsThisYear = date.getUTCMonth() >= 8;
  return `${startsThisYear ? year : year - 1}-${startsThisYear ? year + 1 : year}`;
};

export function getAcademicYearWindow(date = new Date()) {
  const month = date.getUTCMonth();
  const endYear = month >= 8 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
  return { academicYear: academicYearFor(date), startDate: `${endYear - 1}-09-01`, endDate: `${endYear}-06-30`, rolloverDate: `${endYear}-07-01`, isRolloverWindow: month >= 6 && month <= 7 };
}

export function getNextAcademicClassName(className: string) {
  const match = className.trim().match(/^(K4|K5|Grade\s*(\d+))(?:\s+(.+))?$/i);
  if (!match) return null;
  const suffix = match[3] ? ` ${match[3]}` : "";
  if (/^K4$/i.test(match[1])) return `K5${suffix}`;
  if (/^K5$/i.test(match[1])) return `Grade 1${suffix}`;
  const grade = Number(match[2]);
  return grade >= 12 ? null : `Grade ${grade + 1}${suffix}`;
}

export function buildAcademicProgressionPlan(input: {
  students: AcademicStudent[];
  classes: AcademicClass[];
  overrides?: AcademicProgressionOverride[];
  effectiveDate: Date;
  passThreshold?: number;
}) {
  const passThreshold = input.passThreshold ?? 70;
  const window = getAcademicYearWindow(input.effectiveDate);
  const byStudent = new Map((input.overrides || []).map((override) => [override.studentId, override]));
  const items = input.students.map((student) => {
    const override = byStudent.get(student.id);
    const currentClass = input.classes.find((item) => item.id === student.classId) || input.classes.find((item) => item.name === student.className);
    const currentGrade = numericGrade(currentClass?.gradeLevel || currentClass?.name || student.className);
    const passed = student.averagePercent !== null && student.averagePercent !== undefined && student.averagePercent >= passThreshold;
    const defaultDecision = !currentGrade ? "HOLD" : student.averagePercent === null || student.averagePercent === undefined ? "HOLD" : currentGrade >= 12 ? "GRADUATE" : passed ? "PROMOTE" : "REPEAT";
    const decision = override?.decision || defaultDecision;
    const nextClassName = decision === "PROMOTE" ? getNextAcademicClassName(currentClass?.name || student.className || "") : null;
    const targetGrade = decision === "PROMOTE" ? currentGrade + 1 : currentGrade;
    const target = override?.targetClassId
      ? input.classes.find((item) => item.id === override.targetClassId)
      : nextClassName
        ? input.classes.find((item) => item.name.toLowerCase() === nextClassName.toLowerCase())
        : input.classes.find((item) => numericGrade(item.gradeLevel || item.name) === targetGrade && (item.suffix || "") === (currentClass?.suffix || ""));
    const warnings = !currentGrade ? ["CLASS_LEVEL_COULD_NOT_BE_PARSED"] : student.averagePercent === null || student.averagePercent === undefined ? ["PASS_AVERAGE_MISSING"] : decision === "REPEAT" && !override ? ["PASS_THRESHOLD_NOT_MET"] : decision === "MANUAL_TRANSFER" && !target ? ["MANUAL_TRANSFER_REQUIRES_TARGET_CLASS"] : decision === "PROMOTE" && !target ? ["TARGET_CLASS_NOT_FOUND"] : [];
    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      action: decision, decision,
      eventType: `academic_year.${decision.toLowerCase()}`,
      status: decision === "GRADUATE" ? "GRADUATED" : student.status || "ACTIVE",
      fromClassId: currentClass?.id || null, fromClassName: currentClass?.name || student.className || null,
      toClassId: decision === "GRADUATE" ? null : decision === "HOLD" ? currentClass?.id || null : target?.id || currentClass?.id || null,
      toClassName: decision === "GRADUATE" ? null : decision === "HOLD" ? currentClass?.name || student.className || null : target?.name || currentClass?.name || student.className || null,
      averagePercent: student.averagePercent, passThreshold, warnings
    };
  });
  return { ...window, nextAcademicYear: academicYearFor(new Date(Date.UTC(input.effectiveDate.getUTCFullYear() + 1, 8, 1))), effectiveDate: input.effectiveDate.toISOString(), passThreshold, items, warnings: items.flatMap((item) => item.warnings), counts: { PROMOTE: items.filter((item) => item.decision === "PROMOTE").length, REPEAT: items.filter((item) => item.decision === "REPEAT").length, MANUAL_TRANSFER: items.filter((item) => item.decision === "MANUAL_TRANSFER").length, HOLD: items.filter((item) => item.decision === "HOLD").length, GRADUATE: items.filter((item) => item.decision === "GRADUATE").length } };
}
