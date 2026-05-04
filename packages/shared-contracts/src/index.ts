import { z } from "zod";

export const AppSlugSchema = z.enum([
  "KCS_NEXUS",
  "EDUPAY",
  "EDUSYNCAI",
  "SAVANEX"
]);

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

export const StudentPayloadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.string().min(1),
  classExternalId: z.string().min(1).optional(),
  parentExternalId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  status: z.string().min(1).optional()
});

export const ClassPayloadSchema = z.object({
  name: z.string().min(1),
  gradeLevel: z.string().min(1).optional(),
  teacherExternalId: z.string().min(1).optional()
});

export const ParentPayloadSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional()
});

export const TeacherPayloadSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  subject: z.string().min(1).optional()
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