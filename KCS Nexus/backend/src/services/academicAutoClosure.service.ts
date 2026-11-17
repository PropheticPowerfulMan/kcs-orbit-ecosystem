import { prisma } from '../config/prisma.js'
import { automaticAcademicClosures } from '../utils/academicAutoClosure.js'
import { academicCalendars,type Calendar } from './reportAttendance.service.js'
import { closeAcademicPeriod } from './academicPeriodClosure.service.js'
import { ApiError } from '../utils/api.js'

/** No fallback calendar and no client clock may authorize an automatic closure. */
export async function runAcademicAutoClosures(options:{now?:Date;db?:typeof prisma;calendars?:Calendar[]}={}){
 const db=options.db??prisma,now=options.now??new Date()
 const calendars=options.calendars??await academicCalendars({strict:true})
 const plan=automaticAcademicClosures(calendars,now)
 const rows=await db.auditLog.findMany({where:{action:'ACADEMIC_PERIOD_CLOSED',targetType:'AcademicPeriodClosure'},select:{metadata:true}})
 const closed=new Set(rows.map(row=>{const m=row.metadata as {academicYear:string;term:string};return m.academicYear+'::'+m.term}))
 let completed=0,deferred=0
 for(const item of plan.filter(item=>!closed.has(item.academicYear+'::'+item.term)).slice(0,7)){
  try{
   const result=await closeAcademicPeriod({...item,calendars,automatic:true,now},db)
   if(!result.alreadyClosed)completed++
  }catch(error){
   if(error instanceof ApiError&&error.statusCode===409){deferred++;continue}
   throw error
  }
 }
 return {closed:completed,deferred,publishedCalendars:calendars.length}
}
let started=false,running=false,lastWarning=0
export function startAcademicAutoClosureWorker(){
 if(started)return;started=true
 const tick=async()=>{
  if(running)return;running=true
  try{const result=await runAcademicAutoClosures();if(result.closed)console.info('[academic.auto-close]',result)}
  catch{if(Date.now()-lastWarning>300000){lastWarning=Date.now();console.warn('[academic.auto-close] Closure postponed; the verified calendar or database is temporarily unavailable.')}}
  finally{running=false}
 }
 setTimeout(()=>void tick(),5000).unref()
 setInterval(()=>void tick(),60000).unref()
}
