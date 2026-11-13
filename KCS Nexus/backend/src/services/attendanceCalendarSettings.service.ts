import {prisma} from '../config/prisma.js'
import type {NonSchoolRange} from '../utils/schoolDayPolicy.js'
const initialPublishedClosures:NonSchoolRange[]=[{"startDate": "2026-11-26", "endDate": "2026-11-26", "label": "Thanksgiving"}, {"startDate": "2026-12-21", "endDate": "2027-01-04", "label": "Christmas Break"}, {"startDate": "2027-01-01", "endDate": "2027-01-01", "label": "New Year"}, {"startDate": "2027-01-04", "endDate": "2027-01-04", "label": "Independence Martyrs"}, {"startDate": "2027-01-16", "endDate": "2027-01-16", "label": "Mzee Kabila Day"}, {"startDate": "2027-01-17", "endDate": "2027-01-17", "label": "Lumumba Day"}, {"startDate": "2027-03-22", "endDate": "2027-04-04", "label": "Spring Break"}]
export const attendanceCalendarKey=(year:string)=>'nexus-attendance-calendar:'+year
export async function nonSchoolSettings(year:string){
 const row=await prisma.auditLog.findUnique({where:{id:attendanceCalendarKey(year)},select:{metadata:true}})
 const data=row?.metadata as {revision?:number;ranges?:NonSchoolRange[]}|null
 return {revision:data?.revision??0,ranges:data?.ranges??(year==='2026-2027'?initialPublishedClosures:[])}
}
