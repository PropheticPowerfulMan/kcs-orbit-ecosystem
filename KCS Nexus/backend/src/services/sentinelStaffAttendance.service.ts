import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {env} from '../config/env.js'
import {prisma} from '../config/prisma.js'
import {attendanceDayAccess} from './attendanceCalendar.service.js'
import {academicCycleForDate,academicPeriodAccess,assertAcademicPeriodOpen,protectAcademicPeriod} from './academicPeriodAccess.service.js'
const stateId='nexus-sentinel-staff-attendance-sync'
export const sentinelStaffMarker='[KCS_SENTINEL] '
export const isSentinelStaffRecord=(record:{recordedById?:string|null;note?:string|null})=>!record.recordedById&&Boolean(record.note?.startsWith(sentinelStaffMarker))
export const staffBusinessNote=(record:{note?:string|null})=>record.note?.startsWith(sentinelStaffMarker)?record.note.slice(sentinelStaffMarker.length):record.note??''
const entry=z.object({staffOrbitId:z.string().min(1).max(160),employeeNumber:z.string().nullable(),staffName:z.string().min(1),staffEmail:z.string().nullable(),department:z.string().nullable(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),status:z.enum(['PRESENT','LATE','EXCUSED']),firstEntry:z.string().datetime().nullable(),lastExit:z.string().datetime().nullable(),sourceUpdatedAt:z.string().datetime(),movementCount:z.number().int().min(0),justification:z.object({id:z.string(),type:z.string(),reason:z.string(),reviewNote:z.string().nullable()}).nullable()})
let running=false
const configured=()=>Boolean(env.SENTINEL_ATTENDANCE_SYNC_KEY)
const day=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kinshasa',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
const clock=(value:string|null)=>value?new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Kinshasa',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)):null
export async function sentinelStaffSyncState():Promise<Record<string,unknown>&{configured:boolean}>{const record=await prisma.auditLog.findUnique({where:{id:stateId},select:{metadata:true}});return{configured:configured(),...(record?.metadata as Record<string,unknown>??{})}}
async function setState(patch:Record<string,unknown>){const current=await sentinelStaffSyncState();await prisma.auditLog.upsert({where:{id:stateId},create:{id:stateId,actorId:null,action:'SENTINEL_STAFF_SYNC_STATE',targetType:'StaffAttendanceIntegration',targetId:'school',metadata:{...current,...patch} as Prisma.InputJsonValue},update:{metadata:{...current,...patch} as Prisma.InputJsonValue}})}
export async function synchronizeSentinelStaffRange(from:string,to:string){
 if(!configured())return{imported:0,manualPreserved:0}
 const url=new URL('/api/integration/nexus/staff-attendance',env.SENTINEL_API_URL);url.searchParams.set('from',from);url.searchParams.set('to',to)
 const response=await fetch(url,{headers:{'x-kcs-nexus-key':env.SENTINEL_ATTENDANCE_SYNC_KEY!},signal:AbortSignal.timeout(5000)})
 if(!response.ok)throw new Error('Sentinel attendance export unavailable ('+response.status+')')
 const payload=z.object({source:z.literal('KCS_SENTINEL'),timezone:z.literal('Africa/Kinshasa'),records:z.array(entry).max(50000)}).parse(await response.json())
 if(payload.records.some(record=>record.date<from||record.date>to))throw new Error('Sentinel returned a record outside the requested dates')
 const access=await academicPeriodAccess(),allowed=new Map<string,Awaited<ReturnType<typeof academicCycleForDate>>>()
 for(const date of new Set(payload.records.map(record=>record.date))){if(!(await attendanceDayAccess(date)).allowed)continue;const cycle=await academicCycleForDate(new Date(date+'T00:00:00Z'));try{if(cycle)assertAcademicPeriodOpen(access,cycle.academicYear,cycle.term);allowed.set(date,cycle)}catch{/* Preserve explicitly closed registers. */}}
 let imported=0,manualPreserved=0
 for(let start=0;start<payload.records.length;start+=100){const records=payload.records.slice(start,start+100).filter(record=>allowed.has(record.date));if(!records.length)continue
  await prisma.$transaction(async tx=>{
   const cycles=new Map(records.map(record=>{const c=allowed.get(record.date);return[c?c.academicYear+'::'+c.term:'',c] as const}));for(const cycle of cycles.values())if(cycle)await protectAcademicPeriod(tx,cycle.academicYear,cycle.term)
   await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext('sentinel-staff-sync'))`)
   const existing=await tx.staffAttendanceRecord.findMany({where:{staffOrbitId:{in:records.map(record=>record.staffOrbitId)},date:{in:records.map(record=>new Date(record.date+'T00:00:00Z'))}}})
   const byKey=new Map(existing.map(record=>[record.staffOrbitId+'::'+record.date.toISOString().slice(0,10),record]))
   let changed=0
   for(const record of records){const previous=byKey.get(record.staffOrbitId+'::'+record.date);if(previous&&!isSentinelStaffRecord(previous)){manualPreserved++;continue}
    const note=sentinelStaffMarker+(record.justification?record.justification.reason+(record.justification.reviewNote?' · '+record.justification.reviewNote:''):'')
    const data={employeeNumber:record.employeeNumber,staffName:record.staffName,staffEmail:record.staffEmail,department:record.department,status:record.status,arrivalTime:clock(record.firstEntry),departureTime:clock(record.lastExit),note,recordedById:null}
    if(previous&&Object.entries(data).every(([key,value])=>(previous as any)[key]===value))continue
    await tx.staffAttendanceRecord.upsert({where:{staffOrbitId_date:{staffOrbitId:record.staffOrbitId,date:new Date(record.date+'T00:00:00Z')}},create:{staffOrbitId:record.staffOrbitId,date:new Date(record.date+'T00:00:00Z'),...data},update:data});changed++;imported++
   }
   if(changed)await tx.auditLog.create({data:{actorId:null,action:'SENTINEL_STAFF_ATTENDANCE_SYNCHRONIZED',targetType:'StaffRegister',targetId:from+'..'+to,metadata:{source:'KCS_SENTINEL',from,to,changed,timezone:'Africa/Kinshasa'}}})
  },{maxWait:10000,timeout:30000})
 }
 await setState({status:'READY',lastSuccessAt:new Date().toISOString(),lastRange:{from,to},lastError:null,manualPreserved});return{imported,manualPreserved}
}
export async function refreshSentinelStaffDay(date:string){if(!configured()||running)return;running=true;try{await synchronizeSentinelStaffRange(date,date)}catch{await setState({status:'UNAVAILABLE',lastError:'Sentinel is temporarily unavailable; saved attendance is preserved.'}).catch(()=>undefined)}finally{running=false}}
export function startSentinelStaffAttendanceSync(){
 if(!configured())return
 const run=async()=>{if(running)return;running=true;try{
  const state=await sentinelStaffSyncState(),today=day(),access=await academicPeriodAccess();const calendar=(access.calendars??[]).find(item=>item.name===access.activeAcademicYear)
  const needsBackfill=calendar&&(!state.backfillCompletedAt||Date.now()-Date.parse(String(state.backfillCompletedAt))>6*3600000)
  if(needsBackfill){const start=String(calendar.startDate).slice(0,10);for(let date=start;date<=today;){const end=new Date(date+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+6);const to=end.toISOString().slice(0,10)>today?today:end.toISOString().slice(0,10);await synchronizeSentinelStaffRange(date,to);const next=new Date(to+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);date=next.toISOString().slice(0,10)}await setState({backfillCompletedAt:new Date().toISOString()})}
  await synchronizeSentinelStaffRange(today,today)
 }catch{await setState({status:'UNAVAILABLE',lastError:'Sentinel is temporarily unavailable; saved attendance is preserved.'}).catch(()=>undefined)}finally{running=false}}
 const initial=setTimeout(()=>void run(),1000);initial.unref();const timer=setInterval(()=>void run(),5000);timer.unref()
}
