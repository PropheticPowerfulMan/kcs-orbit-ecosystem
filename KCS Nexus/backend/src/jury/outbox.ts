import { Prisma } from '@prisma/client';
import { prisma } from './database.js';
import { sendSchoolMail } from '../utils/mail.js';
import { notify } from './projects.js';
import { publicBase } from './security.js';
// Short database claims; network delivery never runs inside a database transaction.
export async function drainJuryOutbox(limit = 20) { const cutoff = new Date(Date.now() - 10 * 60000); await prisma.juryOutbox.updateMany({ where: { status: 'PROCESSING', lockedAt: { lt: cutoff } }, data: { status: 'PENDING', lockedAt: null } }); let delivered = 0, failed = 0; for (let i = 0; i < limit; i++) {
    const row = await prisma.$transaction(async (tx) => { const ids = await tx.$queryRaw<{
        id: string;
    }[]>(Prisma.sql `SELECT id FROM "JuryOutbox" WHERE status IN ('PENDING','RETRY') AND "nextAttemptAt"<=NOW() AND attempts<10 ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`); if (!ids.length)
        return null; return tx.juryOutbox.update({ where: { id: ids[0].id }, data: { status: 'PROCESSING', lockedAt: new Date(), attempts: { increment: 1 } } }); });
    if (!row)
        break;
    try {
        const p = row.payload as any;
        if (row.kind === 'NOTIFICATION') {
            const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { id: true, accountBlockedAt: true } });
            if (!user || user.accountBlockedAt)
                throw Error('RECIPIENT_UNAVAILABLE');
            await prisma.notification.upsert({ where: { id: 'jury:' + row.id }, create: { id: 'jury:' + row.id, userId: p.userId, title: p.title, message: p.message, type: 'INFO', link: p.link }, update: {} });
        }
        else if (row.kind === 'INVITATION') {
            const invite = await prisma.juryInvitation.findUnique({ where: { id: p.invitationId }, include: { project: { select: { title: true } } } });
            if (!invite || invite.revokedAt || invite.expiresAt <= new Date() || invite.acceptedAt)
                throw Error('INVITATION_NO_LONGER_VALID');
            const fr=p.language==='fr',deadline=invite.expiresAt.toLocaleString(fr?'fr-CD':'en-GB',{timeZone:'Africa/Kinshasa',dateStyle:'long',timeStyle:'short'})
            const result = await sendSchoolMail({to:invite.email,subject:fr?'KCS Nexus Jury · Invitation au jury':'KCS Nexus Jury · Jury invitation',text:fr?`Bonjour ${invite.displayName},\n\nKinshasa Christian School vous invite à rejoindre le jury du projet « ${invite.project.title} ».\n\nOuvrez votre invitation personnelle à usage unique : ${p.link}\n\nCet accès expire le ${deadline} (heure de Kinshasa). Gardez ce lien confidentiel.\n\nCordialement,\nKinshasa Christian School`:`Dear ${invite.displayName},\n\nKinshasa Christian School invites you to join the jury for ${invite.project.title}.\n\nOpen your personal, single-use invitation: ${p.link}\n\nAccess expires on ${deadline} (Kinshasa time). Keep this link private.\n\nKind regards,\nKinshasa Christian School`,language:fr?'fr':'en'})
            if (!result.sent)
                throw Error(result.reason);
            await prisma.juryInvitation.update({ where: { id: invite.id }, data: { sentAt: new Date() } });
        }
        else
            throw Error('OUTBOX_KIND_INVALID');
        await prisma.juryOutbox.update({ where: { id: row.id }, data: { status: 'DELIVERED', lockedAt: null, deliveredAt: new Date(), lastErrorCode: null, ...(row.kind === 'INVITATION' ? { payload: { invitationId: p.invitationId } } : {}) } });
        delivered++;
    }
    catch (error) {
        const raw = error instanceof Error ? error.message : 'DELIVERY_ERROR', code = /^[A-Z_]{3,70}$/.test(raw) ? raw : 'DELIVERY_ERROR';
        await prisma.juryOutbox.update({ where: { id: row.id }, data: { status: row.attempts >= 10 ? 'FAILED' : 'RETRY', lockedAt: null, lastErrorCode: code, nextAttemptAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** row.attempts)) } });
        failed++;
    }
} return { delivered, failed }; }
export async function scheduleJuryReminders(now = new Date()) { const projects = await prisma.juryProject.findMany({ where: { status: { notIn: ['ARCHIVED', 'CANCELLED', 'PUBLISHED'] } }, select: { id: true, title: true, ownerId: true, registrationDeadline: true, submissionDeadline: true, presentationAt: true } }); let scheduled = 0; for (const project of projects)
    for (const [kind, date] of [['submission', project.submissionDeadline], ['presentation', project.presentationAt]] as const) {
        if (!date)
            continue;
        const days = Math.ceil((date.getTime() - now.getTime()) / 86400000);
        if (![1, 7].includes(days))
            continue;
        const rows = await prisma.juryParticipant.findMany({ where: { projectId: project.id, status: 'ACTIVE', studentId: { not: null } }, select: { student: { select: { userId: true } } } }), judges = await prisma.juryMember.findMany({ where: { panel: { projectId: project.id }, status: 'ACCEPTED', userId: { not: null } }, select: { userId: true } }), ids = [project.ownerId, ...rows.map(r => r.student?.userId), ...judges.map(j => j.userId)].filter(Boolean) as string[];
        await prisma.$transaction(async (tx) => { await notify(tx, project.id, ids, 'Jury reminder', `${project.title} · ${kind} in ${days} day(s)`, project.id + ':' + kind + ':' + date.toISOString() + ':' + days); });
        scheduled++;
    } return { scheduled }; }
