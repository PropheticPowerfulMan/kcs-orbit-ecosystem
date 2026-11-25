import { prisma } from './database.js';
import { assertAccountAccess } from '../services/accountAccess.service.js';
import { JuryError } from './security.js';
export type Actor = {
    reference: string;
    userId: string | null;
    invitationId: string | null;
    memberId: string | null;
    root: boolean;
    administrator: boolean;
    academic: boolean;
    teacher: boolean;
    studentId: string | null;
    sessionId: string;
    csrfToken: string;
    user?: any;
};
const profileSelect = { id: true, email: true, role: true, firstName: true, middleName: true, lastName: true, permissions: true, avatar: true, passwordChangedAt: true, accountBlockedAt: true, teacherProfile: { select: { id: true } }, studentProfile: { select: { id: true, status: true } } } as const;
export async function internalActor(userId: string): Promise<Actor> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
    if (!user)
        throw new JuryError('ACCOUNT_UNAVAILABLE', 'This institutional account is no longer available.', 403);
    await assertAccountAccess(user.id);
    const grants = await prisma.juryRoleGrant.findMany({ where: { userId, enabled: true }, select: { role: true } }), roles = new Set(grants.map(g => g.role)), root = user.role === 'ADMIN' && user.email.toLowerCase() === (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase(), administrator = root || roles.has('JURY_ADMIN'), academic = administrator || user.permissions.some(p => ['nexus:principal-workspace', 'nexus:senior-teacher-workspace'].includes(p)) || roles.has('ACADEMIC_ADMIN'), teacher = Boolean(user.teacherProfile) || user.role === 'TEACHER';
    return { reference: userId, userId, invitationId: null, memberId: null, root, administrator, academic, teacher, studentId: user.studentProfile?.id || null, sessionId: '', csrfToken: '', user };
}
export async function projectAccess(actor: Actor, projectId: string, write = false, db: any = prisma) {
    const project = await db.juryProject.findUnique({ where: { id: projectId }, include: { activeRubric: { include: { juryCriterion_rubric: { include: { juryPerformanceLevel_criterion: true } } } }, juryPanel_project: { include: { juryMember_panel: true } }, juryParticipant_project: true, juryProjectCourse_project: { include: { course: { select: { id: true, name: true, teacherId: true, teacher: { select: { userId: true } } } } } } } });
    if (!project)
        throw new JuryError('PROJECT_NOT_FOUND', 'This project was not found.', 404);
    const manager = actor.administrator || actor.academic || Boolean(actor.userId && project.ownerId === actor.userId), member = project.juryPanel_project?.flatMap((panel: any) => panel.juryMember_panel).find((m: any) => !actor.studentId && actor.user?.role!=='STUDENT' && m.status === 'ACCEPTED' && (actor.userId ? m.userId === actor.userId : Boolean(actor.invitationId && m.invitationId === actor.invitationId))), participant = actor.studentId ? project.juryParticipant_project.find((p: any) => p.studentId === actor.studentId) : null;
    if (write ? !manager : !manager && !member && !participant)
        throw new JuryError('PROJECT_ACCESS_DENIED', 'This project is outside your authorized assignments.', 403);
    return { project, manager, member, participant };
}
export function requireRevision(actual: number, expected: unknown) { if (!Number.isInteger(expected) || actual !== expected)
    throw new JuryError('REVISION_CONFLICT', 'This record changed in another session. Reload and reconcile your changes.', 409); }
export function requireReason(value: unknown) { const reason = String(value || '').trim(); if (reason.length < 8 || reason.length > 2000)
    throw new JuryError('REASON_REQUIRED', 'Provide a clear reason of 8 to 2000 characters.'); return reason; }
export async function audit(db: any, actor: Actor, projectId: string | null, action: string, entityType: string, entityId: string, metadata: any = {}, reason = '') { return db.juryAudit.create({ data: { actorReference: actor.reference, projectId, action, entityType, entityId, metadata: JSON.parse(JSON.stringify(metadata)), reason } }); }
