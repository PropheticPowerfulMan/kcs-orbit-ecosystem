import {certificateDeliveryEvidence} from '../utils/certificateDeliveryEvidence.js'
import {verifyCertificateReceipt} from '../utils/certificateReceipt.js'
import {reportCardDeliveryEvidence} from '../utils/reportCardDeliveryEvidence.js'
import {transcriptDeliveryEvidence} from '../utils/transcriptDeliveryEvidence.js'
import {messageDeliveryEvidence} from '../utils/messageReceipt.js'
import {randomBytes} from 'node:crypto'
import type {Router} from 'express'
import type {CorrespondenceLog} from '@prisma/client'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '../config/prisma.js'
import {env} from '../config/env.js'
import {ApiError,asyncHandler,success} from '../utils/api.js'
import {receiptMetadata,verifyReportCardReceipt} from '../utils/reportCardReceipt.js'
import {verifyTranscriptReceipt} from '../utils/transcriptReceipt.js'
import {verifyMessageReceipt} from '../utils/messageReceipt.js'
import {receiptMailbox} from '../utils/receiptMailbox.js'
import {receiptPage,receiptClientScript,type ReceiptKind} from '../utils/receiptPage.js'
const idSchema=z.string().regex(/^[a-zA-Z0-9-]{8,100}$/),tokenSchema=z.string().regex(/^[a-f0-9]{64}$/)
function parse<T>(schema:z.ZodType<T>,input:unknown):T{const result=schema.safeParse(input);if(!result.success)throw new ApiError(400,'Invalid confirmation data. Reopen the link from your email. / Confirmation incomplète. Rouvrez le lien depuis votre mail.');return result.data}
const confirmationSchema=z.object({token:tokenSchema,confirmed:z.literal('yes'),formVersion:z.literal('2').optional(),emailReceived:z.literal('yes'),pdfReceived:z.literal('yes').optional()}).strict()
export function registerDocumentReceiptPublicRoutes(router:Router,kind:ReceiptKind){
 const prefix=kind==='report-card'?'reportCard':kind==='transcript'?'transcript':kind==='certificate'?'certificate':'message'
 const path='/api/'+(kind==='report-card'?'report-card-receipts':kind==='transcript'?'transcript-receipts':kind==='certificate'?'certificate-receipts':'message-receipts')
 const verify=kind==='report-card'?verifyReportCardReceipt:kind==='transcript'?verifyTranscriptReceipt:kind==='certificate'?verifyCertificateReceipt:verifyMessageReceipt
 const attachment=(row:CorrespondenceLog)=>kind!=='message'||Boolean(receiptMetadata(row.metadata).messageAttachmentName)
 const view=(row:CorrespondenceLog)=>{const evidence=kind==='report-card'?reportCardDeliveryEvidence(row):kind==='transcript'?transcriptDeliveryEvidence(row):kind==='certificate'?certificateDeliveryEvidence(row):messageDeliveryEvidence(row);return{confirmedAt:evidence.confirmedAt,hasAttachment:attachment(row),inboxUrl:receiptMailbox(row.recipientEmail)}}
 const check=(row:CorrespondenceLog|null,token:string)=>{
  if(!row||row.channel!=='EMAIL'||!verify(row,token,env.JWT_SECRET))throw new ApiError(400,'This confirmation link is invalid or incomplete. / Ce lien de confirmation est invalide ou incomplet.')
  return row
 }
 router.get('/client.js',(_req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.type('application/javascript').send(receiptClientScript)})
 router.get('/:id',asyncHandler(async(req,res)=>{
  const id=parse(idSchema,req.params.id),nonce=randomBytes(18).toString('base64')
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer')
  res.setHeader('Content-Security-Policy',`default-src 'none'; img-src 'self'; style-src 'nonce-${nonce}'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`)
  res.type('html').send(receiptPage(kind,id,req.query.lang==='fr',nonce))
 }))
 router.post('/:id/status',asyncHandler(async(req,res)=>{
  const id=parse(idSchema,req.params.id),{token}=parse(z.object({token:tokenSchema}).strict(),req.body)
  const row=check(await prisma.correspondenceLog.findUnique({where:{id}}),token)
  res.setHeader('Cache-Control','no-store');return success(res,view(row))
 }))
 router.post('/:id',asyncHandler(async(req,res)=>{
  const id=parse(idSchema,req.params.id),confirmation=parse(confirmationSchema,req.body)
  const result=await prisma.$transaction(async tx=>{
   await tx.$queryRaw(Prisma.sql`SELECT id FROM "CorrespondenceLog" WHERE id = ${id} FOR UPDATE`)
   const row=check(await tx.correspondenceLog.findUnique({where:{id}}),confirmation.token),m=receiptMetadata(row.metadata)
   if(attachment(row)&&confirmation.pdfReceived!=='yes')throw new ApiError(400,'Confirm receipt of the email and attachment. / Confirmez la réception du mail et de sa pièce jointe.')
   if(view(row).confirmedAt)return{...view(row),alreadyConfirmed:true}
   const now=new Date(),withAttachment=attachment(row)
   const method=kind==='message'?(withAttachment?'RECIPIENT_EMAIL_AND_ATTACHMENT_ACKNOWLEDGEMENT':'RECIPIENT_EMAIL_ACKNOWLEDGEMENT'):'PARENT_EMAIL_AND_PDF_ACKNOWLEDGEMENT'
   const metadata={...m,[prefix+'ReceiptConfirmedAt']:now.toISOString(),[prefix+'ReceiptEmailConfirmed']:true,...(kind==='message'?{messageReceiptAttachmentConfirmed:withAttachment,messageReceiptConfirmationMethod:withAttachment?'RECIPIENT_EMAIL_AND_ATTACHMENT_ACKNOWLEDGEMENT':'RECIPIENT_EMAIL_ACKNOWLEDGEMENT'}:{[prefix+'ReceiptPdfConfirmed']:true,[prefix+'ReceiptConfirmationMethod']:'PARENT_EMAIL_AND_PDF_ACKNOWLEDGEMENT'})} as Prisma.InputJsonValue
   const attachmentHash=m[prefix==='message'?'messageAttachmentSha256':prefix+'AttachmentSha256']
   const updated=await tx.correspondenceLog.update({where:{id},data:{status:'DELIVERED',deliveredAt:row.deliveredAt??now,failureReason:null,metadata}})
   await tx.auditLog.create({data:{action:kind==='report-card'?'REPORT_CARD_RECEIPT_CONFIRMED':kind==='transcript'?'TRANSCRIPT_RECEIPT_CONFIRMED':kind==='certificate'?'CERTIFICATE_RECEIPT_CONFIRMED':'MESSAGE_RECEIPT_CONFIRMED',targetType:'CorrespondenceLog',targetId:id,metadata:{...(kind==='report-card'?{reportCardId:row.reportCardId}:{studentId:row.studentId}),recipientEmail:row.recipientEmail,documentId:typeof m.receiptDocumentId==='string'?m.receiptDocumentId:null,attachmentSha256:typeof attachmentHash==='string'?attachmentHash:null,method,previousFailureReason:row.failureReason??null,confirmedAt:now.toISOString()}}})
   return{...view(updated),alreadyConfirmed:false}
  },{maxWait:10000,timeout:15000})
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer')
  if(req.get('Accept')?.includes('application/json'))return success(res,result,'Receipt confirmed')
  return res.redirect(303,path+'/'+encodeURIComponent(id)+'?lang='+(req.query.lang==='fr'?'fr':'en')+'#token='+encodeURIComponent(confirmation.token))
 }))
}
