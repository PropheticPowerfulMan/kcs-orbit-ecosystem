import {Prisma} from '@prisma/client';
import {prisma} from '../config/prisma.js';
import {academicPeriodAccess,assertAcademicPeriodOpen} from './academicPeriodAccess.service.js';
import {ApiError} from '../utils/api.js';
import {normalizeTeachingPeriods,updateTeachingPeriods,type CoursePeriodState} from '../utils/courseTeachingPeriods.js';
const key=(id:string)=>'nexus-course-periods:'+id;
type Database=Prisma.TransactionClient|typeof prisma;
export async function coursePeriodStates(ids:string[],db:Database=prisma) {
  if (!ids.length) return new Map<string,CoursePeriodState>();
  const rows=await db.auditLog.findMany({where:{id:{in:[...new Set(ids)].map(key)}},select:{targetId:true,metadata:true}});
  return new Map(rows.filter(row=>row.targetId).map(row=>{const value=row.metadata as any;return [row.targetId!,{periods:normalizeTeachingPeriods(value?.periods),revision:Number(value?.revision)||0}]}));
}
export async function saveCoursePeriods(tx:Prisma.TransactionClient,input:{courseId:string;actorId:string;academicYear:string;semesters:number[];mode:'add'|'replace';expectedRevision?:number}) {
  await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'course-periods:'+input.courseId}))`);
  const current=(await coursePeriodStates([input.courseId],tx)).get(input.courseId)||{periods:[],revision:0};
  if(input.expectedRevision!==undefined&&input.expectedRevision!==current.revision)throw new ApiError(409,'COURSE_PERIODS_CHANGED: Reload the course catalogue before saving.');
  const previousSemesters=current.periods.find(p=>p.academicYear===input.academicYear)?.semesters||[];
  const access=await academicPeriodAccess(tx);
  const changedSemesters=input.mode==='replace'?[...new Set([...previousSemesters,...input.semesters])]:input.semesters;
  changedSemesters.forEach(s=>assertAcademicPeriodOpen(access,input.academicYear,'Semester '+s));
  const next={periods:updateTeachingPeriods(current.periods,input.academicYear,input.semesters,input.mode),revision:current.revision+1};
  await tx.auditLog.upsert({where:{id:key(input.courseId)},create:{id:key(input.courseId),actorId:input.actorId,action:'COURSE_TEACHING_PERIODS',targetType:'Course',targetId:input.courseId,metadata:next},update:{actorId:input.actorId,metadata:next}});
  await tx.auditLog.create({data:{actorId:input.actorId,action:'COURSE_TEACHING_PERIODS_UPDATED',targetType:'Course',targetId:input.courseId,metadata:{previous:current,next}}});
  return next;
}
