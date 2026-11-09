import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

type Subject = { name: string; code: string; credits?: number; teacherName?: string; percentage: number; letterGrade: string; termResults?: Record<string, number | null> }
type ImageSignature = { name?: string; image?: string | null }
const imageBuffer = (value?: string | null) => {
  if (!value?.startsWith('data:image/')) return null
  try { return Buffer.from(value.slice(value.indexOf(',') + 1), 'base64') } catch { return null }
}

export async function officialReportCardPdf(input: {
  id: string; studentName: string; studentNumber: string; grade: string; term: string; average: number
  publicationStatus: string; subjects: Subject[]; teacherComment?: string | null; conduct?: string | null
  attendance?: { present?: number; absent?: number; late?: number; excused?: number; attendanceRate?: number | null } | null
  language: 'fr' | 'en'; principal: ImageSignature; mainTeacher?: ImageSignature | null; seal?: string | null
}) {
  const tr = (fr: string, en: string) => input.language === 'fr' ? fr : en
  const issued = new Date()
  const digestSource = JSON.stringify({ id: input.id, student: input.studentNumber, term: input.term, average: input.average, status: input.publicationStatus, grade: input.grade, language: input.language, attendance: input.attendance, teacherComment: input.teacherComment, conduct: input.conduct, principal: input.principal.name, signature: input.principal.image ? createHash('sha256').update(input.principal.image).digest('hex') : null, seal: input.seal ? createHash('sha256').update(input.seal).digest('hex') : null, subjects: input.subjects.map(item => [item.name, item.teacherName ?? '', item.credits ?? 0, item.percentage, item.letterGrade]) })
  const fingerprint = createHash('sha256').update(digestSource).digest('hex').toUpperCase()
  const documentId = `KCS-RC-${issued.toISOString().slice(0, 10).replace(/-/g, '')}-${fingerprint.slice(0, 16)}`
  const verifyUrl = `${process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://kinshasachristianschool.org'}/verify/report-card?document=${encodeURIComponent(documentId)}&fingerprint=${fingerprint}`
  const qr = await QRCode.toBuffer(verifyUrl, { errorCorrectionLevel: 'H', width: 300, margin: 1 })
  const logo = await readFile(join(process.cwd(), 'assets', 'kcs-watermark.jpg')).catch(() => null)
  const watermark = await readFile(join(process.cwd(), 'assets', 'kcs-watermark.jpg')).catch(() => logo)
  const doc = new PDFDocument({ size: 'A4', margins: { top: 38, left: 38, right: 38, bottom: 20 }, bufferPages: true, info: { Title: `KCS Official Report Card · ${input.studentName}`, Author: 'Kinshasa Christian School', Subject: documentId } })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  const w = doc.page.width
  const drawWatermark = () => { if (watermark) doc.save().opacity(0.055).image(watermark, w / 2 - 180, doc.page.height / 2 - 180, { fit: [360, 360] }).restore() }
  drawWatermark()
  doc.lineWidth(2).strokeColor('#0D5D99').roundedRect(25, 25, w - 50, doc.page.height - 50, 12).stroke()
  if (logo) doc.image(logo, 43, 39, { fit: [72, 56] })
  doc.fillColor('#B07E0A').font('Helvetica-Bold').fontSize(8).text('KINSHASA CHRISTIAN SCHOOL', 126, 43, { characterSpacing: 1.2 })
  doc.fillColor('#073B70').fontSize(19).text(tr('BULLETIN SCOLAIRE OFFICIEL', 'OFFICIAL REPORT CARD'), 126, 59)
  doc.fillColor('#52677D').font('Helvetica').fontSize(8).text(documentId, 126, 84)
  doc.moveTo(43, 108).lineTo(w - 43, 108).lineWidth(1.5).strokeColor('#D6A62A').stroke()
  doc.roundedRect(43, 119, w - 86, 96, 10).fill('#F1F7FB')
  doc.fillColor('#073B70').font('Helvetica-Bold').fontSize(input.studentName.length > 45 ? 10 : 13).text(input.studentName, 56, 132, { width: w - 240, height: 30 })
  const periodLabel = input.language === 'fr' ? input.term.replace(/Semester/g, 'Semestre').replace('Annual final', 'Bilan annuel') : input.term
  doc.font('Helvetica').fontSize(8).fillColor('#52677D').text(tr('Matricule', 'Student ID') + ' · ' + input.studentNumber, 56, 166, { width: w - 240 })
  doc.text(tr('Classe', 'Class') + ' · ' + input.grade, 56, 178, { width: w - 240 })
  doc.text(tr('Période', 'Period') + ' · ' + periodLabel, 56, 190, { width: w - 125 })
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#62788B').text(tr('MOYENNE OFFICIELLE', 'OFFICIAL AVERAGE'), w - 150, 132, { width: 90, align: 'right' })
  doc.fontSize(17).fillColor('#008B7B').text(`${input.average.toFixed(2)}%`, w - 150, 150, { width: 90, align: 'right' })
  let y = 232
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#073B70').text(tr('RÉSULTATS ACADÉMIQUES', 'ACADEMIC PERFORMANCE'), 43, y)
  y += 17
  const left = 43, right = w - 43
  doc.rect(left, y, right - left, 22).fill('#0D5D99')
  doc.fillColor('#FFFFFF').fontSize(7).text(tr('COURS', 'COURSE'), left + 8, y + 8)
  doc.text(tr('ENSEIGNANT', 'TEACHER'), left + 205, y + 8, { width: 145 })
  doc.text(tr('RÉSULTAT', 'RESULT'), right - 91, y + 8, { width: 48, align: 'right' })
  doc.text(tr('NOTE', 'GRADE'), right - 38, y + 8, { width: 30, align: 'right' })
  y += 25
  const rows = input.subjects
  const rowHeight = Math.max(11, Math.min(21, 235 / Math.max(1, rows.length)))
  rows.forEach((subject, index) => {
    if (y > 485) { doc.addPage(); drawWatermark(); y = 55 }
    if (index % 2 === 0) doc.rect(left, y - 3, right - left, rowHeight).fill('#F4F8FB')
    doc.fillColor('#153B5D').font('Helvetica-Bold').fontSize(rows.length > 16 ? 6.5 : 8).text(subject.name, left + 8, y, { width: 190, ellipsis: true })
    doc.font('Helvetica').fontSize(rows.length > 16 ? 6 : 7).fillColor('#173D60').text(subject.teacherName || '—', left + 205, y, { width: 145, ellipsis: true })
    doc.text(`${subject.percentage.toFixed(2)}%`, right - 91, y, { width: 48, align: 'right' })
    doc.font('Helvetica-Bold').fillColor('#008B7B').text(subject.letterGrade, right - 38, y, { width: 30, align: 'right' })
    y += rowHeight
  })
  if (y > 500) { doc.addPage(); drawWatermark(); y = 55 }
  y += 8
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#073B70').text(tr('RÉSUMÉ DES PRÉSENCES', 'ATTENDANCE SUMMARY'), left, y)
  y += 15
  const attendance = input.attendance
  doc.font('Helvetica').fontSize(8).fillColor('#284A68').text(attendance ? `${tr('Présent', 'Present')}: ${attendance.present ?? 0}     ${tr('Absent', 'Absent')}: ${attendance.absent ?? 0}     ${tr('Retard', 'Late')}: ${attendance.late ?? 0}     ${tr('Excusé', 'Excused')}: ${attendance.excused ?? 0}     ${tr('Taux', 'Rate')}: ${attendance.attendanceRate ?? '—'}%` : tr('Données de présence indisponibles.', 'Attendance data unavailable.'), left, y)
  y += 22
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#073B70').text(tr('COMMENTAIRE DU TITULAIRE', 'MAIN TEACHER COMMENT'), left, y)
  doc.font('Helvetica').fontSize(8).fillColor('#284A68').text(input.teacherComment || tr('Aucun commentaire.', 'No comment entered.'), left, y + 12, { width: 245, height: 42, ellipsis: true })
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#073B70').text(tr('CONDUITE', 'CONDUCT'), left + 270, y)
  doc.font('Helvetica').fontSize(8).fillColor('#284A68').text(input.conduct || tr('Non renseignée.', 'Not entered.'), left + 270, y + 12, { width: right - left - 270, height: 42, ellipsis: true })
  y += 65
  const drawSignature = (x: number, signature: ImageSignature | null | undefined, label: string) => {
    const image = imageBuffer(signature?.image)
    if (image) try { doc.image(image, x + 16, y - 27, { fit: [145, 28] }) } catch { /* Invalid optional upload; keep the signature line. */ }
    doc.moveTo(x, y).lineTo(x + 175, y).strokeColor('#56728A').lineWidth(.7).stroke()
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#173D60').text(signature?.name || '', x, y + 4, { width: 175, align: 'center' })
    doc.font('Helvetica').fontSize(7).fillColor('#52677D').text(label, x, y + 14, { width: 175, align: 'center' })
  }
  drawSignature(left, input.mainTeacher, tr('Enseignant titulaire', 'Main Teacher'))
  drawSignature(right - 175, input.principal, tr('Principal / Autorité autorisée', 'Principal / Authorized official'))
  const seal = imageBuffer(input.seal)
  if (seal) try { doc.save().opacity(.82).image(seal, w / 2 - 26, y - 37, { fit: [52, 52] }).restore() } catch { /* Optional seal. */ }
  const qrY = Math.min(doc.page.height - 92, y + 30)
  doc.image(qr, left, qrY, { fit: [47, 47] })
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#073B70').text(tr('DOCUMENT OFFICIEL VÉRIFIABLE', 'VERIFIABLE OFFICIAL DOCUMENT'), left + 54, qrY + 5)
  doc.font('Helvetica').fontSize(6).fillColor('#52677D').text(`${documentId}\nSHA-256 ${fingerprint}\nQR ISO/IEC 18004 · ECC H`, left + 54, qrY + 17, { width: right - left - 60 })
  doc.font('Helvetica').fontSize(6).fillColor('#52677D').text(`Kinshasa Christian School · ${issued.toLocaleDateString(input.language === 'fr' ? 'fr-FR' : 'en-GB')}`, left, doc.page.height - 57, { width: right - left, align: 'center' })
  doc.text('Avenue de la République n° 1 · Macampagne, Ngaliema · Kinshasa, RDC · Réf. 80 jours\n+243 895 326 011 · +243 994 645 735 · kinshasachristianschool@gmail.com', left, doc.page.height - 48, { width: right - left, align: 'center' })
  doc.end()
  return { buffer: await done, documentId, fingerprint }
}
