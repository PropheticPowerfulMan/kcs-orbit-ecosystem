import { Prisma } from '@prisma/client';
import { prisma } from './database.js';
import { JuryError, checksum, token, digest, publicBase } from './security.js';
import { type Actor, projectAccess, requireRevision, requireReason, audit } from './policy.js';
import { projectInput, rubricInput, termFor, nameOf } from './validation.js';
import { validateRubric } from './scoring.js';
import { randomUUID } from 'node:crypto';
export const writableComposition = new Set(['DRAFT', 'REGISTRATION_OPEN', 'SUBMISSION_OPEN', 'SCHEDULED']);
export const transitions: Record<string, string[]> = { DRAFT: ['REGISTRATION_OPEN', 'CANCELLED'], REGISTRATION_OPEN: ['SUBMISSION_OPEN', 'SCHEDULED', 'CANCELLED'], SUBMISSION_OPEN: ['SCHEDULED', 'CANCELLED'], SCHEDULED: ['EVALUATION_IN_PROGRESS', 'CANCELLED'], EVALUATION_IN_PROGRESS: ['EVALUATION_CLOSED'], EVALUATION_CLOSED: ['RESULTS_PENDING_VALIDATION', 'REOPENED'], RESULTS_PENDING_VALIDATION: ['APPROVED', 'REOPENED'], APPROVED: ['PUBLISHED', 'REOPENED'], PUBLISHED: ['ARCHIVED', 'REOPENED'], ARCHIVED: ['REOPENED'], CANCELLED: ['REOPENED'], REOPENED: ['SCHEDULED', 'EVALUATION_IN_PROGRESS', 'CANCELLED'] };
export async function lockProject(tx: any, id: string, shared = false) { await tx.$queryRaw(Prisma.sql `SELECT id FROM "JuryProject" WHERE id=${id} ${shared ? Prisma.sql `FOR SHARE` : Prisma.sql `FOR UPDATE`}`); }
export async function projectTransaction<T>(actor: Actor, id: string, revision: number | undefined, fn: (tx: any, access: any) => Promise<T>) { return prisma.$transaction(async (tx) => { await lockProject(tx, id); const access = await projectAccess(actor, id, true, tx); if (revision !== undefined)
    requireRevision(access.project.revision, revision); return fn(tx, access); }, { maxWait: 5000, timeout: 15000 }); }
export function assertComposition(project: any) { if (!writableComposition.has(project.status) || project.activeRubric?.lockedAt)
    throw new JuryError('COMPOSITION_LOCKED', 'Participants, groups and assignments are protected once evaluation begins.', 409); }
export async function touch(tx: any, id: string, changes: {status?:string} = {}) { return tx.juryProject.update({ where: { id }, data: { ...changes, revision: { increment: 1 } } }); }
export async function notify(tx: any, projectId: string, userIds: string[], title: string, message: string, key: string) { for (const userId of [...new Set(userIds)])
    await tx.juryOutbox.upsert({ where: { deduplicationKey: key + ':' + userId }, create: { projectId, kind: 'NOTIFICATION', deduplicationKey: key + ':' + userId, payload: { userId, title, message, link: publicBase() + '#/projects/' + projectId } }, update: {} }); }
export async function projectList(actor: Actor, filter: any) { const where: any = { ...(filter.academicYear ? { academicYear: filter.academicYear } : {}), ...(filter.status ? { status: filter.status } : {}), ...(filter.q ? { title: { contains: String(filter.q).slice(0, 160), mode: 'insensitive' } } : {}) }; if (!actor.academic && !actor.administrator)
    where.OR = [...(actor.userId ? [{ ownerId: actor.userId }, { juryPanel_project: { some: { juryMember_panel: { some: { userId: actor.userId, status: 'ACCEPTED' } } } } }] : []), ...(actor.invitationId ? [{ juryPanel_project: { some: { juryMember_panel: { some: { invitationId: actor.invitationId, status: 'ACCEPTED' } } } } }] : []), ...(actor.studentId ? [{ juryParticipant_project: { some: { studentId: actor.studentId } } }] : [])]; return prisma.juryProject.findMany({ where, select: { id: true, title: true, kind: true, mode: true, status: true, academicYear: true, semester: true, quarter: true, term: true, maximum: true, revision: true, presentationAt: true, updatedAt: true, _count: { select: { juryParticipant_project: true, juryGroup_project: true, juryPublication_project: true } } }, orderBy: { updatedAt: 'desc' }, take: 100 }); }
export async function createProject(actor: Actor, raw: unknown) { if (!actor.userId || !actor.teacher && !actor.academic)
    throw new JuryError('CREATE_PROJECT_DENIED', 'Only authorized teachers and academic administrators may create projects.', 403); const body = projectInput.parse(raw); return prisma.$transaction(async (tx) => { const courses = await tx.course.findMany({ where: { id: { in: body.courseIds } }, include: { teacher: { select: { userId: true } } } }); if (courses.length !== new Set(body.courseIds).size || !actor.academic && courses.some(c => c.teacher.userId !== actor.userId))
    throw new JuryError('COURSE_ACCESS_DENIED', 'Select canonical courses assigned to your institutional account.', 403); const { courseIds, ...fields } = body; const project = await tx.juryProject.create({ data: { ...fields, maximum: String(body.maximum), settings: body.settings, semester: body.quarter <= 2 ? 1 : 2, term: termFor(body.quarter), ownerId: actor.userId, ownerReference: actor.reference, juryProjectCourse_project: { create: courseIds.map(courseId => ({ courseId, courseReference: courseId })) }, juryPanel_project: { create: { title: 'Project jury' } }, juryProjectSession_project: { create: { title: body.title, scheduledAt: body.presentationAt, durationSeconds: body.durationSeconds, venue: body.venue } } } }); await audit(tx, actor, project.id, 'PROJECT_CREATED', 'Project', project.id, { courseIds }); return project; }); }
export async function projectDetail(actor: Actor, id: string) { const a = await projectAccess(actor, id); const p: any = a.project; const candidates = await prisma.juryCandidate.findMany({ where: { projectId: id, ...(!a.manager && !a.member ? { OR: [{ participantId: a.participant?.id }, { group: { juryGroupMember_group: { some: { participantId: a.participant?.id } } } }] } : {}) }, include: { group: { include: { juryGroupMember_group: { include: { participant: true } } } }, participant: true }, orderBy: { position: 'asc' } }); const sessions = await prisma.juryProjectSession.findMany({ where: { projectId: id } }); const members = a.manager ? await prisma.juryMember.findMany({ where: { panel: { projectId: id } }, select: { id: true, userId: true, role: true, weight: true, status: true, availability: true, conflictOfInterest: true, conflictReason: true, conflictAcknowledgedBy: true, revision: true, user: { select: { firstName: true, lastName: true, middleName: true } }, invitation: { select: { id: true, displayName: true, email: true, expiresAt: true, revokedAt: true } } } }) : []; const rubric = p.activeRubric ? { ...p.activeRubric, criteria: p.activeRubric.juryCriterion_rubric.map((c: any) => ({ ...c, levels: c.juryPerformanceLevel_criterion })) } : null; return { project: { id: p.id, title: p.title, description: p.description, objectives: p.objectives, instructions: p.instructions, kind: p.kind, mode: p.mode, status: p.status, academicYear: p.academicYear, semester: p.semester, quarter: p.quarter, term: p.term, maximum: p.maximum, settings: p.settings, revision: p.revision, resultVersion: p.resultVersion, registrationDeadline: p.registrationDeadline, submissionDeadline: p.submissionDeadline, presentationAt: p.presentationAt, durationSeconds: p.durationSeconds, venue: p.venue, ownerReference: p.ownerReference }, permissions: { manage: a.manager, judge: Boolean(a.member), participant: Boolean(a.participant) }, self:{participantId:a.participant?.id||null,memberId:a.member?.id||null}, courses: p.juryProjectCourse_project.map((c: any) => ({ id: c.courseReference, name: c.course?.name || 'Archived course' })), rubric, participants: a.manager ? p.juryParticipant_project : [], candidates, sessions: sessions.map(({ displayTokenHash, ...s }) => s), members }; }
export async function updateProject(actor: Actor, id: string, revision: number, raw: unknown) { const b = projectInput.parse(raw); return projectTransaction(actor, id, revision, async (tx, { project }) => { assertComposition(project); if (b.mode !== project.mode && (await tx.juryParticipant.count({ where: { projectId: id } })))
    throw new JuryError('MODE_LOCKED', 'Create a new project to change mode after registration.', 409); const courses = await tx.course.findMany({ where: { id: { in: b.courseIds } }, include: { teacher: { select: { userId: true } } } }); if (courses.length !== new Set(b.courseIds).size || !actor.academic && courses.some((c: any) => c.teacher.userId !== actor.userId))
    throw new JuryError('COURSE_ACCESS_DENIED', 'The destination courses are not assigned to you.', 403); const { courseIds, ...fields } = b; await tx.juryProjectCourse.deleteMany({ where: { projectId: id } }); const p = await tx.juryProject.update({ where: { id }, data: { ...fields, maximum: String(b.maximum), settings: b.settings, semester: b.quarter <= 2 ? 1 : 2, term: termFor(b.quarter), revision: { increment: 1 }, juryProjectCourse_project: { create: courseIds.map(courseId => ({ courseId, courseReference: courseId })) } } }); await audit(tx, actor, id, 'PROJECT_UPDATED', 'Project', id, { revision: p.revision }); return p; }); }
export async function transition(actor: Actor, id: string, revision: number, status: string, reason: string) { return projectTransaction(actor, id, revision, async (tx, { project }) => { if (!transitions[project.status]?.includes(status))
    throw new JuryError('INVALID_TRANSITION', `Cannot change ${project.status} to ${status}.`, 409); if (['CANCELLED', 'REOPENED', 'ARCHIVED'].includes(status))
    requireReason(reason); if (status === 'EVALUATION_IN_PROGRESS') {
    if (!project.activeRubricId)
        throw new JuryError('RUBRIC_REQUIRED', 'Publish a rubric before starting evaluations.');
    const candidates = await tx.juryCandidate.findMany({ where: { projectId: id, checkIn: { notIn: ['ABSENT', 'DISQUALIFIED'] } } });
    if (!candidates.length)
        throw new JuryError('CANDIDATES_REQUIRED', 'Register at least one eligible candidate.');
    const members = await tx.juryMember.findMany({ where: { panel: { projectId: id }, status: 'ACCEPTED' } });
    const rules: any = project.settings;
    if (members.filter((m: any) => !m.conflictOfInterest || m.conflictAcknowledgedBy).length < rules.minimumJudges)
        throw new JuryError('JURY_QUORUM_REQUIRED', 'The jury does not meet the configured minimum.');
    for (const c of candidates) {
        const assigned = await tx.juryAssignment.findMany({ where: { candidateId: c.id, enabled: true, member: { status: 'ACCEPTED' } }, include: { member: true } });
        if (assigned.filter((a: any) => !a.member.conflictOfInterest || a.member.conflictAcknowledgedBy).length < rules.minimumJudges)
            throw new JuryError('ASSIGNMENT_QUORUM_REQUIRED', 'Every candidate needs the required number of eligible judges.');
    }
    await tx.juryRubricVersion.update({ where: { id: project.activeRubricId }, data: { lockedAt: new Date() } });
} if (status === 'RESULTS_PENDING_VALIDATION')
    throw new JuryError('CONSOLIDATE_FIRST', 'Use Consolidate results to compute and preserve a result version.'); if (status === 'APPROVED')
    throw new JuryError('APPROVE_RESULT_RUN', 'Approve the computed result version explicitly.'); if (status === 'PUBLISHED') {
    const run = await tx.juryResultRun.findUnique({ where: { projectId_version: { projectId: id, version: project.resultVersion } } });
    if (!run || run.status !== 'APPROVED')
        throw new JuryError('RESULTS_NOT_APPROVED', 'Approve the current result version before release.');
} if (status === 'REOPENED') {
    await tx.juryResultRun.updateMany({ where: { projectId: id, status: 'APPROVED' }, data: { status: 'SUPERSEDED' } });
} const p = await tx.juryProject.update({ where: { id }, data: { status, revision: { increment: 1 }, ...(status === 'ARCHIVED' ? { archivedAt: new Date() } : {}), ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}) } }); await audit(tx, actor, id, 'PROJECT_' + status, 'Project', id, { previousStatus: project.status }, reason); if (status === 'PUBLISHED') {
    const students = await tx.juryParticipant.findMany({ where: { projectId: id, status: 'ACTIVE', studentId: { not: null } }, select: { student: { select: { userId: true } } } });
    await notify(tx, id, students.map((s: any) => s.student?.userId).filter(Boolean), 'Jury results published', project.title, 'results:' + id + ':' + project.resultVersion);
} return p; }); }
export async function importParticipants(actor: Actor, id: string, revision: number, studentIds: string[]) { return projectTransaction(actor, id, revision, async (tx, { project }) => { assertComposition(project); const courses = project.juryProjectCourse_project.map((c: any) => c.courseId).filter(Boolean), students = await tx.studentProfile.findMany({ where: { id: { in: studentIds }, status: { equals: 'active', mode: 'insensitive' }, enrollments: { some: { courseId: { in: courses } } } }, include: { user: { select: { firstName: true, lastName: true, middleName: true } } } }); if (students.length !== new Set(studentIds).size)
    throw new JuryError('ROSTER_MISMATCH', 'Every selected learner must have an active enrollment in a project course.'); let position = await tx.juryCandidate.count({ where: { projectId: id } }); for (const s of students) {
    const p = await tx.juryParticipant.upsert({ where: { projectId_studentReference: { projectId: id, studentReference: s.id } }, create: { projectId: id, studentReference: s.id, studentId: s.id, displayNameSnapshot: nameOf(s.user), gradeSnapshot: s.grade, sectionSnapshot: s.section || '' }, update: {} });
    if (project.mode !== 'GROUP')
        await tx.juryCandidate.upsert({ where: { projectId_participantId: { projectId: id, participantId: p.id } }, create: { projectId: id, participantId: p.id, position: ++position }, update: {} });
} await audit(tx, actor, id, 'PARTICIPANTS_IMPORTED', 'Project', id, { count: students.length }); return touch(tx, id); }); }
export async function saveGroups(actor: Actor, id: string, revision: number, groups: {
    id?: string;
    name: string;
    topic: string;
    leaderParticipantId?: string;
    participantIds: string[];
}[]) { return projectTransaction(actor, id, revision, async (tx, { project }) => { assertComposition(project); if (project.mode === 'INDIVIDUAL')
    throw new JuryError('GROUP_MODE_REQUIRED', 'This project uses individual assessment.');
    const groupNames=groups.map(g=>g.name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()),groupIds=groups.map(g=>g.id).filter(Boolean);
    if(new Set(groupNames).size!==groupNames.length)throw new JuryError('GROUP_NAME_DUPLICATE','Every group must have a distinct name.');
    if(new Set(groupIds).size!==groupIds.length)throw new JuryError('GROUP_ID_DUPLICATE','The same saved group cannot be used twice in one composition.');
    const known = new Set(project.juryParticipant_project.map((p: any) => p.id)), ids = groups.flatMap(g => g.participantIds); if (new Set(ids).size !== ids.length || ids.some(p => !known.has(p)))
    throw new JuryError('GROUP_MEMBERSHIP_INVALID', 'A participant may belong to only one group in this project.'); const old = await tx.juryGroup.findMany({ where: { projectId: id } }); if (groups.some(g => g.id && !old.some((o: any) => o.id === g.id)))
    throw new JuryError('GROUP_NOT_FOUND', 'One of the groups does not belong to this project.'); const remove = old.filter((g: any) => !groups.some(n => n.id === g.id)); if (remove.length) {
    const submitted=await tx.juryCandidate.count({where:{projectId:id,groupId:{in:remove.map((g:any)=>g.id)},jurySubmission_candidate:{some:{}}}});
    if(submitted)throw new JuryError('GROUP_HAS_SUBMISSIONS','A group with a project portfolio cannot be removed. Preserve its identity and revise its membership instead.',409);
    await tx.juryCandidate.deleteMany({ where: { projectId: id, groupId: { in: remove.map((g: any) => g.id) } } });
    await tx.juryGroup.deleteMany({ where: { id: { in: remove.map((g: any) => g.id) } } });
} await tx.juryGroupMember.deleteMany({ where: { projectId: id } }); let pos = await tx.juryCandidate.count({ where: { projectId: id, groupId: null } }); for (const g of groups) {
    if (g.leaderParticipantId && !g.participantIds.includes(g.leaderParticipantId))
        throw new JuryError('GROUP_LEADER_INVALID', 'The leader must be a member of the group.');
    const row = g.id ? await tx.juryGroup.update({ where: { id: g.id }, data: { name: g.name, topic: g.topic, leaderParticipantId: g.leaderParticipantId || null, revision: { increment: 1 } } }) : await tx.juryGroup.create({ data: { projectId: id, name: g.name, topic: g.topic, leaderParticipantId: g.leaderParticipantId || null } });
    await tx.juryGroupMember.createMany({ data: g.participantIds.map(participantId => ({ projectId: id, groupId: row.id, participantId })) });
    await tx.juryCandidate.upsert({ where: { projectId_groupId: { projectId: id, groupId: row.id } }, create: { projectId: id, groupId: row.id, position: ++pos, topic: g.topic }, update: { topic: g.topic } });
} await audit(tx, actor, id, 'GROUPS_UPDATED', 'Project', id, { groups: groups.length }); return touch(tx, id); }); }
export async function publishRubric(actor: Actor, id: string, raw: unknown) { const b = rubricInput.parse(raw), keys = new Set(b.criteria.map(c => c.key)); validateRubric(b.criteria.map(c => ({ ...c, id: c.key, parentId: c.parentKey }))); if (b.criteria.some(c => c.parentKey && !keys.has(c.parentKey)))
    throw new JuryError('CRITERION_PARENT_INVALID', 'Every parent section must be in this rubric.'); return projectTransaction(actor, id, b.revision, async (tx, { project }) => { assertComposition(project); const version = (await tx.juryRubricVersion.aggregate({ where: { projectId: id }, _max: { version: true } }))._max.version || 0; const rubric = await tx.juryRubricVersion.create({ data: { projectId: id, version: version + 1, title: b.title, maximum: project.maximum, sourceTemplateId: b.sourceTemplateId, sourceTemplateVersion: b.sourceTemplateVersion, definitionHash: checksum(b.criteria) } }), ids = new Map(b.criteria.map(c => [c.key, randomUUID()])); for (const [position, c] of b.criteria.entries()) {
    const { key, parentKey, levels, ...fields } = c;
    await tx.juryCriterion.create({ data: { ...fields, id: ids.get(key), key, rubricVersionId: rubric.id, position, maximum: String(c.maximum), weight: String(c.weight), parentId: null, juryPerformanceLevel_criterion: { create: levels.map((l, position) => ({ ...l, minimum: String(l.minimum), maximum: String(l.maximum), position })) } } });
} for (const c of b.criteria)
    if (c.parentKey)
        await tx.juryCriterion.update({ where: { id: ids.get(c.key) }, data: { parentId: ids.get(c.parentKey) } }); const p = await tx.juryProject.update({ where: { id }, data: { activeRubricId: rubric.id, revision: { increment: 1 } } }); await audit(tx, actor, id, 'RUBRIC_VERSION_PUBLISHED', 'RubricVersion', rubric.id, { version: version + 1, hash: rubric.definitionHash }); return { rubric, project: p }; }); }
export async function addJuryMember(actor:Actor,id:string,revision:number,input:any){
 return projectTransaction(actor,id,revision,async(tx,{project})=>{
  assertComposition(project);const panel=project.juryPanel_project[0];if(input.conflictOfInterest)requireReason(input.conflictReason);
  if(input.role==='PRESIDENT'&&panel.presidentId)throw new JuryError('PRESIDENT_ALREADY_ASSIGNED','Change the current president explicitly before assigning another.');
  let data:any={panelId:panel.id,role:input.role,weight:input.weight,availability:input.availability||{},conflictOfInterest:input.conflictOfInterest||false,conflictReason:input.conflictReason||'',conflictAcknowledgedBy:null},invitationLink:string|undefined;
  if(input.userId){
   const user=await tx.user.findUnique({where:{id:input.userId},select:{id:true,role:true,accountBlockedAt:true,studentProfile:{select:{id:true}}}});
   if(!user||user.accountBlockedAt)throw new JuryError('JUDGE_UNAVAILABLE','This institutional account is unavailable. / Ce compte institutionnel est indisponible.',403);
   if(user.role==='STUDENT'||user.studentProfile)throw new JuryError('STUDENT_CANNOT_BE_JUDGE','Learners cannot be jury members. Select an employee, parent or eligible external person. / Les élèves ne peuvent pas être juges. Choisissez un employé, un parent ou une personne extérieure admissible.',403);
   data={...data,userId:user.id,userReference:user.id,status:'ACCEPTED'};
  }else{
   if(!input.email||!input.displayName||input.externalNotLearner!==true)throw new JuryError('EXTERNAL_JUDGE_DECLARATION_REQUIRED','Confirm the external person is not a KCS learner. / Confirmez que la personne extérieure n’est pas un élève KCS.',400);
   const email=String(input.email).trim().toLowerCase(),known=await tx.user.findFirst({where:{email:{equals:email,mode:'insensitive'}},select:{id:true,role:true,studentProfile:{select:{id:true}}}});
   if(known){if(known.role==='STUDENT'||known.studentProfile)throw new JuryError('STUDENT_CANNOT_BE_JUDGE','A learner cannot be invited as an external judge. / Un élève ne peut pas être invité comme juge extérieur.',403);throw new JuryError('SELECT_EXISTING_KCS_ACCOUNT','This person has a KCS account. Select it from the institutional directory. / Cette personne possède un compte KCS. Sélectionnez-le dans le registre institutionnel.',409)}
   const previous=await tx.juryInvitation.findFirst({where:{projectId:id,email,revokedAt:null,expiresAt:{gt:new Date()},juryMember_invitation:{some:{status:{not:'REVOKED'}}}},select:{id:true}});if(previous)throw new JuryError('JUDGE_ALREADY_INVITED','This person already has a current invitation for this project. / Cette personne possède déjà une invitation valide pour ce projet.',409);
   const raw=token(),invitation=await tx.juryInvitation.create({data:{projectId:id,email,displayName:input.displayName,tokenHash:digest(raw),createdByReference:actor.reference,expiresAt:new Date(Date.now()+Math.min(input.days||7,30)*86400000)}});
   data={...data,invitationId:invitation.id};invitationLink=publicBase()+'#/invitation?token='+raw;
   await tx.juryOutbox.create({data:{projectId:id,kind:'INVITATION',deduplicationKey:'invite:'+invitation.id,payload:{invitationId:invitation.id,link:invitationLink,language:input.language==='fr'?'fr':'en'}}});
  }
  const member=await tx.juryMember.create({data});if(input.role==='PRESIDENT')await tx.juryPanel.update({where:{id:panel.id},data:{presidentId:member.id,revision:{increment:1}}});await audit(tx,actor,id,'JURY_MEMBER_ADDED','Member',member.id,{external:!input.userId,role:input.role});await touch(tx,id);if(input.userId)await notify(tx,id,[input.userId],'Jury assignment',project.title,'jury:'+member.id);
  return{member,invitationQueued:!input.userId,...(invitationLink?{invitationLink}:{} )};
 });
}
export async function saveAssignments(actor: Actor, id: string, revision: number, input: {
    memberId: string;
    candidateIds: string[];
    criterionIds: string[];
}[]) { return projectTransaction(actor, id, revision, async (tx, { project }) => { assertComposition(project); const members = await tx.juryMember.findMany({ where: { panel: { projectId: id },status:{in:['INVITED','ACCEPTED']},OR:[{user:{is:{role:{not:'STUDENT'},studentProfile:{is:null},accountBlockedAt:null}}},{userId:null,invitationId:{not:null}}] } }), candidates = await tx.juryCandidate.findMany({ where: { projectId: id } }), criteria = project.activeRubric?.juryCriterion_rubric || []; for (const a of input) {
    if (!members.some((m: any) => m.id === a.memberId) || a.candidateIds.some(c => !candidates.some((v: any) => v.id === c)) || a.criterionIds.some(c => !criteria.some((v: any) => v.id === c)))
        throw new JuryError('ASSIGNMENT_REFERENCE_INVALID', 'Assignments must use members, candidates and criteria from the same project.');
    await tx.juryAssignment.updateMany({ where: { memberId: a.memberId }, data: { enabled: false } });
    for (const candidateId of a.candidateIds)
        await tx.juryAssignment.upsert({ where: { memberId_candidateId: { memberId: a.memberId, candidateId } }, create: { memberId: a.memberId, candidateId, criterionIds: a.criterionIds }, update: { criterionIds: a.criterionIds, enabled: true } });
} await audit(tx, actor, id, 'ASSIGNMENTS_UPDATED', 'Project', id, { members: input.length }); return touch(tx, id); }); }
