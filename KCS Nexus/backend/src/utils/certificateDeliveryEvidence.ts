import {receiptMetadata} from './certificateReceipt.js'
type Delivery={status:string;sentAt:Date|string|null;deliveredAt:Date|string|null;metadata:unknown}
const iso=(value:unknown)=>{if(!(value instanceof Date)&&typeof value!=='string')return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString()}
const text=(value:unknown)=>typeof value==='string'&&value.trim()?value:null
export function certificateDeliveryEvidence(row:Delivery){
 const m=receiptMetadata(row.metadata)
 const confirmedAt=iso(m.certificateReceiptConfirmedAt)
 const providerAcceptedAt=iso(m.smtpAcceptedAt)??iso(row.sentAt)
 return {
  confirmedAt,
  confirmationAvailable:Number(m.certificateReceiptVersion)===2&&typeof m.certificateAttachmentSha256==='string'&&/^[a-f0-9]{64}$/.test(m.certificateAttachmentSha256)&&Boolean(text(m.receiptDocumentId))&&Boolean(text(m.receiptFingerprint)),
  confirmationSource:confirmedAt?'PARENT_ACKNOWLEDGEMENT':null,
  providerAcceptedAt,providerMessageId:text(m.smtpMessageId),
  emailOpenedAt:iso(m.certificateEmailOpenedAt),
  attachmentName:text(m.certificateAttachmentName),attachmentBytes:typeof m.certificateAttachmentBytes==='number'?m.certificateAttachmentBytes:null,
  attachmentSha256:text(m.certificateAttachmentSha256),documentId:text(m.receiptDocumentId),
  documentFingerprint:text(m.receiptFingerprint),
  smtpAttempts:typeof m.attempts==='number'?m.attempts:0,
  // A tracking pixel, SMTP acceptance and a manual delivery label are never parental acknowledgement.
  receiptState:confirmedAt?'CONFIRMED':row.status==='FAILED'?'FAILED':row.status==='QUEUED'?'QUEUED':providerAcceptedAt?'AWAITING_CONFIRMATION':'UNVERIFIED',
 }
}
