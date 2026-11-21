import {transcriptDeliveryEvidence} from '../utils/transcriptDeliveryEvidence.js'
import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { authenticate, requireSuperAdmin } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { receiptMetadata, verifyTranscriptReceipt } from '../utils/transcriptReceipt.js'
export const transcriptReceiptsRouter = Router()
transcriptReceiptsRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next()})
const escape = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
transcriptReceiptsRouter.get('/', authenticate, requireSuperAdmin(), asyncHandler(async (req, res) => {
  const ids = z.string().max(12000).parse(req.query.studentIds ?? '').split(',').filter(Boolean)
  if (!ids.length) return success(res, [])
  if (ids.length > 250) throw new ApiError(400, 'Select at most 250 transcripts')
  const rows=await prisma.$queryRaw<Array<{id:string;studentId:string;recipientName:string|null;recipientEmail:string;status:string;sentAt:Date|null;deliveredAt:Date|null;failureReason:string|null;createdAt:Date;metadata:unknown;deliveryCount:number}>>(Prisma.sql`
    SELECT DISTINCT ON ("studentId", lower("recipientEmail")) id,"studentId","recipientName","recipientEmail",status,"sentAt","deliveredAt","failureReason","createdAt",metadata,
      count(*) OVER (PARTITION BY "studentId",lower("recipientEmail"))::int AS "deliveryCount"
    FROM "CorrespondenceLog" WHERE channel='EMAIL' AND "recipientEmail" IS NOT NULL AND (metadata->>'documentType'='transcript' OR metadata->>'documentId' LIKE 'KCS-TR-%') AND "studentId" IN (${Prisma.join(ids)})
    ORDER BY "studentId",lower("recipientEmail"),"createdAt" DESC,id DESC
  `)
  return success(res,rows.map(({metadata,...row})=>({...row,...transcriptDeliveryEvidence({...row,metadata})})))
}))
transcriptReceiptsRouter.get('/history',authenticate,requireSuperAdmin(),asyncHandler(async(req,res)=>{
 const query=z.object({studentId:z.string().min(1).max(100),recipientEmail:z.string().email().max(320),cursor:z.string().min(1).max(100).optional()}).parse(req.query)
 const where={channel:'EMAIL' as const,OR:[{metadata:{path:['documentType'],equals:'transcript'}},{metadata:{path:['documentId'],string_starts_with:'KCS-TR-'}}],studentId:query.studentId,recipientEmail:{equals:query.recipientEmail,mode:'insensitive' as const}}
 if(query.cursor&&!await prisma.correspondenceLog.findFirst({where:{...where,id:query.cursor},select:{id:true}}))throw new ApiError(400,'Invalid receipt history cursor')
 const rows=await prisma.correspondenceLog.findMany({where,select:{id:true,studentId:true,recipientName:true,recipientEmail:true,status:true,sentAt:true,deliveredAt:true,failureReason:true,createdAt:true,metadata:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,...(query.cursor?{cursor:{id:query.cursor},skip:1}:{})})
 const deliveries=rows.slice(0,50).map(({metadata,...row})=>({...row,...transcriptDeliveryEvidence({...row,metadata})}))
 return success(res,{deliveries,hasMore:rows.length>50,nextCursor:rows.length>50?deliveries.at(-1)?.id:null})
}))

transcriptReceiptsRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = z.string().regex(/^[a-zA-Z0-9-]{8,100}$/).parse(req.params.id)
  const fr = req.query.lang === 'fr', nonce = randomBytes(18).toString('base64')
  res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','same-origin')
  res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`)
  res.type('html').send(`<!doctype html><html lang="${fr?'fr':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KCS · ${fr?'Confirmation de réception':'Receipt confirmation'}</title><style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#e7f0f6;color:#12344c;font:16px/1.6 system-ui,sans-serif}main{max-width:620px;width:100%;border:1px solid #adc8d7;border-radius:24px;overflow:hidden;background:#f7fbfd;box-shadow:0 22px 70px #12344c20}header{padding:24px 30px;color:#fff;background:#083d60;border-top:6px solid #e6ba51}header strong{letter-spacing:.15em}form{padding:30px}h1{font-size:25px;line-height:1.3;margin:10px 0}label{display:flex;align-items:start;gap:12px;margin:24px 0}input[type=checkbox]{margin-top:7px;width:20px;height:20px;flex-shrink:0;accent-color:#086a87}button{border:0;padding:14px 22px;border-radius:12px;color:#fff;background:#086785;font:700 15px system-ui;cursor:pointer}small{display:block;margin-top:24px;color:#557080}</style></head><body><main><header><strong>KCS</strong><h1>${fr?'Accusé de réception du relevé académique':'Transcript receipt confirmation'}</h1></header><form method="post" action="/api/transcript-receipts/${escape(id)}?lang=${fr?'fr':'en'}"><input type="hidden" name="token" id="receipt-token"><input type="hidden" name="formVersion" value="2"><input type="hidden" name="confirmed" value="yes"><p>${fr?'Merci de confirmer la réception du message et du relevé académique PDF joint.':'Please confirm receipt of the message and its attached transcript PDF.'}</p><label><input type="checkbox" name="emailReceived" value="yes" required><span>${fr?'Je confirme avoir reçu cet e-mail.':'I confirm that I received this email.'}</span></label><label><input type="checkbox" name="pdfReceived" value="yes" required><span>${fr?'Je confirme avoir reçu le relevé académique PDF joint et avoir pu l’ouvrir.':'I confirm that I received and could open the attached transcript PDF.'}</span></label><button type="submit">${fr?'Confirmer la réception':'Confirm receipt'}</button><small>${fr?'Cette action enregistre votre confirmation auprès de l’administration KCS. Elle ne modifie aucun résultat scolaire.':'This action records your acknowledgement with KCS administration. It does not change any academic result.'}</small></form></main><script nonce="${nonce}">document.getElementById('receipt-token').value=new URLSearchParams(location.hash.slice(1)).get('token')||'';</script></body></html>`)
}))
transcriptReceiptsRouter.post('/:id', asyncHandler(async (req, res) => {
  const id = z.string().regex(/^[a-zA-Z0-9-]{8,100}$/).parse(req.params.id)
  const confirmation = z.object({ token:z.string().regex(/^[a-f0-9]{64}$/), confirmed:z.literal('yes'),formVersion:z.literal('2').optional(),emailReceived:z.literal('yes').optional(),pdfReceived:z.literal('yes').optional() }).superRefine((value,ctx)=>{if(value.formVersion==='2'&&(value.emailReceived!=='yes'||value.pdfReceived!=='yes'))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Confirm both email and attached PDF receipt'})}).parse(req.body)
  const {token}=confirmation
  await prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "CorrespondenceLog" WHERE id = ${id} FOR UPDATE`)
    const row = await tx.correspondenceLog.findUnique({ where:{id} })
    if (!row || row.channel !== 'EMAIL' || !verifyTranscriptReceipt(row, token, env.JWT_SECRET)) throw new ApiError(400,'This receipt confirmation link is invalid / Ce lien de confirmation est invalide')
    const m = receiptMetadata(row.metadata)
    if(Number(m.transcriptReceiptVersion)>=2&&(confirmation.emailReceived!=='yes'||confirmation.pdfReceived!=='yes'))throw new ApiError(400,'Confirm both email and attached PDF receipt / Confirmez la réception du mail et du PDF joint')
    if (m.transcriptReceiptConfirmedAt) return
    const now = new Date()
    await tx.correspondenceLog.update({ where:{id}, data:{ status:'DELIVERED', deliveredAt:row.deliveredAt??now, metadata:{ ...m, transcriptReceiptConfirmedAt:now.toISOString(),transcriptReceiptConfirmationMethod:'PARENT_EMAIL_AND_PDF_ACKNOWLEDGEMENT',transcriptReceiptEmailConfirmed:true,transcriptReceiptPdfConfirmed:true } as Prisma.InputJsonValue } })
    await tx.auditLog.create({ data:{ action:'TRANSCRIPT_RECEIPT_CONFIRMED', targetType:'CorrespondenceLog', targetId:id, metadata:{ studentId:row.studentId, recipientEmail:row.recipientEmail, documentId:m.receiptDocumentId as string, attachmentSha256:typeof m.transcriptAttachmentSha256==='string'?m.transcriptAttachmentSha256:null, method:'PARENT_EMAIL_AND_PDF_ACKNOWLEDGEMENT', confirmedAt:now.toISOString() } } })
  })
  const fr = req.query.lang === 'fr'
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','same-origin')
  res.type('html').send(`<!doctype html><html lang="${fr?'fr':'en'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KCS</title><body><main><h1>${fr?'Réception confirmée':'Receipt confirmed'}</h1><p>${fr?'Merci. Votre confirmation a bien été enregistrée par KCS. Vous pouvez fermer cette page.':'Thank you. KCS has recorded your confirmation. You may close this page.'}</p></main></body></html>`)
}))
