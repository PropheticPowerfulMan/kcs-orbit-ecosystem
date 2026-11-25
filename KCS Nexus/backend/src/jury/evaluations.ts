import { Prisma } from '@prisma/client';
import { prisma } from './database.js';
import { type Actor, projectAccess, requireRevision, requireReason, audit } from './policy.js';
import { lockProject, projectTransaction, touch, notify } from './projects.js';
import { JuryError, checksum } from './security.js';
import { evaluate, consolidate, hybridScore, rankScores, ScoringError, defaultScoringRules, type Mark, type Criterion, type ScoringRules } from './scoring.js';
const Decimal = Prisma.Decimal.clone({ precision: 40 });
export function rubricCriteria(rows: any[]): Criterion[] { return rows.map(c => ({ id: c.id, name: c.name, maximum: String(c.maximum), weight: String(c.weight), parentId: c.parentId, mandatory: c.mandatory, applicability: c.applicability, commentRule: c.commentRule, commentThreshold: String(c.commentThreshold), minimumJudges: c.minimumJudges })); }
export async function assignmentAccess(actor: Actor, assignmentId: string, tx: any = prisma) { const a = await tx.juryAssignment.findUnique({ where: { id: assignmentId }, include: { member: { include: { panel: true } }, candidate: true } }); if (!a)
    throw new JuryError('ASSIGNMENT_NOT_FOUND', 'This evaluation assignment was not found.', 404); const access = await projectAccess(actor, a.candidate.projectId, false, tx), own = !actor.studentId && actor.user?.role!=='STUDENT' && a.member.status === 'ACCEPTED' && Boolean(actor.userId && a.member.userId === actor.userId || actor.invitationId && a.member.invitationId === actor.invitationId); return { a, access, own }; }
export async function evaluationSheet(actor: Actor, assignmentId: string) { const { a, access, own } = await assignmentAccess(actor, assignmentId); const closed = ['EVALUATION_CLOSED', 'RESULTS_PENDING_VALIDATION', 'APPROVED', 'PUBLISHED', 'ARCHIVED'].includes(access.project.status); if (!own && !(access.manager && closed) && !(access.member && closed && (access.project.settings as any).showOtherJudgesAfterClosure))
    throw new JuryError('EVALUATION_PRIVATE', 'Judge evaluations remain independent and confidential until closure.', 403); const rubric = access.project.activeRubric; if (!rubric)
    throw new JuryError('RUBRIC_REQUIRED', 'No rubric is published.'); const current = await prisma.juryEvaluation.findUnique({ where: { assignmentId_rubricVersionId: { assignmentId, rubricVersionId: rubric.id } }, include: { juryEvaluationScore_evaluation: true } }); return { assignment: { id: a.id, candidateId: a.candidateId, memberId: a.memberId, criterionIds: a.criterionIds, scope: a.candidate.groupId ? 'GROUP' : 'INDIVIDUAL' }, rubric: { id: rubric.id, title: rubric.title, version: rubric.version, maximum: String(rubric.maximum), criteria: rubric.juryCriterion_rubric.map((c: any) => ({ ...c, maximum: String(c.maximum), weight: String(c.weight), levels: c.juryPerformanceLevel_criterion })) }, evaluation: current ? { ...current, marks: current.juryEvaluationScore_evaluation.map(m => ({ ...m, points: m.points === null ? null : String(m.points) })) } : { id: null, revision: 0, status: 'DRAFT', marks: [], comment: '' }, canEdit: own && a.enabled && access.project.status === 'EVALUATION_IN_PROGRESS', projectStatus: access.project.status }; }
export async function saveEvaluation(actor: Actor, assignmentId: string, input: {
    revision: number;
    requestId: string;
    submit: boolean;
    marks: Mark[];
    comment: string;
}) { const initial = await assignmentAccess(actor, assignmentId); if (!initial.own)
    throw new JuryError('EVALUATION_NOT_ASSIGNED', 'Only the assigned judge can write this evaluation.', 403); return prisma.$transaction(async (tx) => { await lockProject(tx, initial.a.candidate.projectId, true); const { a, access, own } = await assignmentAccess(actor, assignmentId, tx); if (!own || !a.enabled)
    throw new JuryError('EVALUATION_NOT_ASSIGNED', 'This assignment was disabled or revoked.', 403); if (a.member.conflictOfInterest && !a.member.conflictAcknowledgedBy)
    throw new JuryError('CONFLICT_OF_INTEREST', 'The organizer must review this conflict of interest before scoring.', 403); const p = access.project, rubric = p.activeRubric; if (!rubric)
    throw new JuryError('RUBRIC_REQUIRED', 'No active rubric exists.'); const hash = checksum(input); let row = await tx.juryEvaluation.upsert({ where: { assignmentId_rubricVersionId: { assignmentId, rubricVersionId: rubric.id } }, create: { assignmentId, rubricVersionId: rubric.id }, update: {} }); await tx.$queryRaw(Prisma.sql `SELECT id FROM "JuryEvaluation" WHERE id=${row.id} FOR UPDATE`); row = await tx.juryEvaluation.findUniqueOrThrow({ where: { id: row.id } }); const duplicate = await tx.juryEvaluationRevision.findUnique({ where: { evaluationId_requestId: { evaluationId: row.id, requestId: input.requestId } } }); if (duplicate) {
    if (duplicate.requestHash !== hash)
        throw new JuryError('IDEMPOTENCY_CONFLICT', 'This save identifier belongs to another payload.', 409);
    return { ...(duplicate.snapshot as any), idempotent: true };
} if (p.status !== 'EVALUATION_IN_PROGRESS')
    throw new JuryError('EVALUATION_CLOSED', 'Scoring is only permitted while evaluation is open.', 409); requireRevision(row.revision, input.revision); if (row.status === 'SUBMITTED')
    throw new JuryError('EVALUATION_SUBMITTED', 'Request an authorized reopening before changing a submitted evaluation.', 409); if (['ABSENT','EXCUSED', 'DISQUALIFIED'].includes(a.candidate.checkIn))
    throw new JuryError('CANDIDATE_INELIGIBLE', 'This candidate cannot currently be evaluated.', 409); const criteria = rubricCriteria(rubric.juryCriterion_rubric), scope = a.candidate.groupId ? 'GROUP' : 'INDIVIDUAL', result = evaluate(criteria, input.marks, String(rubric.maximum), scope, a.criterionIds.length ? a.criterionIds : undefined); if (input.submit && !result.complete)
    throw new JuryError('EVALUATION_INCOMPLETE', 'Complete all assigned criteria or explicitly mark optional criteria not applicable.', 409, { missing: result.missing }); await tx.juryEvaluationScore.deleteMany({ where: { evaluationId: row.id } }); await tx.juryEvaluationScore.createMany({ data: input.marks.map(m => ({ evaluationId: row.id, criterionId: m.criterionId, kind: m.kind, points: m.kind === 'SCORED' ? String(m.points) : null, comment: m.comment || '' })) }); const updated = await tx.juryEvaluation.update({ where: { id: row.id }, data: { revision: { increment: 1 }, comment: input.comment, status: input.submit ? 'SUBMITTED' : 'DRAFT', submittedAt: input.submit ? new Date() : null, total: result.complete ? result.total : null } }), snapshot = { id: updated.id, revision: updated.revision, status: updated.status, comment: updated.comment, marks: input.marks, result, serverSavedAt: updated.updatedAt.toISOString() }; await tx.juryEvaluationRevision.create({ data: { evaluationId: row.id, revision: updated.revision, requestId: input.requestId, requestHash: hash, snapshot, action: input.submit ? 'SUBMITTED' : 'DRAFT_SAVED', actorReference: actor.reference } }); await audit(tx, actor, p.id, input.submit ? 'EVALUATION_SUBMITTED' : 'EVALUATION_DRAFT_SAVED', 'Evaluation', row.id, { revision: updated.revision }); return snapshot; }, { maxWait: 5000, timeout: 15000 }); }
export async function myAssignments(actor: Actor, projectId?: string) { if(actor.studentId||actor.user?.role==='STUDENT')return []; const memberWhere = actor.userId ? { userId: actor.userId } : { invitationId: actor.invitationId }; return prisma.juryAssignment.findMany({ where: { enabled: true, member: { ...memberWhere, status: 'ACCEPTED', ...(projectId ? { panel: { projectId } } : {}) } }, select: { id: true, criterionIds: true, candidate: { select: { id: true, topic: true, position: true, checkIn: true, participant: { select: { displayNameSnapshot: true } }, group: { select: { name: true } }, project: { select: { id: true, title: true, academicYear: true, term: true, status: true, activeRubricId: true } } } }, juryEvaluation_assignment: { select: { id: true, status: true, revision: true, rubricVersionId: true, updatedAt: true } } }, orderBy: { candidate: { position: 'asc' } } }); }
export async function requestReopen(actor: Actor, evaluationId: string, reason: string) { requireReason(reason); const evaluation = await prisma.juryEvaluation.findUnique({ where: { id: evaluationId }, include: { assignment: true } }); if (!evaluation)
    throw new JuryError('EVALUATION_NOT_FOUND', 'This evaluation was not found.', 404); const { own, access } = await assignmentAccess(actor, evaluation.assignmentId); if (!own && !access.manager)
    throw new JuryError('REOPEN_DENIED', 'You cannot request reopening for this evaluation.', 403); return prisma.juryReopenRequest.create({ data: { projectId: access.project.id, evaluationId, requestedBy: actor.reference, reason } }); }
export async function reopenEvaluation(actor: Actor, evaluationId: string, reason: string) { requireReason(reason); const e = await prisma.juryEvaluation.findUnique({ where: { id: evaluationId }, include: { assignment: { include: { candidate: true } } } }); if (!e)
    throw new JuryError('EVALUATION_NOT_FOUND', 'This evaluation was not found.', 404); return projectTransaction(actor, e.assignment.candidate.projectId, undefined, async (tx, { project }) => { await tx.$queryRaw(Prisma.sql `SELECT id FROM "JuryEvaluation" WHERE id=${evaluationId} FOR UPDATE`); const row = await tx.juryEvaluation.findUniqueOrThrow({ where: { id: evaluationId } }); const revision = row.revision + 1; await tx.juryResultRun.updateMany({ where: { projectId: project.id, status: 'APPROVED' }, data: { status: 'SUPERSEDED' } }); await tx.juryProject.update({ where: { id: project.id }, data: { status: 'EVALUATION_IN_PROGRESS', revision: { increment: 1 } } }); const updated = await tx.juryEvaluation.update({ where: { id: evaluationId }, data: { status: 'DRAFT', revision, reopenedAt: new Date(), submittedAt: null } }); await tx.juryEvaluationRevision.create({ data: { evaluationId, revision, requestId: 'reopen:' + revision, requestHash: checksum({ reason }), snapshot: { status: 'DRAFT', revision }, action: 'REOPENED', actorReference: actor.reference, reason } }); await tx.juryReopenRequest.updateMany({ where: { evaluationId, status: 'PENDING' }, data: { status: 'APPROVED', resolvedAt: new Date(), resolvedBy: actor.reference } }); await audit(tx, actor, project.id, 'EVALUATION_REOPENED', 'Evaluation', evaluationId, { revision }, reason); return updated; }); }
export async function consolidateResults(actor: Actor, projectId: string, revision: number) {
    return projectTransaction(actor, projectId, revision, async (tx, { project: p }) => {
        if (!['EVALUATION_CLOSED', 'RESULTS_PENDING_VALIDATION'].includes(p.status))
            throw new JuryError('CLOSE_EVALUATION_FIRST', 'Close scoring before consolidating results.', 409);
        const rubric = p.activeRubric;
        if (!rubric)
            throw new JuryError('RUBRIC_REQUIRED', 'A published rubric is required.');
        const criteria = rubricCriteria(rubric.juryCriterion_rubric), rules = { ...defaultScoringRules, ...p.settings } as ScoringRules, candidates = await tx.juryCandidate.findMany({ where: { projectId }, include: { group: { include: { juryGroupMember_group: true } }, juryAssignment_candidate: { where: { enabled: true }, include: { member: true, juryEvaluation_assignment: { where: { rubricVersionId: rubric.id, status: 'SUBMITTED' }, include: { juryEvaluationScore_evaluation: true } } } } }, orderBy: { position: 'asc' } }), rows: any[] = [];
        for (const c of candidates) {
            const scope = c.groupId ? 'GROUP' : 'INDIVIDUAL', assigned = c.juryAssignment_candidate.filter((a: any) => a.member.status === 'ACCEPTED' && (!a.member.conflictOfInterest || a.member.conflictAcknowledgedBy)), submitted = assigned.flatMap((a: any) => a.juryEvaluation_assignment.map((e: any) => ({ a, e })));
            let result: any = { score: null, maximum: String(p.maximum), percentage: null, judgeCount: submitted.length, status: ['ABSENT','EXCUSED', 'DISQUALIFIED'].includes(c.checkIn) ? c.checkIn : 'INCOMPLETE', statistics: {}, criterionResults: {}, flags: [] };
            if (result.status === 'INCOMPLETE')
                try {
                    let marks: Mark[] = [], criterionResults: any = {};
                    const scopeCriteria = criteria.filter(k => !criteria.some(child => child.parentId === k.id) && (k.applicability === 'BOTH' || k.applicability === scope));
                    for (const criterion of scopeCriteria) {
                        const scores = submitted.flatMap(({ a, e }: any) => { const m = e.juryEvaluationScore_evaluation.find((m: any) => m.criterionId === criterion.id); return m?.kind === 'SCORED' ? [{ memberId: a.memberId, score: String(m.points), weight: String(a.member.weight), president: a.member.role === 'PRESIDENT' }] : []; });
                        const applicable = submitted.filter(({ e }: any) => e.juryEvaluationScore_evaluation.some((m: any) => m.criterionId === criterion.id && m.kind === 'NOT_APPLICABLE'));
                        if (!scores.length && !criterion.mandatory && applicable.length >= Math.max(rules.minimumJudges, criterion.minimumJudges || 1)) {
                            marks.push({ criterionId: criterion.id, kind: 'NOT_APPLICABLE' });
                            continue;
                        }
                        const consolidated = consolidate(scores, String(criterion.maximum), { ...rules, minimumJudges: Math.max(rules.minimumJudges, criterion.minimumJudges || 1) });
                        criterionResults[criterion.id] = consolidated;
                        marks.push({ criterionId: criterion.id, kind: 'SCORED', points: consolidated.score, comment: 'Consolidated jury assessment' });
                    }
                    let consolidated: any;
                    if (rules.aggregation === 'CRITERION_PANEL') {
                        const total = evaluate(criteria, marks, String(p.maximum), scope);
                        if (!total.complete)
                            throw new ScoringError('INCOMPLETE_PANEL', 'The criterion panels are incomplete.');
                        consolidated = { score: total.total, maximum: String(p.maximum), percentage: total.percentage, judgeCount: submitted.length, statistics: {}, flags: Object.values(criterionResults).flatMap((r: any) => r.flags) };
                    }
                    else {
                        if (assigned.some((a: any) => a.criterionIds.length))
                            throw new JuryError('PANEL_AGGREGATION_REQUIRED', 'Partial-criterion assignments require criterion-panel aggregation.');
                        consolidated = consolidate(submitted.map(({ a, e }: any) => ({ memberId: a.memberId, score: e.total === null ? null : String(e.total), weight: String(a.member.weight), president: a.member.role === 'PRESIDENT' })), String(p.maximum), rules);
                    }
                    result = { ...result, ...consolidated, status: 'COMPLETE', criterionResults };
                }
                catch (error) {
                    if (error instanceof ScoringError || error instanceof JuryError)
                        result.flags = [error.code];
                    else
                        throw error;
                }
            rows.push({ candidate: c, ...result });
        }
        const participants = p.juryParticipant_project, studentRows: any[] = [];
        for (const participant of participants) {
            const individual = rows.find(r => r.candidate.participantId === participant.id), group = rows.find(r => r.candidate.group?.juryGroupMember_group.some((m: any) => m.participantId === participant.id)), score = participant.status !== 'ACTIVE' ? null : p.mode === 'HYBRID' ? hybridScore(group?.score ?? null, individual?.score ?? null, (p.settings as any).groupWeight, (p.settings as any).individualWeight) : p.mode === 'GROUP' ? group?.score ?? null : individual?.score ?? null;
            studentRows.push({ participantId: participant.id, groupScore: group?.score ?? null, individualScore: individual?.score ?? null, score, maximum: String(p.maximum), percentage: score === null ? null : new Decimal(score).div(String(p.maximum)).mul(100).toDecimalPlaces(8).toString(), status: participant.status !== 'ACTIVE' ? participant.status : score === null ? 'INCOMPLETE' : 'COMPLETE' });
        }
        const ranked = rankScores(studentRows), version = p.resultVersion + 1, run = await tx.juryResultRun.create({ data: { projectId, version, method: rules.method, settings: rules as any, rubricVersionId: rubric.id, checksum: checksum({ rows: rows.map(({ candidate, ...r }) => ({ candidateId: candidate.id, score:r.score, maximum:r.maximum, percentage:r.percentage, judgeCount:r.judgeCount, status:r.status, statistics:{...r.statistics,unrounded:r.unrounded??r.score}, criterionResults:r.criterionResults, flags:r.flags })), students: ranked }), juryCandidateResult_run: { create: rows.map(({ candidate, ...r }) => ({ candidateId: candidate.id, score:r.score, maximum:r.maximum, percentage:r.percentage, judgeCount:r.judgeCount, status:r.status, statistics:{...r.statistics,unrounded:r.unrounded??r.score}, criterionResults:r.criterionResults, flags:r.flags })) }, juryStudentResult_run: { create: ranked.map(({ rank, ...r }) => ({ ...r, rank })) } } });
        await tx.juryProject.update({ where: { id: projectId }, data: { resultVersion: version, status: 'RESULTS_PENDING_VALIDATION', revision: { increment: 1 } } });
        await audit(tx, actor, projectId, 'RESULTS_CONSOLIDATED', 'ResultRun', run.id, { version, incomplete: ranked.filter(r => r.score === null).length });
        return run;
    });
}
export async function approveResults(actor: Actor, projectId: string, revision: number, runId: string, reason: string) { return projectTransaction(actor, projectId, revision, async (tx, { project }) => { const run = await tx.juryResultRun.findUnique({ where: { id: runId }, include: { juryStudentResult_run: true } }); if (!run || run.projectId !== projectId || run.version !== project.resultVersion || project.status !== 'RESULTS_PENDING_VALIDATION')
    throw new JuryError('STALE_RESULT_RUN', 'Recompute and review the current result version.', 409); const incomplete = run.juryStudentResult_run.filter((r: any) => r.status === 'INCOMPLETE'); if (incomplete.length)
    throw new JuryError('INCOMPLETE_RESULTS', 'Complete or explicitly mark absent/disqualified learners before approval.', 409); requireReason(reason); await tx.juryResultRun.update({ where: { id: runId }, data: { status: 'APPROVED', approvedAt: new Date(), approvedByReference: actor.reference } }); await tx.juryProject.update({ where: { id: projectId }, data: { status: 'APPROVED', revision: { increment: 1 } } }); await audit(tx, actor, projectId, 'RESULTS_APPROVED', 'ResultRun', runId, { version: run.version }, reason); return { approved: true, runId }; }); }
