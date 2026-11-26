import {createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {receiptMetadata} from './reportCardReceipt.js'
export type MessageReceiptDelivery={id:string;recipientEmail:string|null;subject:string;body:string;metadata:unknown}
export function messageReceiptToken(row:MessageReceiptDelivery,secret:string){
 const m=receiptMetadata(row.metadata)
 if(!row.recipientEmail||Number(m.messageReceiptVersion)!==1)return null
 if(m.messageAttachmentName&&!(typeof m.messageAttachmentSha256==='string'&&/^[a-f0-9]{64}$/.test(m.messageAttachmentSha256)))return null
 return createHmac('sha256',secret).update(JSON.stringify(['kcs-message-receipt-v1',row.id,row.recipientEmail.toLowerCase(),createHash('sha256').update(row.subject+'\n'+row.body).digest('hex'),m.messageAttachmentName||'',m.messageAttachmentSha256||''])).digest('hex')
}
export function verifyMessageReceipt(row:MessageReceiptDelivery,token:unknown,secret:string){
 const expected=messageReceiptToken(row,secret)
 return typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&Boolean(expected)&&timingSafeEqual(Buffer.from(token,'hex'),Buffer.from(expected!,'hex'))
}
export function messageReceiptUrl(row:MessageReceiptDelivery,frontend:string,secret:string,language:'fr'|'en'){
 const token=messageReceiptToken(row,secret);if(!token)return null
 const url=new URL('/api/message-receipts/'+encodeURIComponent(row.id),frontend);url.searchParams.set('lang',language);url.hash=new URLSearchParams({token}).toString();return url.href
}
export function messageDeliveryEvidence(row:{status:string;sentAt:Date|string|null;metadata:unknown}){
 const m=receiptMetadata(row.metadata),date=(v:unknown)=>typeof v==='string'&&!Number.isNaN(Date.parse(v))?v:null
 const attachment=Boolean(m.messageAttachmentName),confirmedAt=date(m.messageReceiptConfirmedAt)&&m.messageReceiptEmailConfirmed===true&&['RECIPIENT_EMAIL_ACKNOWLEDGEMENT','RECIPIENT_EMAIL_AND_ATTACHMENT_ACKNOWLEDGEMENT'].includes(String(m.messageReceiptConfirmationMethod))&&(!attachment||m.messageReceiptAttachmentConfirmed===true)?date(m.messageReceiptConfirmedAt):null
 return{confirmedAt,confirmationAvailable:Number(m.messageReceiptVersion)===1,confirmationScope:confirmedAt?(attachment?'EMAIL_AND_EXACT_ATTACHMENT':'EMAIL'):null,providerAcceptedAt:date(m.smtpAcceptedAt)||(row.sentAt?new Date(row.sentAt).toISOString():null),attachmentName:typeof m.messageAttachmentName==='string'?m.messageAttachmentName:null,attachmentSha256:typeof m.messageAttachmentSha256==='string'?m.messageAttachmentSha256:null}
}
