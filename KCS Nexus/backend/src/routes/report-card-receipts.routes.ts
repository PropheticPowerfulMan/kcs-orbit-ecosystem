import {registerDocumentReceiptPublicRoutes} from './document-receipt-public.routes.js'
import {reportCardDeliveryInventory} from '../services/reportCardDeliveryInventory.service.js'
import {reportCardDeliveryEvidence} from '../utils/reportCardDeliveryEvidence.js'
import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireSuperAdmin } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
export const reportCardReceiptsRouter = Router()
reportCardReceiptsRouter.get('/', authenticate, requireSuperAdmin(), asyncHandler(async (req, res) => {
  const ids = z.string().max(12000).parse(req.query.reportCardIds ?? '').split(',').filter(Boolean)
  if (!ids.length) return success(res, [])
  if (ids.length > 250) throw new ApiError(400, 'Select at most 250 report cards')
  const rows=await prisma.$queryRaw<Array<{id:string;reportCardId:string;recipientName:string|null;recipientEmail:string;status:string;sentAt:Date|null;deliveredAt:Date|null;failureReason:string|null;createdAt:Date;metadata:unknown;deliveryCount:number}>>(Prisma.sql`
    SELECT DISTINCT ON ("reportCardId", lower("recipientEmail")) id,"reportCardId","recipientName","recipientEmail",status,"sentAt","deliveredAt","failureReason","createdAt",metadata,
      count(*) OVER (PARTITION BY "reportCardId",lower("recipientEmail"))::int AS "deliveryCount"
    FROM "CorrespondenceLog" WHERE channel='EMAIL' AND "recipientEmail" IS NOT NULL AND "reportCardId" IN (${Prisma.join(ids)})
    ORDER BY "reportCardId",lower("recipientEmail"),"createdAt" DESC,id DESC
  `)
  const inventory=await reportCardDeliveryInventory(ids,rows)
  res.setHeader('X-KCS-Receipt-Inventory',inventory.complete?'complete':'partial')
  return success(res,inventory.rows)
}))
reportCardReceiptsRouter.get('/history',authenticate,requireSuperAdmin(),asyncHandler(async(req,res)=>{
 const query=z.object({reportCardId:z.string().min(1).max(100),recipientEmail:z.string().email().max(320),cursor:z.string().min(1).max(100).optional()}).parse(req.query)
 const where={channel:'EMAIL' as const,reportCardId:query.reportCardId,recipientEmail:{equals:query.recipientEmail,mode:'insensitive' as const}}
 if(query.cursor&&!await prisma.correspondenceLog.findFirst({where:{...where,id:query.cursor},select:{id:true}}))throw new ApiError(400,'Invalid receipt history cursor')
 const rows=await prisma.correspondenceLog.findMany({where,select:{id:true,reportCardId:true,recipientName:true,recipientEmail:true,status:true,sentAt:true,deliveredAt:true,failureReason:true,createdAt:true,metadata:true},orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,...(query.cursor?{cursor:{id:query.cursor},skip:1}:{})})
 const deliveries=rows.slice(0,50).map(({metadata,...row})=>({...row,...reportCardDeliveryEvidence({...row,metadata})}))
 return success(res,{deliveries,hasMore:rows.length>50,nextCursor:rows.length>50?deliveries.at(-1)?.id:null})
}))

registerDocumentReceiptPublicRoutes(reportCardReceiptsRouter,'report-card')
