import { Router } from "express";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import {
  requireSuperAdmin,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { ApiError, asyncHandler, success } from "../utils/api.js";
import { databaseActorId } from "../utils/databaseActor.js";
import { isSequentialAcademicYear } from "../utils/academicCycle.js";
import { normalizeClassParts } from "../utils/className.js";
import { officialCertificatePdf } from "../utils/officialCertificatePdf.js";

export const certificateDeliveryRouter = Router();
certificateDeliveryRouter.use(requireSuperAdmin());
const identity = { firstName: true, middleName: true, lastName: true } as const;
const selection = {
  id: true,
  studentNumber: true,
  grade: true,
  section: true,
  user: { select: { id: true, ...identity } },
  parentLinks: {
    orderBy: { parentId: "asc" },
    select: {
      parent: { select: { id: true, ...identity, email: true, phone: true } },
    },
  },
} as const;
const fullName = (user: {
  firstName: string;
  middleName: string | null;
  lastName: string;
}) =>
  [user.lastName, user.middleName, user.firstName].filter(Boolean).join(" ");

type CertificateOptions = {
  academicYear: string;
  documentType: "completion" | "attendance";
  language: "fr" | "en";
  includeAuthentication: boolean;
};
type CertificateStudent = Prisma.StudentProfileGetPayload<{
  select: typeof selection;
}>;
async function buildDocuments(
  students: CertificateStudent[],
  options: CertificateOptions,
  actorId: string,
) {
  const [account, leadership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: actorId },
      select: { ...identity, signatureImage: true, officialSealImage: true },
    }),
    prisma.user.findMany({
      where: {
        signatureImage: { not: null },
        OR: [{ role: "STAFF" }, { role: "ADMIN" }],
      },
      select: {
        ...identity,
        signatureImage: true,
        staffFunction: true,
        staffProfile: { select: { function: true } },
      },
    }),
  ]);
  const title = (user: (typeof leadership)[number]) =>
    `${user.staffFunction || ""} ${user.staffProfile?.function || ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const signature = (
    user:
      | {
          firstName: string;
          middleName: string | null;
          lastName: string;
          signatureImage: string | null;
        }
      | null
      | undefined,
  ) => (user ? { name: fullName(user), image: user.signatureImage } : null);
  const principal = signature(
    leadership.find((user) => /principal|prefet/.test(title(user))) ?? account,
  );
  const headOfSchool = signature(
    leadership.find((user) =>
      /head of school|school head|directeur|direction/.test(title(user)),
    ),
  );
  const documents = new Map<
    string,
    Awaited<ReturnType<typeof officialCertificatePdf>>
  >();
  for (const student of students)
    documents.set(
      student.id,
      await officialCertificatePdf({
        studentId: student.id,
        studentNumber: student.studentNumber,
        studentName: fullName(student.user),
        grade: [student.grade, student.section].filter(Boolean).join(" "),
        academicYear: options.academicYear,
        documentType: options.documentType,
        language: options.language,
        includeAuthentication: options.includeAuthentication,
        principal,
        headOfSchool,
        seal: account?.officialSealImage,
      }),
    );
  return documents;
}

certificateDeliveryRouter.get(
  "/recipients",
  asyncHandler(async (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    return success(
      res,
      await prisma.studentProfile.findMany({
        where: { archive: null },
        select: selection,
        orderBy: { user: { lastName: "asc" } },
      }),
      "Certificate parent recipients loaded",
    );
  }),
);

certificateDeliveryRouter.get(
  "/workflow",
  asyncHandler(async (req, res) => {
    const academicYear = z
      .string()
      .refine(isSequentialAcademicYear)
      .parse(req.query.academicYear);
    const documentType = z
      .enum(["completion", "attendance"])
      .parse(req.query.documentType);
    const prefix = documentType === "completion" ? "KCS-CERT-" : "KCS-ATT-";
    const records = await prisma.auditLog.findMany({
      where: {
        action: "CERTIFICATE_VERIFICATION_ISSUED",
        targetType: "OfficialCompletionCertificate",
        targetId: { startsWith: prefix },
        metadata: { path: ["academicYear"], equals: academicYear },
      },
      orderBy: { createdAt: "desc" },
      select: { targetId: true, createdAt: true, metadata: true },
    });
    const workflow = new Map<
      string,
      {
        studentId: string;
        status: "READY" | "SENT";
        documentId: string;
        recordedAt: string;
      }
    >();
    for (const record of records) {
      const metadata = record.metadata as {
        studentId?: string;
        deliveryRecorded?: boolean;
      };
      if (metadata.studentId && !workflow.has(metadata.studentId))
        workflow.set(metadata.studentId, {
          studentId: metadata.studentId,
          status: metadata.deliveryRecorded ? "SENT" : "READY",
          documentId: record.targetId!,
          recordedAt: record.createdAt.toISOString(),
        });
    }
    res.setHeader("Cache-Control", "private, no-store");
    return success(
      res,
      [...workflow.values()],
      "Certificate preparation workflow loaded",
    );
  }),
);

certificateDeliveryRouter.post(
  "/prepare",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const options = z
      .object({
        academicYear: z.string().refine(isSequentialAcademicYear),
        documentType: z.enum(["completion", "attendance"]),
        language: z.enum(["fr", "en"]),
        includeAuthentication: z.boolean(),
        studentIds: z.array(z.string().min(1)).min(1).max(50),
      })
      .parse(req.body);
    const actorId = await databaseActorId(req.user!.sub);
    const students = await prisma.studentProfile.findMany({
      where: { id: { in: [...new Set(options.studentIds)] }, archive: null },
      select: selection,
      orderBy: { id: "asc" },
    });
    if (students.length !== new Set(options.studentIds).size)
      throw new ApiError(
        409,
        options.language === "fr"
          ? "Actualisez la sélection des élèves."
          : "Refresh the learner selection.",
      );
    if (
      options.documentType === "completion" &&
      students.some(
        (student) =>
          !["K4", "Grade 4", "Grade 8"].includes(
            normalizeClassParts(student.grade, student.section).grade,
          ),
      )
    )
      throw new ApiError(
        409,
        options.language === "fr"
          ? "Certificats de réussite réservés à K4, Grade 4 et Grade 8."
          : "Completion certificates are restricted to K4, Grade 4 and Grade 8.",
      );
    const documents = await buildDocuments(students, options, actorId);
    await prisma.$transaction(
      async (tx) => {
        for (const student of students) {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "StudentProfile" WHERE id = ${student.id} FOR SHARE`,
          );
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "User" WHERE id = ${student.user.id} FOR SHARE`,
          );
          const current = await tx.studentProfile.findFirst({
            where: { id: student.id, archive: null },
            select: selection,
          });
          if (JSON.stringify(current) !== JSON.stringify(student))
            throw new ApiError(
              409,
              options.language === "fr"
                ? "Le dossier a changé. Actualisez avant de préparer le certificat."
                : "The record changed. Refresh before preparing the certificate.",
            );
          const pdf = documents.get(student.id)!;
          await tx.auditLog.upsert({
            where: { id: "certificate-ready-" + pdf.documentId },
            update: {},
            create: {
              id: "certificate-ready-" + pdf.documentId,
              actorId,
              action: "CERTIFICATE_VERIFICATION_ISSUED",
              targetType: "OfficialCompletionCertificate",
              targetId: pdf.documentId,
              metadata: {
                fingerprint: pdf.fingerprint,
                studentId: student.id,
                studentName: fullName(student.user),
                studentNumber: student.studentNumber,
                grade: student.grade,
                academicYear: options.academicYear,
                documentType: options.documentType,
                language: options.language,
                deliveryRecorded: false,
                preparationConfirmed: true,
              },
            },
          });
        }
      },
      { maxWait: 10000, timeout: 60000 },
    );
    return success(
      res,
      { prepared: students.length },
      options.language === "fr"
        ? "Certificats préparés et classés dans « Prêts à envoyer »."
        : "Certificates prepared and filed under “Ready to send”.",
    );
  }),
);

certificateDeliveryRouter.post(
  "/deliver",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const payload = z
      .object({
        requestId: z.string().min(8).max(128),
        academicYear: z.string().refine(isSequentialAcademicYear),
        documentType: z.enum(["completion", "attendance"]),
        language: z.enum(["fr", "en"]),
        includeAuthentication: z.boolean(),
        deliveries: z
          .array(
            z.object({
              studentId: z.string().min(1),
              parentIds: z.array(z.string().min(1)).min(1).max(10),
            }),
          )
          .min(1)
          .max(50),
      })
      .parse(req.body);
    const tr = (fr: string, en: string) =>
      payload.language === "fr" ? fr : en;
    const actorId = await databaseActorId(req.user!.sub);
    const deliveries = new Map<string, string[]>();
    for (const item of payload.deliveries)
      deliveries.set(
        item.studentId,
        [
          ...new Set([
            ...(deliveries.get(item.studentId) ?? []),
            ...item.parentIds,
          ]),
        ].sort(),
      );
    const normalized = [...deliveries].sort(([a], [b]) => a.localeCompare(b));
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          ...payload,
          requestId: undefined,
          deliveries: normalized,
        }),
      )
      .digest("hex");
    const batchId =
      "certificate-delivery-" +
      createHash("sha256")
        .update(actorId + ":" + payload.requestId)
        .digest("hex");
    const replay = async () => {
      const previous = await prisma.auditLog.findUnique({
        where: { id: batchId },
        select: { metadata: true },
      });
      if (!previous) return null;
      const data = previous.metadata as {
        requestHash: string;
        certificates: number;
        recipients: number;
      };
      if (data.requestHash !== requestHash)
        throw new ApiError(
          409,
          tr(
            "La demande réutilisée contient une autre sélection.",
            "The reused request contains a different selection.",
          ),
        );
      return { certificates: data.certificates, recipients: data.recipients };
    };
    const previous = await replay();
    if (previous)
      return success(
        res,
        previous,
        tr("Envoi déjà enregistré.", "Delivery already recorded."),
      );
    const students = await prisma.studentProfile.findMany({
      where: { id: { in: [...deliveries.keys()] }, archive: null },
      select: selection,
      orderBy: { id: "asc" },
    });
    if (students.length !== deliveries.size)
      throw new ApiError(
        409,
        tr(
          "Un élève sélectionné est indisponible. Actualisez le registre.",
          "A selected learner is unavailable. Refresh the registry.",
        ),
      );
    for (const student of students) {
      if (
        payload.documentType === "completion" &&
        !["K4", "Grade 4", "Grade 8"].includes(
          normalizeClassParts(student.grade, student.section).grade,
        )
      )
        throw new ApiError(
          409,
          tr(
            "Les certificats de réussite sont réservés à K4, Grade 4 et Grade 8.",
            "Completion certificates are restricted to K4, Grade 4 and Grade 8.",
          ),
        );
      for (const id of deliveries.get(student.id)!) {
        const parent = student.parentLinks.find(
          (link) => link.parent.id === id,
        )?.parent;
        if (!parent?.email?.trim())
          throw new ApiError(
            409,
            tr(
              "Chaque destinataire doit être un parent lié disposant d’un e-mail.",
              "Every recipient must be a linked parent with an email address.",
            ),
          );
      }
    }
    const documents = await buildDocuments(students, payload, actorId);
    const recipients = normalized.reduce((sum, [, ids]) => sum + ids.length, 0);
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.auditLog.create({
            data: {
              id: batchId,
              actorId,
              action: "CERTIFICATE_DELIVERY_BATCH",
              targetType: "CertificateBatch",
              metadata: {
                requestHash,
                certificates: students.length,
                recipients,
              },
            },
          });
          for (const student of students) {
            await tx.$queryRaw(
              Prisma.sql`SELECT id FROM "StudentProfile" WHERE id = ${student.id} FOR SHARE`,
            );
            await tx.$queryRaw(
              Prisma.sql`SELECT "parentId" FROM "ParentStudentLink" WHERE "studentId" = ${student.id} FOR SHARE`,
            );
            const parentIds = deliveries.get(student.id)!;
            await tx.$queryRaw(
              Prisma.sql`SELECT id FROM "User" WHERE id IN (${Prisma.join([...parentIds, student.user.id])}) FOR SHARE`,
            );
            const current = await tx.studentProfile.findFirst({
              where: { id: student.id, archive: null },
              select: selection,
            });
            if (JSON.stringify(current) !== JSON.stringify(student))
              throw new ApiError(
                409,
                tr(
                  "Le dossier familial a changé. Actualisez avant l’envoi.",
                  "The family record changed. Refresh before sending.",
                ),
              );
            const pdf = documents.get(student.id)!;
            const documentTitle =
              payload.documentType === "completion"
                ? tr(
                    "Certificat officiel de réussite",
                    "Official certificate of completion",
                  )
                : tr(
                    "Attestation de fréquentation",
                    "Certificate of attendance",
                  );
            const subject = `KCS · ${documentTitle} · ${fullName(student.user)}`;
            const body = tr(
              `Bonjour,\n\nVeuillez trouver en pièce jointe le document « ${documentTitle} » de ${fullName(student.user)}, matricule ${student.studentNumber}, pour l’année scolaire ${payload.academicYear}.\n\nSon code QR permet de vérifier son authenticité. Le document reste disponible dans votre messagerie Nexus.\n\nCordialement,\nKinshasa Christian School`,
              `Dear Parent/Guardian,\n\nPlease find attached the ${documentTitle.toLowerCase()} for ${fullName(student.user)}, student ID ${student.studentNumber}, for academic year ${payload.academicYear}.\n\nIts QR code verifies its authenticity. The document also remains available in your Nexus inbox.\n\nSincerely,\nKinshasa Christian School`,
            );
            const attachment = await tx.messageAttachment.create({
              data: {
                name: pdf.documentId + ".pdf",
                mime: "application/pdf",
                size: pdf.buffer.length,
                data: pdf.buffer,
              },
              select: { id: true },
            });
            const parents = student.parentLinks
              .filter((link) => parentIds.includes(link.parent.id))
              .map((link) => link.parent);
            const ids = new Map(
              parents.map((parent) => [parent.id, randomUUID()]),
            );
            await tx.internalMessage.createMany({
              data: parents.map((parent) => ({
                id: ids.get(parent.id)!,
                senderId: actorId,
                recipientId: parent.id,
                subject,
                body,
                priority: "high",
                attachmentName: pdf.documentId + ".pdf",
                attachmentMime: "application/pdf",
                attachmentSize: pdf.buffer.length,
                sharedAttachmentId: attachment.id,
              })),
            });
            await tx.notification.createMany({
              data: parents.map((parent) => ({
                userId: parent.id,
                title: subject,
                message: body,
                type: "MESSAGE",
                link: "/portal/parent/messages",
              })),
            });
            await tx.correspondenceLog.createMany({
              data: parents.map((parent) => ({
                channel: "EMAIL",
                status: "QUEUED",
                subject,
                body,
                senderId: actorId,
                recipientName: fullName(parent),
                recipientEmail: parent.email,
                recipientPhone: parent.phone,
                studentId: student.id,
                metadata: {
                  mailQueueVersion: 1,
                  internalMessageId: ids.get(parent.id)!,
                  recipientId: parent.id,
                  attempts: 0,
                  nextAttemptAt: new Date().toISOString(),
                  priority: "HIGH",
                  language: payload.language,
                  documentId: pdf.documentId,
                },
              })),
            });
            await tx.auditLog.create({
              data: {
                actorId,
                action: "CERTIFICATE_VERIFICATION_ISSUED",
                targetType: "OfficialCompletionCertificate",
                targetId: pdf.documentId,
                metadata: {
                  fingerprint: pdf.fingerprint,
                  studentId: student.id,
                  studentName: fullName(student.user),
                  studentNumber: student.studentNumber,
                  grade: student.grade,
                  academicYear: payload.academicYear,
                  documentType: payload.documentType,
                  language: payload.language,
                  deliveryRecorded: true,
                },
              },
            });
          }
        },
        { maxWait: 10000, timeout: 60000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const confirmed = await replay();
        if (confirmed)
          return success(
            res,
            confirmed,
            tr("Envoi déjà enregistré.", "Delivery already recorded."),
          );
      }
      throw error;
    }
    return success(
      res,
      { certificates: students.length, recipients },
      tr(
        "Certificats placés dans la file d’envoi sécurisée et disponibles dans la messagerie des parents.",
        "Certificates safely queued for email delivery and available in parents’ inboxes.",
      ),
    );
  }),
);
