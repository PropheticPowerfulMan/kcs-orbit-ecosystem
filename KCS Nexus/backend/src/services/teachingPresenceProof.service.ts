import {createHash,randomBytes} from 'node:crypto'
import {Prisma} from '@prisma/client'
import {prisma} from '../config/prisma.js'
import {ApiError} from '../utils/api.js'
import {insideCampus,type CampusPolicy,type Position} from '../utils/teachingPresenceProof.js'
type Database=Prisma.TransactionClient|typeof prisma
export const campusPolicyId='teaching-campus-policy-v1'
export const proofId=(id:string,action:string)=>'teaching-proof:'+id+':'+action
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
export async function campusPolicy(db:Database=prisma){const row=await db.auditLog.findUnique({where:{id:campusPolicyId}});return row?.metadata as CampusPolicy|null}
export async function saveCampusPolicy(actorId:string,value:Omit<CampusPolicy,'version'>){
 const policy={...value,version:randomBytes(16).toString('hex')}
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql(['SELECT 1 FROM pg_advisory_xact_lock(hashtext(', '))'],campusPolicyId))
  await tx.auditLog.create({data:{actorId,action:'TEACHING_CAMPUS_POLICY_CHANGED',targetType:'CampusPolicy',targetId:campusPolicyId,metadata:policy}})
  await tx.auditLog.upsert({where:{id:campusPolicyId},create:{id:campusPolicyId,actorId,action:'TEACHING_CAMPUS_POLICY',targetType:'CampusPolicy',targetId:campusPolicyId,metadata:policy},update:{actorId,metadata:policy}})
  return policy
 })
}
export async function issuePresenceChallenge(userId:string,locator:{courseId:string;scheduleKey:string;date:string},action:'ENTRY'|'EXIT'){
 const token=randomBytes(32).toString('hex')
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql(['SELECT 1 FROM pg_advisory_xact_lock(hashtext(', '))'],'teaching-challenge:'+userId))
  const policy=await campusPolicy(tx);if(!policy)throw new ApiError(409,'TEACHING_CAMPUS_NOT_CONFIGURED')
  const rows=await tx.$queryRaw<Array<{now:Date}>>(Prisma.sql(['SELECT clock_timestamp() AS now']))
  const now=rows[0].now
  const count=await tx.auditLog.count({where:{actorId:userId,action:'TEACHING_POSITION_CHALLENGE',createdAt:{gte:new Date(now.getTime()-60000)}}})
  if(count>=10)throw new ApiError(429,'TEACHING_LOCATION_RATE_LIMIT')
  await tx.auditLog.create({data:{id:'teaching-challenge:'+hash(token),actorId:userId,action:'TEACHING_POSITION_CHALLENGE',targetType:'TeachingPresenceChallenge',targetId:locator.courseId,metadata:{...locator,action,policyVersion:policy.version,expiresAt:new Date(now.getTime()+120000).toISOString()}}})
 })
 return {token,expiresInSeconds:120}
}
export async function consumePresenceChallenge(tx:Prisma.TransactionClient,userId:string,locator:{courseId:string;scheduleKey:string;date:string},action:string,token:string,position:Position,now:Date){
 const id='teaching-challenge:'+hash(token)
 const challenge=await tx.auditLog.findUnique({where:{id}})
 const data=challenge?.metadata as Record<string,unknown>|null
 const policy=await campusPolicy(tx)
 if(!policy)throw new ApiError(409,'TEACHING_CAMPUS_NOT_CONFIGURED')
 if(!challenge||challenge.actorId!==userId||!data||data.consumed||data.courseId!==locator.courseId||data.scheduleKey!==locator.scheduleKey||data.date!==locator.date||data.action!==action||data.policyVersion!==policy.version||Date.parse(String(data.expiresAt))<now.getTime())throw new ApiError(409,'TEACHING_LOCATION_CHALLENGE_INVALID')
 const result=insideCampus(position,policy)
 if(!result.accepted)throw new ApiError(403,'TEACHING_LOCATION_OUTSIDE')
 await tx.auditLog.update({where:{id},data:{metadata:{...data,consumed:true} as Prisma.InputJsonValue}})
 // Do not retain raw teacher coordinates. Keep only the decision and measurement uncertainty.
 return {status:'PENDING',revision:0,distanceMeters:result.distanceMeters,accuracyMeters:Math.round(position.accuracy),policyVersion:policy.version,recordedAt:now.toISOString()}
}
export async function attachPresenceProofs<T extends {id:string|null}>(rows:T[]){
 const ids=rows.flatMap(row=>row.id?[proofId(row.id,'ENTRY'),proofId(row.id,'EXIT')]:[])
 const proofs=ids.length?await prisma.auditLog.findMany({where:{id:{in:ids}},select:{id:true,metadata:true}}):[]
 const map=new Map(proofs.map(row=>[row.id,row.metadata]))
 return rows.map(row=>({...row,presenceProof:{entry:row.id?map.get(proofId(row.id,'ENTRY'))??null:null,exit:row.id?map.get(proofId(row.id,'EXIT'))??null:null}}))
}
export async function verifyTeachingPresence(actorId:string,id:string,action:'ENTRY'|'EXIT',status:'VERIFIED'|'REJECTED',revision:number,note:string){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql(['SELECT 1 FROM pg_advisory_xact_lock(hashtext(', '))'],'teaching-verification:'+id+':'+action))
  const session=await tx.teachingSession.findUnique({where:{id}})
  if(!session)throw new ApiError(404,'TEACHING_SESSION_NOT_FOUND')
  if(session.teacherUserId===actorId)throw new ApiError(403,'TEACHING_SELF_VERIFICATION_DENIED')
  const proof=await tx.auditLog.findUnique({where:{id:proofId(id,action)}})
  const previous=proof?.metadata as Record<string,unknown>|null
  if(!previous||!(action==='ENTRY'?session.checkInAt:session.checkOutAt))throw new ApiError(409,'TEACHING_LOCATION_REQUIRED')
  if(previous.revision!==revision)throw new ApiError(409,'TEACHING_REGISTER_CHANGED')
  const time=await tx.$queryRaw<Array<{now:Date}>>(Prisma.sql(['SELECT clock_timestamp() AS now']))
  const metadata={...previous,status,revision:revision+1,reviewedAt:time[0].now.toISOString(),reviewedById:actorId,note}
  await tx.auditLog.update({where:{id:proof!.id},data:{actorId,metadata:metadata as Prisma.InputJsonValue}})
  await tx.auditLog.create({data:{actorId,action:'TEACHING_PHYSICAL_PRESENCE_'+status,targetType:'TeachingSession',targetId:id,metadata:{action,previous:String(previous.status),status,revision:revision+1,note,observedOnSite:true}}})
  return metadata
 })
}
