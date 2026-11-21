import { createHash } from 'node:crypto'
export const MAX_SCHOOL_PDF_BYTES = 20 * 1024 * 1024
export function schoolDocumentKey(kind: string, language: string, academicYear?: string) {
  return 'nexus-school-document-' + kind + '-' + language + (kind === 'calendar' ? '-' + academicYear : '')
}
export function safeSchoolPdfName(name: string) {
  return (name.normalize('NFC').replace(/[\u0000-\u001f\u007f/\\<>:"|?*]/g, '-').replace(/\.pdf$/i, '').trim().slice(0, 170) || 'KCS-document') + '.pdf'
}
export function validSchoolPdf(buffer: Buffer) {
  return buffer.length >= 16 && buffer.length <= MAX_SCHOOL_PDF_BYTES
    && buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    && buffer.subarray(-2048).toString('latin1').includes('%%EOF')
}
export const schoolPdfHash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex')
