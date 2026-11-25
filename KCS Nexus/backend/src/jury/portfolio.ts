import { prisma } from './database.js';
import { type Actor, projectAccess, requireRevision, audit } from './policy.js';
import { JuryError, httpsLink } from './security.js';
import { projectTransaction } from './projects.js';
export async function candidateAccess(actor: Actor, candidateId: string, write = false, tx: any = prisma) { const candidate = await tx.juryCandidate.findUnique({ where: { id: candidateId }, include: { group: { include: { juryGroupMember_group: true } }, participant: true } }); if (!candidate)
    throw new JuryError('CANDIDATE_NOT_FOUND', 'This candidate was not found.', 404); const access = await projectAccess(actor, candidate.projectId, false, tx), own = Boolean(access.participant && (candidate.participantId === access.participant.id || candidate.group?.juryGroupMember_group.some((m: any) => m.participantId === access.participant.id))); if (write ? !access.manager && !own : !access.manager && !own && !await tx.juryAssignment.findFirst({ where: { candidateId, enabled: true, member: { status: 'ACCEPTED', ...(actor.userId ? { userId: actor.userId } : { invitationId: actor.invitationId }) } } }))
    throw new JuryError('PORTFOLIO_ACCESS_DENIED', 'This portfolio is outside your assignments.', 403); return { candidate, access, own }; }
export async function candidatePortfolio(actor: Actor, candidateId: string) { await candidateAccess(actor, candidateId); return prisma.jurySubmission.findMany({ where: { candidateId }, include: { juryAttachment_submission: { where: { removedAt: null }, select: { id: true, originalName: true, mimeType: true, bytes: true, purpose: true, createdAt: true } } }, orderBy: { updatedAt: 'desc' } }); }
export async function saveSubmission(actor: Actor, candidateId: string, input: any) { const a = await candidateAccess(actor, candidateId, true); return projectTransactionForPortfolio(actor, a.candidate.projectId, async (tx: any) => { const { candidate, access } = await candidateAccess(actor, candidateId, true, tx); if (!['REGISTRATION_OPEN', 'SUBMISSION_OPEN'].includes(access.project.status) && !access.manager)
    throw new JuryError('SUBMISSION_CLOSED', 'The project submission period is closed.', 409); if (access.project.submissionDeadline && access.project.submissionDeadline < new Date() && !access.manager)
    throw new JuryError('SUBMISSION_DEADLINE_PASSED', 'The submission deadline has passed.', 409); const data = { title: input.title, description: input.description, repositoryUrl: input.repositoryUrl ? httpsLink(input.repositoryUrl) : null, demonstrationUrl: input.demonstrationUrl ? httpsLink(input.demonstrationUrl) : null, links: input.links.map((l: any) => ({ label: l.label, url: httpsLink(l.url) })), submittedAt: input.submit ? new Date() : null }; let result; if (input.id) {
    const old = await tx.jurySubmission.findUnique({ where: { id: input.id } });
    if (!old || old.candidateId !== candidateId)
        throw new JuryError('SUBMISSION_NOT_FOUND', 'This submission was not found.', 404);
    requireRevision(old.revision, input.revision);
    result = await tx.jurySubmission.update({ where: { id: old.id }, data: { ...data, revision: { increment: 1 } } });
}
else
    result = await tx.jurySubmission.create({ data: { ...data, projectId: candidate.projectId, candidateId } }); await audit(tx, actor, candidate.projectId, input.submit ? 'PORTFOLIO_SUBMITTED' : 'PORTFOLIO_DRAFT_SAVED', 'Submission', result.id, { revision: result.revision }); return result; }); }
async function projectTransactionForPortfolio<T>(actor: Actor, projectId: string, fn: (tx: any) => Promise<T>) { return prisma.$transaction(async (tx) => { await tx.$queryRaw `SELECT id FROM "JuryProject" WHERE id=${projectId} FOR SHARE`; return fn(tx); }, { timeout: 10000 }); }
