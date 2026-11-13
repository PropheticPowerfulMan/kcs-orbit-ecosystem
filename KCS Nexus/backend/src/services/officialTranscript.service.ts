import {createHash} from 'node:crypto'
import {prisma} from '../config/prisma.js'
import type {Prisma} from '@prisma/client'
import {academicCalendars} from './reportAttendance.service.js'
import {officialStudentPortrait} from './officialPortrait.service.js'
import {buildTranscriptRecords} from '../utils/transcriptRecords.js'
import {ApiError} from '../utils/api.js'
type Client=Prisma.TransactionClient|typeof prisma
export async function activeTranscriptYear(){return(await academicCalendars()).find(calendar=>calendar.isCurrent)?.name??null}
export async function transcriptSource(studentId:string,activeAcademicYear:string|null,client:Client=prisma){
 const student=await client.studentProfile.findUnique({where:{id:studentId},include:{user:true}});if(!student)throw new ApiError(404,'Student not found')
 const[grades,legacy,cards]=await Promise.all([
  client.grade.findMany({where:{studentId,assignmentId:null,period:{endsWith:'::APPROVED'}},include:{course:true},orderBy:{createdAt:'desc'}}),
  client.legacyTranscriptRecord.findMany({where:{studentId,verificationStatus:'VERIFIED'},orderBy:[{academicYear:'asc'},{term:'asc'},{courseCode:'asc'}]}),
  client.reportCard.findMany({where:{studentId},select:{id:true}}),
 ])
 const approvals=cards.length?await client.auditLog.findMany({where:{action:'REPORT_CARD_APPROVED',targetId:{in:cards.map(card=>card.id)}},orderBy:{createdAt:'desc'},select:{metadata:true}}):[]
 const gradeSnapshots:Record<string,string>={}
 for(const record of approvals){const data=record.metadata as {academicYear?:string;term?:string;studentGrade?:string};if(data.academicYear&&data.term&&data.studentGrade){const key=data.academicYear+'::'+data.term.replace(/Trimester/gi,'Quarter');if(!gradeSnapshots[key])gradeSnapshots[key]=data.studentGrade}}
 const result=buildTranscriptRecords({studentGrade:student.grade,activeAcademicYear,grades,legacy,gradeSnapshots})
 const identity={id:student.id,studentNumber:student.studentNumber,name:[student.user.lastName,student.user.middleName,student.user.firstName].filter(Boolean).join(' '),grade:student.grade,transcriptVisible:student.transcriptVisible}
 const sourceVersion=createHash('sha256').update(JSON.stringify({identity,rows:result.rows,summary:result.summary})).digest('hex')
 return{student:identity,...result,sourceVersion,activeAcademicYear,generatedAt:new Date().toISOString(),dataPolicy:result.rows.length?'APPROVED_AND_VERIFIED_LEGACY_RECORDS_ONLY':'NO_OFFICIAL_DATA'}
}
export async function loadOfficialTranscript(studentId:string){
 const source=await transcriptSource(studentId,await activeTranscriptYear())
 const profile=await prisma.studentProfile.findUniqueOrThrow({where:{id:studentId},include:{user:true}})
 return{...source,student:{...source.student,photoUrl:await officialStudentPortrait(profile)}}
}
export type OfficialTranscript=Awaited<ReturnType<typeof loadOfficialTranscript>>
