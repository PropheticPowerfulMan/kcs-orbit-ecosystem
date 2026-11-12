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

// Presentation only. The teacher's saved course title remains unchanged.
export const courseDisplayName = (value?: string | null) => {
  const title = (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
  return title.replace(/(^|[\s'’/-])(\p{L}+)/gu, (_match, separator: string, word: string, offset: number) =>
    separator + (offset > 0 && ['and', 'et'].includes(word) ? word : word[0].toLocaleUpperCase('fr') + word.slice(1)))
}

export const teacherDisplayName = (value?: string | null) => {
  const name = (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
  return name.replace(/(^|[\s'’-])(\p{L})/gu, (_match, separator: string, letter: string) => separator + letter.toLocaleUpperCase('fr'))
}

export async function officialReportCardPdf(input: {
  id: string; studentName: string; studentNumber: string; grade: string; term: string; average: number
  publicationStatus: string; studentPhoto?: string | null; subjects: Subject[]; teacherComment?: string | null; conduct?: string | null
  attendance?: { present?: number; absent?: number; late?: number; excused?: number; attendanceRate?: number | null } | null
  language: 'fr' | 'en'; principal: ImageSignature; mainTeacher?: ImageSignature | null; seal?: string | null
}) {
  const tr = (fr: string, en: string) => input.language === 'fr' ? fr : en
  const issued = new Date()
  const digestSource = JSON.stringify({ id: input.id, student: input.studentNumber, term: input.term, average: input.average, status: ['APPROVED','POSTED_TO_PORTAL','EMAILED'].includes(input.publicationStatus) ? 'APPROVED' : input.publicationStatus, grade: input.grade, language: input.language, attendance: input.attendance, teacherComment: input.teacherComment, conduct: input.conduct, principal: input.principal.name, signature: input.principal.image ? createHash('sha256').update(input.principal.image).digest('hex') : null, seal: input.seal ? createHash('sha256').update(input.seal).digest('hex') : null, subjects: input.subjects.map(item => [courseDisplayName(item.name), item.teacherName ?? '', item.credits ?? 0, item.percentage, item.letterGrade, item.termResults ?? null]) })
  const fingerprint = createHash('sha256').update(digestSource).digest('hex').toUpperCase()
  const documentId = `KCS-RC-${issued.toISOString().slice(0, 10).replace(/-/g, '')}-${fingerprint.slice(0, 16)}`
  const verifyUrl = `${process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://kinshasachristianschool.org'}/verify/report-card?document=${encodeURIComponent(documentId)}&fingerprint=${fingerprint}`
  const qr = await QRCode.toBuffer(verifyUrl, { errorCorrectionLevel: 'H', width: 600, margin: 4 })
  const logo = await readFile(join(process.cwd(), 'assets', 'kcs-watermark.jpg')).catch(() => null)
  const watermark = await readFile(join(process.cwd(), 'assets', 'kcs-watermark.jpg')).catch(() => logo)
  const doc = new PDFDocument({ size: 'A4', margins: { top: 28, left: 28, right: 28, bottom: 20 }, bufferPages: true, info: { Title: `KCS Official Report Card · ${input.studentName}`, Author: 'Kinshasa Christian School', Subject: documentId } })
  const chunks: Buffer[] = []
  doc.on('data', chunk => chunks.push(chunk))
  const done = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  const width = doc.page.width, height = doc.page.height, left = 32, right = width - 32, contentWidth = right - left
  const official = ['APPROVED', 'POSTED_TO_PORTAL', 'EMAILED'].includes(input.publicationStatus)
  const annual = /Annual final/i.test(input.term)
  const quarters = ['Semester 1 · Quarter 1', 'Semester 1 · Quarter 2', 'Semester 2 · Quarter 3', 'Semester 2 · Quarter 4']
  const portrait = imageBuffer(input.studentPhoto)
  const period = input.language === 'fr' ? input.term.replace(/Semester/g, 'Semestre').replace('Annual final', 'Bilan annuel') : input.term
  const text = (value: string, x: number, y: number, fontSize: number, color = '#173D60', options: PDFKit.Mixins.TextOptions = {}, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(color).text(value, x, y, { lineBreak: false, ...options })
  }
  const box = (x: number, y: number, w: number, h: number, fill: string, border = '#CBDDE9') => {
    doc.roundedRect(x, y, w, h, 6).fillAndStroke(fill, border)
  }
  const image = (data: Buffer | null, x: number, y: number, w: number, h: number) => {
    if (data) try { doc.image(data, x, y, { fit: [w, h], align: 'center', valign: 'center' }) } catch { /* Optional official artwork must not prevent printing the academic record. */ }
  }
  const pages = Math.max(1, Math.ceil(input.subjects.length / 32))
  for (let page = 0; page < pages; page++) {
    if (page) doc.addPage()
    if (watermark) doc.save().opacity(.085).image(watermark, width / 2 - 195, height / 2 - 195, { fit: [390, 390] }).restore()
    doc.rect(left, 24, contentWidth * .18, 4).fill('#D6A62A')
    doc.rect(left + contentWidth * .18, 24, contentWidth * .66, 4).fill('#0D5D99')
    doc.rect(left + contentWidth * .84, 24, contentWidth * .16, 4).fill('#20BFA9')
    image(logo, left, 35, 62, 62)
    text('KINSHASA CHRISTIAN SCHOOL', left + 75, 40, 8, '#60758C', { width: contentWidth - 75, align: 'right' }, true)
    text(tr('BULLETIN SCOLAIRE OFFICIEL', 'OFFICIAL REPORT CARD'), left + 75, 57, 17, '#053665', { width: contentWidth - 75, align: 'right' }, true)
    text(documentId, left + 75, 83, 6.8, '#8F6D15', { width: contentWidth - 75, align: 'right' }, true)
    doc.moveTo(left, 105).lineTo(right, 105).lineWidth(1.5).strokeColor('#D6A62A').stroke()
    box(left, 114, contentWidth, 18, official ? '#EAF5FB' : '#FFF4CF', official ? '#EAF5FB' : '#FFF4CF')
    text(official ? tr('DOCUMENT OFFICIEL · APPROUVÉ', 'OFFICIAL DOCUMENT · APPROVED') : tr('BROUILLON · SOUMIS À VALIDATION', 'DRAFT · SUBJECT TO APPROVAL'), left + 5, 120, 6.8, official ? '#073B70' : '#795B0A', { width: contentWidth - 10, align: 'center' }, true)
    box(left, 142, contentWidth, 89, '#F2F8FA')
    box(left + 10, 150, 57, 71, '#FFFFFF', '#D8AA2F')
    if (portrait) image(portrait, left + 13, 153, 51, 65)
    else text('KCS', left + 10, 181, 11, '#0D5D99', { width: 57, align: 'center' }, true)
    const identityX = left + 78, identityWidth = contentWidth - 195
    text(input.studentName, identityX, 160, input.studentName.length > 45 ? 9 : 12, '#062F5B', { width: identityWidth, height: 26, lineBreak: true, ellipsis: true }, true)
    text(tr('Matricule', 'Student ID') + ' · ' + input.studentNumber, identityX, 189, 7, '#52677D', { width: identityWidth })
    text(tr('Classe', 'Class') + ' · ' + input.grade, identityX, 201, 7, '#52677D', { width: identityWidth })
    text(tr('Période', 'Reporting period') + ' · ' + period, identityX, 213, 6.3, '#52677D', { width: contentWidth - 88 })
    doc.moveTo(right - 105, 164).lineTo(right - 105, 204).lineWidth(.6).strokeColor('#B9CFDD').stroke()
    text(tr('MOYENNE OFFICIELLE', 'OFFICIAL AVERAGE'), right - 100, 168, 6, '#60758C', { width: 90, align: 'center' }, true)
    text(input.average.toFixed(2) + '%', right - 100, 183, 19, '#08716A', { width: 90, align: 'center' }, true)
    text(tr('RÉSULTATS ACADÉMIQUES', 'ACADEMIC PERFORMANCE'), left, 244, 9, '#073B70', {}, true)
    doc.rect(left, 258, contentWidth, 19).fill('#0D5D99')
    const columns = annual
      ? [{ x: left, width: contentWidth * .25 }, { x: left + contentWidth * .25, width: contentWidth * .23 }, ...quarters.map((_, index) => ({ x: left + contentWidth * (.48 + index * .08), width: contentWidth * .08 })), { x: left + contentWidth * .8, width: contentWidth * .12 }, { x: left + contentWidth * .92, width: contentWidth * .08 }]
      : [{ x: left, width: contentWidth * .36 }, { x: left + contentWidth * .36, width: contentWidth * .32 }, { x: left + contentWidth * .68, width: contentWidth * .2 }, { x: left + contentWidth * .88, width: contentWidth * .12 }]
    const headers = [tr('COURS', 'COURSE'), tr('ENSEIGNANT', 'TEACHER'), ...(annual ? ['Q1', 'Q2', 'Q3', 'Q4'] : []), tr('RÉSULTAT', 'RESULT'), tr('NOTE', 'GRADE')]
    columns.forEach((column, index) => text(headers[index], column.x + 4, 265, 5.7, '#FFFFFF', { width: column.width - 8, align: index ? 'center' : 'left' }, true))
    const rows = input.subjects.slice(page * 32, (page + 1) * 32)
    const rowHeight = Math.min(18, 247 / Math.max(1, rows.length))
    let y = 280
    for (const [index, subject] of rows.entries()) {
      if (index % 2 === 1) doc.rect(left, y - 2, contentWidth, rowHeight).fill('#F3F8FB')
      const values = [courseDisplayName(subject.name), teacherDisplayName(subject.teacherName || '—'), ...(annual ? quarters.map(term => subject.termResults?.[term] == null ? '—' : subject.termResults[term]!.toFixed(1) + '%') : []), subject.percentage.toFixed(2) + '%', subject.letterGrade]
      columns.forEach((column, index) => text(values[index], column.x + 4, y + 1, rows.length > 24 ? 5.6 : 6.6, index === columns.length - 1 ? '#08716A' : '#173D60', { width: column.width - 8, height: rowHeight - 1, ellipsis: true, align: index ? 'center' : 'left' }, index === 0 || index === columns.length - 1))
      doc.moveTo(left, y + rowHeight - 2).lineTo(right, y + rowHeight - 2).lineWidth(.35).strokeColor('#DCE5EE').stroke()
      y += rowHeight
    }
    if (!rows.length) text(tr('Aucun résultat de matière soumis.', 'No submitted subject results.'), left, y + 6, 8, '#795B0A')
    y = Math.max(y + 12, 335)
    text(tr('RÉSUMÉ DES PRÉSENCES', 'ATTENDANCE SUMMARY'), left, y, 8, '#073B70', {}, true)
    y += 14
    const attendance = input.attendance
    const attendanceValues = [[tr('PRÉSENT', 'PRESENT'), attendance?.present ?? '—'], [tr('ABSENT', 'ABSENT'), attendance?.absent ?? '—'], [tr('RETARD', 'LATE'), attendance?.late ?? '—'], [tr('EXCUSÉ', 'EXCUSED'), attendance?.excused ?? '—'], [tr('TAUX', 'RATE'), attendance?.attendanceRate == null ? '—' : attendance.attendanceRate + '%']]
    attendanceValues.forEach(([label, value], index) => {
      const x = left + index * (contentWidth + 6) / 5, w = (contentWidth - 24) / 5
      box(x, y, w, 32, '#FFFFFF')
      text(String(label), x + 2, y + 7, 5.5, '#60758C', { width: w - 4, align: 'center' }, true)
      text(String(value), x + 2, y + 18, 10, '#073B70', { width: w - 4, align: 'center' }, true)
    })
    y += 45
    text(tr('APPRÉCIATION DE LA DIRECTION DE CLASSE', 'CLASS LEADERSHIP REVIEW'), left, y, 8, '#073B70', {}, true)
    y += 13
    const commentWidth = contentWidth * .61
    box(left, y, commentWidth, 39, '#FBFDFE')
    box(left + commentWidth + 8, y, contentWidth - commentWidth - 8, 39, '#FBFDFE')
    text(tr('COMMENTAIRE DU TITULAIRE', 'MAIN TEACHER COMMENT'), left + 6, y + 5, 5.8, '#073B70', {}, true)
    text(input.teacherComment || tr('Aucun commentaire saisi.', 'No comment entered.'), left + 6, y + 16, 6.5, '#284A68', { width: commentWidth - 12, height: 19, lineBreak: true, ellipsis: true })
    text(tr('CONDUITE', 'CONDUCT'), left + commentWidth + 14, y + 5, 5.8, '#073B70', {}, true)
    text(input.conduct || tr('Non renseignée.', 'Not entered.'), left + commentWidth + 14, y + 16, 6.5, '#284A68', { width: contentWidth - commentWidth - 20, height: 19, lineBreak: true, ellipsis: true })
    y += 66
    for (const [x, signature, label] of [[left, input.mainTeacher, tr('Titulaire de classe', 'Main Teacher')], [right - 195, input.principal, tr('Préfet / Signature autorisée', 'Principal / Authorized signature')]] as const) {
      image(imageBuffer(signature?.image), x + 20, y - 23, 155, 23)
      doc.moveTo(x, y).lineTo(x + 195, y).lineWidth(.6).strokeColor('#496178').stroke()
      text(teacherDisplayName(signature?.name || ''), x, y + 4, 6, '#173D60', { width: 195, align: 'center' }, true)
      text(label, x, y + 14, 6, '#52677D', { width: 195, align: 'center' })
    }
    image(imageBuffer(input.seal), width / 2 - 26, y - 29, 52, 52)
    y += 33
    box(left, y, contentWidth, 59, '#F4F9FC', '#B8CFDF')
    image(qr, left + 3, y + 3, 53, 53)
    text(tr('AUTHENTIFICATION NUMÉRIQUE INTERNATIONALE', 'INTERNATIONAL DIGITAL AUTHENTICATION'), left + 63, y + 7, 6, '#073B70', { width: contentWidth - 71 }, true)
    text(tr('Vérifiez ce document dans le registre officiel KCS Nexus.', 'Verify this document in the official KCS Nexus registry.'), left + 63, y + 19, 5.7, '#52677D')
    text(documentId, left + 63, y + 30, 5.5, '#52677D')
    text('SHA-256 ' + fingerprint, left + 63, y + 40, 4.4, '#52677D')
    doc.moveTo(left, height - 61).lineTo(right, height - 61).lineWidth(1).strokeColor('#20BFA9').stroke()
    text('Kinshasa Christian School', left, height - 54, 6, '#073B70', {}, true)
    text('Avenue de la République n° 1 · Macampagne, Ngaliema · Kinshasa, RDC', left, height - 43, 5.5, '#52677D')
    text('+243 895 326 011 · +243 994 645 735 · kinshasachristianschool@gmail.com', left, height - 33, 5.5, '#52677D')
    text('KCS Nexus AI · ' + tr('Bulletin officiel', 'Official Report Card') + (pages > 1 ? ` · ${page + 1}/${pages}` : ''), right - 180, height - 54, 6, '#52677D', { width: 180, align: 'right' })
  }
  doc.end()
  return { buffer: await done, documentId, fingerprint }
}
