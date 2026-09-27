type ReportSubject = {
  id: string
  percentage: number
  letterGrade: string
  course: { name: string; code: string; credits?: number }
}

export type PrintableReportCard = {
  id: string
  term: string
  average: number
  teacherComment?: string | null
  conduct?: string | null
  publicationStatus: string
  attendanceSummary?: {
    total: number
    present: number
    absent: number
    late: number
    excused: number
    sick: number
    suspended: number
    attendanceRate: number | null
  } | null
  subjects?: ReportSubject[]
  student: {
    studentNumber: string
    grade?: string | null
    section?: string | null
    officialAvatar?: string | null
    user: { firstName: string; middleName?: string | null; lastName: string; avatar?: string | null }
  }
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[character] ?? character)

const printableAsset = (value?: string | null) => {
  if (!value) return ''
  if (/^(data:|blob:|https?:)/i.test(value)) return value
  return new URL(value, window.location.origin).href
}

export function printOfficialReportCard(card: PrintableReportCard, onBlocked: (message: string) => void) {
  const language = document.documentElement.lang.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const dateLocale = language === 'fr' ? 'fr-FR' : 'en-GB'
  const localizedTerm = (value: string) => language === 'fr'
    ? value.replace(/Semester/g, 'Semestre').replace(/Trimester/g, 'Trimestre').replace(/Annual final/gi, 'Final annuel')
    : value
  const logo = printableAsset('/images/kcs-logo.png')
  const watermark = printableAsset('/images/kcs.jpg?v=official-watermark-20260927')
  const photo = printableAsset(card.student.officialAvatar ?? card.student.user.avatar)
  const studentName = [card.student.user.lastName, card.student.user.middleName, card.student.user.firstName].filter(Boolean).join(' ')
  const issuedAt = new Date()
  const documentId = `KCS-RC-${issuedAt.toISOString().slice(0,10).replace(/-/g,'')}-${card.student.studentNumber.replace(/[^a-z0-9]/gi,'').toUpperCase()}`
  const statusLabel = ({
    DRAFT: tr('BROUILLON', 'DRAFT'),
    READY_FOR_REVIEW: tr('PRÊT POUR EXAMEN', 'READY FOR REVIEW'),
    APPROVED: tr('APPROUVÉ', 'APPROVED'),
    EMAILED: tr('ENVOYÉ PAR E-MAIL', 'EMAILED'),
    POSTED_TO_PORTAL: tr('PUBLIÉ DANS LE PORTAIL', 'POSTED TO PORTAL'),
  } as Record<string, string>)[card.publicationStatus] ?? card.publicationStatus.replace(/_/g, ' ')
  const subjects = (card.subjects ?? []).map((subject) => `
    <tr><td><b>${escapeHtml(subject.course.code)}</b><span>${escapeHtml(subject.course.name)}</span></td>
    <td class="number">${subject.course.credits ?? '—'}</td><td class="number">${subject.percentage.toFixed(2)}%</td>
    <td class="grade">${escapeHtml(subject.letterGrade)}</td></tr>`).join('')
  const attendance = card.attendanceSummary
  const photoBlock = photo
    ? `<img class="student-photo" src="${escapeHtml(photo)}" alt="${tr('Photo de l’élève', 'Student photograph')}">`
    : '<div class="student-photo placeholder">KCS</div>'

  const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(documentId)} · ${tr('Bulletin officiel', 'Official Report Card')}</title>
  <style>
  @page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#eaf2f8;color:#102849;font-family:"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{position:relative;isolation:isolate;width:210mm;min-height:277mm;margin:14px auto;overflow:hidden;background:#fff;border:1px solid #cad8e6;box-shadow:0 18px 55px #082b4d26}.top-line{height:8px;background:linear-gradient(90deg,#f1b82d 0 18%,#0d5d99 18% 84%,#20bfa9 84%)}
  .watermark-wrap{position:absolute;z-index:0;inset:0;display:grid;place-items:center;pointer-events:none}.watermark{display:block;width:138mm;height:138mm;object-fit:contain;object-position:center;opacity:.085;filter:grayscale(1);mix-blend-mode:multiply}.content{position:relative;z-index:1;padding:14mm 14mm 11mm}
  .masthead{display:flex;align-items:center;justify-content:space-between;gap:18px;padding-bottom:12px;border-bottom:3px solid #d6a62a}.school-logo{width:70mm;height:auto}.document-title{text-align:right}.document-title small{display:block;color:#60758c;font-size:9px;font-weight:800;letter-spacing:.17em;text-transform:uppercase}.document-title h1{margin:4px 0 0;color:#053665;font-size:23px;text-transform:uppercase}.document-title p{margin:5px 0 0;color:#8f6d15;font-size:9px;font-weight:800}
  .status{margin-top:10px;padding:7px 12px;border-radius:7px;background:#eaf5fb;color:#073b70;font-size:9px;font-weight:900;letter-spacing:.09em;text-align:center;text-transform:uppercase}.status.draft{background:#fff4cf;color:#795b0a}
  .identity{display:grid;grid-template-columns:26mm 1fr 38mm;gap:13px;align-items:center;margin:13px 0;padding:12px;background:linear-gradient(120deg,#f8fbfd,#edf7f5);border:1px solid #c8ddec;border-radius:10px}.student-photo{width:26mm;height:32mm;object-fit:cover;border:2px solid #d8aa2f;border-radius:8px;background:#fff}.student-photo.placeholder{display:flex;align-items:center;justify-content:center;color:#0d5d99;font-weight:900}
  .identity h2{margin:0 0 8px;color:#062f5b;font-size:19px}.identity p{margin:3px 0;color:#566c82;font-size:10px}.identity p b{color:#102849}.average{text-align:center;padding:10px;border-left:1px solid #b9cfdd}.average span{display:block;color:#60758c;font-size:8px;font-weight:800;text-transform:uppercase}.average b{display:block;margin-top:4px;color:#08716a;font-size:24px}
  h3{margin:14px 0 7px;color:#073b70;font-size:12px;letter-spacing:.06em;text-transform:uppercase}table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:9.5px}.course-col{width:46%}.credit-col{width:14%}.result-col{width:24%}.grade-col{width:16%}thead{display:table-header-group}th{padding:8px 7px;text-align:left;background:#0d5d99;color:#fff;font-size:8px;text-transform:uppercase}td{padding:8px 7px;border-bottom:1px solid #dce5ee}tbody tr:nth-child(even){background:#f3f8fb}td span{display:block;margin-top:2px;color:#62758a;font-size:8px}th:nth-child(n+2),td:nth-child(n+2){text-align:center}.number,.grade{text-align:center}.grade{color:#08716a;font-weight:900}
  .attendance{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.stat{padding:8px;text-align:center;border:1px solid #d5e2eb;border-radius:7px;background:#fff}.stat span{display:block;color:#6d8193;font-size:7px;font-weight:800;text-transform:uppercase}.stat b{display:block;margin-top:3px;color:#073b70;font-size:14px}
  .comments{display:grid;grid-template-columns:1.5fr 1fr;gap:10px}.comment{min-height:58px;padding:10px;border:1px solid #d2e0e9;border-left:4px solid #20a995;border-radius:7px;background:#fbfdfe;font-size:9px;line-height:1.5}.comment b{display:block;margin-bottom:4px;color:#073b70;text-transform:uppercase}
  .empty{padding:18px;text-align:center;color:#725b15;background:#fff7dc;border:1px solid #ead99d;border-radius:8px;font-size:9px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-top:24px}.signature{padding-top:7px;border-top:1px solid #496178;text-align:center;color:#52677d;font-size:9px}
  footer{display:flex;justify-content:space-between;margin-top:18px;padding-top:8px;border-top:2px solid #20a995;color:#5b7086;font-size:8px;line-height:1.45}footer strong{color:#073b70}
  @media print{body{background:#fff}.sheet{width:auto;min-height:0;margin:0;border:0;box-shadow:none}.content{padding:10mm 9mm 7mm}}
  </style></head><body><main class="sheet"><div class="top-line"></div><div class="watermark-wrap" aria-hidden="true"><img class="watermark" src="${escapeHtml(watermark)}" alt=""></div>
  <div class="content"><header class="masthead"><img class="school-logo" src="${escapeHtml(logo)}" alt="Kinshasa Christian School">
  <div class="document-title"><small>${tr('Dossier de progression académique', 'Academic Progress Record')}</small><h1>${tr('Bulletin scolaire officiel', 'Official Report Card')}</h1><p>${escapeHtml(documentId)}</p></div></header>
  <div class="status ${card.publicationStatus==='DRAFT'?'draft':''}">${tr('Statut du document', 'Document status')} · ${escapeHtml(statusLabel)}</div>
  <section class="identity">${photoBlock}<div><h2>${escapeHtml(studentName)}</h2>
  <p>${tr('Matricule', 'Student ID')} · <b>${escapeHtml(card.student.studentNumber)}</b></p><p>${tr('Classe', 'Class')} · <b>${escapeHtml([card.student.grade,card.student.section].filter(Boolean).join(' ')||tr('En attente', 'Pending'))}</b></p>
  <p>${tr('Période scolaire', 'Reporting period')} · <b>${escapeHtml(localizedTerm(card.term))}</b></p></div><div class="average"><span>${tr('Moyenne finale', 'Final average')}</span><b>${card.average.toFixed(2)}%</b></div></section>
  <h3>${tr('Résultats académiques', 'Academic performance')}</h3>${subjects?`<table><colgroup><col class="course-col"><col class="credit-col"><col class="result-col"><col class="grade-col"></colgroup><thead><tr><th>${tr('Cours', 'Course')}</th><th>${tr('Crédit', 'Credit')}</th><th>${tr('Résultat final', 'Final result')}</th><th>${tr('Note', 'Grade')}</th></tr></thead><tbody>${subjects}</tbody></table>`:`<div class="empty">${tr('Aucun résultat de matière soumis n’est encore rattaché à ce bulletin.', 'No submitted subject result is attached to this report card yet.')}</div>`}
  <h3>${tr('Résumé des présences', 'Attendance summary')}</h3>${attendance?`<div class="attendance"><div class="stat"><span>${tr('Présent', 'Present')}</span><b>${attendance.present}</b></div><div class="stat"><span>${tr('Absent', 'Absent')}</span><b>${attendance.absent}</b></div><div class="stat"><span>${tr('Retard', 'Late')}</span><b>${attendance.late}</b></div><div class="stat"><span>${tr('Excusé', 'Excused')}</span><b>${attendance.excused}</b></div><div class="stat"><span>${tr('Taux', 'Rate')}</span><b>${attendance.attendanceRate??'—'}%</b></div></div>`:`<div class="empty">${tr('Le résumé des présences n’est pas disponible pour cette période.', 'Attendance summary is not available for this reporting period.')}</div>`}
  <h3>${tr('Appréciation de la direction de classe', 'Class leadership review')}</h3><div class="comments"><div class="comment"><b>${tr('Commentaire du titulaire', 'Main Teacher comment')}</b>${escapeHtml(card.teacherComment||tr('Aucun commentaire saisi.', 'No comment entered.'))}</div><div class="comment"><b>${tr('Conduite', 'Conduct')}</b>${escapeHtml(card.conduct||tr('Non renseignée.', 'Not entered.'))}</div></div>
  <div class="signatures"><div class="signature">${tr('Titulaire de classe', 'Main Teacher')}</div><div class="signature">${tr('Préfet / Signature autorisée', 'Principal / Authorized signature')}</div></div>
  <footer><div><strong>Kinshasa Christian School</strong><br>Macampagne, Ngaliema · Kinshasa, ${tr('République démocratique du Congo', 'Democratic Republic of Congo')}</div><div style="text-align:right">KCS Nexus AI · ${tr('Bulletin officiel', 'Official Report Card')}<br>${escapeHtml(issuedAt.toLocaleDateString(dateLocale))}</div></footer>
  </div></main><script>addEventListener('load',function(){var i=Array.prototype.slice.call(document.images);Promise.all(i.map(function(x){if(x.complete)return Promise.resolve();return new Promise(function(r){x.onload=r;x.onerror=r})})).then(function(){setTimeout(function(){window.focus();window.print()},250)})});<\/script></body></html>`
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}))
  const printWindow=window.open(url,'_blank','width=1100,height=900')
  if(!printWindow){URL.revokeObjectURL(url);onBlocked(tr('Le navigateur a bloqué la fenêtre d’impression. Autorisez les fenêtres contextuelles puis réessayez.', 'The browser blocked the print window. Allow pop-ups and try again.'));return}
  window.setTimeout(()=>URL.revokeObjectURL(url),60_000)
}
