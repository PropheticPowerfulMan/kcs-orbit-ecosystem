import {prisma} from '../config/prisma.js'
import {attendanceWindow,attendanceWithSuspensions,shouldRefreshReportCardAttendance} from './reportAttendance.service.js'
import {summarizeAttendanceStatuses} from '../utils/attendancePolicy.js'
const summarizeAttendance=(records:Array<{status:string}>)=>summarizeAttendanceStatuses(records.map(r=>r.status))
export const splitReportCardTerm=(value:string)=>{
 const academicYear=value.slice(0,9)
 const term=value.slice(9).replace(/^[^A-Za-z0-9]+/,'').trim()
 return{academicYear,term}
}
export async function reportCardAttendanceSummaries(cards: Array<{ id: string; studentId: string; term: string; attendanceSummary: unknown; publicationStatus?: string; academicCorrections?: unknown }>) {
 const cycles=[...new Set(cards.filter(shouldRefreshReportCardAttendance).map(card=>card.term))]
 const windows=new Map(await Promise.all(cycles.map(async label=>{
  const cycle=splitReportCardTerm(label)
  return [label,await attendanceWindow(cycle.academicYear,cycle.term)] as const
 })))
 const missingIds=[...new Set(cards.filter(shouldRefreshReportCardAttendance).map(card=>card.studentId))]
 const dates=[...windows.values()]
 const range=dates.length?{gte:new Date(Math.min(...dates.map(w=>w.gte.getTime()))),lte:new Date(Math.max(...dates.map(w=>w.lte.getTime())))}:null
 const [attendance,suspensions]=range&&missingIds.length?await Promise.all([
  prisma.attendanceRecord.findMany({where:{studentId:{in:missingIds},date:range},select:{studentId:true,status:true,date:true,period:true,createdAt:true,updatedAt:true}}),
  prisma.disciplineCase.findMany({where:{studentId:{in:missingIds},suspensionStart:{lte:range.lte},suspensionEnd:{gte:range.gte},status:{not:'RESOLVED'}},select:{studentId:true,suspensionStart:true,suspensionEnd:true}}),
 ]):[[],[]]
 return new Map(cards.filter(shouldRefreshReportCardAttendance).map(card => {
  const window = windows.get(card.term)!
  return [card.id, summarizeAttendance(attendanceWithSuspensions(
   attendance.filter(row => row.studentId === card.studentId && row.date >= window.gte && row.date <= window.lte),
   suspensions.filter(row => row.studentId === card.studentId), window,
  ))] as const
 }))
}
