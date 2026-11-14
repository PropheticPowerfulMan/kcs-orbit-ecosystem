import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import QRCode from 'qrcode'
import type {OfficialTranscript} from '../services/officialTranscript.service.js'
import {renderOfficialPdf} from '../services/reportPdfRenderer.service.js'
const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char))
export async function officialTranscriptDocument(transcript:OfficialTranscript){
 const preview=!transcript.rows.length
 const language='en';const tr=(_fr:string,en:string)=>en;const dateLocale='en-GB'
 const localizedTerm=(value:string)=>value.replace(/Trimester/gi,'Quarter')
 const issueDate=new Date(transcript.generatedAt);const compactDate=issueDate.toISOString().slice(0,10).replace(/-/g,'')
 const fingerprint=createHash('sha256').update(transcript.sourceVersion+':'+createHash('sha256').update(transcript.student.photoUrl??'').digest('hex')+':'+compactDate+(preview?':en:transcript-preview-v1':':en:official-transcript-v2')).digest('hex').toUpperCase()
 const documentId=`KCS-TR-${preview?'PREVIEW-':''}${compactDate}-${fingerprint.slice(0,16)}`
 const verificationUrl=new URL('/verify/transcript',process.env.FRONTEND_URL||'https://kinshasachristianschool.org')
 if(!['https:','http:'].includes(verificationUrl.protocol))throw new Error('Invalid public document verification URL')
 verificationUrl.searchParams.set('document',documentId);verificationUrl.searchParams.set('fingerprint',fingerprint)
 const verifyUrl=verificationUrl.toString()
 const qrCode=await QRCode.toDataURL(verifyUrl,{errorCorrectionLevel:'H',width:800,margin:4})
 const watermark='data:image/jpeg;base64,'+(await readFile(join(process.cwd(),'assets','kcs-watermark.jpg'))).toString('base64');const logo=watermark
 const photo=/^data:image\/(?:png|jpeg|jpg|webp);base64,/.test(transcript.student.photoUrl||'')?transcript.student.photoUrl!:''
 const html=await renderHtml();return{html,preview,documentId,fingerprint,verificationUrl:verifyUrl,sourceVersion:transcript.sourceVersion,activeAcademicYear:transcript.activeAcademicYear}
 async function renderHtml(){
  const rows = transcript.rows.map((row) => `
    <tr><td>${escapeHtml(row.cycle.academicYear)}<span>${escapeHtml(row.gradeLevel)}</span></td><td>${escapeHtml(localizedTerm(row.cycle.term))}</td>
    <td><b>${escapeHtml(row.course.code)}</b><span>${escapeHtml(row.course.name)}</span></td>
    <td class="number">${row.credits}</td><td class="number">${row.percentage.toFixed(2)}%</td>
    <td class="grade">${escapeHtml(row.letterGrade)}</td></tr>`).join('')
  const photoBlock = photo
    ? `<img class="student-photo" src="${escapeHtml(photo)}" alt="${tr('Photo de l’élève', 'Student photograph')}">`
    : '<div class="student-photo placeholder">KCS</div>'

  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(documentId)} · ${tr('Relevé officiel', 'Official Transcript')}</title>
  <style>
  @page{size:A4;margin:10mm;@bottom-left{content:"KCS · ${documentId}";font:7px Arial;color:#5b7086}@bottom-right{content:"Page " counter(page) " / " counter(pages);font:7px Arial;color:#5b7086}}*{box-sizing:border-box}body{margin:0;background:#eaf2f8;color:#102849;font-family:"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{position:relative;isolation:isolate;width:210mm;min-height:277mm;margin:14px auto;overflow:hidden;background:#fff;border:1px solid #cad8e6;box-shadow:0 18px 55px #082b4d26}.top-line{height:8px;background:linear-gradient(90deg,#032f5f 0 72%,#f1b82d 72% 86%,#18bde0 86%)}
  .watermark-wrap{position:fixed;z-index:0;inset:0;display:grid;place-items:center;pointer-events:none}.watermark{display:block;width:138mm;height:138mm;object-fit:contain;object-position:center;opacity:.085;filter:grayscale(1);mix-blend-mode:multiply}.content{position:relative;z-index:1;padding:16mm 15mm 12mm}
  .masthead{display:flex;align-items:center;justify-content:space-between;gap:18px;padding-bottom:13px;border-bottom:2px solid #0d5d99}.school-logo{width:24mm;height:24mm;object-fit:contain}.document-title{text-align:right}.document-title small{display:block;color:#60758c;font-size:9px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
  .document-title h1{margin:4px 0 0;color:#053665;font-size:22px;line-height:1.05;letter-spacing:.04em;text-transform:uppercase}.document-title p{margin:6px 0 0;color:#9a7212;font-size:9px;font-weight:800}
  .identity{display:grid;grid-template-columns:27mm 1fr;gap:14px;margin:17px 0 14px;padding:13px;background:linear-gradient(120deg,#eff7fc,#f8fbfd);border:1px solid #c8ddec;border-left:5px solid #0d5d99;border-radius:10px}
  .student-photo{width:27mm;height:34mm;object-fit:cover;border:2px solid #d8aa2f;border-radius:8px;background:#fff}.student-photo.placeholder{display:flex;align-items:center;justify-content:center;color:#0d5d99;font-weight:900}
  .identity h2{margin:2px 0 10px;color:#062f5b;font-size:20px}.identity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 20px}.identity-grid div{font-size:10px;color:#52677d}.identity-grid b{display:block;margin-top:2px;color:#102849;font-size:12px}
  .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:15px}.metric{padding:10px;text-align:center;border:1px solid #d2e0eb;border-radius:8px;background:#fff}.metric span{display:block;color:#687b8f;font-size:8px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.metric b{display:block;margin-top:4px;color:#073b70;font-size:19px}
  .records-title{display:flex;align-items:end;justify-content:space-between;margin:13px 0 7px}.records-title h3{margin:0;color:#073b70;font-size:13px;text-transform:uppercase}.records-title span{color:#6f8193;font-size:9px}
  table{width:100%;border-collapse:collapse;font-size:9.5px}thead{display:table-header-group}tr{break-inside:avoid}th{padding:8px 7px;text-align:left;background:#073b70;color:#fff;font-size:8px;letter-spacing:.05em;text-transform:uppercase}td{padding:8px 7px;border-bottom:1px solid #dce5ee;vertical-align:top}tbody tr:nth-child(even){background:#f4f8fb}td span{display:block;margin-top:2px;color:#62758a;font-size:8px}.number{text-align:center}.grade{text-align:center;color:#073b70;font-weight:900}
  .empty{padding:22px;text-align:center;color:#77611e;background:#fff8df;border:1px solid #ead99d;border-radius:8px;font-size:10px}.certification{margin-top:18px;padding:10px 12px;border:1px solid #c8ddec;border-radius:8px;color:#3f566d;font-size:9px;line-height:1.55}
  .preview .empty{padding:12px}.preview .academic-certification{display:none}.preview .signatures{margin-top:18px}.preview .certification{margin-top:12px}.certification,footer,.signatures{break-inside:avoid}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-top:27px}.signature{padding-top:7px;border-top:1px solid #496178;text-align:center;color:#52677d;font-size:9px}
  footer{display:flex;justify-content:space-between;gap:15px;margin-top:22px;padding-top:8px;border-top:2px solid #f1b82d;color:#5b7086;font-size:8px;line-height:1.45}footer strong{color:#073b70}
  @media print{body{background:#fff}.sheet{width:auto;min-height:0;margin:0;border:0;box-shadow:none}.content{padding:11mm 10mm 8mm}}
  </style></head><body><main class="sheet ${preview?'preview':''}"><div class="top-line"></div>
  <div class="watermark-wrap" aria-hidden="true"><img class="watermark" src="${escapeHtml(watermark)}" alt=""></div><div class="content">
  <header class="masthead"><img class="school-logo" src="${escapeHtml(logo)}" alt="Kinshasa Christian School">
  <div class="document-title"><small>${tr('Bureau des dossiers académiques', 'Office of Academic Records')}</small><h1>${preview?'Academic Transcript · Preview':tr('Relevé académique officiel', 'Official Academic Transcript')}</h1><p>${tr('Document', 'Document')} ${escapeHtml(documentId)}</p></div></header>
  ${preview?'<div class="empty" role="status" style="margin-top:16px;border-width:2px"><b>PREVIEW · NOT AN ISSUED ACADEMIC TRANSCRIPT</b><br>No approved or verified Grade 9–12 results are on file. Approve the relevant report cards or import verified academic history to prepare an official transcript.</div>':''}
  <section class="identity">${photoBlock}<div><h2>${escapeHtml(transcript.student.name)}</h2><div class="identity-grid">
  <div>${tr('Matricule', 'Student ID')}<b>${escapeHtml(transcript.student.studentNumber)}</b></div><div>${tr('Classe actuelle', 'Current grade')}<b>${escapeHtml(transcript.student.grade)}</b></div>
  <div>${tr('Date de délivrance', 'Date issued')}<b>${escapeHtml(issueDate.toLocaleDateString(dateLocale,{day:'2-digit',month:'long',year:'numeric'}))}</b></div><div>${tr('Statut du dossier', 'Record status')}<b>${preview?'Administrative preview · No official results':tr('Officiel · Source vérifiée', 'Official · Verified source')}</b></div>
  </div></div></section><section class="metrics"><div class="metric"><span>${tr('Résultats officiels', 'Official results')}</span><b>${transcript.summary.officialRecords}</b></div>
  <div class="metric"><span>${tr('Crédits représentés', 'Credits represented')}</span><b>${transcript.summary.credits}</b></div><div class="metric"><span>${tr('Moyenne générale cumulative', 'Cumulative GPA')}</span><b>${transcript.summary.cumulativeGpa ?? '—'}</b></div></section>
  <div class="records-title"><h3>${tr('Dossier scolaire', 'Scholastic record')}</h3><span>${tr('Seules les notes finales approuvées sont incluses', 'Only approved final grades are included')}</span></div>
  ${rows ? `<table><thead><tr><th>${tr('Année scolaire', 'Academic year')}</th><th>${tr('Période', 'Term')}</th><th>${tr('Cours', 'Course')}</th><th>${tr('Crédit', 'Credit')}</th><th>${tr('Moyenne', 'Average')}</th><th>${tr('Note', 'Grade')}</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">${tr('Aucun résultat académique approuvé n’a encore été publié pour cet élève.', 'No approved academic result has been published for this learner yet.')}</div>`}
  <div class="certification academic-certification">${preview?'This administrative preview displays the learner identity and document layout only. It does not certify academic results and must not be used as an official transcript.':tr('Ce relevé est généré depuis le registre académique officiel de Kinshasa Christian School. Toute modification invalide le document. Les résultats provisoires, projetés ou non autorisés sont exclus.', 'This transcript is generated from the official Kinshasa Christian School academic register. Alteration invalidates the document. Provisional, projected or unauthorized results are excluded.')}</div>
  <div class="certification"><b>Academic summary method</b><br>Course credits are counted once per academic year. Approved annual results take precedence; otherwise the KCS quarter and semester rules apply. Missing periods are not scored as zero. GPA uses the KCS 4-point scale (90/80/70/60% thresholds).<br><br><b>Grade 9–12 coverage</b><br>${escapeHtml(transcript.summary.gradeCoverage.map(item=>item.gradeLevel+': '+item.records+' record(s)').join(' · '))}${transcript.summary.missingGradeLevels.length?'<br>Records not yet on file: '+escapeHtml(transcript.summary.missingGradeLevels.join(', ')):''}${transcript.summary.unclassifiedRecords?'<br>Historical records awaiting grade-level verification: '+transcript.summary.unclassifiedRecords:''}</div>
  <section class="certification document-identity" style="display:flex;align-items:center;gap:14px">
  <img src="${escapeHtml(qrCode)}" alt="Verification QR code" style="width:30mm;height:30mm;flex-shrink:0">
  <div style="min-width:0;overflow-wrap:anywhere"><b>Digital document identity</b><br>
  <b>Document ID:</b> ${escapeHtml(documentId)}<br>
  <b>Issuer:</b> Kinshasa Christian School<br>
  <b>Status:</b> ${preview?'REGISTERED PREVIEW · NOT AN ISSUED TRANSCRIPT':'OFFICIAL · VERIFIED ACADEMIC RECORD'}<br>
  <b>Generated (UTC):</b> ${escapeHtml(issueDate.toISOString())}<br>
  <b>SHA-256:</b> ${fingerprint}<br>
  QR ISO/IEC 18004 · ECC H · KCS verification register<br>
  <a href="${escapeHtml(verifyUrl)}" style="color:#073b70;text-decoration:none">${escapeHtml(verifyUrl)}</a>
  ${preview?'<br><b>This QR verifies the registered preview and its status; it does not certify academic results.</b>':''}
  </div></section>
  <div class="signatures"><div class="signature">${tr('Responsable des dossiers académiques', 'Registrar / Academic Records Officer')}</div><div class="signature">${tr('Direction de l’école / Signature autorisée', 'School Director / Authorized signature')}</div></div>
  <footer><div><strong>Kinshasa Christian School</strong><br>Avenue de la République n° 1 · Macampagne, Ngaliema · Kinshasa, Democratic Republic of Congo · Réf. 80 jours<br>+243 895 326 011 · +243 994 645 735<br>kinshasachristianschool@gmail.com · www.kinshasachristianschool.org</div>
  <div style="text-align:right">KCS Nexus AI · ${tr('Dossier académique institutionnel', 'Institutional Academic Record')}<br>${escapeHtml(documentId)}</div></footer>
  </div></main></body></html>`

 }
}
export async function officialTranscriptPdf(transcript:OfficialTranscript){const document=await officialTranscriptDocument(transcript);return{...document,buffer:await renderOfficialPdf(document.html)}}
