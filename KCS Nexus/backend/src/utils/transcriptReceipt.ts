import {createHmac,timingSafeEqual}from 'node:crypto'
import {receiptMetadata}from './reportCardReceipt.js'
export {receiptMetadata}from './reportCardReceipt.js'
export type TranscriptReceiptDelivery={id:string;studentId:string|null;recipientEmail:string|null;metadata:unknown}
export function transcriptReceiptToken(row:TranscriptReceiptDelivery,secret:string){
 const m=receiptMetadata(row.metadata)
 if(!row.studentId||!row.recipientEmail||Number(m.transcriptReceiptVersion)!==2||typeof m.receiptDocumentId!=='string'||typeof m.receiptFingerprint!=='string'||typeof m.transcriptAttachmentSha256!=='string'||!/^[a-f0-9]{64}$/.test(m.transcriptAttachmentSha256))return null
 return createHmac('sha256',secret).update(JSON.stringify(['kcs-transcript-receipt-v2',row.id,row.studentId,row.recipientEmail.toLowerCase(),m.receiptDocumentId,m.receiptFingerprint,m.transcriptAttachmentSha256])).digest('hex')
}
export function verifyTranscriptReceipt(row:TranscriptReceiptDelivery,token:unknown,secret:string){
 const expected=transcriptReceiptToken(row,secret)
 return typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&Boolean(expected)&&timingSafeEqual(Buffer.from(token,'hex'),Buffer.from(expected!,'hex'))
}
export function transcriptReceiptUrl(row:TranscriptReceiptDelivery,frontend:string,secret:string,language:'fr'|'en'){
 const token=transcriptReceiptToken(row,secret);if(!token)return null
 const url=new URL('/api/transcript-receipts/'+encodeURIComponent(row.id),frontend);url.searchParams.set('lang',language);url.hash=new URLSearchParams({token}).toString();return url.toString()
}
