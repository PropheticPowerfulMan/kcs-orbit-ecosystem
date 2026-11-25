import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './database.js';
import { type Actor, projectAccess, requireRevision, requireReason, audit } from './policy.js';
import { projectTransaction, notify } from './projects.js';
import { JuryError, checksum } from './security.js';
import { recoverGradebook } from './gradebookRecovery.js';
import { normalizeScore } from './scoring.js';
import { protectGradebookEntry } from '../services/academicPeriodAccess.service.js';
const clone = (v: any) => JSON.parse(JSON.stringify(v));
export type Destination = {
    courseId: string;
    mode: 'NEW' | 'EXISTING';
    columnId?: string;
    title: string;
    category: string;
    date: string;
    maximum: string | number;
};
const keyOf = (courseId: string, year: string) => courseId + '::' + year;
export function gradebookView(state: any, courseId: string, academicYear: string, students: {
    id: string;
    studentNumber?: string;
}[]) { const recovered = recoverGradebook({ state: state || {}, courseId, academicYear, students }).snapshot; const primary = state?.advancedGradebookByCycle?.[keyOf(courseId, academicYear)] || (academicYear === '2026-2027' ? state?.advancedGradebookByCourse?.[courseId] : {}) || {}; return { ...primary, ...recovered }; }
export function targetedMerge(state: any, courseId: string, academicYear: string, column: any, rows: {
    studentId: string;
    points: string;
}[], students: any[], savedAt: string) { const next = clone(state || {}), snapshot = gradebookView(next, courseId, academicYear, students); snapshot.assignments = [...snapshot.assignments.filter((a: any) => a.id !== column.id), column].sort((a: any, b: any) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0) || a.id.localeCompare(b.id)); snapshot.scores = { ...snapshot.scores }; for (const row of rows)
    snapshot.scores[column.id + ':' + row.studentId] = row.points; snapshot.savedAt = savedAt; next.advancedGradebookByCycle = { ...next.advancedGradebookByCycle, [keyOf(courseId, academicYear)]: snapshot }; if (academicYear === '2026-2027')
    next.advancedGradebookByCourse = { ...next.advancedGradebookByCourse, [courseId]: snapshot }; return next; }
async function destinationAccess(actor: Actor, project: any, input: Destination, tx: any) { if (!actor.userId)
    throw new JuryError('PUBLICATION_DENIED', 'External judges cannot publish grades.', 403); const course = await tx.course.findUnique({ where: { id: input.courseId }, include: { teacher: { select: { id: true, userId: true } }, enrollments: { include: { student: { select: { id: true, studentNumber: true, status: true } } } } } }); if (!course || !project.juryProjectCourse_project.some((c: any) => c.courseReference === course.id) || course.teacher.userId !== actor.userId && !actor.root)
    throw new JuryError('DESTINATION_DENIED', 'Only the course teacher or SuperAdmin may publish into this Gradebook.', 403); return course; }
async function resultRows(project: any, course: any, tx: any, maximum: string | number) { const run = await tx.juryResultRun.findUnique({ where: { projectId_version: { projectId: project.id, version: project.resultVersion } }, include: { juryStudentResult_run: { include: { participant: true } } } }); if (!run || run.status !== 'APPROVED' || !['APPROVED', 'PUBLISHED'].includes(project.status))
    throw new JuryError('RESULTS_NOT_APPROVED', 'The current result version must be approved before Gradebook publication.', 409); const ids = new Set(course.enrollments.filter((e: any) => String(e.student.status).toLowerCase() === 'active').map((e: any) => e.studentId)), rows: any[] = [], excluded: any[] = []; for (const result of run.juryStudentResult_run) {
    const p = result.participant;
    if (result.score === null || result.status !== 'COMPLETE' || p.status !== 'ACTIVE') {
        excluded.push({ participantId: p.id, reason: result.status });
        continue;
    }
    if (!p.studentId || !ids.has(p.studentId))
        throw new JuryError('ENROLLMENT_CHANGED', 'An evaluated learner is no longer actively enrolled in the destination course. Review the roster before publication.', 409);
    rows.push({ participantId: p.id, studentId: p.studentId, name: p.displayNameSnapshot, points: normalizeScore(String(result.score), String(result.maximum), maximum) });
} if (!rows.length)
    throw new JuryError('NO_PUBLISHABLE_GRADES', 'There are no eligible validated grades for this course.'); return { run, rows, excluded }; }
export async function publicationOptions(actor: Actor, id: string, courseId: string) { const { project } = await projectAccess(actor, id, true); const course = await destinationAccess(actor, project, { courseId } as Destination, prisma), workspace = await prisma.teacherWorkspace.findUnique({ where: { userId: course.teacher.userId } }), snapshot = gradebookView(workspace?.state, courseId, project.academicYear, course.enrollments.map((e: any) => e.student)); return { course: { id: course.id, name: course.name, teacherId: course.teacher.userId }, academicYear: project.academicYear, term: project.term, workspaceRevision: workspace?.revision || 0, columns: snapshot.assignments.filter((a: any) => a.term === project.term).map((a: any) => ({ id: a.id, title: a.title, category: a.category, maximum: a.maxPoints, date: a.date })), categories: snapshot.categories }; }
export async function previewPublication(actor: Actor, id: string, input: Destination) { const { project } = await projectAccess(actor, id, true), course = await destinationAccess(actor, project, input, prisma), workspace = await prisma.teacherWorkspace.findUnique({ where: { userId: course.teacher.userId } }), students = course.enrollments.map((e: any) => e.student), snapshot = gradebookView(workspace?.state, course.id, project.academicYear, students), link = await prisma.juryGradebookLink.findUnique({ where: { projectId_courseReference_academicYear_term: { projectId: id, courseReference: course.id, academicYear: project.academicYear, term: project.term } } }), columnId = input.mode === 'EXISTING' ? input.columnId : link?.columnId || 'jury:' + id + ':' + course.id, existing = snapshot.assignments.find((a: any) => a.id === columnId); if (!columnId || input.mode === 'EXISTING' && !existing)
    throw new JuryError('COLUMN_NOT_FOUND', 'Choose a current Gradebook column.'); if (existing && existing.term !== project.term)
    throw new JuryError('COLUMN_PERIOD_MISMATCH', 'The existing column belongs to another reporting period.'); if (link && link.columnId !== columnId)
    throw new JuryError('PROJECT_ALREADY_LINKED', 'This project already has a protected destination column. Use that link or cancel and reconcile it first.', 409); const maximum = existing ? existing.maxPoints : input.maximum; if (Number(maximum) <= 0)
    throw new JuryError('INVALID_MAXIMUM', 'Maximum points must be positive.'); const { run, rows, excluded } = await resultRows(project, course, prisma, maximum), column = existing ? clone(existing) : { id: columnId, title: input.title, type: input.category, category: input.category, maxPoints: Number(maximum), date: input.date, term: project.term, description: 'KCS Nexus Jury · ' + project.title, confirmedCycle: project.academicYear + '::' + project.term, juryProjectId: id }, previewRows = rows.map(row => ({ ...row, previousValue: { present: Object.prototype.hasOwnProperty.call(snapshot.scores, columnId + ':' + row.studentId), value: snapshot.scores[columnId + ':' + row.studentId] ?? null } })), payload = { destination: input, column, rows: previewRows, excluded, runId: run.id, runChecksum: run.checksum, mode: existing ? 'EXISTING' : 'NEW' }, hash = checksum(payload), preview = await prisma.juryPublicationPreview.create({ data: { projectId: id, actorReference: actor.reference, courseReference: course.id, teacherReference: course.teacher.userId, request: payload, resultVersion: project.resultVersion, workspaceRevision: workspace?.revision || 0, previewHash: hash, expiresAt: new Date(Date.now() + 10 * 60000) } }); return { previewId: preview.id, previewHash: hash, expiresAt: preview.expiresAt, workspaceRevision: preview.workspaceRevision, academicYear: project.academicYear, term: project.term, column, rows: previewRows, excluded, requiresOverwriteAcknowledgement: previewRows.some(r => r.previousValue.present && String(r.previousValue.value ?? '').trim() !== ''), notice: 'This writes raw Gradebook cells only. Existing subject-grade and report-card submissions remain explicit teacher actions.' }; }
export async function publishGrades(actor: Actor, id: string, input: {
    previewId: string;
    previewHash: string;
    idempotencyKey: string;
    approve: boolean;
    overwriteAcknowledged: boolean;
}) { if (!input.approve)
    throw new JuryError('EXPLICIT_APPROVAL_REQUIRED', 'Confirm the preview to publish grades.'); const requestHash = checksum(input); let publication: any; try {
    publication = await projectTransaction(actor, id, undefined, async (tx, { project }) => { const duplicate = await tx.juryPublication.findUnique({ where: { projectId_idempotencyKey: { projectId: id, idempotencyKey: input.idempotencyKey } } }); if (duplicate) {
        if (duplicate.requestHash !== requestHash)
            throw new JuryError('IDEMPOTENCY_CONFLICT', 'This publication key belongs to another payload.', 409);
        return duplicate;
    } const preview = await tx.juryPublicationPreview.findUnique({ where: { id: input.previewId } }); if (!preview || preview.projectId !== id || preview.actorReference !== actor.reference || preview.expiresAt <= new Date() || preview.previewHash !== input.previewHash || checksum(preview.request) !== preview.previewHash)
        throw new JuryError('PREVIEW_EXPIRED', 'Reload the Gradebook preview before publishing.', 409); if (preview.resultVersion !== project.resultVersion)
        throw new JuryError('RESULT_VERSION_CHANGED', 'The validated results changed after this preview.', 409); const payload = preview.request as any, course = await destinationAccess(actor, project, payload.destination, tx), { run, rows } = await resultRows(project, course, tx, payload.column.maxPoints); if (run.id !== payload.runId || run.checksum !== payload.runChecksum || checksum(rows.map((r: any) => ({ participantId: r.participantId, studentId: r.studentId, name: r.name, points: r.points }))) !== checksum(payload.rows.map(({ previousValue, ...r }: any) => r)))
        throw new JuryError('RESULTS_CHANGED', 'The learner mappings or scores changed. Preview again.', 409); const existingPublication = await tx.juryPublication.findUnique({ where: { projectId_runId_courseReference_academicYear_term: { projectId: id, runId: run.id, courseReference: course.id, academicYear: project.academicYear, term: project.term } } }); if (existingPublication) {
        if (existingPublication.status === 'CANCELLED')
            throw new JuryError('PUBLICATION_CANCELLED', 'This version was cancelled. Recompute and approve a new result version before publishing again.', 409);
        return existingPublication;
    } await protectGradebookEntry(tx, project.academicYear, project.term, actor.root ? 'configured-superadmin' : course.teacher.userId); await tx.$queryRaw(Prisma.sql `SELECT id FROM "TeacherWorkspace" WHERE "userId"=${course.teacher.userId} FOR UPDATE`); let workspace = await tx.teacherWorkspace.findUnique({ where: { userId: course.teacher.userId } }); requireRevision(workspace?.revision || 0, preview.workspaceRevision); const state = workspace?.state || {}, students = course.enrollments.map((e: any) => e.student), view = gradebookView(state, course.id, project.academicYear, students), currentColumn = view.assignments.find((a: any) => a.id === payload.column.id); if (payload.mode === 'EXISTING' && checksum(currentColumn) !== checksum(payload.column) || payload.mode === 'NEW' && currentColumn)
        throw new JuryError('COLUMN_CHANGED', 'The target column changed since preview.', 409); for (const r of payload.rows) {
        const k = payload.column.id + ':' + r.studentId, previous = { present: Object.prototype.hasOwnProperty.call(view.scores, k), value: view.scores[k] ?? null };
        if (checksum(previous) !== checksum(r.previousValue))
            throw new JuryError('GRADE_CELL_CHANGED', 'One of the destination cells changed after preview.', 409);
    } if (payload.rows.some((r: any) => r.previousValue.present && String(r.previousValue.value ?? '').trim() !== '') && !input.overwriteAcknowledged)
        throw new JuryError('OVERWRITE_ACKNOWLEDGEMENT_REQUIRED', 'Acknowledge every existing grade shown in the preview.'); const next = targetedMerge(state, course.id, project.academicYear, payload.column, rows, students, new Date().toISOString()), before = workspace?.revision || 0; if (workspace) {
        const updated = await tx.teacherWorkspace.updateMany({ where: { id: workspace.id, revision: before }, data: { state: next, revision: { increment: 1 } } });
        if (updated.count !== 1)
            throw new JuryError('REVISION_CONFLICT', 'Another Gradebook save won. Reload and preview again.', 409);
    }
    else
        workspace = await tx.teacherWorkspace.create({ data: { userId: course.teacher.userId, state: next, revision: 1 } }); const persisted = await tx.teacherWorkspace.findUniqueOrThrow({ where: { userId: course.teacher.userId } }), read = gradebookView(persisted.state, course.id, project.academicYear, students); for (const row of rows)
        if (read.scores[payload.column.id + ':' + row.studentId] !== row.points)
            throw new JuryError('READBACK_FAILED', 'The Gradebook read-back did not match the intended values.', 503); const result = await tx.juryPublication.create({ data: { projectId: id, runId: run.id, idempotencyKey: input.idempotencyKey, requestHash, courseId: course.id, courseReference: course.id, teacherReference: course.teacher.userId, academicYear: project.academicYear, term: project.term, columnId: payload.column.id, mode: payload.mode, status: 'VERIFIED', workspaceRevisionBefore: before, workspaceRevisionAfter: persisted.revision, actorReference: actor.reference, receiptReference: 'JURY-GB-' + randomUUID().toUpperCase(), verifiedAt: new Date(), juryPublicationItem_publication: { create: payload.rows.map((r: any) => ({ studentReference: r.studentId, participantId: r.participantId, previousValue: r.previousValue, points: r.points, maximum: String(payload.column.maxPoints), verifiedHash: checksum({ studentId: r.studentId, points: r.points, columnId: payload.column.id }) })) } } }); await tx.juryGradebookLink.upsert({ where: { projectId_courseReference_academicYear_term: { projectId: id, courseReference: course.id, academicYear: project.academicYear, term: project.term } }, create: { projectId: id, courseId: course.id, courseReference: course.id, teacherReference: course.teacher.userId, academicYear: project.academicYear, term: project.term, columnId: payload.column.id, latestPublicationId: result.id }, update: { latestPublicationId: result.id } }); await audit(tx, actor, id, 'GRADEBOOK_PUBLICATION_VERIFIED', 'Publication', result.id, { receipt: result.receiptReference, courseId: course.id, columnId: payload.column.id, count: rows.length, workspaceRevision: persisted.revision }); await notify(tx, id, [course.teacher.userId], 'Jury grades saved in Gradebook', project.title, 'publication:' + result.id); return result; });
}
catch (error) {
    await prisma.juryAudit.create({ data: { actorReference: actor.reference, projectId: null, action: 'GRADEBOOK_PUBLICATION_FAILED', entityType: 'Project', entityId: id, metadata: { code: error instanceof JuryError ? error.code : 'PUBLICATION_ERROR' } } }).catch(() => undefined);
    throw error;
} return publicationReceipt(actor, id, publication.id); }
export async function publicationReceipt(actor: Actor, projectId: string, publicationId: string) { await projectAccess(actor, projectId, true); const p = await prisma.juryPublication.findUnique({ where: { id: publicationId }, include: { juryPublicationItem_publication: true } }); if (!p || p.projectId !== projectId)
    throw new JuryError('PUBLICATION_NOT_FOUND', 'This publication was not found.', 404); const workspace = await prisma.teacherWorkspace.findUnique({ where: { userId: p.teacherReference } }), course = await prisma.course.findUnique({ where: { id: p.courseReference }, include: { enrollments: { include: { student: { select: { id: true, studentNumber: true } } } } } }), view = gradebookView(workspace?.state, p.courseReference, p.academicYear, course?.enrollments.map(e => e.student) || []), changes = p.juryPublicationItem_publication.filter(row => view.scores[p.columnId + ':' + row.studentReference] !== String(row.points)).map(row => ({ studentId: row.studentReference, status: 'CHANGED_SINCE_PUBLICATION' })); return { ...p, verifiedNow: p.status === 'VERIFIED' && changes.length === 0, changes, checkedAt: new Date().toISOString(), workspaceRevision: workspace?.revision || 0 }; }
export async function cancelPublication(actor: Actor, projectId: string, publicationId: string, reason: string, workspaceRevision: number) { requireReason(reason); return projectTransaction(actor, projectId, undefined, async (tx, { project }) => { const p = await tx.juryPublication.findUnique({ where: { id: publicationId }, include: { juryPublicationItem_publication: true } }); if (!p || p.projectId !== projectId)
    throw new JuryError('PUBLICATION_NOT_FOUND', 'This publication was not found.', 404); if (p.teacherReference !== actor.userId && !actor.root)
    throw new JuryError('CANCELLATION_DENIED', 'Only the destination teacher or SuperAdmin may reverse grades.', 403); if (p.status === 'CANCELLED')
    return p; await protectGradebookEntry(tx, p.academicYear, p.term, actor.root ? 'configured-superadmin' : p.teacherReference); await tx.$queryRaw(Prisma.sql `SELECT id FROM "TeacherWorkspace" WHERE "userId"=${p.teacherReference} FOR UPDATE`); const w = await tx.teacherWorkspace.findUniqueOrThrow({ where: { userId: p.teacherReference } }); requireRevision(w.revision, workspaceRevision); const state: any = clone(w.state), course = await tx.course.findUnique({ where: { id: p.courseReference }, include: { enrollments: { include: { student: { select: { id: true, studentNumber: true } } } } } }), view = gradebookView(state, p.courseReference, p.academicYear, course?.enrollments.map((e: any) => e.student) || []); for (const row of p.juryPublicationItem_publication) {
    const k = p.columnId + ':' + row.studentReference;
    if (view.scores[k] !== String(row.points))
        throw new JuryError('LATER_GRADE_CHANGE', 'Later Gradebook edits are protected. Review the cells manually before reversing.', 409);
    const before = row.previousValue as any;
    if (before.present)
        view.scores[k] = before.value;
    else
        delete view.scores[k];
} view.savedAt = new Date().toISOString(); state.advancedGradebookByCycle = { ...state.advancedGradebookByCycle, [keyOf(p.courseReference, p.academicYear)]: view }; if (p.academicYear === '2026-2027')
    state.advancedGradebookByCourse = { ...state.advancedGradebookByCourse, [p.courseReference]: view }; await tx.teacherWorkspace.update({ where: { id: w.id }, data: { state: state, revision: { increment: 1 } } }); const updated = await tx.juryPublication.update({ where: { id: p.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason } }); await audit(tx, actor, projectId, 'GRADEBOOK_PUBLICATION_REVERSED', 'Publication', p.id, { columnPreserved: true, previousValuesRestored: true }, reason); return updated; }); }
