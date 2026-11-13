import {Prisma} from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { closedVisibilityPolicy, canViewAcademic, academicFeatures, type VisibilityPolicy, type VisibilityContext, type AcademicFeature } from '../utils/academicVisibilityPolicy.js'
import { ApiError } from '../utils/api.js'
export const visibilitySettingsId='nexus-academic-visibility-settings'
export async function academicVisibilityPolicy(){
 const row=await prisma.auditLog.findUnique({where:{id:visibilitySettingsId},select:{metadata:true}})
 return row?.metadata?row.metadata as unknown as VisibilityPolicy:closedVisibilityPolicy()
}
export async function assertAcademicVisible(actorId:string,audience:'student'|'parent',studentId:string,feature:AcademicFeature,period?:{academicYear:string;term:string}){
 const [policy,student,actor]=await Promise.all([academicVisibilityPolicy(),prisma.studentProfile.findUnique({where:{id:studentId},select:{studentNumber:true,grade:true,section:true,parentLinks:{select:{parentId:true}}}}),prisma.user.findUnique({where:{id:actorId},select:{orbitUserId:true}})])
 if(!student||!canViewAcademic(policy,feature,{audience,...student,...period,section:student.section??'',parentIds:[actorId,actor?.orbitUserId??'',...(audience==='student'?student.parentLinks.map(l=>l.parentId):[])]}))throw new ApiError(403,'ACADEMIC_VISIBILITY_CLOSED: La Super Administration n’a pas encore autorisé cet accès. / Super Administration has not released these results.')
}
const gradeScalars=new Set(['average','officialAverage','overallPercentage','percentage','score','gpa','letterGrade','finalGrade','calculatedGrade','earnedPoints','weightedAverage','currentAverage','predictedAverage','classAverage','highestScore','lowestScore','publishedGrades','academicTrend','performanceTrend','riskLevel','grading','aiFeedback','feedback','result','results','questionResults','scoreBreakdown','recommendations','aiRecommendations','pointsAwarded','isCorrect','teacherFeedback','gradingExplanation','rubricScores'])
export async function filterAcademicPayload(actorId:string,audience:'student'|'parent',payload:unknown){
 const [policy,user,students]=await Promise.all([academicVisibilityPolicy(),prisma.user.findUnique({where:{id:actorId},select:{orbitUserId:true}}),prisma.studentProfile.findMany({where:audience==='student'?{userId:actorId}:{parentLinks:{some:{parentId:actorId}}},select:{id:true,studentNumber:true,grade:true,section:true,parentLinks:{select:{parentId:true}}}})])
 const key=(v:unknown)=>String(v??'').trim().toLowerCase()
 const byKey=new Map(students.flatMap(s=>[s.id,s.studentNumber].map(k=>[key(k),s] as const)))
 const root:VisibilityContext={audience,parentIds:[actorId,user?.orbitUserId??'',...(audience==='student'?students.flatMap(s=>s.parentLinks.map(l=>l.parentId)):[])],...(students.length===1?{...students[0],section:students[0].section??''}:{})}
 const permissions=(c:VisibilityContext)=>Object.fromEntries(academicFeatures.map(f=>[f,policy.enabled&&(policy.defaults[c.audience][f]||canViewAcademic(policy,f,c)||policy.rules.some(r=>r.effect!=='DENY'&&r.permissions[f]&&canViewAcademic(policy,f,{...c,academicYear:r.academicYear||c.academicYear,term:r.term||c.term,courseId:r.courseIds?.[0]||c.courseId})))]))
 const visit=(value:any,context:VisibilityContext):any=>{
  if(value===null||typeof value!=='object')return value
  if(value instanceof Date)return value.toISOString()
  if(Array.isArray(value))return value.flatMap(v=>{const item=visit(v,context);return item===undefined?[]:[item]})
  const identity=byKey.get(key(value.studentNumber))||byKey.get(key(value.studentId))||byKey.get(key(value.profile?.studentNumber))||byKey.get(key(value.id))
  const rawPeriod=typeof value.period==='string'?value.period:typeof value.term==='string'?value.term:''
  const academicYear=typeof value.academicYear==='string'?value.academicYear:/^\d{4}-\d{4}/.exec(rawPeriod)?.[0]
  const term=rawPeriod.includes('::')?rawPeriod.split('::')[1]:rawPeriod.replace(/^\d{4}-\d{4}\s*·\s*/, '')||undefined
  const next:VisibilityContext={...context,...(identity?{studentNumber:identity.studentNumber,grade:identity.grade,section:identity.section??''}:{}),...(academicYear?{academicYear}:{}),...(term?{term}:{}),...(value.courseId||value.course?.id?{courseId:value.courseId||value.course.id}:{})}
  if('courseId'in value&&('percentage'in value||'letterGrade'in value)&&!canViewAcademic(policy,'grades',next))return undefined
  const out:any={}
  for(const[key,v]of Object.entries(value)){
   const feature=key==='reportCards'?'reportCards':key==='transcripts'?'transcripts':key==='grades'?'grades':null
   if(feature&&Array.isArray(v)){out[key]=v.flatMap((row:any)=>{
    const rowPeriod=String(row.period||row.term||'');const y=/^\d{4}-\d{4}/.exec(rowPeriod)?.[0];const t=rowPeriod.includes('::')?rowPeriod.split('::')[1]:rowPeriod.replace(/^\d{4}-\d{4}\s*·\s*/, '')
    const c={...next,...(y?{academicYear:y}:{}),...(t?{term:t}:{}),...(row.courseId?{courseId:row.courseId}:{})}
    // Documents are all-or-nothing; never expose a partially redacted official document.
    return canViewAcademic(policy,feature,c)?[feature==='grades'?visit(row,c):row]:[]
   });continue}
   if(gradeScalars.has(key)&&!canViewAcademic(policy,'grades',next)){out[key]=null;continue}
   if(key==='transcriptVisible'){out[key]=canViewAcademic(policy,'transcripts',next);continue}
   out[key]=visit(v,next)
  }
  if(identity||'profile'in value||'academicSummary'in value)out.academicVisibility={...permissions(next),enabled:policy.enabled,revision:policy.revision}
  return out
 }
 const data=visit(payload,root)
 if(data&&typeof data==='object'&&!Array.isArray(data))data.academicVisibility={...permissions(root),enabled:policy.enabled,revision:policy.revision}
 return data
}

export async function setIndividualTranscriptVisibility(studentId:string,visible:boolean,actorId:string|null){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext('nexus-academic-visibility'))`)
  const student=await tx.studentProfile.update({where:{id:studentId},data:{transcriptVisible:visible},select:{id:true,studentNumber:true,transcriptVisible:true}}).catch(()=>null)
  if(!student)throw new ApiError(404,'Student not found')
  const row=await tx.auditLog.findUnique({where:{id:visibilitySettingsId},select:{metadata:true}})
  const previous=row?.metadata?row.metadata as unknown as VisibilityPolicy:closedVisibilityPolicy()
  const id='transcript-learner-'+student.studentNumber
  const policy:VisibilityPolicy={...previous,revision:previous.revision+1,rules:[...previous.rules.filter(r=>r.id!==id),{id,audience:'both',effect:visible?'ALLOW':'DENY',studentNumbers:[student.studentNumber],permissions:{grades:false,reportCards:false,transcripts:true}}]}
  await tx.auditLog.upsert({where:{id:visibilitySettingsId},create:{id:visibilitySettingsId,actorId,action:'ACADEMIC_VISIBILITY_SETTINGS',targetType:'AcademicVisibility',targetId:'school',metadata:policy as unknown as Prisma.InputJsonValue},update:{actorId,metadata:policy as unknown as Prisma.InputJsonValue}})
  await tx.auditLog.create({data:{actorId,action:visible?'STUDENT_TRANSCRIPT_ACCESS_GRANTED':'STUDENT_TRANSCRIPT_ACCESS_REVOKED',targetType:'StudentProfile',targetId:studentId,metadata:{studentNumber:student.studentNumber,previous,next:policy} as unknown as Prisma.InputJsonValue}})
  return {...student,centralVisibilityEnabled:policy.enabled}
 })
}
