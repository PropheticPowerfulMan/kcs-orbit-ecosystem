import {receiptMetadata} from './reportCardReceipt.js'
type Delivery={status:string;sentAt:Date|string|null;deliveredAt:Date|string|null;metadata:unknown}
const iso=(value:unknown)=>{if(!(value instanceof Date)&&typeof value!=='string')return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString()}
const text=(value:unknown)=>typeof value==='string'&&value.trim()?value:null
export function reportCardDeliveryEvidence(row:Delivery){
 const m=receiptMetadata(row.metadata)
 const acknowledgedAt=iso(m.reportCardReceiptConfirmedAt)
 const confirmedAt=acknowledgedAt&&m.reportCardReceiptConfirmationMethod==='PARENT_EMAIL_AND_PDF_ACKNOWLEDGEMENT'&&m.reportCardReceiptEmailConfirmed===true&&m.reportCardReceiptPdfConfirmed===true?acknowledgedAt:null
 const leaseUntil=iso(m.leaseUntil),sending=row.status==='QUEUED'&&Boolean(leaseUntil&&Date.parse(leaseUntil)>Date.now()&&text(m.leaseId))
 const providerAcceptedAt=iso(m.smtpAcceptedAt)??iso(row.sentAt)
 return {
  confirmedAt,legacyAcknowledgedAt:confirmedAt?null:acknowledgedAt,
  confirmationScope:confirmedAt?(typeof m.reportCardAttachmentSha256==='string'&&/^[a-f0-9]{64}$/.test(m.reportCardAttachmentSha256)?'EMAIL_AND_EXACT_PDF':'EMAIL_AND_PDF_SELF_REPORTED'):acknowledgedAt?'LEGACY_ACKNOWLEDGEMENT':null,
  sending,
  confirmationAvailable:[1,2].includes(Number(m.reportCardReceiptVersion))&&Boolean(text(m.receiptDocumentId))&&Boolean(text(m.receiptFingerprint)),
  confirmationSource:confirmedAt?'PARENT_ACKNOWLEDGEMENT':null,
  providerAcceptedAt,providerMessageId:text(m.smtpMessageId),
  emailOpenedAt:iso(m.reportCardEmailOpenedAt),
  attachmentName:text(m.reportCardAttachmentName),attachmentBytes:typeof m.reportCardAttachmentBytes==='number'?m.reportCardAttachmentBytes:null,
  attachmentSha256:text(m.reportCardAttachmentSha256),documentId:text(m.receiptDocumentId),
  documentFingerprint:text(m.receiptFingerprint),
  smtpAttempts:typeof m.attempts==='number'?m.attempts:0,
  // A tracking pixel, SMTP acceptance and a manual delivery label are never parental acknowledgement.
  receiptState:confirmedAt?'CONFIRMED':row.status==='FAILED'?'FAILED':row.status==='NOT_SENT'?'NOT_SENT':sending?'SENDING':row.status==='QUEUED'?'QUEUED':providerAcceptedAt?'AWAITING_CONFIRMATION':'UNVERIFIED',
 }
}
