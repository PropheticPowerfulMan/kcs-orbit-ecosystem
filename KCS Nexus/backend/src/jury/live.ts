import { prisma } from './database.js';
import { type Actor, requireRevision, requireReason, audit } from './policy.js';
import { projectTransaction } from './projects.js';
import { token, digest, publicBase, JuryError } from './security.js';
export async function controlPresentation(actor: Actor, projectId: string, sessionId: string, input: any) { return projectTransaction(actor, projectId, undefined, async (tx, { project }) => { const s = await tx.juryProjectSession.findUnique({ where: { id: sessionId } }); if (!s || s.projectId !== projectId)
    throw new JuryError('SESSION_NOT_FOUND', 'This presentation session was not found.', 404); requireRevision(s.revision, input.revision); const now = new Date(), data: any = { revision: { increment: 1 } }; if (input.action === 'SELECT') {
    const c = await tx.juryCandidate.findUnique({ where: { id: input.candidateId } });
    if (!c || c.projectId !== projectId || ['ABSENT','EXCUSED', 'DISQUALIFIED'].includes(c.checkIn))
        throw new JuryError('CANDIDATE_NOT_AVAILABLE', 'Choose an eligible candidate from this project.');
    data.currentCandidateId = c.id;
    data.state = 'WAITING';
    data.elapsedMilliseconds = 0;
    data.startedAt = null;
    data.pausedAt = null;
}
else if (input.action === 'START' || input.action === 'RESUME') {
    if (!s.currentCandidateId || input.action === 'RESUME' && s.state !== 'PAUSED' || input.action==='START'&&!['WAITING','FINISHED'].includes(s.state))
        throw new JuryError('TIMER_STATE_INVALID', 'Select a candidate and a compatible timer state.');
    data.startedAt = now;
    data.pausedAt = null;
    const pause = input.action==='RESUME'?await tx.juryAudit.findFirst({where:{projectId,entityId:sessionId,action:'PRESENTATION_PAUSE'},orderBy:{createdAt:'desc'},select:{metadata:true}}):null;
    data.state = (pause?.metadata as any)?.resumeState==='QUESTIONS'?'QUESTIONS':'PRESENTING';
}
else if (input.action === 'PAUSE') {
    if (!['PRESENTING', 'QUESTIONS'].includes(s.state) || !s.startedAt)
        throw new JuryError('TIMER_NOT_RUNNING', 'The presentation timer is not running.');
    data.elapsedMilliseconds = s.elapsedMilliseconds + Math.max(0, now.getTime() - s.startedAt.getTime());
    data.pausedAt = now;
    data.startedAt = null;
    data.state = 'PAUSED';
}
else if (input.action === 'QUESTIONS') {
    if (!s.currentCandidateId)
        throw new JuryError('CANDIDATE_REQUIRED', 'Select the current candidate.');
    data.state = 'QUESTIONS';
    data.elapsedMilliseconds = 0;
    data.startedAt = now;
    data.pausedAt = null;
}
else if (input.action === 'FINISH') {
    data.state = 'FINISHED';
    data.elapsedMilliseconds = s.elapsedMilliseconds + (s.startedAt ? Math.max(0, now.getTime() - s.startedAt.getTime()) : 0);
    data.startedAt = null;
}
else if (input.action === 'RESET') {
    requireReason(input.reason);
    data.state = 'WAITING';
    data.elapsedMilliseconds = 0;
    data.startedAt = null;
    data.pausedAt = null;
}
else
    throw new JuryError('TIMER_ACTION_INVALID', 'Choose a valid timer action.'); const updated = await tx.juryProjectSession.update({ where: { id: sessionId }, data }); await audit(tx, actor, projectId, 'PRESENTATION_' + input.action, 'ProjectSession', sessionId, { revision: updated.revision, ...(input.action==='PAUSE'?{resumeState:s.state}:{}) }, input.reason || ''); const { displayTokenHash, ...safe } = updated; return { ...safe, serverUtc: now.toISOString() }; }); }
export async function displayLink(actor: Actor, projectId: string, sessionId: string, approved: boolean) { if (!approved)
    throw new JuryError('PUBLIC_DISPLAY_APPROVAL_REQUIRED', 'Confirm that this projector may show candidate names and presentation topics.'); return projectTransaction(actor, projectId, undefined, async (tx) => { const s = await tx.juryProjectSession.findUnique({ where: { id: sessionId } }); if (!s || s.projectId !== projectId)
    throw new JuryError('SESSION_NOT_FOUND', 'This session was not found.', 404); const raw = token(); await tx.juryProjectSession.update({ where: { id: sessionId }, data: { displayTokenHash: digest(raw), displayExpiresAt: new Date(Date.now() + 2 * 3600000) } }); await audit(tx, actor, projectId, 'PROJECTOR_LINK_ISSUED', 'ProjectSession', sessionId, { expiresInHours: 2 }); return { url: publicBase() + '#/display?token=' + raw }; }); }
export async function presentationDisplay(raw: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw))
        throw new JuryError('DISPLAY_ACCESS_REQUIRED', 'A current projector link is required.', 401);
    const s = await prisma.juryProjectSession.findUnique({
        where: { displayTokenHash: digest(raw) },
        include: { project: { select: { title: true, venue: true, status: true } }, currentCandidate: { select: { id: true, topic: true, position: true, participant: { select: { displayNameSnapshot: true } }, group: { select: { name: true } } } } }
    });
    if (!s || !s.displayExpiresAt || s.displayExpiresAt <= new Date() || s.project.status === 'CANCELLED')
        throw new JuryError('DISPLAY_EXPIRED', 'The projector link expired or was revoked.', 401);
    const next = await prisma.juryCandidate.findFirst({ where: { projectId: s.projectId, position: { gt: s.currentCandidate?.position ?? -1 }, checkIn: { notIn: ['ABSENT', 'EXCUSED', 'DISQUALIFIED'] } }, orderBy: { position: 'asc' }, select: { topic: true, participant: { select: { displayNameSnapshot: true } }, group: { select: { name: true } } } });
    const view = (c: any) => c ? { name: c.group?.name || c.participant?.displayNameSnapshot || 'Archived candidate', topic: c.topic } : null;
    return { school: 'Kinshasa Christian School', event: s.project.title, venue: s.venue, state: s.state, current: view(s.currentCandidate), next: view(next), startedAt: s.startedAt, elapsedMilliseconds: s.elapsedMilliseconds, durationSeconds: s.durationSeconds, questionsSeconds: s.questionsSeconds, serverUtc: new Date().toISOString() };
}
