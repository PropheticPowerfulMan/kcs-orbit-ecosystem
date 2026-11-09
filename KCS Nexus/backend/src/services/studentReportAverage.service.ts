import { aggregateReportCardResults } from './annualReportCard.service.js'
type Grade = { studentId: string; courseId: string; percentage: number; period: string; createdAt?: Date | string; assignmentId?: string | null; course: { credits: number } }
type Card = { term: string; average: number; publicationStatus: string; updatedAt: Date; academicCorrections?: unknown }
export function studentReportAverage(grades: Grade[], cards: Card[]) {
 const official=grades.filter(grade=>!grade.assignmentId&&/::(?:SUBMITTED|APPROVED)$/.test(grade.period))
 const years=[...official.map(grade=>grade.period.split('::')[0]),...cards.map(card=>card.term.slice(0,9))].filter(year=>/^\d{4}-\d{4}$/.test(year)).sort()
 const academicYear=years[years.length-1]
 if(!academicYear)return{average:null,academicYear:null,term:null,source:'NO_COURSE_RESULTS'}
 const candidates=cards.filter(card=>card.term.startsWith(academicYear+' · ')).sort((a,b)=>b.updatedAt.getTime()-a.updatedAt.getTime())
 const card=candidates.find(item=>[...aggregateReportCardResults(official,academicYear,item.term.slice(12)).values()].some(result=>result.percentage!==null))
   ??candidates.find(item=>['APPROVED','EMAILED','POSTED_TO_PORTAL'].includes(item.publicationStatus))

 const term=card?.term.slice(12)??official.filter(grade=>grade.period.startsWith(academicYear+'::')).sort((a,b)=>new Date(b.createdAt??0).getTime()-new Date(a.createdAt??0).getTime())[0]?.period.split('::')[1]
 if(!term)return{average:null,academicYear,term:null,source:'NO_COURSE_RESULTS'}
 const corrections=(card?.academicCorrections??{})as{hiddenCourseIds?:string[];subjects?:Array<{courseId:string;percentage:number}>}
 const hidden=new Set(corrections.hiddenCourseIds??[]),overrides=new Map((corrections.subjects??[]).map(item=>[item.courseId,item.percentage]))
 const result=aggregateReportCardResults(official,academicYear,term)
 const values=[...result.values()].filter(item=>item.percentage!==null&&!hidden.has(item.courseId))
 const credits=(id:string)=>Math.max(1,official.find(grade=>grade.courseId===id)?.course.credits||1)
 const total=values.reduce((sum,item)=>sum+credits(item.courseId),0)
 const average=total?Number((values.reduce((sum,item)=>sum+(overrides.get(item.courseId)??item.percentage!)*credits(item.courseId),0)/total).toFixed(2)):null
 const officialCard=card&&['APPROVED','EMAILED','POSTED_TO_PORTAL'].includes(card.publicationStatus)
 return{average:officialCard?card.average:average,academicYear,term,source:officialCard?'OFFICIAL_REPORT_CARD':'SUBMITTED_COURSE_RESULTS'}
}
