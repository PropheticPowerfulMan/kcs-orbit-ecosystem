import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import XLSX from 'xlsx';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from './database.js';
import { assertAcademicVisible } from '../services/academicVisibility.service.js';
import { type Actor, projectAccess, audit, requireReason } from './policy.js';
import { JuryError, checksum, digest, publicBase, spreadsheetCell, safeFilename } from './security.js';
export const reportTitles: Record<string, [
    string,
    string
]> = { GROUP_COMPOSITION: ['Group Composition and Readiness Register', 'Registre de composition et de préparation des groupes'], PROJECT_EVALUATION: ['Project Evaluation Report', 'Rapport d’évaluation du projet'], INDIVIDUAL_ASSESSMENT: ['Individual Student Assessment', 'Évaluation individuelle de l’élève'], GROUP_ASSESSMENT: ['Group Assessment Report', 'Évaluation du groupe'], JURY_SCORING: ['Jury Scoring Sheet', 'Feuille de notation du jury'], DELIBERATION: ['Jury Deliberation Report', 'Rapport de délibération'], FINAL_RANKING: ['Final Ranking Report', 'Classement final'], PROJECT_ATTENDANCE: ['Project Attendance Report', 'Rapport de présence'], GRADEBOOK_SYNCHRONIZATION: ['Gradebook Synchronization Report', 'Rapport de synchronisation'], PARTICIPATION_CERTIFICATE: ['Certificate of Participation', 'Certificat de participation'], EXCELLENCE_CERTIFICATE: ['Certificate of Excellence', 'Certificat d’excellence'], JURY_APPRECIATION_CERTIFICATE: ['Jury Appreciation Certificate', 'Certificat de reconnaissance du jury'] };
export async function resultData(actor: Actor, projectId: string) { const access = await projectAccess(actor, projectId), p = access.project, run = await prisma.juryResultRun.findUnique({ where: { projectId_version: { projectId, version: p.resultVersion } }, include: { juryStudentResult_run: { include: { participant: true } }, juryCandidateResult_run: { include: { candidate: { include: { group: true, participant: true } } } } } }); if (!run)
    return { project: access.manager ? p : { id: p.id, title: p.title, academicYear: p.academicYear, term: p.term, maximum: p.maximum }, run: null, students: [], candidates: [], released: false }; if (!access.manager) {
    if (p.status !== 'PUBLISHED' || run.status !== 'APPROVED')
        throw new JuryError('RESULTS_PRIVATE', 'The organizer has not released these results.', 403);
    if (access.participant) {
        await assertAcademicVisible(actor.userId!, 'student', actor.studentId!, 'grades', { academicYear: p.academicYear, term: p.term });
        return { project: { id: p.id, title: p.title, academicYear: p.academicYear, term: p.term, maximum: p.maximum }, run: { id: run.id, version: run.version, status: run.status }, students: run.juryStudentResult_run.filter(s => s.participantId === access.participant.id).map(({ rank, ...s }) => ({ ...s, rank: (p.settings as any).publishRankings ? rank : null })), candidates: [], released: true };
    }
    throw new JuryError('RESULTS_ACCESS_DENIED', 'Detailed results are available to organizers and the concerned learner only.', 403);
} return { project: p, run, students: run.juryStudentResult_run, candidates: run.juryCandidateResult_run, released: p.status === 'PUBLISHED' }; }
export async function issueCertificate(actor: Actor, projectId: string, input: any) { const { project } = await projectAccess(actor, projectId, true); if (!['APPROVED', 'PUBLISHED', 'ARCHIVED'].includes(project.status))
    throw new JuryError('APPROVE_RESULTS_FIRST', 'Certificates require approved results.', 409); if (input.participantId) {
    if (!await prisma.juryParticipant.findFirst({ where: { id: input.participantId, projectId, status: 'ACTIVE' } }))
        throw new JuryError('PARTICIPANT_NOT_FOUND', 'Choose a participant in this project.');
    if (input.kind === 'EXCELLENCE_CERTIFICATE' && !await prisma.juryAward.findFirst({ where: { projectId, participantId: input.participantId } }))
        throw new JuryError('AWARD_REQUIRED', 'Record a transparent award decision before issuing an excellence certificate.');
} if (input.memberId && !await prisma.juryMember.findFirst({ where: { id: input.memberId, panel: { projectId } } }))
    throw new JuryError('MEMBER_NOT_FOUND', 'Choose a member of this jury.'); if (input.kind === 'JURY_APPRECIATION_CERTIFICATE' ? !input.memberId : !input.participantId)
    throw new JuryError('CERTIFICATE_TARGET_REQUIRED', 'Select the appropriate recipient.'); const reference = 'KCS-JURY-' + randomUUID().toUpperCase(), data = { kind: input.kind, reference, projectId, participantId: input.participantId, memberId: input.memberId, issuedByReference: actor.reference, language: input.language, settings: { signatureNames: input.signatureNames || [] }, verificationHash: digest(reference), documentHash: checksum({ reference, projectId, kind: input.kind, participantId: input.participantId, memberId: input.memberId }) }, c = await prisma.juryCertificate.create({ data }); await audit(prisma, actor, projectId, 'CERTIFICATE_ISSUED', 'Certificate', c.id, { reference, kind: input.kind }); return c; }
export async function certificateVerification(reference: string) { const c = await prisma.juryCertificate.findUnique({ where: { verificationHash: digest(reference) }, select: { reference: true, kind: true, issuedAt: true, revokedAt: true, documentHash: true } }); if (!c)
    throw new JuryError('DOCUMENT_NOT_FOUND', 'No issued document matches this reference.', 404); return { reference: c.reference, kind: c.kind, issuedAt: c.issuedAt, valid: !c.revokedAt, documentHash: c.documentHash, issuer: 'Kinshasa Christian School', privacy: 'Names and academic results are deliberately omitted.' }; }
export async function revokeCertificate(actor: Actor, id: string, reason: string) { requireReason(reason); const c = await prisma.juryCertificate.findUnique({ where: { id } }); if (!c)
    throw new JuryError('CERTIFICATE_NOT_FOUND', 'This certificate was not found.', 404); await projectAccess(actor, c.projectId, true); await prisma.juryCertificate.update({ where: { id }, data: { revokedAt: new Date(), revocationReason: reason } }); await audit(prisma, actor, c.projectId, 'CERTIFICATE_REVOKED', 'Certificate', id, {}, reason); return { revoked: true }; }
export async function exportResults(actor: Actor, projectId: string, format: 'csv' | 'xlsx') { await projectAccess(actor, projectId, true); const d = await resultData(actor, projectId), rows = [['Learner', 'Class', 'Section', 'Score', 'Maximum', 'Percentage', 'Rank', 'Status'], ...d.students.map((s: any) => [s.participant.displayNameSnapshot, s.participant.gradeSnapshot, s.participant.sectionSnapshot, s.score === null ? '' : String(s.score), String(s.maximum), s.percentage === null ? '' : String(s.percentage), s.rank ?? '', s.status])].map(row => row.map(spreadsheetCell)); if (format === 'csv')
    return { bytes: Buffer.from('\ufeff' + rows.map(row => row.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n'), 'utf8'), mime: 'text/csv; charset=utf-8', filename: 'KCS-Jury-results.csv' }; const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Validated results'); return { bytes: XLSX.write(book, { bookType: 'xlsx', type: 'buffer' }) as Buffer, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'KCS-Jury-results.xlsx' }; }
import { juryPdf } from './pdfLayout.js';
export async function generateReport(actor: Actor, projectId: string, kind: string, language: 'en' | 'fr', targetId?: string, certificateId?: string) {
    if (!reportTitles[kind])
        throw new JuryError('REPORT_KIND_INVALID', 'Choose a supported report.');
    const access = await projectAccess(actor, projectId), p = access.project, t = (en: string, fr: string) => language === 'fr' ? fr : en;
    if (!access.manager && kind !== 'JURY_SCORING' && kind !== 'INDIVIDUAL_ASSESSMENT' && !kind.endsWith('CERTIFICATE'))
        throw new JuryError('REPORT_ACCESS_DENIED', 'This document requires project management access.', 403);
    if (kind === 'JURY_SCORING' && !access.manager && !access.member)
        throw new JuryError('REPORT_ACCESS_DENIED', 'This scoring sheet is reserved for assigned judges.', 403);
    if (kind === 'INDIVIDUAL_ASSESSMENT' && !access.manager && targetId !== access.participant?.id)
        throw new JuryError('REPORT_ACCESS_DENIED', 'Select only your own assessment.', 403);
    const data = kind.endsWith('CERTIFICATE') || kind === 'JURY_SCORING' || kind === 'PROJECT_ATTENDANCE' || kind === 'GROUP_COMPOSITION' || kind === 'GRADEBOOK_SYNCHRONIZATION' ? { run: null, students: [], candidates: [] } : await resultData(actor, projectId);
    const certificate = certificateId ? await prisma.juryCertificate.findUnique({ where: { id: certificateId }, include: { participant: true, member: { include: { user: { select: { lastName: true, firstName: true, middleName: true } }, invitation: { select: { displayName: true } } } } } }) : null;
    if (kind.endsWith('CERTIFICATE') && (!certificate || certificate.projectId !== projectId || certificate.kind !== kind || certificate.revokedAt))
        throw new JuryError('CERTIFICATE_REQUIRED', 'Issue a valid certificate before downloading it.');
    if (certificate && !access.manager && certificate.participantId !== access.participant?.id && certificate.memberId !== access.member?.id)
        throw new JuryError('CERTIFICATE_ACCESS_DENIED', 'This certificate belongs to another recipient.', 403);
    const reference = certificate?.reference || 'KCS-JURY-RPT-' + randomUUID().toUpperCase(), pdf = juryPdf(reportTitles[kind][language === 'fr' ? 1 : 0], p.title, `${p.academicYear} · ${p.term} · ${new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'Africa/Kinshasa' })}`, reference, language), { doc, section, text, table, distribution, ensure, colors } = pdf;
    const students: any[] = kind === 'INDIVIDUAL_ASSESSMENT' ? data.students.filter((s: any) => s.participantId === targetId) : data.students, candidates: any[] = kind === 'GROUP_ASSESSMENT' ? data.candidates.filter((c: any) => c.candidateId === targetId) : kind === 'INDIVIDUAL_ASSESSMENT' ? data.candidates.filter((c: any) => c.candidate.participantId === targetId) : data.candidates;
    if (certificate) {
        const name = certificate.participant?.displayNameSnapshot || [certificate.member?.user?.lastName, certificate.member?.user?.middleName, certificate.member?.user?.firstName].filter(Boolean).join(' ') || certificate.member?.invitation?.displayName || 'Jury member';
        doc.moveDown(2);
        doc.font('KCSRegular').fontSize(12).fillColor(colors.muted).text(t('This is proudly presented to', 'Ce document est décerné à'), { align: 'center' });
        doc.moveDown();
        doc.font('KCSBold').fontSize(27).fillColor(colors.teal).text(name, { align: 'center', width: 507 });
        doc.moveDown(1.2);
        doc.font('KCSRegular').fontSize(12).fillColor(colors.ink).text(kind === 'EXCELLENCE_CERTIFICATE' ? t('In recognition of outstanding academic achievement, thoughtful inquiry and excellence demonstrated throughout this project.', 'En reconnaissance de ses résultats remarquables et de l’excellence démontrée au cours de ce projet.') : kind === 'JURY_APPRECIATION_CERTIFICATE' ? t('In appreciation of dedicated service, professional judgment and a commitment to fair academic evaluation.', 'En reconnaissance de son engagement, de son expertise et de sa contribution à une évaluation équitable.') : t('For active participation, engagement and contribution to the successful completion of this academic project.', 'Pour sa participation active, son engagement et sa contribution à la réalisation de ce projet académique.'), { align: 'center', width: 507, lineGap: 6 });
        doc.moveDown(2);
        text(t('The certificate verification QR and document reference appear in the footer.','Le QR de vérification et la référence du certificat figurent en pied de page.'));
        ensure(85);
        const names = (certificate.settings as any)?.signatureNames || [];
        table([t('School representative', 'Représentant de l’école'), t('Jury president', 'Président du jury')], [[names[0] || '____________________________', names[1] || '____________________________']], [0.5, 0.5]);
    }
    else if (kind === 'JURY_SCORING') {
        section(t('Assessment rubric', 'Grille d’évaluation'));
        table([t('Criterion', 'Critère'), t('Maximum / weight', 'Maximum / poids'), t('Score / observations', 'Note / observations')], (p.activeRubric?.juryCriterion_rubric || []).sort((a: any, b: any) => a.position - b.position).map((c: any) => [c.name + (c.instructions ? '\n' + c.instructions.slice(0, 1200) : ''), String(c.maximum) + ' / ' + String(c.weight), '________________________']), [0.48, 0.18, 0.34]);
        section(t('Judge declaration', 'Déclaration du juge'));
        text(t('I confirm that my assessment is independent, evidence-based and free from undisclosed conflicts of interest.', 'Je confirme que mon évaluation est indépendante, fondée sur des éléments observables et exempte de conflit d’intérêts non déclaré.'));
        text(t('Name / signature: ____________________________', 'Nom / signature : ____________________________'));
    }
    else if(kind==='GROUP_COMPOSITION'){
      if(p.mode==='INDIVIDUAL')throw new JuryError('GROUP_MODE_REQUIRED','This project uses individual assessment.');
      const groups=await prisma.juryGroup.findMany({where:{projectId},include:{juryGroupMember_group:{include:{participant:true}}},orderBy:{name:'asc'}});
      const participants=await prisma.juryParticipant.findMany({where:{projectId},orderBy:{displayNameSnapshot:'asc'}}),assigned=new Set(groups.flatMap(g=>g.juryGroupMember_group.map(m=>m.participantId))),unassigned=participants.filter(person=>!assigned.has(person.id));
      section(t('Composition at the time of export','Composition au moment de l’exportation'));
      text(t('Project status: ','État du projet : ')+p.status+' · '+groups.length+t(' groups · ',' groupes · ')+participants.length+t(' registered learners · ',' élèves inscrits · ')+unassigned.length+t(' unassigned',' non affectés'));
      text(t('This register describes saved membership. It is not an academic result or approval of the evaluations.','Ce registre décrit la composition enregistrée. Il ne constitue ni un résultat académique ni une approbation des évaluations.'));
      table([t('Group / topic','Groupe / sujet'),t('Learners','Élèves'),t('Group leader','Responsable')],groups.map(g=>[g.name+'\n'+g.topic,g.juryGroupMember_group.length,g.juryGroupMember_group.find(m=>m.participantId===g.leaderParticipantId)?.participant.displayNameSnapshot||'—']),[.52,.12,.36]);
      if(groups.length){
        section(t('Group-size distribution · learners','Répartition des effectifs · élèves'));
        const values=groups.map(g=>g.juryGroupMember_group.length).sort((a,b)=>a-b),mean=values.reduce((a,b)=>a+b,0)/values.length,median=values.length%2?values[Math.floor(values.length/2)]:(values[values.length/2-1]+values[values.length/2])/2,sd=Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0)/values.length),maximum=Math.max(1,...values);
        text(t('Groups: ','Groupes : ')+values.length+' · '+t('Mean size: ','Effectif moyen : ')+mean.toFixed(2)+' · '+t('Median: ','Médiane : ')+median.toFixed(2)+' · σ '+sd.toFixed(2)+' · min '+values[0]+' / max '+maximum);
        for(const group of groups){doc.font('KCSRegular').fontSize(8);const height=Math.max(27,doc.heightOfString(group.name,{width:165})+8);ensure(height);const y=doc.y;doc.font('KCSRegular').fontSize(8).fillColor(colors.ink).text(group.name,48,y,{width:165});doc.roundedRect(225,y+2,Math.max(1,205*group.juryGroupMember_group.length/maximum),12,3).fill(colors.teal);doc.font('KCSRegular').fontSize(8).fillColor(colors.ink).text(group.juryGroupMember_group.length+t(' learners',' élèves'),440,y,{width:105});doc.x=46;doc.y=y+height;}
      }
      for(const group of groups){section(group.name+' · '+group.juryGroupMember_group.length+t(' learners',' élèves'));table([t('Learner','Élève'),t('Class','Classe'),t('Responsibility','Responsabilité')],[...group.juryGroupMember_group].sort((a,b)=>a.participant.displayNameSnapshot.localeCompare(b.participant.displayNameSnapshot)).map(m=>[m.participant.displayNameSnapshot,m.participant.gradeSnapshot+' '+m.participant.sectionSnapshot,m.participantId===group.leaderParticipantId?t('Group leader','Responsable'):t('Member','Membre')]),[.5,.25,.25]);}
      if(unassigned.length){section(t('Registered learners still awaiting a group','Élèves inscrits encore sans groupe'));table([t('Learner','Élève'),t('Class','Classe')],unassigned.map(person=>[person.displayNameSnapshot,person.gradeSnapshot+' '+person.sectionSnapshot]),[.7,.3]);}
    }
    else if (kind === 'PROJECT_ATTENDANCE') {
        const list = await prisma.juryCandidate.findMany({ where: { projectId }, include: { participant: true, group: true }, orderBy: { position: 'asc' } });
        section(t('Candidate check-in register', 'Registre de présence des candidats'));
        table(['#', t('Candidate', 'Candidat'), t('Status / server time', 'État / heure serveur')], list.map(c => [c.position, c.group?.name || c.participant?.displayNameSnapshot, c.checkIn + '\n' + (c.checkInAt?.toISOString() || '—')]), [0.08, 0.5, 0.42]);
    }
    else if (kind === 'GRADEBOOK_SYNCHRONIZATION') {
        const list = await prisma.juryPublication.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { juryPublicationItem_publication: true } } } });
        section(t('Verified publication receipts', 'Reçus de publication vérifiée'));
        table([t('Receipt / destination', 'Reçu / destination'), t('Period / cells', 'Période / cellules'), t('Verification', 'Vérification')], list.map(c => [c.receiptReference + '\n' + c.courseReference, c.academicYear + ' · ' + c.term + '\n' + c._count.juryPublicationItem_publication, c.status + '\nRevision ' + c.workspaceRevisionBefore + ' → ' + c.workspaceRevisionAfter]), [0.45, 0.3, 0.25]);
        text(t('A verified receipt confirms a server read-back at publication time. Reconciliation detects subsequent teacher edits.', 'Un reçu vérifié confirme la relecture au moment de la publication. La réconciliation détecte les modifications ultérieures.'));
    }
    else {
        if (!data.run)
            throw new JuryError('RESULTS_REQUIRED', 'Consolidate results before exporting this report.');
        section(t('Academic results', 'Résultats académiques'));
        if (kind === 'GROUP_ASSESSMENT')
            table([t('Group', 'Groupe'), t('Score', 'Note'), t('Evidence', 'Éléments')], candidates.map(c => [c.candidate.group?.name || c.candidate.participant?.displayNameSnapshot, c.score === null ? '—' : String(c.score) + ' / ' + String(c.maximum), c.status + '\n' + (Array.isArray(c.flags) ? c.flags.join(', ') : '')]), [0.48, 0.22, 0.3]);
        else
            table([t('Rank / learner', 'Rang / élève'), t('Score', 'Note'), t('Percentage', 'Pourcentage'), t('Status', 'État')], [...students].sort((a, b) => (a.rank || 99999) - (b.rank || 99999)).map(s => [(s.rank === null ? '—' : s.rank) + '  ' + s.participant.displayNameSnapshot, s.score === null ? '—' : String(s.score) + ' / ' + String(s.maximum), s.percentage === null ? '—' : Number(s.percentage).toFixed(2) + '%', s.status]), [0.44, 0.19, 0.17, 0.2]);
        distribution(students.filter(s => s.percentage !== null).map(s => Number(s.percentage)), t('Performance distribution', 'Distribution des résultats'));
        if (['PROJECT_EVALUATION', 'DELIBERATION', 'INDIVIDUAL_ASSESSMENT'].includes(kind)) {
            section(t('Criterion evidence and jury agreement', 'Critères et accord du jury'));
            for (const c of candidates) {
                ensure(65);
                text((c.candidate.group?.name || c.candidate.participant?.displayNameSnapshot || 'Candidate') + ' · ' + c.judgeCount + ' ' + t('submitted judge(s)', 'juge(s) ayant soumis'));
                table([t('Criterion', 'Critère'), t('Score / maximum', 'Note / maximum'), t('Agreement / dispersion', 'Accord / dispersion')], Object.entries(c.criterionResults || {}).map(([id, s]: any) => [(p.activeRubric?.juryCriterion_rubric || []).find((v: any) => v.id === id)?.name || id, s.score + ' / ' + s.maximum, 'SD ' + (s.statistics?.standardDeviation || '—') + ' · ' + s.judgeCount]), [0.46, 0.24, 0.3]);
            }
        }
        section(t('Validation and traceability', 'Validation et traçabilité'));
        text(t('Result version', 'Version des résultats') + ': ' + (data.run as any).version + ' · ' + (data.run as any).status);
        text(t('Content fingerprint', 'Empreinte du contenu') + ': ' + (data.run as any).checksum);
        text(t('Organizer signature: ____________________    Jury president: ____________________', 'Signature du responsable : ____________________    Président du jury : ____________________'));
    }
    const result = await pdf.finish();
    await audit(prisma, actor, projectId, 'REPORT_DOWNLOADED', 'Project', projectId, { kind, reference, format: 'PDF', pages: result.pages });
    return { bytes: result.bytes, filename: safeFilename('JURY - ' + reportTitles[kind][0] + ' - ' + p.academicYear + ' - ' + p.title) + '.pdf' };
}
