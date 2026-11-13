import QRCode from 'qrcode'
import { createHash } from 'node:crypto'
import { renderReportCardHtml, courseDisplayName } from './officialReportCardHtml.js'
export { teacherDisplayName, courseDisplayName } from './officialReportCardHtml.js'
import { renderOfficialPdf } from '../services/reportPdfRenderer.service.js'

type Subject = { name: string; code: string; credits?: number; teacherName?: string; percentage: number; letterGrade: string; termResults?: Record<string, number | null> }
type ImageSignature = { name?: string; image?: string | null }
export type ReportCardInput = {
  id: string; studentName: string; studentNumber: string; grade: string; term: string; periodEndDate?: string | null; average: number
  publicationStatus: string; studentPhoto?: string | null; subjects: Subject[]; teacherComment?: string | null; conduct?: string | null
  attendance?: { present?: number; absent?: number; late?: number; excused?: number; attendanceRate?: number | null } | null
  language: 'fr' | 'en'; principal: ImageSignature; mainTeacher?: ImageSignature | null; seal?: string | null
}

export async function officialReportCardDocument(input: ReportCardInput) {
  const issued = new Date()
  const digestSource = JSON.stringify({ id: input.id, student: input.studentNumber, term: input.term, periodEndDate: input.periodEndDate ?? null, average: input.average, status: ['APPROVED','POSTED_TO_PORTAL','EMAILED'].includes(input.publicationStatus) ? 'APPROVED' : input.publicationStatus, grade: input.grade, language: input.language, attendance: input.attendance, teacherComment: input.teacherComment, conduct: input.conduct, principal: input.principal.name, signature: input.principal.image ? createHash('sha256').update(input.principal.image).digest('hex') : null, seal: input.seal ? createHash('sha256').update(input.seal).digest('hex') : null, subjects: input.subjects.map(item => [courseDisplayName(item.name), item.teacherName ?? '', item.credits ?? 0, item.percentage, item.letterGrade, item.termResults ?? null]) })
  const fingerprint = createHash('sha256').update(digestSource).digest('hex').toUpperCase()
  const documentId = `KCS-RC-${issued.toISOString().slice(0, 10).replace(/-/g, '')}-${fingerprint.slice(0, 16)}`
  const verifyUrl = `${process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://kinshasachristianschool.org'}/verify/report-card?document=${encodeURIComponent(documentId)}&fingerprint=${fingerprint}`
  const qrCode = await QRCode.toDataURL(verifyUrl, { errorCorrectionLevel: 'H', width: 600, margin: 4 })
  const html = await renderReportCardHtml(input, documentId, fingerprint, qrCode, issued)
  return { html, documentId, fingerprint }
}
export async function officialReportCardPdf(input: ReportCardInput) {
  const document = await officialReportCardDocument(input)
  return { ...document, buffer: await renderOfficialPdf(document.html) }
}
