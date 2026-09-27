type TranscriptRow = {
  id: string
  percentage: number
  letterGrade: string
  credits: number
  cycle: { academicYear: string; term: string }
  course: { name: string; code: string }
}

type OfficialTranscript = {
  student: { name: string; studentNumber: string; grade: string; photoUrl?: string | null }
  rows: TranscriptRow[]
  summary: { credits: number; cumulativeGpa: number | null; officialRecords: number }
  generatedAt?: string
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

export function printOfficialTranscript(transcript: OfficialTranscript, onBlocked: (message: string) => void) {
  const issueDate = new Date(transcript.generatedAt ?? Date.now())
  const compactDate = issueDate.toISOString().slice(0, 10).replace(/-/g, '')
  const studentToken = transcript.student.studentNumber.replace(/[^a-z0-9]/gi, '').toUpperCase() || 'STUDENT'
  const documentId = `KCS-TR-${compactDate}-${studentToken}`
  const logo = printableAsset('/images/kcs-logo.png')
  const photo = printableAsset(transcript.student.photoUrl)
  const rows = transcript.rows.map((row) => `
    <tr><td>${escapeHtml(row.cycle.academicYear)}</td><td>${escapeHtml(row.cycle.term)}</td>
    <td><b>${escapeHtml(row.course.code)}</b><span>${escapeHtml(row.course.name)}</span></td>
    <td class="number">${row.credits}</td><td class="number">${row.percentage.toFixed(2)}%</td>
    <td class="grade">${escapeHtml(row.letterGrade)}</td></tr>`).join('')
  const photoBlock = photo
    ? `<img class="student-photo" src="${escapeHtml(photo)}" alt="Student photograph">`
    : '<div class="student-photo placeholder">KCS</div>'

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(documentId)} · Official Transcript</title>
  <style>
  @page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#eaf2f8;color:#102849;font-family:"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{position:relative;width:210mm;min-height:277mm;margin:14px auto;overflow:hidden;background:#fff;border:1px solid #cad8e6;box-shadow:0 18px 55px #082b4d26}.top-line{height:8px;background:linear-gradient(90deg,#032f5f 0 72%,#f1b82d 72% 86%,#18bde0 86%)}
  .watermark-wrap{position:absolute;z-index:0;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}.watermark{display:block;width:155mm;max-height:105mm;object-fit:contain;opacity:.055;filter:grayscale(1)}.content{position:relative;z-index:1;padding:16mm 15mm 12mm}
  .masthead{display:flex;align-items:center;justify-content:space-between;gap:18px;padding-bottom:13px;border-bottom:2px solid #0d5d99}.school-logo{width:72mm;height:auto}.document-title{text-align:right}.document-title small{display:block;color:#60758c;font-size:9px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
  .document-title h1{margin:4px 0 0;color:#053665;font-size:22px;line-height:1.05;letter-spacing:.04em;text-transform:uppercase}.document-title p{margin:6px 0 0;color:#9a7212;font-size:9px;font-weight:800}
  .identity{display:grid;grid-template-columns:27mm 1fr;gap:14px;margin:17px 0 14px;padding:13px;background:linear-gradient(120deg,#eff7fc,#f8fbfd);border:1px solid #c8ddec;border-left:5px solid #0d5d99;border-radius:10px}
  .student-photo{width:27mm;height:34mm;object-fit:cover;border:2px solid #d8aa2f;border-radius:8px;background:#fff}.student-photo.placeholder{display:flex;align-items:center;justify-content:center;color:#0d5d99;font-weight:900}
  .identity h2{margin:2px 0 10px;color:#062f5b;font-size:20px}.identity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 20px}.identity-grid div{font-size:10px;color:#52677d}.identity-grid b{display:block;margin-top:2px;color:#102849;font-size:12px}
  .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:15px}.metric{padding:10px;text-align:center;border:1px solid #d2e0eb;border-radius:8px;background:#fff}.metric span{display:block;color:#687b8f;font-size:8px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.metric b{display:block;margin-top:4px;color:#073b70;font-size:19px}
  .records-title{display:flex;align-items:end;justify-content:space-between;margin:13px 0 7px}.records-title h3{margin:0;color:#073b70;font-size:13px;text-transform:uppercase}.records-title span{color:#6f8193;font-size:9px}
  table{width:100%;border-collapse:collapse;font-size:9.5px}thead{display:table-header-group}th{padding:8px 7px;text-align:left;background:#073b70;color:#fff;font-size:8px;letter-spacing:.05em;text-transform:uppercase}td{padding:8px 7px;border-bottom:1px solid #dce5ee;vertical-align:top}tbody tr:nth-child(even){background:#f4f8fb}td span{display:block;margin-top:2px;color:#62758a;font-size:8px}.number{text-align:center}.grade{text-align:center;color:#073b70;font-weight:900}
  .empty{padding:22px;text-align:center;color:#77611e;background:#fff8df;border:1px solid #ead99d;border-radius:8px;font-size:10px}.certification{margin-top:18px;padding:10px 12px;border:1px solid #c8ddec;border-radius:8px;color:#3f566d;font-size:9px;line-height:1.55}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-top:27px}.signature{padding-top:7px;border-top:1px solid #496178;text-align:center;color:#52677d;font-size:9px}
  footer{display:flex;justify-content:space-between;gap:15px;margin-top:22px;padding-top:8px;border-top:2px solid #f1b82d;color:#5b7086;font-size:8px;line-height:1.45}footer strong{color:#073b70}
  @media print{body{background:#fff}.sheet{width:auto;min-height:0;margin:0;border:0;box-shadow:none}.content{padding:11mm 10mm 8mm}}
  </style></head><body><main class="sheet"><div class="top-line"></div>
  <div class="watermark-wrap"><img class="watermark" src="${escapeHtml(logo)}" alt=""></div><div class="content">
  <header class="masthead"><img class="school-logo" src="${escapeHtml(logo)}" alt="Kinshasa Christian School">
  <div class="document-title"><small>Office of Academic Records</small><h1>Official Academic Transcript</h1><p>Document ${escapeHtml(documentId)}</p></div></header>
  <section class="identity">${photoBlock}<div><h2>${escapeHtml(transcript.student.name)}</h2><div class="identity-grid">
  <div>Student ID<b>${escapeHtml(transcript.student.studentNumber)}</b></div><div>Current grade<b>${escapeHtml(transcript.student.grade)}</b></div>
  <div>Date issued<b>${escapeHtml(issueDate.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}))}</b></div><div>Record status<b>Official · Verified source</b></div>
  </div></div></section><section class="metrics"><div class="metric"><span>Official results</span><b>${transcript.summary.officialRecords}</b></div>
  <div class="metric"><span>Credits earned</span><b>${transcript.summary.credits}</b></div><div class="metric"><span>Cumulative GPA</span><b>${transcript.summary.cumulativeGpa ?? '—'}</b></div></section>
  <div class="records-title"><h3>Scholastic record</h3><span>Only approved final grades are included</span></div>
  ${rows ? `<table><thead><tr><th>Academic year</th><th>Term</th><th>Course</th><th>Credit</th><th>Average</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No approved academic result has been published for this learner yet.</div>'}
  <div class="certification">This transcript is generated from the official Kinshasa Christian School academic register. Alteration invalidates the document. Provisional, projected or unauthorized results are excluded.</div>
  <div class="signatures"><div class="signature">Registrar / Academic Records Officer</div><div class="signature">School Director / Authorized signature</div></div>
  <footer><div><strong>Kinshasa Christian School</strong><br>Macampagne, Ngaliema · Kinshasa, Democratic Republic of Congo</div>
  <div style="text-align:right">KCS Nexus AI · Institutional Academic Record<br>${escapeHtml(documentId)}</div></footer>
  </div></main><script>addEventListener('load',function(){var i=Array.prototype.slice.call(document.images);Promise.all(i.map(function(x){if(x.complete)return Promise.resolve();return new Promise(function(r){x.onload=r;x.onerror=r})})).then(function(){setTimeout(function(){window.focus();window.print()},250)})});<\/script></body></html>`

  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const printWindow = window.open(url, '_blank', 'width=1100,height=900')
  if (!printWindow) {
    URL.revokeObjectURL(url)
    onBlocked('The browser blocked the print window. Allow pop-ups and try again.')
    return
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
