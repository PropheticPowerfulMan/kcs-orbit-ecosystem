import {registerDocumentReceiptPublicRoutes} from './document-receipt-public.routes.js'
import {transcriptDeliveryEvidence} from '../utils/transcriptDeliveryEvidence.js'
import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireSuperAdmin } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
export const transcriptReceiptsRouter = Router()
transcriptReceiptsRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next()})
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

registerDocumentReceiptPublicRoutes(transcriptReceiptsRouter,'transcript')
