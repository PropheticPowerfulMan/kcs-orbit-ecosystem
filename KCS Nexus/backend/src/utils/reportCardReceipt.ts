import { createHmac, timingSafeEqual } from 'node:crypto'
export type ReceiptDelivery = { id: string; reportCardId: string | null; recipientEmail: string | null; metadata: unknown }
export const receiptMetadata = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export function reportCardReceiptToken(row: ReceiptDelivery, secret: string) {
  const m = receiptMetadata(row.metadata)
  if (!row.reportCardId || !row.recipientEmail || ![1,2].includes(Number(m.reportCardReceiptVersion)) || typeof m.receiptDocumentId !== 'string' || typeof m.receiptFingerprint !== 'string') return null
  const version=Number(m.reportCardReceiptVersion)
  if(version===2&&(typeof m.reportCardAttachmentSha256!=='string'||!/^[a-f0-9]{64}$/.test(m.reportCardAttachmentSha256)))return null
  const claims=['kcs-report-card-receipt-v'+version,row.id,row.reportCardId,row.recipientEmail.toLowerCase(),m.receiptDocumentId,m.receiptFingerprint,...(version===2?[m.reportCardAttachmentSha256]:[])]
  return createHmac('sha256', secret).update(JSON.stringify(claims)).digest('hex')
}
export function verifyReportCardReceipt(row: ReceiptDelivery, token: unknown, secret: string) {
  const expected = reportCardReceiptToken(row, secret)
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) && Boolean(expected) && timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected!, 'hex'))
}
export function reportCardReceiptUrl(row: ReceiptDelivery, frontend: string, secret: string, language: 'fr' | 'en') {
  const token = reportCardReceiptToken(row, secret)
  if (!token) return null
  const base=new URL(frontend);if(!base.pathname.endsWith('/'))base.pathname+='/'
  const url = new URL('api/report-card-receipts/' + encodeURIComponent(row.id), base)
  url.searchParams.set('lang', language)
  // A URL fragment is never transmitted in HTTP access logs or referrers.
  url.hash = new URLSearchParams({ token }).toString()
  return url.toString()
}
