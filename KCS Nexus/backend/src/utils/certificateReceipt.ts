import {createHmac,timingSafeEqual}from 'node:crypto'
import {receiptMetadata}from './reportCardReceipt.js'
export {receiptMetadata}from './reportCardReceipt.js'
export type CertificateReceiptDelivery={id:string;studentId:string|null;recipientEmail:string|null;metadata:unknown}
export function certificateReceiptToken(row:CertificateReceiptDelivery,secret:string){
 const m=receiptMetadata(row.metadata)
 if(!row.studentId||!row.recipientEmail||Number(m.certificateReceiptVersion)!==2||typeof m.receiptDocumentId!=='string'||typeof m.receiptFingerprint!=='string'||typeof m.certificateAttachmentSha256!=='string'||!/^[a-f0-9]{64}$/.test(m.certificateAttachmentSha256))return null
 return createHmac('sha256',secret).update(JSON.stringify(['kcs-certificate-receipt-v2',row.id,row.studentId,row.recipientEmail.toLowerCase(),m.receiptDocumentId,m.receiptFingerprint,m.certificateAttachmentSha256])).digest('hex')
}
export function verifyCertificateReceipt(row:CertificateReceiptDelivery,token:unknown,secret:string){
 const expected=certificateReceiptToken(row,secret)
 return typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&Boolean(expected)&&timingSafeEqual(Buffer.from(token,'hex'),Buffer.from(expected!,'hex'))
}
export function certificateReceiptUrl(row:CertificateReceiptDelivery,frontend:string,secret:string,language:'fr'|'en'){
 const token=certificateReceiptToken(row,secret);if(!token)return null
 const url=new URL('/api/certificate-receipts/'+encodeURIComponent(row.id),frontend);url.searchParams.set('lang',language);url.hash=new URLSearchParams({token}).toString();return url.toString()
}
