import type {Prisma} from '@prisma/client'
import {prisma} from '../config/prisma.js'

export const REPORT_CARD_SUBMISSION_ACTIONS=['MAIN_TEACHER_REPORT_CARD_SUBMITTED','MAIN_TEACHER_REPORT_CARD_RESUBMITTED'] as const
type Receipt={id:string;submittedAt:string}
export type ReportCardSubmissionHistory={count:number;firstSubmittedAt:string|null;lastSubmittedAt:string|null;receipts:Receipt[]}
export const emptyReportCardSubmissionHistory=():ReportCardSubmissionHistory=>({count:0,firstSubmittedAt:null,lastSubmittedAt:null,receipts:[]})
export function aggregateReportCardSubmissionHistory(records:Array<{id:string;targetId:string|null;action:string;createdAt:Date}>,cardIds:string[]){
 const histories=new Map(cardIds.map(id=>[id,emptyReportCardSubmissionHistory()]))
 for(const row of [...records].sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()||a.id.localeCompare(b.id))){
  if(!row.targetId||!REPORT_CARD_SUBMISSION_ACTIONS.some(action=>action===row.action))continue
  const history=histories.get(row.targetId);if(!history)continue
  const submittedAt=row.createdAt.toISOString()
  history.count++;history.firstSubmittedAt??=submittedAt;history.lastSubmittedAt=submittedAt
  history.receipts.push({id:row.id,submittedAt})
 }
 return histories
}
/** One scoped query, independent of mutable draft/review/publication status. */
export async function reportCardSubmissionHistories(cardIds:string[],client:Prisma.TransactionClient|typeof prisma=prisma){
 const ids=[...new Set(cardIds)];if(!ids.length)return new Map<string,ReportCardSubmissionHistory>()
 const records=await client.auditLog.findMany({where:{targetType:'ReportCard',targetId:{in:ids},action:{in:[...REPORT_CARD_SUBMISSION_ACTIONS]}},select:{id:true,targetId:true,action:true,createdAt:true},orderBy:[{createdAt:'asc'},{id:'asc'}]})
 return aggregateReportCardSubmissionHistory(records,ids)
}
