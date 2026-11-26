import {Router} from 'express'
import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from '../config/prisma.js'
import {authenticate,requireSuperAdmin} from '../middleware/auth.js'
import {asyncHandler,success,ApiError} from '../utils/api.js'
import {reportCardDeliveryEvidence} from '../utils/reportCardDeliveryEvidence.js'
import {transcriptDeliveryEvidence} from '../utils/transcriptDeliveryEvidence.js'
import {messageDeliveryEvidence} from '../utils/messageReceipt.js'
import {registerDocumentReceiptPublicRoutes} from './document-receipt-public.routes.js'
export const messageReceiptsRouter=Router()
const proof=Prisma.sql`(COALESCE(metadata->>'reportCardReceiptConfirmedAt','')<>'' AND metadata->>'reportCardReceiptConfirmationMethod'='PARENT_EMAIL_AND_PDF_ACKNOWLEDGEMENT' AND metadata->>'reportCardReceiptEmailConfirmed'='true' AND metadata->>'reportCardReceiptPdfConfirmed'='true') OR (COALESCE(metadata->>'transcriptReceiptConfirmedAt','')<>'' AND metadata->>'transcriptReceiptConfirmationMethod'='PARENT_EMAIL_AND_PDF_ACKNOWLEDGEMENT' AND metadata->>'transcriptReceiptEmailConfirmed'='true' AND metadata->>'transcriptReceiptPdfConfirmed'='true') OR (COALESCE(metadata->>'messageReceiptConfirmedAt','')<>'' AND metadata->>'messageReceiptConfirmationMethod' IN ('RECIPIENT_EMAIL_AND_ATTACHMENT_ACKNOWLEDGEMENT','RECIPIENT_EMAIL_ACKNOWLEDGEMENT') AND metadata->>'messageReceiptEmailConfirmed'='true' AND (COALESCE(metadata->>'messageAttachmentName','')='' OR metadata->>'messageReceiptAttachmentConfirmed'='true'))`
const requested=Prisma.sql`COALESCE(metadata->>'reportCardReceiptVersion','') IN ('1','2') OR metadata->>'transcriptReceiptVersion'='2' OR metadata->>'messageReceiptVersion'='1'`
const state=Prisma.sql`CASE WHEN (${proof}) THEN 'CONFIRMED' WHEN status='FAILED' THEN 'FAILED' WHEN status='QUEUED' THEN 'QUEUED' WHEN NOT(COALESCE((${requested}),false)) THEN 'NOT_REQUESTED' WHEN "sentAt" IS NOT NULL OR COALESCE(metadata->>'smtpAcceptedAt','')<>'' THEN 'AWAITING_CONFIRMATION' ELSE 'UNVERIFIED' END`
const kind=Prisma.sql`CASE WHEN "reportCardId" IS NOT NULL THEN 'report-card' WHEN metadata->>'transcriptReceiptVersion'='2' OR metadata->>'documentType'='transcript' THEN 'transcript' ELSE 'message' END`
const evidence=(row:any)=>row.reportCardId?reportCardDeliveryEvidence(row):Number(row.metadata?.transcriptReceiptVersion)===2?transcriptDeliveryEvidence(row):messageDeliveryEvidence(row)
const shape=({metadata,...row}:any)=>{const proof=evidence({...row,metadata});const state=proof.confirmedAt?'CONFIRMED':row.status==='FAILED'?'FAILED':row.status==='QUEUED'?'QUEUED':!proof.confirmationAvailable?'NOT_REQUESTED':proof.providerAcceptedAt?'AWAITING_CONFIRMATION':'UNVERIFIED';return{...row,...proof,receiptState:row.receiptState||state}}
messageReceiptsRouter.get('/',authenticate,requireSuperAdmin(),asyncHandler(async(req,res)=>{
 const q=z.object({q:z.string().max(200).default(''),state:z.enum(['ALL','CONFIRMED','AWAITING_CONFIRMATION','QUEUED','FAILED','NOT_REQUESTED','UNVERIFIED']).default('ALL'),kind:z.enum(['ALL','report-card','transcript','message']).default('ALL'),page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(50).default(30)}).parse(req.query)
 const search=q.q.trim()?'%'+q.q.trim()+'%':null
 const filters=Prisma.sql`channel='EMAIL' ${search?Prisma.sql`AND (COALESCE("recipientName",'') ILIKE ${search} OR COALESCE("recipientEmail",'') ILIKE ${search} OR subject ILIKE ${search})`:Prisma.empty} ${q.kind==='ALL'?Prisma.empty:Prisma.sql`AND (${kind})=${q.kind}`}`
 const cte=Prisma.sql`WITH selected AS (SELECT id,"reportCardId","studentId","recipientName","recipientEmail",subject,status,"sentAt","deliveredAt","failureReason","createdAt",metadata,${state} AS "receiptState",${kind} AS kind FROM "CorrespondenceLog" WHERE ${filters})`
 const [rows,groups]=await Promise.all([
 prisma.$queryRaw<any[]>(Prisma.sql`${cte} SELECT * FROM selected ${q.state==='ALL'?Prisma.empty:Prisma.sql`WHERE "receiptState"=${q.state}`} ORDER BY "createdAt" DESC,id DESC LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`),
 prisma.$queryRaw<Array<{state:string;count:number}>>(Prisma.sql`${cte} SELECT "receiptState" AS state,count(*)::int AS count FROM selected GROUP BY "receiptState"`)
 ])
 const counts=Object.fromEntries(groups.map(g=>[g.state,g.count])),total=q.state==='ALL'?groups.reduce((n,g)=>n+g.count,0):counts[q.state]||0
 res.setHeader('Cache-Control','private, no-store');return success(res,{rows:rows.map(shape),counts,total,page:q.page,limit:q.limit})
}))
messageReceiptsRouter.get('/:id/details',authenticate,requireSuperAdmin(),asyncHandler(async(req,res)=>{
 const id=z.string().min(8).max(100).parse(req.params.id),row=await prisma.correspondenceLog.findFirst({where:{id,channel:'EMAIL'}})
 if(!row)throw new ApiError(404,'Email record not found')
 res.setHeader('Cache-Control','private, no-store');return success(res,shape(row))
}))
registerDocumentReceiptPublicRoutes(messageReceiptsRouter,'message')
