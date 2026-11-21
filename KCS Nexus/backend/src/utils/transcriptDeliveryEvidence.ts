import {receiptMetadata} from './transcriptReceipt.js'
type Delivery={status:string;sentAt:Date|string|null;deliveredAt:Date|string|null;metadata:unknown}
const iso=(value:unknown)=>{if(!(value instanceof Date)&&typeof value!=='string')return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString()}
const text=(value:unknown)=>typeof value==='string'&&value.trim()?value:null
export function transcriptDeliveryEvidence(row:Delivery){
 const m=receiptMetadata(row.metadata)
 const confirmedAt=iso(m.transcriptReceiptConfirmedAt)
 const providerAcceptedAt=iso(m.smtpAcceptedAt)??iso(row.sentAt)
 return {
  confirmedAt,
  confirmationAvailable:Number(m.transcriptReceiptVersion)===2&&typeof m.transcriptAttachmentSha256==='string'&&/^[a-f0-9]{64}$/.test(m.transcriptAttachmentSha256)&&Boolean(text(m.receiptDocumentId))&&Boolean(text(m.receiptFingerprint)),
  confirmationSource:confirmedAt?'PARENT_ACKNOWLEDGEMENT':null,
  providerAcceptedAt,providerMessageId:text(m.smtpMessageId),
  emailOpenedAt:iso(m.transcriptEmailOpenedAt),
  attachmentName:text(m.transcriptAttachmentName),attachmentBytes:typeof m.transcriptAttachmentBytes==='number'?m.transcriptAttachmentBytes:null,
  attachmentSha256:text(m.transcriptAttachmentSha256),documentId:text(m.receiptDocumentId),
  documentFingerprint:text(m.receiptFingerprint),
  smtpAttempts:typeof m.attempts==='number'?m.attempts:0,
  // A tracking pixel, SMTP acceptance and a manual delivery label are never parental acknowledgement.
  receiptState:confirmedAt?'CONFIRMED':row.status==='FAILED'?'FAILED':row.status==='QUEUED'?'QUEUED':providerAcceptedAt?'AWAITING_CONFIRMATION':'UNVERIFIED',
 }
}
