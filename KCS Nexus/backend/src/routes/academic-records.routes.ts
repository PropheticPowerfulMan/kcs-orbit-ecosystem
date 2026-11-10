import { certificateDeliveryRouter } from './certificateDelivery.routes.js'
import { officialStudentPortrait } from '../services/officialPortrait.service.js'
import { databaseActorId } from '../utils/databaseActor.js'
import { academicPeriodAccess, protectAcademicPeriod } from '../services/academicPeriodAccess.service.js'
import { Prisma } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { createHash, randomUUID } from 'node:crypto'
import * as XLSX from 'xlsx'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, requireSuperAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { getParentAcademicClearance } from './finance.routes.js'
import { normalizeClassParts } from '../utils/className.js'
import { isTeacherHomeroomForStudent } from '../utils/teacherClassAccess.js'
import { ensureTeacherProfile } from '../utils/teacherProfile.js'
import { synchronizeStudentAcademicMetrics } from '../services/academicSync.js'
import { MAX_IMPORT_BYTES, parseImportBuffer, validateImportFile } from '../modules/data-migration/file-parser.js'
import { academicPeriodKey, isKcsAcademicTerm, isSequentialAcademicYear, KCS_ACADEMIC_TERMS } from '../utils/academicCycle.js'
import { isVisibleInSuperAdministrationQueue } from '../services/academicSubmissionWorkflow.js'
import { summarizeAttendanceStatuses, normalizeAttendanceCorrection } from '../utils/attendancePolicy.js'
import { aggregateReportCardResults, reportCardSourcePeriods } from '../services/annualReportCard.service.js'
import { attendanceWindow, attendanceWithSuspensions } from '../services/reportAttendance.service.js'
import { submitCourseFinalGrades } from '../services/finalGradeSubmission.service.js'
import { officialReportCardPdf } from '../utils/officialReportCardPdf.js'

const academicYearSchema = z.string().refine(isSequentialAcademicYear, 'Academic year must be sequential and use YYYY-YYYY')
const academicTermSchema = z.string().refine(isKcsAcademicTerm, `Academic term must be one of: ${KCS_ACADEMIC_TERMS.join(', ')}`)
const submissionSchema=z.object({
 courseId:z.string().min(1),academicYear:academicYearSchema,term:academicTermSchema,confirmedCycle:z.string().max(100).optional(),ungradedStudentIds:z.array(z.string().min(1)).max(500).optional(),
 results:z.array(z.object({studentId:z.string().min(1),studentNumber:z.string().trim().min(1).max(100).optional(),percentage:z.number().min(0).max(100),comment:z.string().max(1000).optional()})).min(1)
})
const cycleSchema=z.object({academicYear:academicYearSchema,term:academicTermSchema})
const teacherReportDraftSchema=cycleSchema.extend({
 teacherComment:z.string().trim().max(1500).default(''),
 conduct:z.string().trim().max(500).default(''),
 hiddenCourseIds:z.array(z.string().min(1)).max(100).default([]),
})
const teacherReportVisibilityBulkSchema=cycleSchema.extend({
 action:z.enum(['HIDE','RESTORE']),
 studentIds:z.array(z.string().min(1)).min(1).max(200),
 courseIds:z.array(z.string().min(1)).min(1).max(100),
})
const attendanceCorrectionSchema=z.object({
 total:z.number().int().min(0).max(6000),present:z.number().int().min(0).max(1000),absent:z.number().int().min(0).max(4000),late:z.number().int().min(0).max(1000),excused:z.number().int().min(0).max(1000),sick:z.number().int().min(0).max(1000),suspended:z.number().int().min(0).max(1000),attendanceRate:z.number().min(0).max(100).nullable(),
})
const reportCardEditorialSchema=z.object({
 teacherComment:z.string().trim().max(1500),conduct:z.string().trim().max(500),average:z.number().min(0).max(100),
 attendanceSummary:attendanceCorrectionSchema.nullable(),
 subjects:z.array(z.object({courseId:z.string().min(1),courseName:z.string().trim().min(2).max(160).optional(),percentage:z.number().min(0).max(100)})).max(100),
})
const reportCardOfficialSettingsSchema=z.object({
 principalName:z.string().trim().min(2).max(120),
 signatureImage:z.string().max(900_000).refine(value=>value===''||/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+$/s.test(value),'Only PNG or WebP signature images are accepted.'),
 officialSealImage:z.string().max(1_500_000).refine(value=>value===''||/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+$/s.test(value),'Only PNG or WebP seal images are accepted.'),
})
const letter=(value:number)=>value>=97?'A+':value>=93?'A':value>=90?'A-':value>=87?'B+':value>=83?'B':value>=80?'B-':value>=77?'C+':value>=73?'C':value>=70?'C-':value>=67?'D+':value>=63?'D':value>=60?'D-':'F'
const periodKey=(year:string,term:string,status:'SUBMITTED'|'APPROVED')=>academicPeriodKey(year,term as Parameters<typeof academicPeriodKey>[1],status)
const parsePeriod=(period:string)=>{const [academicYear,term,status]=period.split('::');return{academicYear,term,status}}

const summarizeAttendance=(records:Array<{status:string}>)=>summarizeAttendanceStatuses(records.map(item=>item.status))
const reportCardTerm=(academicYear:string,term:string)=>`${academicYear} · ${term}`
const weightedCourseAverage=(grades:Array<{percentage:number;course:{credits:number}}>)=>{
 const credits=grades.reduce((sum,item)=>sum+Math.max(item.course.credits||1,1),0)
 return credits?Number((grades.reduce((sum,item)=>sum+(item.percentage*Math.max(item.course.credits||1,1)),0)/credits).toFixed(2)):0
}
const splitReportCardTerm=(value:string)=>{
 const academicYear=value.slice(0,9)
 const term=value.slice(9).replace(/^[^A-Za-z0-9]+/,'').trim()
 return{academicYear,term}
}

async function reportCardAttendanceSummaries(cards: Array<{ id: string; studentId: string; term: string; attendanceSummary: unknown }>) {
 const cycles=[...new Set(cards.filter(card=>!card.attendanceSummary).map(card=>card.term))]
 const windows=new Map(await Promise.all(cycles.map(async label=>{
  const cycle=splitReportCardTerm(label)
  return [label,await attendanceWindow(cycle.academicYear,cycle.term)] as const
 })))
 const missingIds=[...new Set(cards.filter(card=>!card.attendanceSummary).map(card=>card.studentId))]
 const dates=[...windows.values()]
 const range=dates.length?{gte:new Date(Math.min(...dates.map(w=>w.gte.getTime()))),lte:new Date(Math.max(...dates.map(w=>w.lte.getTime())))}:null
 const [attendance,suspensions]=range&&missingIds.length?await Promise.all([
  prisma.attendanceRecord.findMany({where:{studentId:{in:missingIds},date:range},select:{studentId:true,status:true,date:true}}),
  prisma.disciplineCase.findMany({where:{studentId:{in:missingIds},suspensionStart:{lte:range.lte},suspensionEnd:{gte:range.gte},status:{not:'RESOLVED'}},select:{studentId:true,suspensionStart:true,suspensionEnd:true}}),
 ]):[[],[]]
 return new Map(cards.filter(card => !card.attendanceSummary).map(card => {
  const window = windows.get(card.term)!
  return [card.id, summarizeAttendance(attendanceWithSuspensions(
   attendance.filter(row => row.studentId === card.studentId && row.date >= window.gte && row.date <= window.lte),
   suspensions.filter(row => row.studentId === card.studentId), window,
  ))] as const
 }))
}

const lockedReportCard=async(tx:Prisma.TransactionClient,id:string)=>{
 const initial=await tx.reportCard.findUnique({where:{id}})
 if(!initial)throw new ApiError(404,'Report card not found')
 await tx.$queryRaw(Prisma.sql`SELECT id FROM "StudentProfile" WHERE id = ${initial.studentId} FOR UPDATE`)
 return tx.reportCard.findUniqueOrThrow({where:{id}})
}
type AcademicCorrections={subjects?:Array<{courseId:string;courseName?:string;percentage:number;letterGrade?:string}>;hiddenCourseIds?:string[]}
const academicCorrections=(value:unknown):AcademicCorrections=>value&&typeof value==='object'&&!Array.isArray(value)?value as AcademicCorrections:{}
const correctionMap=(value:unknown)=>new Map((academicCorrections(value).subjects??[]).map(item=>[item.courseId,item]))
const reportCardVisibility=(courseIds:string[],requested:string[])=>{
 const official=new Set(courseIds),hidden=[...new Set(requested)]
 const invalid=hidden.filter(courseId=>!official.has(courseId))
 if(invalid.length)throw new ApiError(400,'A hidden course does not belong to this learner official enrollment')
 const visible=courseIds.filter(courseId=>!hidden.includes(courseId))
 if(!visible.length)throw new ApiError(400,'At least one official course must remain visible on the report card')
 return{hiddenCourseIds:hidden,visibleCourseIds:visible}
}
const resolveAcademicActorId=async(req:AuthenticatedRequest)=>req.user!.sub==='configured-superadmin'
 ? (await prisma.user.findUnique({where:{email:process.env.SUPERADMIN_EMAIL||'superadmin@kcsnexus.com'},select:{id:true}}))?.id??null
 : req.user!.sub
const homeroomReportContext=async(userId:string,studentId:string,academicYear:string,term:string,db:Prisma.TransactionClient=prisma)=>{
 if(db===prisma)await ensureTeacherProfile(userId)
 const window = await attendanceWindow(academicYear,term)
 const [teacher,student]=await Promise.all([
  db.teacherProfile.findUnique({where:{userId},select:{id:true,status:true,homeroomGrade:true,homeroomSection:true}}),
  db.studentProfile.findUnique({
   where:{id:studentId},
   include:{enrollments:{include:{course:true}},attendanceRecords:{where:{date:window},select:{status:true,date:true}},disciplineCases:{where:{suspensionStart:{lte:window.lte},suspensionEnd:{gte:window.gte},status:{not:'RESOLVED'}},select:{suspensionStart:true,suspensionEnd:true}}},
  }),
 ])
 if(!teacher)throw new ApiError(404,'Teacher profile synchronization pending')
 if(!student)throw new ApiError(404,'Student not found')
  if(!isTeacherHomeroomForStudent(teacher,student))throw new ApiError(403,'Only the assigned main teacher may edit or submit this learner report card')
 const submittedPeriods=reportCardSourcePeriods(academicYear,term)
 const submittedGrades=await db.grade.findMany({
  where:{studentId,courseId:{in:student.enrollments.map(item=>item.courseId)},assignmentId:null,period:{in:submittedPeriods}},
  include:{course:true},
  orderBy:{createdAt:'desc'},
 })
 const resultByCourse=aggregateReportCardResults(submittedGrades,academicYear,term)
 const latestGradeByCourse=new Map<string,(typeof submittedGrades)[number]>()
 for(const grade of submittedGrades)if(!latestGradeByCourse.has(grade.courseId))latestGradeByCourse.set(grade.courseId,grade)
 const uniqueEnrollments=[...student.enrollments.reduce((bySubject,enrollment)=>{
  const subjectKey=[enrollment.course.name,enrollment.course.grade,enrollment.course.teacherId].join('|').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()
  const current=bySubject.get(subjectKey)
  const currentGrade=current?resultByCourse.get(studentId+':'+current.courseId):null
  const candidateGrade=resultByCourse.get(studentId+':'+enrollment.courseId)
  if(!current||(!currentGrade&&candidateGrade))bySubject.set(subjectKey,enrollment)
  return bySubject
 },new Map<string,(typeof student.enrollments)[number]>()).values()]
 const grades=uniqueEnrollments.flatMap(item=>{
  const source=latestGradeByCourse.get(item.courseId),result=resultByCourse.get(studentId+':'+item.courseId)
  return source&&result&&result.percentage!==null?[{...source,percentage:result.percentage,letterGrade:letter(result.percentage)}]:[]
 })
 return{teacher,student,enrollments:uniqueEnrollments,grades,average:weightedCourseAverage(grades),attendanceSummary:summarizeAttendance(attendanceWithSuspensions(student.attendanceRecords,student.disciplineCases,window))}
}
export const academicRecordsRouter=Router()
const legacyUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_IMPORT_BYTES,files:1}})
academicRecordsRouter.get('/transcripts/verify', asyncHandler(async (req, res) => {
 const documentId = z.string().regex(new RegExp('^KCS-TR-[0-9]{8}-[A-Z0-9-]+$','i')).parse(req.query.document)
 const fingerprint = z.string().min(6).max(100).parse(req.query.fingerprint)
 const record = await prisma.auditLog.findFirst({ where: { action: 'TRANSCRIPT_VERIFICATION_ISSUED', targetType: 'OfficialTranscript', targetId: documentId }, orderBy: { createdAt: 'desc' } })
 const metadata = (record?.metadata ?? {}) as Record<string, unknown>
 if (!record || metadata.fingerprint !== fingerprint) throw new ApiError(404, 'Transcript authenticity record not found')
 return success(res, { valid: true, documentType: 'TRANSCRIPT', documentId, issuedAt: record.createdAt }, 'Authentic KCS transcript verified')
}))
academicRecordsRouter.get('/certificates/verify',asyncHandler(async(req,res)=>{
 const documentId=z.string().regex(new RegExp('^KCS-(?:CERT|ATT)-[0-9]{8}-[A-Z0-9-]+$','i')).parse(req.query.document)
 const fingerprint=z.string().regex(/^[A-F0-9]{64}$/i).parse(req.query.fingerprint)
 const record=await prisma.auditLog.findFirst({where:{action:'CERTIFICATE_VERIFICATION_ISSUED',targetType:'OfficialCompletionCertificate',targetId:documentId},orderBy:{createdAt:'desc'}})
 const metadata=(record?.metadata??{}) as Record<string,unknown>
 if(!record||metadata.fingerprint!==fingerprint)throw new ApiError(404,'Certificate authenticity record not found')
 return success(res,{valid:true,documentType:'CERTIFICATE',documentId,studentName:metadata.studentName,studentNumber:metadata.studentNumber,grade:metadata.grade,academicYear:metadata.academicYear,issuedAt:record.createdAt},'Authentic KCS certificate verified')
}))

academicRecordsRouter.get('/report-cards/verify', asyncHandler(async (req, res) => {
 const documentId = z.string().regex(new RegExp('^KCS-RC-[0-9]{8}-[A-Z0-9-]+$','i')).parse(req.query.document)
 const fingerprint = z.string().regex(/^[A-F0-9]{64}$/i).parse(req.query.fingerprint)
 const record = await prisma.auditLog.findFirst({ where: { action: 'REPORT_CARD_VERIFICATION_ISSUED', targetType: 'OfficialReportCard', targetId: documentId }, orderBy: { createdAt: 'desc' } })
 const metadata = (record?.metadata ?? {}) as Record<string, unknown>
 if (!record || metadata.fingerprint !== fingerprint) throw new ApiError(404, 'Report-card authenticity record not found')
 if(typeof metadata.reportCardId==='string'&&['APPROVED','EMAILED','POSTED_TO_PORTAL'].includes(String(metadata.publicationStatus))){
  const current=await prisma.reportCard.findUnique({where:{id:metadata.reportCardId},select:{publicationStatus:true,approvedAt:true}})
  if(!current||!['APPROVED','EMAILED','POSTED_TO_PORTAL'].includes(current.publicationStatus)||(typeof metadata.approvedAt==='string'&&current.approvedAt?.toISOString()!==metadata.approvedAt))throw new ApiError(409,'This report card was replaced or reopened for review. Request the latest approved document.')
 }
 return success(res, { valid: true, documentType: 'REPORT_CARD', documentId, publicationStatus: metadata.publicationStatus, issuedAt: record.createdAt }, 'Authentic KCS report card verified')
}))
academicRecordsRouter.get('/gradebooks/verify', asyncHandler(async (req, res) => {
 const documentId=z.string().regex(new RegExp('^KCS-GB-[0-9]{8}-[A-Z0-9-]+$','i')).parse(req.query.document)
 const fingerprint=z.string().regex(/^[A-F0-9]{64}$/i).parse(req.query.fingerprint)
 const record=await prisma.auditLog.findFirst({where:{action:'GRADEBOOK_VERIFICATION_ISSUED',targetType:'OfficialGradebook',targetId:documentId},orderBy:{createdAt:'desc'}})
 const metadata=(record?.metadata??{}) as Record<string,unknown>
 if(!record||metadata.fingerprint!==fingerprint)throw new ApiError(404,'Gradebook authenticity record not found')
 return success(res,{valid:true,documentType:'GRADEBOOK',documentId,courseId:metadata.courseId,academicYear:metadata.academicYear,term:metadata.term,issuedAt:record.createdAt},'Authentic KCS gradebook verified')
}))
academicRecordsRouter.get('/report-card-analytics/verify', asyncHandler(async (req, res) => {
 const documentId=z.string().regex(/^KCS-RA-[0-9]{8}-[A-Z0-9-]+$/i).parse(req.query.document)
 const fingerprint=z.string().regex(/^[A-F0-9]{64}$/i).parse(req.query.fingerprint)
 const record=await prisma.auditLog.findFirst({where:{action:'REPORT_CARD_ANALYTICS_VERIFICATION_ISSUED',targetType:'OfficialReportCardAnalytics',targetId:documentId},orderBy:{createdAt:'desc'}})
 const metadata=(record?.metadata??{}) as Record<string,unknown>
 if(!record||metadata.fingerprint!==fingerprint)throw new ApiError(404,'Report-card analysis authenticity record not found')
 return success(res,{valid:true,documentType:'REPORT_CARD_ANALYTICS',documentId,academicYear:metadata.academicYear,term:metadata.term,rankedCount:metadata.rankedCount,issuedAt:record.createdAt},'Authentic KCS report-card analysis verified')
}))

academicRecordsRouter.use(authenticate)
academicRecordsRouter.use('/certificates', certificateDeliveryRouter)

academicRecordsRouter.post('/report-card-analytics/verification', requireRoles('admin','staff','teacher'), asyncHandler(async (req:AuthenticatedRequest,res)=>{
 const payload=cycleSchema.extend({documentId:z.string().regex(/^KCS-RA-[0-9]{8}-[A-Z0-9-]+$/i),fingerprint:z.string().regex(/^[A-F0-9]{64}$/i),studentIds:z.array(z.string().min(1)).min(1).max(5000),rankedCount:z.number().int().min(1).max(5000)}).parse(req.body)
 const ids=[...new Set(payload.studentIds)]
 if(payload.rankedCount>ids.length)throw new ApiError(400,'The ranked learner count exceeds the selected cohort')
 const students=await prisma.studentProfile.findMany({where:{id:{in:ids}},select:{id:true,grade:true,section:true}})
 if(students.length!==ids.length)throw new ApiError(404,'A selected learner no longer exists')
 if(req.user!.role==='teacher'){
  const teacher=await prisma.teacherProfile.findUnique({where:{userId:req.user!.sub},select:{status:true,homeroomGrade:true,homeroomSection:true}})
  if(!teacher||students.some(student=>!isTeacherHomeroomForStudent(teacher,student)))throw new ApiError(403,'Class report-card analysis is limited to the assigned main-teacher roster')
 }
 const actorId=await databaseActorId(req.user!.sub)
 await prisma.auditLog.create({data:{actorId,action:'REPORT_CARD_ANALYTICS_VERIFICATION_ISSUED',targetType:'OfficialReportCardAnalytics',targetId:payload.documentId,metadata:{fingerprint:payload.fingerprint,academicYear:payload.academicYear,term:payload.term,studentIds:ids,rankedCount:payload.rankedCount}}})
 return success(res,{registered:true,documentId:payload.documentId},'Report-card analysis registered for public verification')
}))


const signatureIdentity = (user: { firstName: string; middleName: string | null; lastName: string; signatureImage: string | null } | null) => user ? ({
 image: user.signatureImage,
 name: [user.lastName, user.middleName, user.firstName].filter(Boolean).join(' '),
}) : null

academicRecordsRouter.get('/official-signatures', requireRoles('admin','staff','teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
 const studentId = String(req.query.studentId || '').trim()
 const [requester, student, leadership] = await Promise.all([
  req.user!.sub === 'configured-superadmin'
   ? prisma.user.findUnique({where:{email:process.env.SUPERADMIN_EMAIL||'superadmin@kcsnexus.com'},select:{firstName:true,middleName:true,lastName:true,signatureImage:true,officialSealImage:true}})
   : prisma.user.findUnique({where:{id:req.user!.sub},select:{firstName:true,middleName:true,lastName:true,signatureImage:true,officialSealImage:true}}),
  studentId ? prisma.studentProfile.findUnique({where:{id:studentId},select:{grade:true,section:true}}) : null,
  prisma.user.findMany({
   where:{signatureImage:{not:null},OR:[{role:'STAFF'},{role:'ADMIN'}]},
   select:{firstName:true,middleName:true,lastName:true,staffFunction:true,signatureImage:true,staffProfile:{select:{function:true}}},
  }),
 ])
 let mainTeacher = req.user!.role === 'teacher' ? signatureIdentity(requester) : null
 if(student){
  const teachers=await prisma.teacherProfile.findMany({
   where:{status:'HOMEROOM_TEACHER'},
   select:{homeroomGrade:true,homeroomSection:true,user:{select:{firstName:true,middleName:true,lastName:true,signatureImage:true}}},
  })
  const target=normalizeClassParts(student.grade,student.section)
  const match=teachers.find(item=>{const assigned=normalizeClassParts(item.homeroomGrade||'',item.homeroomSection||'');return assigned.grade.toLowerCase()===target.grade.toLowerCase()&&assigned.section.toLowerCase()===target.section.toLowerCase()})
  mainTeacher=signatureIdentity(match?.user??null)
 }
 const title=(item:(typeof leadership)[number])=>`${item.staffFunction||''} ${item.staffProfile?.function||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 const principal=leadership.find(item=>/principal|prefet/.test(title(item)))??null
 const headOfSchool=leadership.find(item=>/head of school|school head|directeur|direction/.test(title(item)))??null
 const superAdministrator=req.user!.sub==='configured-superadmin'||requester?.officialSealImage?signatureIdentity(requester):null
 return success(res,{mainTeacher,principal:signatureIdentity(principal),headOfSchool:signatureIdentity(headOfSchool),superAdministrator,officialSealImage:requester?.officialSealImage??null},'Official document signatures loaded')
}))
const legacyHeaders=['studentNumber','academicYear','gradeLevel','term','courseCode','courseName','credits','percentage','letterGrade','sourceSchool','sourceDocument']
const legacyCell=(row:Record<string,unknown>,key:string)=>{
 const found=Object.keys(row).find(candidate=>candidate.replace(/[ _-]/g,'').toLowerCase()===key.replace(/[ _-]/g,'').toLowerCase())
 return String(found?row[found]??'':'').trim()
}

academicRecordsRouter.get('/legacy-records/template',requireSuperAdmin(),asyncHandler(async(req,res)=>{
 const format=String(req.query.format||'xlsx').toLowerCase()
 const example={studentNumber:'KCS-STU-...',academicYear:'2025-2026',gradeLevel:'Grade 10',term:'Annual final',courseCode:'MATH-10',courseName:'Mathematics',credits:1,percentage:84,letterGrade:'B',sourceSchool:'Kinshasa Christian School',sourceDocument:'QuickSchools official export'}
 if(format==='csv'){
  const csv=[legacyHeaders.join(','),legacyHeaders.map(key=>JSON.stringify((example as Record<string,unknown>)[key]??'')).join(',')].join('\r\n')
  res.setHeader('content-type','text/csv; charset=utf-8');res.setHeader('content-disposition','attachment; filename="kcs-legacy-transcript-template.csv"');return res.send('\ufeff'+csv)
 }
 const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet([example],{header:legacyHeaders}),'Verified history')
 const buffer=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'})
 res.setHeader('content-type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('content-disposition','attachment; filename="kcs-legacy-transcript-template.xlsx"');return res.send(buffer)
}))

academicRecordsRouter.post('/legacy-records/import',requireSuperAdmin(),legacyUpload.single('file'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 if(!req.file)throw new ApiError(400,'A CSV or Excel file is required')
 if(String(req.body.confirmation||'')!=='IMPORT VERIFIED LEGACY RECORDS')throw new ApiError(400,'Type IMPORT VERIFIED LEGACY RECORDS to confirm this controlled import')
 validateImportFile(req.file.originalname,req.file.mimetype,req.file.size)
 const rows=parseImportBuffer(req.file.buffer,req.file.originalname)
 if(!rows.length||rows.length>5000)throw new ApiError(400,'Import must contain between 1 and 5,000 rows')
 const studentNumbers=[...new Set(rows.map(row=>legacyCell(row,'studentNumber')).filter(Boolean))]
 const students=await prisma.studentProfile.findMany({where:{studentNumber:{in:studentNumbers}},select:{id:true,studentNumber:true}})
 const studentMap=new Map(students.map(student=>[student.studentNumber.toUpperCase(),student]))
 const fileHash=createHash('sha256').update(req.file.buffer).digest('hex')
 const parsed:Array<{studentId:string;academicYear:string;gradeLevel:string;term:string;courseCode:string;courseName:string;credits:number;percentage:number;letterGrade:string;sourceSchool:string;sourceDocument:string}>=[]
 const errors:string[]=[]
 rows.forEach((row,index)=>{
  const line=index+2,studentNumber=legacyCell(row,'studentNumber'),academicYear=legacyCell(row,'academicYear'),rawGrade=legacyCell(row,'gradeLevel')
  const gradeMatch=rawGrade.match(/(?:grade\s*)?(9|10|11|12)$/i),term=legacyCell(row,'term'),courseCode=legacyCell(row,'courseCode').toUpperCase(),courseName=legacyCell(row,'courseName')
  const credits=Number(legacyCell(row,'credits')),percentage=Number(legacyCell(row,'percentage')),sourceSchool=legacyCell(row,'sourceSchool'),sourceDocument=legacyCell(row,'sourceDocument')
  const student=studentMap.get(studentNumber.toUpperCase())
  if(!student)errors.push('Line '+line+': unknown studentNumber '+(studentNumber||'(empty)'))
  if(!/^\d{4}-\d{4}$/.test(academicYear))errors.push('Line '+line+': academicYear must use YYYY-YYYY')
  if(!gradeMatch)errors.push('Line '+line+': gradeLevel must be Grade 9, 10, 11 or 12')
  if(!term||!courseCode||!courseName||!sourceSchool||!sourceDocument)errors.push('Line '+line+': term, course, school and source document are required')
  if(!Number.isFinite(credits)||credits<=0||credits>20)errors.push('Line '+line+': credits must be greater than 0')
  if(!Number.isFinite(percentage)||percentage<0||percentage>100)errors.push('Line '+line+': percentage must be between 0 and 100')
  if(student&&gradeMatch&&/^\d{4}-\d{4}$/.test(academicYear)&&term&&courseCode&&courseName&&sourceSchool&&sourceDocument&&credits>0&&credits<=20&&percentage>=0&&percentage<=100)parsed.push({studentId:student.id,academicYear,gradeLevel:'Grade '+gradeMatch[1],term,courseCode,courseName,credits,percentage,letterGrade:legacyCell(row,'letterGrade')||letter(percentage),sourceSchool,sourceDocument})
 })
 if(errors.length)throw new ApiError(400,'Legacy import rejected without partial changes. '+errors.slice(0,30).join(' | '))
 await prisma.$transaction(async tx=>{
  for(const item of parsed)await tx.legacyTranscriptRecord.upsert({
   where:{studentId_academicYear_term_courseCode:{studentId:item.studentId,academicYear:item.academicYear,term:item.term,courseCode:item.courseCode}},
   create:{...item,fileHash,sourceSystem:'QUICKSCHOOLS',verificationStatus:'VERIFIED',importedBy:req.user!.sub},
   update:{...item,fileHash,sourceSystem:'QUICKSCHOOLS',verificationStatus:'VERIFIED',importedBy:req.user!.sub},
  })
 })
 const actorId=req.user!.sub==='configured-superadmin'?(await prisma.user.findUnique({where:{email:process.env.SUPERADMIN_EMAIL||'superadmin@kcsnexus.com'},select:{id:true}}))?.id:req.user!.sub
 await prisma.auditLog.create({data:{actorId:actorId||null,action:'VERIFIED_LEGACY_TRANSCRIPT_IMPORT',targetType:'LegacyTranscriptRecord',targetId:fileHash,metadata:{file:req.file.originalname,rows:parsed.length,students:studentNumbers.length,source:'QUICKSCHOOLS'}}})
 return success(res,{imported:parsed.length,students:studentNumbers.length,fileHash},'Verified legacy academic history imported',201)
}))

academicRecordsRouter.get('/student-registry', requireRoles('admin','staff'), asyncHandler(async (_req, res) => {
 const students = await prisma.studentProfile.findMany({
  select: { id: true, studentNumber: true, grade: true, section: true, status: true, transcriptVisible: true, user: { select: { id: true, firstName: true, middleName: true, lastName: true } } },
  orderBy: [{ grade: 'asc' }, { section: 'asc' }, { user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
 })
 res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate')
 return success(res, students, 'Official Nexus academic student registry loaded')
}))

academicRecordsRouter.post('/transcripts/verification', requireRoles('admin','staff'), asyncHandler(async (req: AuthenticatedRequest, res) => {
 const payload = z.object({ documentId: z.string().regex(new RegExp('^KCS-TR-[0-9]{8}-[A-Z0-9-]+$','i')), fingerprint: z.string().min(6).max(100), studentId: z.string().min(1) }).parse(req.body)
 const student = await prisma.studentProfile.findUnique({ where: { id: payload.studentId }, include: { user: true } })
 if (!student) throw new ApiError(404, 'Student not found')
 const studentName = [student.user.lastName, student.user.middleName, student.user.firstName].filter(Boolean).join(' ')
 const configuredActor = req.user!.sub === 'configured-superadmin' ? await prisma.user.findUnique({ where: { email: process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com' }, select: { id: true } }) : null
 const actorId = configuredActor?.id ?? (req.user!.sub === 'configured-superadmin' ? null : req.user!.sub)
 await prisma.auditLog.create({ data: { actorId, action: 'TRANSCRIPT_VERIFICATION_ISSUED', targetType: 'OfficialTranscript', targetId: payload.documentId, metadata: { fingerprint: payload.fingerprint, studentId: student.id, studentName, studentNumber: student.studentNumber, grade: student.grade } } })
 return success(res, { registered: true, documentId: payload.documentId, fingerprint: payload.fingerprint }, 'Transcript registered for public verification')
}))

academicRecordsRouter.post('/report-cards/verification', requireRoles('admin','staff','teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
 const payload = z.object({ documentId: z.string().regex(new RegExp('^KCS-RC-[0-9]{8}-[A-Z0-9-]+$','i')), fingerprint: z.string().regex(/^[A-F0-9]{64}$/i), reportCardId: z.string().min(1) }).parse(req.body)
 const reportCard = await prisma.reportCard.findUnique({ where: { id: payload.reportCardId }, include: { student: true } })
 if (!reportCard) throw new ApiError(404, 'Report card not found')
 if (req.user!.role === 'teacher') { await ensureTeacherProfile(req.user!.sub); const teacher = await prisma.teacherProfile.findUnique({ where: { userId: req.user!.sub }, select: { id: true, status: true, homeroomGrade: true, homeroomSection: true } }); if (!teacher || !isTeacherHomeroomForStudent(teacher, reportCard.student)) throw new ApiError(403, 'Only the assigned main teacher may register this report card') }
 const configuredActor = req.user!.sub === 'configured-superadmin' ? await prisma.user.findUnique({ where: { email: process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com' }, select: { id: true } }) : null
 const actorId = configuredActor?.id ?? (req.user!.sub === 'configured-superadmin' ? null : req.user!.sub)
 await prisma.auditLog.create({ data: { actorId, action: 'REPORT_CARD_VERIFICATION_ISSUED', targetType: 'OfficialReportCard', targetId: payload.documentId, metadata: { fingerprint: payload.fingerprint, reportCardId: reportCard.id, studentId: reportCard.studentId, publicationStatus: reportCard.publicationStatus } } })
 return success(res, { registered: true, documentId: payload.documentId }, 'Report card registered for public verification')
}))
academicRecordsRouter.post('/certificates/verification',requireSuperAdmin(),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=z.object({documentId:z.string().regex(new RegExp('^KCS-(?:CERT|ATT)-[0-9]{8}-[A-Z0-9-]+$','i')),fingerprint:z.string().regex(/^[A-F0-9]{64}$/i),studentId:z.string().min(1),academicYear:academicYearSchema}).parse(req.body)
 const student=await prisma.studentProfile.findUnique({where:{id:payload.studentId},include:{user:true}})
 if(!student)throw new ApiError(404,'Student not found')
 const grade=normalizeClassParts(student.grade,student.section).grade
 if(payload.documentId.toUpperCase().startsWith('KCS-CERT-')&&!['K4','Grade 4','Grade 8'].includes(grade))throw new ApiError(409,'Certificates are restricted to K4, Grade 4 and Grade 8')
 const studentName=[student.user.lastName,student.user.middleName,student.user.firstName].filter(Boolean).join(' ')
 const actorId=await resolveAcademicActorId(req)
 await prisma.auditLog.create({data:{actorId,action:'CERTIFICATE_VERIFICATION_ISSUED',targetType:'OfficialCompletionCertificate',targetId:payload.documentId,metadata:{fingerprint:payload.fingerprint,studentId:student.id,studentName,studentNumber:student.studentNumber,grade,academicYear:payload.academicYear}}})
 return success(res,{registered:true,documentId:payload.documentId},'Certificate registered for public verification')
}))
academicRecordsRouter.post('/gradebooks/verification',requireRoles('admin','staff','teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=z.object({documentId:z.string().regex(new RegExp('^KCS-GB-[0-9]{8}-[A-Z0-9-]+$','i')),fingerprint:z.string().regex(/^[A-F0-9]{64}$/i),courseId:z.string().min(1),academicYear:academicYearSchema,term:academicTermSchema}).parse(req.body)
 const course=await prisma.course.findUnique({where:{id:payload.courseId},include:{teacher:{select:{userId:true}},_count:{select:{enrollments:true}}}})
 if(!course)throw new ApiError(404,'Course not found')
 if(req.user!.role==='teacher'&&course.teacher.userId!==req.user!.sub)throw new ApiError(403,'Only the assigned teacher may authenticate this Gradebook')
 const configuredActor=req.user!.sub==='configured-superadmin'?await prisma.user.findUnique({where:{email:process.env.SUPERADMIN_EMAIL||'superadmin@kcsnexus.com'},select:{id:true}}):null
 const actorId=configuredActor?.id??(req.user!.sub==='configured-superadmin'?null:req.user!.sub)
 await prisma.auditLog.create({data:{actorId,action:'GRADEBOOK_VERIFICATION_ISSUED',targetType:'OfficialGradebook',targetId:payload.documentId,metadata:{fingerprint:payload.fingerprint,courseId:course.id,courseCode:course.code,academicYear:payload.academicYear,term:payload.term,studentCount:course._count.enrollments}}})
 return success(res,{registered:true,documentId:payload.documentId},'Gradebook registered for public verification')
}))
academicRecordsRouter.post('/final-grades/submit',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=submissionSchema.parse(req.body)
 if(payload.confirmedCycle!==payload.academicYear+'::'+payload.term)throw new ApiError(400,'Reload the updated Gradebook and explicitly confirm its academic year and quarter before submitting these results.')
 const result=await submitCourseFinalGrades(req.user!.sub,payload)
 return success(res,result,'Final grades saved, previous course submission replaced, and report-card drafts verified',201)
}))

academicRecordsRouter.get('/final-grades/me',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 await ensureTeacherProfile(req.user!.sub)
 const teacher=await prisma.teacherProfile.findUnique({where:{userId:req.user!.sub},select:{courses:{select:{id:true,enrollments:{select:{studentId:true}}}}}})
 if(!teacher)return success(res,{submissions:[],reportCards:[]},'Teacher profile synchronization pending')
 const courseIds=teacher.courses.map(course=>course.id)
 const studentIds=[...new Set(teacher.courses.flatMap(course=>course.enrollments.map(item=>item.studentId)))]
 const [grades,cards]=await Promise.all([
  courseIds.length?prisma.grade.findMany({where:{courseId:{in:courseIds},assignmentId:null,period:{contains:'::SUBMITTED'}},select:{id:true,studentId:true,courseId:true,percentage:true,letterGrade:true,period:true,createdAt:true},orderBy:{createdAt:'desc'}}):[],
  studentIds.length?prisma.reportCard.findMany({where:{studentId:{in:studentIds}},select:{id:true,studentId:true,term:true,average:true,principalStatus:true,publicationStatus:true,approvedAt:true,portalPostedAt:true,updatedAt:true},orderBy:{updatedAt:'desc'}}):[],
 ])
 return success(res,{submissions:grades.map(item=>({...item,cycle:parsePeriod(item.period)})),reportCards:cards},'Teacher report-card workflow loaded')
}))

academicRecordsRouter.get('/report-cards/teacher-dashboard',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const cycle=cycleSchema.parse({academicYear:String(req.query.academicYear||''),term:String(req.query.term||'')})
 await ensureTeacherProfile(req.user!.sub)
 const teacher=await prisma.teacherProfile.findUnique({
  where:{userId:req.user!.sub},
  select:{
   id:true,status:true,homeroomGrade:true,homeroomSection:true,
   user:{select:{firstName:true,middleName:true,lastName:true}},
   courses:{select:{enrollments:{select:{studentId:true}}}},
  },
 })
 if(!teacher)throw new ApiError(404,'Teacher profile synchronization pending')

 const courseStudentIds=teacher.courses.flatMap(course=>course.enrollments.map(enrollment=>enrollment.studentId))
 const homeroomCandidates=teacher.homeroomGrade
  ? await prisma.studentProfile.findMany({where:{status:{equals:'active',mode:'insensitive'}},select:{id:true,grade:true,section:true}})
  : []
 const homeroomStudentIds=homeroomCandidates.filter(student=>isTeacherHomeroomForStudent(teacher,student)).map(student=>student.id)
 const scopedStudentIds=[...new Set([...courseStudentIds,...homeroomStudentIds])]
 const termLabel=reportCardTerm(cycle.academicYear,cycle.term)
 const submittedPeriods=reportCardSourcePeriods(cycle.academicYear,cycle.term)
 const window=await attendanceWindow(cycle.academicYear,cycle.term)

 const [students,submittedGrades]=scopedStudentIds.length?await Promise.all([
  prisma.studentProfile.findMany({
   where:{id:{in:scopedStudentIds},status:{equals:'active',mode:'insensitive'}},
   select:{
    id:true,studentNumber:true,grade:true,section:true,
    user:{select:{firstName:true,middleName:true,lastName:true}},
    enrollments:{select:{course:{select:{id:true,name:true,code:true,grade:true,credits:true,teacher:{select:{user:{select:{firstName:true,middleName:true,lastName:true}}}}}}}},
    reportCards:{where:{term:termLabel},take:1},
    attendanceRecords:{where:{date:window},select:{status:true,date:true}},
    disciplineCases:{where:{suspensionStart:{lte:window.lte},suspensionEnd:{gte:window.gte},status:{not:'RESOLVED'}},select:{suspensionStart:true,suspensionEnd:true}},
   },
   orderBy:[{grade:'asc'},{section:'asc'},{user:{lastName:'asc'}}],
  }),
  prisma.grade.findMany({
   where:{studentId:{in:scopedStudentIds},assignmentId:null,period:{in:submittedPeriods}},
   select:{id:true,studentId:true,courseId:true,period:true,percentage:true,letterGrade:true,createdAt:true,course:{select:{id:true,name:true,code:true,credits:true,teacher:{select:{user:{select:{firstName:true,middleName:true,lastName:true}}}}}}},
   orderBy:{createdAt:'desc'},
  }),
 ]):[[],[]]

 const resultByEnrollment=aggregateReportCardResults(submittedGrades,cycle.academicYear,cycle.term)
 const sourceGradeByEnrollment=new Map<string,(typeof submittedGrades)[number]>()
 for(const item of submittedGrades){const key=item.studentId+':'+item.courseId;if(!sourceGradeByEnrollment.has(key))sourceGradeByEnrollment.set(key,item)}
 const learners=students.map(student=>{
  const uniqueEnrollments=[...student.enrollments.reduce((bySubject,enrollment)=>{
   const subjectKey=[
    enrollment.course.name,
    enrollment.course.grade,
    enrollment.course.teacher.user.lastName,
    enrollment.course.teacher.user.firstName,
   ].join('|').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()
   const current=bySubject.get(subjectKey)
   const currentGrade=current?resultByEnrollment.get(student.id+':'+current.course.id):null
   const candidateGrade=resultByEnrollment.get(student.id+':'+enrollment.course.id)
   if(!current||(!currentGrade&&candidateGrade))bySubject.set(subjectKey,enrollment)
   return bySubject
  },new Map<string,(typeof student.enrollments)[number]>()).values()]
  const subjects=uniqueEnrollments.map(enrollment=>{
   const grade=resultByEnrollment.get(student.id+':'+enrollment.course.id)
   const source=sourceGradeByEnrollment.get(student.id+':'+enrollment.course.id)
   return{
    courseId:enrollment.course.id,
    courseName:enrollment.course.name,
    courseCode:enrollment.course.code,
    credits:enrollment.course.credits,
    teacherName:[enrollment.course.teacher.user.lastName,enrollment.course.teacher.user.middleName,enrollment.course.teacher.user.firstName].filter(Boolean).join(' '),
    percentage:grade?.percentage??null,
    letterGrade:grade?.percentage==null?null:letter(grade.percentage),
    submittedAt:source?.createdAt??null,
    termResults:grade?.termResults??{},
    sourceTermCount:grade?.sourceCount??0,
   }
  })
  const reportCard=student.reportCards[0]??null
  const hiddenCourseIds=academicCorrections(reportCard?.academicCorrections).hiddenCourseIds??[]
  const visibleSubjects=subjects.filter(subject=>!hiddenCourseIds.includes(subject.courseId))
  const visibleEnrollments=uniqueEnrollments.filter(enrollment=>!hiddenCourseIds.includes(enrollment.course.id))
  const visibleSubmitted=visibleSubjects.filter(subject=>subject.percentage!==null)
  const visibleWeightedGrades=visibleEnrollments.flatMap(enrollment=>{
   const grade=resultByEnrollment.get(student.id+':'+enrollment.course.id)
   return grade?.percentage==null?[]:[{percentage:grade.percentage,course:enrollment.course}]
  })
  return{
   id:student.id,
   studentNumber:student.studentNumber,
   name:[student.user.lastName,student.user.middleName,student.user.firstName].filter(Boolean).join(' '),
   officialAvatar:null,
   user:student.user,
   grade:student.grade,
   section:student.section,
   isHomeroomStudent:isTeacherHomeroomForStudent(teacher,student),
   subjects,
   expectedSubjectCount:visibleSubjects.length,
   submittedSubjectCount:visibleSubmitted.length,
   allSubjectsSubmitted:visibleSubjects.length>0&&visibleSubmitted.length===visibleSubjects.length,
   average:visibleWeightedGrades.length?weightedCourseAverage(visibleWeightedGrades):null,
   attendance:summarizeAttendance(attendanceWithSuspensions(student.attendanceRecords,student.disciplineCases,window)),
   reportCard:reportCard?{...reportCard,hiddenCourseIds}:null,
  }
 })
 res.setHeader('Cache-Control','private, no-store')
 return success(res,{
  cycle,
  teacher:{status:teacher.status,homeroomGrade:teacher.homeroomGrade,homeroomSection:teacher.homeroomSection,name:[teacher.user.lastName,teacher.user.firstName].filter(Boolean).join(' ')},
  learners,
  hierarchy:{subjectTeachers:'Submit final course grades',homeroomTeacher:'Reviews the complete class file, writes the main comment, and submits it',superAdmin:'Approves, publishes report cards, and controls Grade 9-12 transcripts'},
 },'Scoped teacher report-card workspace loaded')
}))

academicRecordsRouter.get('/report-cards/student-photo/:studentId',requireRoles('admin','staff','teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const studentId=getRouteParam(req.params.studentId)
 if(req.user!.role==='admin'||req.user!.role==='staff'){
  const student=await prisma.studentProfile.findUnique({where:{id:studentId},select:{studentNumber:true,officialAvatar:true,user:{select:{orbitUserId:true}}}})
  if(!student)throw new ApiError(404,'Student not found')
  res.setHeader('Cache-Control','private, max-age=300')
  const portrait=await officialStudentPortrait(student)
 return success(res,{officialAvatar:portrait,avatar:portrait},'Official learner portrait loaded')
 }
 await ensureTeacherProfile(req.user!.sub)
 const [teacher,student]=await Promise.all([
  prisma.teacherProfile.findUnique({
   where:{userId:req.user!.sub},
   select:{
    status:true,homeroomGrade:true,homeroomSection:true,
    courses:{where:{enrollments:{some:{studentId}}},select:{id:true},take:1},
   },
  }),
  prisma.studentProfile.findUnique({
   where:{id:studentId},
   select:{id:true,studentNumber:true,grade:true,section:true,officialAvatar:true,user:{select:{orbitUserId:true}}},
  }),
 ])
 if(!teacher)throw new ApiError(404,'Teacher profile synchronization pending')
 if(!student)throw new ApiError(404,'Student not found')
 const allowed=isTeacherHomeroomForStudent(teacher,student)||teacher.courses.length>0
 if(!allowed)throw new ApiError(403,'This learner is outside the assigned teacher scope')
 res.setHeader('Cache-Control','private, max-age=300')
 const portrait=await officialStudentPortrait(student)
 return success(res,{officialAvatar:portrait,avatar:portrait},'Official learner portrait loaded')
}))
academicRecordsRouter.put('/report-cards/teacher-draft/:studentId',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const studentId=getRouteParam(req.params.studentId)
 const payload=teacherReportDraftSchema.parse(req.body)
 await ensureTeacherProfile(req.user!.sub)
 await academicPeriodAccess()
 const card=await prisma.$transaction(async tx=>{
 await protectAcademicPeriod(tx,payload.academicYear,payload.term)
 await tx.$queryRaw(Prisma.sql`SELECT id FROM "StudentProfile" WHERE id = ${studentId} FOR UPDATE`)
 const context=await homeroomReportContext(req.user!.sub,studentId,payload.academicYear,payload.term,tx)
 const termLabel=reportCardTerm(payload.academicYear,payload.term)
 const current=await tx.reportCard.findUnique({where:{studentId_term:{studentId,term:termLabel}}})
 if(current&&['APPROVED','EMAILED','POSTED_TO_PORTAL'].includes(current.publicationStatus))throw new ApiError(409,'This report card is approved or published and is now read-only for the main teacher')
 const visibility=reportCardVisibility(context.enrollments.map(item=>item.courseId),payload.hiddenCourseIds)
 const visibleGrades=context.grades.filter(item=>visibility.visibleCourseIds.includes(item.courseId))
 const visibleAverage=weightedCourseAverage(visibleGrades)
 const corrections={...academicCorrections(current?.academicCorrections),hiddenCourseIds:visibility.hiddenCourseIds}
  const saved=await tx.reportCard.upsert({
   where:{studentId_term:{studentId,term:termLabel}},
   create:{studentId,term:termLabel,average:visibleAverage,teacherComment:payload.teacherComment,conduct:payload.conduct,attendanceSummary:context.attendanceSummary,academicCorrections:corrections,principalStatus:'DRAFT',publicationStatus:'DRAFT'},
   update:{average:visibleAverage,teacherComment:payload.teacherComment,conduct:payload.conduct,attendanceSummary:context.attendanceSummary,academicCorrections:corrections,principalStatus:'DRAFT',publicationStatus:'DRAFT',approvedById:null,approvedAt:null,portalPostedAt:null,emailedAt:null},
  })
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'MAIN_TEACHER_REPORT_CARD_DRAFT_SAVED',targetType:'ReportCard',targetId:saved.id,metadata:{studentId,academicYear:payload.academicYear,term:payload.term,submittedCourseGrades:visibleGrades.length,hiddenCourseIds:visibility.hiddenCourseIds,withdrawnPreviousSubmission:current?.publicationStatus==='READY_FOR_REVIEW'}}})
  return saved
 },{maxWait:10000,timeout:60000})
 return success(res,card,'Main-teacher report-card draft saved')
}))

academicRecordsRouter.post('/report-cards/teacher-visibility/bulk',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=teacherReportVisibilityBulkSchema.parse(req.body)
 const studentIds=[...new Set(payload.studentIds)],requestedCourseIds=[...new Set(payload.courseIds)]
 const termLabel=reportCardTerm(payload.academicYear,payload.term)
 const prepared=[] as Array<{studentId:string;studentNumber:string;average:number;attendanceSummary:unknown;hiddenCourseIds:string[];current:any}>
 for(const studentId of studentIds){
  const context=await homeroomReportContext(req.user!.sub,studentId,payload.academicYear,payload.term)
  const current=await prisma.reportCard.findUnique({where:{studentId_term:{studentId,term:termLabel}}})
  if(current&&['APPROVED','EMAILED','POSTED_TO_PORTAL'].includes(current.publicationStatus))throw new ApiError(409,`The report card for ${context.student.studentNumber} is approved or published and is read-only`)
  const officialCourseIds=context.enrollments.map(item=>item.courseId)
  const applicable=requestedCourseIds.filter(courseId=>officialCourseIds.includes(courseId))
  if(!applicable.length)continue
  const existing=new Set(academicCorrections(current?.academicCorrections).hiddenCourseIds??[])
  for(const courseId of applicable){if(payload.action==='HIDE')existing.add(courseId);else existing.delete(courseId)}
  const visibility=reportCardVisibility(officialCourseIds,[...existing])
  const visibleGrades=context.grades.filter(item=>visibility.visibleCourseIds.includes(item.courseId))
  prepared.push({studentId,studentNumber:context.student.studentNumber,average:weightedCourseAverage(visibleGrades),attendanceSummary:context.attendanceSummary,hiddenCourseIds:visibility.hiddenCourseIds,current})
 }
 if(!prepared.length)throw new ApiError(400,'None of the selected courses belongs to the selected main-teacher learners')
 await academicPeriodAccess()
 const cards=await prisma.$transaction(async tx=>{
 await protectAcademicPeriod(tx,payload.academicYear,payload.term)
  const saved=[]
  for(const item of prepared){
   const corrections={...academicCorrections(item.current?.academicCorrections),hiddenCourseIds:item.hiddenCourseIds}
   const card=await tx.reportCard.upsert({
    where:{studentId_term:{studentId:item.studentId,term:termLabel}},
    create:{studentId:item.studentId,term:termLabel,average:item.average,teacherComment:'',conduct:'',attendanceSummary:item.attendanceSummary as never,academicCorrections:corrections,principalStatus:'DRAFT',publicationStatus:'DRAFT'},
    update:{average:item.average,attendanceSummary:item.attendanceSummary as never,academicCorrections:corrections,principalStatus:'DRAFT',publicationStatus:'DRAFT',approvedById:null,approvedAt:null,portalPostedAt:null,emailedAt:null},
   })
   await tx.auditLog.create({data:{actorId:req.user!.sub,action:payload.action==='HIDE'?'MAIN_TEACHER_COURSES_HIDDEN_BULK':'MAIN_TEACHER_COURSES_RESTORED_BULK',targetType:'ReportCard',targetId:card.id,metadata:{studentId:item.studentId,studentNumber:item.studentNumber,academicYear:payload.academicYear,term:payload.term,requestedCourseIds,hiddenCourseIds:item.hiddenCourseIds,scopeStudentIds:studentIds}}})
   saved.push({...card,hiddenCourseIds:item.hiddenCourseIds})
  }
  return saved
 })
 return success(res,{action:payload.action,updatedLearners:cards.length,cards},payload.action==='HIDE'?'Selected courses hidden for the selected learners':'Selected courses restored for the selected learners')
}))

academicRecordsRouter.post('/report-cards/teacher-submit/:studentId',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const studentId=getRouteParam(req.params.studentId)
 const payload=teacherReportDraftSchema.parse(req.body)
 if(payload.teacherComment.length<5)throw new ApiError(400,'Add the main teacher comment before submitting the report card')
 await ensureTeacherProfile(req.user!.sub)
 await academicPeriodAccess()
 const result=await prisma.$transaction(async tx=>{
 await protectAcademicPeriod(tx,payload.academicYear,payload.term)
 await tx.$queryRaw(Prisma.sql`SELECT id FROM "StudentProfile" WHERE id = ${studentId} FOR UPDATE`)
 const context=await homeroomReportContext(req.user!.sub,studentId,payload.academicYear,payload.term,tx)
 const visibility=reportCardVisibility(context.enrollments.map(item=>item.courseId),payload.hiddenCourseIds)
 const expectedCourseIds=visibility.visibleCourseIds
 const submittedCourseIds=new Set(context.grades.map(item=>item.courseId))
 const missingCourseIds=expectedCourseIds.filter(courseId=>!submittedCourseIds.has(courseId))
 if(!expectedCourseIds.length)throw new ApiError(409,'This learner has no official course enrollment')
 if(missingCourseIds.length){
  const missingCourses=context.enrollments.filter(item=>missingCourseIds.includes(item.courseId)).map(item=>item.course.code||item.course.name)
  throw new ApiError(409,`Submission blocked: final grades are still missing for ${missingCourses.join(', ')}`)
 }
 const termLabel=reportCardTerm(payload.academicYear,payload.term)
 const current=await tx.reportCard.findUnique({where:{studentId_term:{studentId,term:termLabel}}})
 if(current&&['APPROVED','EMAILED','POSTED_TO_PORTAL'].includes(current.publicationStatus))throw new ApiError(409,'This report card is already approved or published and cannot be replaced without Super Administration review')
 const replacesPreviousSubmission=current?.publicationStatus==='READY_FOR_REVIEW'
 const visibleGrades=context.grades.filter(item=>visibility.visibleCourseIds.includes(item.courseId))
 const visibleAverage=weightedCourseAverage(visibleGrades)
 const corrections={...academicCorrections(current?.academicCorrections),hiddenCourseIds:visibility.hiddenCourseIds}
  const saved=await tx.reportCard.upsert({
   where:{studentId_term:{studentId,term:termLabel}},
   create:{studentId,term:termLabel,average:visibleAverage,teacherComment:payload.teacherComment,conduct:payload.conduct,attendanceSummary:context.attendanceSummary,academicCorrections:corrections,principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW'},
   update:{average:visibleAverage,teacherComment:payload.teacherComment,conduct:payload.conduct,attendanceSummary:context.attendanceSummary,academicCorrections:corrections,principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW',approvedById:null,approvedAt:null,portalPostedAt:null,emailedAt:null},
  })
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:replacesPreviousSubmission?'MAIN_TEACHER_REPORT_CARD_RESUBMITTED':'MAIN_TEACHER_REPORT_CARD_SUBMITTED',targetType:'ReportCard',targetId:saved.id,metadata:{studentId,academicYear:payload.academicYear,term:payload.term,replacesPreviousSubmission,hiddenCourseIds:visibility.hiddenCourseIds,courseGrades:visibleGrades.map(item=>({courseId:item.courseId,percentage:item.percentage,credits:item.course.credits}))}}})
  const recipients=await tx.user.findMany({where:{OR:[{role:'ADMIN'},{email:process.env.SUPERADMIN_EMAIL||'superadmin@kcsnexus.com'}]},select:{id:true}})
  if(recipients.length)await tx.notification.createMany({data:recipients.map(({id:userId})=>({userId,title:replacesPreviousSubmission?'Updated report card ready for review':'Report card ready for review',message:`A main teacher ${replacesPreviousSubmission?'replaced the previous submission':'submitted the complete report card'} for ${context.student.studentNumber}.`,type:'INFO',link:'/admin/report-cards'}))})
  return{saved,notified:recipients.length,replacesPreviousSubmission}
 },{maxWait:10000,timeout:60000})
  const replacesPreviousSubmission=result.replacesPreviousSubmission
  const confirmed=await prisma.reportCard.findUnique({where:{id:result.saved.id},select:{id:true,publicationStatus:true,principalStatus:true}})
  if(!confirmed||!isVisibleInSuperAdministrationQueue(confirmed.publicationStatus,confirmed.principalStatus))throw new ApiError(500,'The report card could not be confirmed in the Super Administration review queue')
  return success(res,{...result.saved,superAdministrationQueued:true,superAdministrationNotified:result.notified,replacesPreviousSubmission},replacesPreviousSubmission?'Previous submission replaced and updated report card sent to Super Administration':'Complete report card submitted to Super Administration')
}))

academicRecordsRouter.get('/review',requireRoles('admin','staff'),asyncHandler(async(req,res)=>{
 const academicYear=String(req.query.academicYear||''),term=String(req.query.term||''),status=String(req.query.status||'SUBMITTED')
 const where:any={assignmentId:null,period:academicYear?{startsWith:`${academicYear}::`,contains:`::${status}`}:{contains:`::${status}`}}
 const grades=await prisma.grade.findMany({
  where,
  include:{student:{select:{id:true,studentNumber:true,grade:true,section:true,user:{select:{firstName:true,middleName:true,lastName:true}}}},course:{select:{id:true,name:true,code:true,grade:true,credits:true,teacher:{select:{id:true,user:{select:{firstName:true,middleName:true,lastName:true}}}}}}},
  orderBy:[{period:'desc'},{courseId:'asc'}],
 })
 const filtered=term?grades.filter(item=>parsePeriod(item.period).term===term):grades
 res.setHeader('Cache-Control','private, no-store, no-cache, must-revalidate')
 return success(res,filtered.map(item=>({...item,cycle:parsePeriod(item.period)})))
}))

academicRecordsRouter.post('/report-cards/generate',requireRoles('admin','staff'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=cycleSchema.parse(req.body)
 const actorId=await resolveAcademicActorId(req)
 if(!actorId)throw new ApiError(403,'The report-card generation identity is unavailable')
 const submittedPeriods=reportCardSourcePeriods(payload.academicYear,payload.term)
 const grades=await prisma.grade.findMany({where:{assignmentId:null,period:{in:submittedPeriods}},include:{course:{select:{id:true,credits:true}}},orderBy:{createdAt:'desc'}})
 if(!grades.length)throw new ApiError(400,'No submitted final grades exist for this cycle')
 const results=aggregateReportCardResults(grades,payload.academicYear,payload.term)
 const grouped=new Map<string,Array<{percentage:number;course:{credits:number}}>>()
 for(const result of results.values())if(result.percentage!==null){
  const source=grades.find(item=>item.studentId===result.studentId&&item.courseId===result.courseId)
  if(source)grouped.set(result.studentId,[...(grouped.get(result.studentId)||[]),{percentage:result.percentage,course:source.course}])
 }
 if(!grouped.size)throw new ApiError(400,'No complete submitted final grades exist for this cycle')
 const window=await attendanceWindow(payload.academicYear,payload.term)
 const attendanceRecords=await prisma.attendanceRecord.findMany({where:{studentId:{in:[...grouped.keys()]},date:window},select:{studentId:true,status:true}})
 await academicPeriodAccess()
 const cards=await prisma.$transaction(async tx=>{
 await protectAcademicPeriod(tx,payload.academicYear,payload.term)
  const created=[]
  for(const [studentId,items] of grouped){const average=weightedCourseAverage(items);const attendanceSummary=summarizeAttendance(attendanceRecords.filter(item=>item.studentId===studentId));created.push(await tx.reportCard.upsert({where:{studentId_term:{studentId,term:reportCardTerm(payload.academicYear,payload.term)}},create:{studentId,term:reportCardTerm(payload.academicYear,payload.term),average,attendanceSummary,principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW'},update:{average,attendanceSummary,principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW'}}))}
  await tx.auditLog.create({data:{actorId,action:'REPORT_CARDS_GENERATED',targetType:'ReportCardCycle',metadata:{...payload,count:created.length,sourceGradeCount:grades.length}}})
  return created
 },{maxWait:10000,timeout:60000})
 return success(res,{count:cards.length,cards},'Report cards generated from submitted grades')
}))

academicRecordsRouter.get('/report-cards',requireRoles('admin','staff'),asyncHandler(async(req,res)=>{
 const academicYear = req.query.academicYear ? academicYearSchema.parse(String(req.query.academicYear)) : undefined
 const cards=await prisma.reportCard.findMany({
  where:{
   ...(req.query.status?{publicationStatus:String(req.query.status) as any}:{}),
   ...(academicYear?{term:{startsWith:academicYear+' · '}}:{}),
  },
  include:{
   student:{select:{
    id:true,studentNumber:true,grade:true,section:true,status:true,transcriptVisible:true,
    user:{select:{id:true,firstName:true,middleName:true,lastName:true}},
    parentLinks:{select:{parentId:true,parent:{select:{id:true,firstName:true,middleName:true,lastName:true,email:true,phone:true}}}},
   }},
   approvedBy:{select:{id:true,firstName:true,middleName:true,lastName:true}},
  },
  orderBy:{updatedAt:'desc'},
 })
 const studentIds=[...new Set(cards.map(card=>card.studentId))]
 const sourcePeriods=[...new Set(cards.flatMap(card=>{
  const cycle=splitReportCardTerm(card.term)
  return reportCardSourcePeriods(cycle.academicYear,cycle.term)
 }))]
 const allGrades=studentIds.length?await prisma.grade.findMany({
  where:{studentId:{in:studentIds},assignmentId:null,period:{in:sourcePeriods}},
  select:{id:true,studentId:true,courseId:true,period:true,percentage:true,letterGrade:true,createdAt:true,
   course:{select:{name:true,code:true,credits:true,teacher:{select:{user:{select:{firstName:true,middleName:true,lastName:true}}}}}},
  },
  orderBy:{createdAt:'desc'},
 }):[]
 const gradesByStudent=new Map<string,typeof allGrades>()
 for(const grade of allGrades){
  const list=gradesByStudent.get(grade.studentId)??[]
  list.push(grade);gradesByStudent.set(grade.studentId,list)
 }
 const missingAttendance = await reportCardAttendanceSummaries(cards)
 const enriched=cards.map(card=>{
  const student=card.student
  const grades=gradesByStudent.get(card.studentId)??[]
  const [academicYear,...termParts]=card.term.split(' · ')
  const expectedPeriod=periodKey(academicYear,termParts.join(' · '),'SUBMITTED')
  const byCourse=new Map<string,(typeof grades)[number]>()
  for(const grade of grades){
   if(grade.period===expectedPeriod&&!byCourse.has(grade.courseId))byCourse.set(grade.courseId,grade)
  }
  const subjects=[...byCourse.values()].sort((left,right)=>(left.course.code||left.course.name).localeCompare(right.course.code||right.course.name,'en',{numeric:true,sensitivity:'base'}))
  const parsedCycle=splitReportCardTerm(card.term)
  const results=aggregateReportCardResults(grades,parsedCycle.academicYear,parsedCycle.term)
  const latestByCourse=new Map<string,(typeof grades)[number]>()
  for(const grade of grades)if(!latestByCourse.has(grade.courseId))latestByCourse.set(grade.courseId,grade)
  const computedSubjects=[...results.values()].flatMap(result=>{
   const source=latestByCourse.get(result.courseId)
   return source&&result.percentage!==null?[{...source,percentage:result.percentage,letterGrade:letter(result.percentage),termResults:result.termResults,sourceTermCount:result.sourceTermCount}]:[]
  }).sort((left,right)=>(left.course.code||left.course.name).localeCompare(right.course.code||right.course.name,'en',{numeric:true,sensitivity:'base'}))
  const baseSubjects=computedSubjects.length?computedSubjects:subjects
  const correctionState=academicCorrections(card.academicCorrections)
  const corrections=correctionMap(card.academicCorrections)
  const hiddenCourseIds=correctionState.hiddenCourseIds??[]
  const correctedSubjects=baseSubjects.filter(subject=>!hiddenCourseIds.includes(subject.courseId)).map(subject=>{
   const correction=corrections.get(subject.courseId)
   return correction?{...subject,course:{...subject.course,name:correction.courseName||subject.course.name},percentage:correction.percentage,letterGrade:letter(correction.percentage)}:subject
  })
  const attendanceSummary=card.attendanceSummary??missingAttendance.get(card.id)??null
  return {...card,attendanceSummary,student,subjects:correctedSubjects.map(subject=>({...subject,course:{...subject.course,teacherName:[subject.course.teacher.user.lastName,subject.course.teacher.user.middleName,subject.course.teacher.user.firstName].filter(Boolean).join(' ')}})),hiddenCourseIds}
 })
 res.setHeader('Cache-Control','private, no-store, no-cache, must-revalidate')
 return success(res,enriched)
}))

academicRecordsRouter.patch('/report-cards/:id/editorial',requireSuperAdmin(),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const id=getRouteParam(req.params.id)
 const payload=reportCardEditorialSchema.parse(req.body)
 if(payload.attendanceSummary)payload.attendanceSummary=normalizeAttendanceCorrection(payload.attendanceSummary)
 const actorId=await resolveAcademicActorId(req)
 const preview=await prisma.reportCard.findUnique({where:{id},select:{term:true}})
 if(!preview)throw new ApiError(404,'Report card not found')
 const lockedCycle=splitReportCardTerm(preview.term)
 await academicPeriodAccess()
 const card=await prisma.$transaction(async tx=>{
  await protectAcademicPeriod(tx,lockedCycle.academicYear,lockedCycle.term)
  const current=await lockedReportCard(tx,id)
  const previous={teacherComment:current.teacherComment,conduct:current.conduct,average:current.average,attendanceSummary:current.attendanceSummary,academicCorrections:current.academicCorrections,publicationStatus:current.publicationStatus}
 const parsedCycle=splitReportCardTerm(current.term)
 const sourcePeriods=reportCardSourcePeriods(parsedCycle.academicYear,parsedCycle.term)
 const officialSources=await tx.grade.findMany({where:{studentId:current.studentId,assignmentId:null,period:{in:sourcePeriods}},include:{course:{select:{credits:true}}}})
 const officialCourseIds=new Set(officialSources.map(item=>item.courseId))
 if(payload.subjects.some(item=>!officialCourseIds.has(item.courseId)))throw new ApiError(400,'A corrected subject is not part of this learner report card')
 const sourceResults=aggregateReportCardResults(officialSources,parsedCycle.academicYear,parsedCycle.term)
 const previousCorrections=correctionMap(current.academicCorrections)
 for(const subject of payload.subjects)previousCorrections.set(subject.courseId,{...previousCorrections.get(subject.courseId),...subject,percentage:Number(subject.percentage.toFixed(2)),letterGrade:letter(subject.percentage)})
 const correctedSubjects=[...previousCorrections.values()]
 const hidden=new Set(academicCorrections(current.academicCorrections).hiddenCourseIds??[])
 const visible=[...sourceResults.values()].filter(item=>item.percentage!==null&&!hidden.has(item.courseId))
 const totalWeight=visible.reduce((sum,item)=>sum+Math.max(1,officialSources.find(row=>row.courseId===item.courseId)?.course.credits||1),0)
 const officialAverage=totalWeight?Number((visible.reduce((sum,item)=>sum+(previousCorrections.get(item.courseId)?.percentage??item.percentage!)*Math.max(1,officialSources.find(row=>row.courseId===item.courseId)?.course.credits||1),0)/totalWeight).toFixed(2)):0
  const requiresReapproval=['APPROVED','POSTED_TO_PORTAL','EMAILED'].includes(current.publicationStatus)
  const updated=await tx.reportCard.update({where:{id},data:{
   teacherComment:payload.teacherComment||null,conduct:payload.conduct||null,average:officialAverage,attendanceSummary:payload.attendanceSummary as any,
   academicCorrections:{...academicCorrections(current.academicCorrections),subjects:correctedSubjects,correctedBy:actorId,correctedAt:new Date().toISOString()} as any,
   ...(requiresReapproval?{principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW' as const,approvedById:null,approvedAt:null,emailedAt:null,portalPostedAt:null}:{}),
  }})
  await tx.auditLog.create({data:{actorId,action:'SUPERADMIN_REPORT_CARD_FULL_CORRECTION',targetType:'ReportCard',targetId:id,metadata:{previous,next:{...payload,average:officialAverage,subjects:correctedSubjects},averageRule:'credit-weighted visible course results',requiresReapproval,term:current.term,studentId:current.studentId}}})
  return updated
 },{maxWait:10000,timeout:60000})
 return success(res,card,'Report-card academic and presentation fields updated and audited')
}))

academicRecordsRouter.get('/report-cards/official-settings',requireSuperAdmin(),asyncHandler(async(_req,res)=>{
 const latest=await prisma.auditLog.findFirst({where:{action:'REPORT_CARD_OFFICIALIZATION_SETTINGS',targetType:'ReportCardSettings',targetId:'global'},orderBy:{createdAt:'desc'},select:{metadata:true}})
 const account=await prisma.user.findUnique({where:{email:process.env.SUPERADMIN_EMAIL||'superadmin@kcsnexus.com'},select:{signatureImage:true,officialSealImage:true}})
 const metadata=(latest?.metadata??{}) as Record<string,unknown>
 return success(res,{principalName:String(metadata.principalName??''),signatureImage:typeof metadata.signatureImage==='string'?metadata.signatureImage:account?.signatureImage??'',officialSealImage:typeof metadata.officialSealImage==='string'?metadata.officialSealImage:account?.officialSealImage??''})
}))

academicRecordsRouter.put('/report-cards/official-settings',requireSuperAdmin(),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=reportCardOfficialSettingsSchema.parse(req.body)
 const actorId=await resolveAcademicActorId(req)
 if(!actorId)throw new ApiError(403,'A configured Super Administrator account is required to save official assets')
 await prisma.$transaction(async tx=>{
  await tx.auditLog.create({data:{actorId,action:'REPORT_CARD_OFFICIALIZATION_SETTINGS',targetType:'ReportCardSettings',targetId:'global',metadata:{principalName:payload.principalName,signatureImage:payload.signatureImage,officialSealImage:payload.officialSealImage,hasSignature:Boolean(payload.signatureImage),hasSeal:Boolean(payload.officialSealImage)}}})
 })
 return success(res,payload,'Official report-card signature, principal name, and school seal saved')
}))

academicRecordsRouter.post('/report-cards/deliver',requireSuperAdmin(),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=z.object({requestId:z.string().min(8).max(128).optional(),language:z.enum(['fr','en']).default('en'),deliveries:z.array(z.object({reportCardId:z.string().min(1),parentIds:z.array(z.string().min(1)).min(1).max(10)})).min(1).max(250)}).parse(req.body)
 const actorId=await resolveAcademicActorId(req)
 if(!actorId)throw new ApiError(403,'The report-card delivery identity is unavailable')
 const batchId='report-card-delivery-'+createHash('sha256').update(actorId+':'+(payload.requestId??randomUUID())).digest('hex')
 const requestHash=createHash('sha256').update(JSON.stringify({language:payload.language,deliveries:payload.deliveries.map(item=>({reportCardId:item.reportCardId,parentIds:[...new Set(item.parentIds)].sort()})).sort((a,b)=>a.reportCardId.localeCompare(b.reportCardId))})).digest('hex')
 const previous=await prisma.auditLog.findUnique({where:{id:batchId},select:{metadata:true}})
 if(previous){
  const data=previous.metadata as {requestHash:string;reportCards:number;recipients:number}
  if(data.requestHash!==requestHash)throw new ApiError(409,'The delivery request was reused with different recipients')
  return success(res,{reportCards:data.reportCards,recipients:data.recipients},'Previously queued report-card delivery confirmed')
 }
 const settingsRow=await prisma.auditLog.findFirst({where:{action:'REPORT_CARD_OFFICIALIZATION_SETTINGS',targetType:'ReportCardSettings',targetId:'global'},orderBy:{createdAt:'desc'},select:{metadata:true}})
 const officialSettings=(settingsRow?.metadata??{}) as {principalName?:string;signatureImage?:string;officialSealImage?:string}
 const officialAccount=await prisma.user.findUnique({where:{email:process.env.SUPERADMIN_EMAIL||'superadmin@kcsnexus.com'},select:{signatureImage:true,officialSealImage:true}})
 const deliveryByCard=new Map<string,{reportCardId:string;parentIds:string[]}>()
 for(const item of payload.deliveries){const old=deliveryByCard.get(item.reportCardId);deliveryByCard.set(item.reportCardId,{reportCardId:item.reportCardId,parentIds:[...new Set([...(old?.parentIds??[]),...item.parentIds])]})}
 const uniqueDeliveries=[...deliveryByCard.values()]
 const cards=await prisma.reportCard.findMany({where:{id:{in:uniqueDeliveries.map(item=>item.reportCardId)}},include:{student:{select:{id:true,studentNumber:true,officialAvatar:true,grade:true,section:true,user:{select:{firstName:true,middleName:true,lastName:true,orbitUserId:true}},parentLinks:{include:{parent:{select:{id:true,firstName:true,middleName:true,lastName:true,email:true,phone:true}}}}}}}})
 if(cards.length!==uniqueDeliveries.length)throw new ApiError(404,'One or more selected report cards no longer exist')
 const invalid=cards.filter(card=>!['APPROVED','POSTED_TO_PORTAL','EMAILED'].includes(card.publicationStatus))
 if(invalid.length)throw new ApiError(409,'Only approved report cards may be sent to parents')
 for(const card of cards){
  const request=deliveryByCard.get(card.id)!
  const linked=new Set(card.student.parentLinks.map(link=>link.parentId))
  if(request.parentIds.some(id=>!linked.has(id)))throw new ApiError(409,'Every selected recipient must be a linked parent of the selected learner')
 }
 const mainTeachers=await prisma.teacherProfile.findMany({where:{status:'HOMEROOM_TEACHER'},select:{status:true,homeroomGrade:true,homeroomSection:true,user:{select:{firstName:true,middleName:true,lastName:true,signatureImage:true}}}})
 const missingAttendance = await reportCardAttendanceSummaries(cards)
 const pdfByCard=new Map<string,Awaited<ReturnType<typeof officialReportCardPdf>>>()
 for(const card of cards){
  const parsed=splitReportCardTerm(card.term)
  const sourcePeriods=reportCardSourcePeriods(parsed.academicYear,parsed.term)
  const source=await prisma.grade.findMany({where:{studentId:card.studentId,assignmentId:null,period:{in:sourcePeriods}},include:{course:{select:{id:true,name:true,code:true,credits:true,teacher:{select:{user:{select:{firstName:true,middleName:true,lastName:true}}}}}}},orderBy:{createdAt:'desc'}})
  const aggregated=aggregateReportCardResults(source,parsed.academicYear,parsed.term)
  const correction=academicCorrections(card.academicCorrections)
  const override=correctionMap(card.academicCorrections)
  const hidden=new Set(correction.hiddenCourseIds??[])
  const latestCourse=new Map<string,typeof source[number]['course']>()
  for(const grade of source)if(!latestCourse.has(grade.courseId))latestCourse.set(grade.courseId,grade.course)
  const subjects=[...aggregated.values()].flatMap(item=>{
   if(item.percentage===null||hidden.has(item.courseId))return[]
   const course=latestCourse.get(item.courseId);if(!course)return[]
   const corrected=override.get(item.courseId)
   const percentage=corrected?.percentage??item.percentage
   const name=corrected?.courseName||course.name
   const teacherName=[course.teacher.user.lastName,course.teacher.user.middleName,course.teacher.user.firstName].filter(Boolean).join(' ')
   return[{name,teacherName,code:course.code,credits:course.credits,percentage,letterGrade:letter(percentage),termResults:item.termResults}]
  })
  const learner=[card.student.user.lastName,card.student.user.middleName,card.student.user.firstName].filter(Boolean).join(' ')
  const mainTeacher=mainTeachers.find(teacher=>isTeacherHomeroomForStudent(teacher,card.student))
  const pdf=await officialReportCardPdf({id:card.id,studentPhoto:await officialStudentPortrait(card.student),studentName:learner,studentNumber:card.student.studentNumber,grade:[card.student.grade,card.student.section].filter(Boolean).join(' '),term:card.term,average:card.average,publicationStatus:card.publicationStatus,subjects,teacherComment:card.teacherComment,conduct:card.conduct,attendance:(card.attendanceSummary??missingAttendance.get(card.id)) as any,language:payload.language,mainTeacher:mainTeacher?{name:[mainTeacher.user.lastName,mainTeacher.user.middleName,mainTeacher.user.firstName].filter(Boolean).join(' '),image:mainTeacher.user.signatureImage}:null,principal:{name:officialSettings.principalName||'Principal',image:officialSettings.signatureImage??officialAccount?.signatureImage},seal:officialSettings.officialSealImage??officialAccount?.officialSealImage})
  pdfByCard.set(card.id,pdf)
 }
 let recipients=0
 try{await prisma.$transaction(async tx=>{
  await tx.auditLog.create({data:{id:batchId,actorId,action:'REPORT_CARD_DELIVERY_BATCH',targetType:'ReportCardBatch',metadata:{requestHash,reportCards:cards.length,recipients:uniqueDeliveries.reduce((sum,item)=>sum+item.parentIds.length,0)}}})
  for(const card of cards){
   const current=await lockedReportCard(tx,card.id)
   if(current.updatedAt.getTime()!==card.updatedAt.getTime()||!['APPROVED','POSTED_TO_PORTAL','EMAILED'].includes(current.publicationStatus))throw new ApiError(409,'A selected report card changed while its PDF was being prepared. Reload it before sending.')
   const request=uniqueDeliveries.find(item=>item.reportCardId===card.id)!
   const linked=card.student.parentLinks.filter(link=>!request.parentIds.length||request.parentIds.includes(link.parentId))
   if(!linked.length)throw new ApiError(409,`No selected parent is linked to ${card.student.studentNumber}`)
   const learner=[card.student.user.lastName,card.student.user.middleName,card.student.user.firstName].filter(Boolean).join(' ')
   const subject=payload.language==='fr'?`KCS · Bulletin scolaire officiel · ${learner} · ${card.term}`:`KCS · Official report card · ${learner} · ${card.term}`
   const body=payload.language==='fr'?`Bonjour,\n\nVeuillez trouver en pièce jointe le bulletin officiel de ${learner} (${card.student.studentNumber}) pour ${card.term}. Moyenne officielle : ${card.average.toFixed(2)} %.\n\nLe document comporte un code QR permettant de vérifier son authenticité auprès du registre KCS Nexus.\n\nCordialement,\nKinshasa Christian School`:`Dear Parent/Guardian,\n\nPlease find attached the official report card for ${learner} (${card.student.studentNumber}) for ${card.term}. Official average: ${card.average.toFixed(2)}%.\n\nThe document includes a QR code to verify its authenticity in the KCS Nexus register.\n\nSincerely,\nKinshasa Christian School`
   const pdf=pdfByCard.get(card.id)!
   const attachment=await tx.messageAttachment.create({data:{name:pdf.documentId+'.pdf',mime:'application/pdf',size:pdf.buffer.length,data:pdf.buffer},select:{id:true}})
   const ids=new Map(linked.map(({parent})=>[parent.id,randomUUID()]))
   await tx.internalMessage.createMany({data:linked.map(({parent})=>({id:ids.get(parent.id)!,senderId:actorId,recipientId:parent.id,subject,body,priority:'high',attachmentName:pdf.documentId+'.pdf',attachmentMime:'application/pdf',attachmentSize:pdf.buffer.length,sharedAttachmentId:attachment.id}))})
   await tx.notification.createMany({data:linked.map(({parent})=>({userId:parent.id,title:subject,message:body,type:'MESSAGE',link:'/portal/parent/grades'}))})
   await tx.correspondenceLog.createMany({data:linked.map(({parent})=>({channel:'EMAIL',status:parent.email?'QUEUED':'FAILED',subject,body,senderId:actorId,recipientName:[parent.lastName,parent.middleName,parent.firstName].filter(Boolean).join(' '),recipientEmail:parent.email,recipientPhone:parent.phone,studentId:card.studentId,reportCardId:card.id,failureReason:parent.email?null:'RECIPIENT_EMAIL_MISSING',metadata:{mailQueueVersion:1,internalMessageId:ids.get(parent.id)!,recipientId:parent.id,attempts:0,nextAttemptAt:new Date().toISOString(),priority:'HIGH',language:payload.language}}))})
   recipients+=linked.length
   await tx.reportCard.update({where:{id:card.id},data:{publicationStatus:'EMAILED',emailedAt:new Date(),portalPostedAt:card.portalPostedAt??new Date()}})
   await tx.auditLog.create({data:{actorId,action:'REPORT_CARD_VERIFICATION_ISSUED',targetType:'OfficialReportCard',targetId:pdf.documentId,metadata:{fingerprint:pdf.fingerprint,reportCardId:card.id,studentId:card.studentId,publicationStatus:'EMAILED',approvedAt:card.approvedAt?.toISOString()??null}}})
   await tx.auditLog.create({data:{actorId,action:'REPORT_CARD_DELIVERY_QUEUED',targetType:'ReportCard',targetId:card.id,metadata:{studentId:card.studentId,parentIds:linked.map(item=>item.parentId),term:card.term,documentId:pdf.documentId,language:payload.language}}})
  }
 },{maxWait:10000,timeout:60000})}catch(error){
  if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'){
   const replay=await prisma.auditLog.findUnique({where:{id:batchId},select:{metadata:true}})
   const data=replay?.metadata as {requestHash?:string;reportCards?:number;recipients?:number}|undefined
   if(data?.requestHash===requestHash)return success(res,{reportCards:data.reportCards,recipients:data.recipients},'Previously queued report-card delivery confirmed')
  }
  throw error
 }
 return success(res,{reportCards:cards.length,recipients},'Official report cards published to parent dashboards and email delivery safely queued')
}))

academicRecordsRouter.patch('/report-cards/:id/approve',requireRoles('admin'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const id=getRouteParam(req.params.id)
 const actorId=await resolveAcademicActorId(req)
 if(!actorId)throw new ApiError(403,'The approval identity is unavailable')
 const card=await prisma.$transaction(async tx=>{
  const current=await lockedReportCard(tx,id)
  if(['APPROVED','EMAILED','POSTED_TO_PORTAL'].includes(current.publicationStatus))return current
  const parts=current.term.split(' · ');const academicYear=parts[0],term=parts.slice(1).join(' · ')
  const parsedCycle=splitReportCardTerm(current.term)
  const submittedPeriods=reportCardSourcePeriods(parsedCycle.academicYear,parsedCycle.term),approved=periodKey(parsedCycle.academicYear,parsedCycle.term,'APPROVED')
  const source=await tx.grade.findMany({where:{studentId:current.studentId,assignmentId:null,period:{in:submittedPeriods}},orderBy:{createdAt:'desc'}})
  if(!source.length)throw new ApiError(409,'The report card has no submitted source grades')
  const aggregated=aggregateReportCardResults(source,parsedCycle.academicYear,parsedCycle.term)
  const correctionState=academicCorrections(current.academicCorrections)
  const corrections=correctionMap(current.academicCorrections)
  const hiddenCourseIds=new Set(correctionState.hiddenCourseIds??[])
  const frozen=[...aggregated.values()].filter((item):item is typeof item&{percentage:number}=>item.percentage!==null&&!hiddenCourseIds.has(item.courseId)).map(item=>{
   const correction=corrections.get(item.courseId)
   return correction?{...item,percentage:correction.percentage}:item
  })
  if([...aggregated.values()].some(item=>item.percentage===null&&!hiddenCourseIds.has(item.courseId)))throw new ApiError(409,'Every required quarter must be submitted for each visible course before approval')
  if(!frozen.length)throw new ApiError(409,'No available course results can be approved for this report card')
  await tx.grade.deleteMany({where:{studentId:current.studentId,assignmentId:null,period:approved}})
  for(const grade of frozen)await tx.grade.create({data:{studentId:grade.studentId,courseId:grade.courseId,assignmentId:null,score:grade.percentage,maxScore:100,percentage:grade.percentage,letterGrade:letter(grade.percentage),period:approved}})
  await synchronizeStudentAcademicMetrics(tx,[current.studentId])
  const updated=await tx.reportCard.update({where:{id},data:{principalStatus:'APPROVED',publicationStatus:'APPROVED',approvedById:actorId,approvedAt:new Date()}})
  await tx.auditLog.create({data:{actorId,action:'REPORT_CARD_APPROVED',targetType:'ReportCard',targetId:id,metadata:{previousStatus:current.publicationStatus,academicYear,term,hiddenCourseIds:[...hiddenCourseIds],sourceGrades:source.map(x=>({courseId:x.courseId,percentage:x.percentage,letterGrade:x.letterGrade})),frozenGrades:frozen.map(x=>({courseId:x.courseId,percentage:x.percentage,letterGrade:letter(x.percentage)})),superAdminCorrectionsApplied:corrections.size}}})
  return updated
 },{maxWait:10000,timeout:60000})
 return success(res,card,'Report card approved and official grades frozen')
}))

academicRecordsRouter.patch('/report-cards/:id/publish',requireRoles('admin','staff'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const id=getRouteParam(req.params.id)
 const card=await prisma.$transaction(async tx=>{
  const current=await tx.reportCard.findUnique({where:{id}});if(!current)throw new ApiError(404,'Report card not found')
  if(current.publicationStatus!=='APPROVED')throw new ApiError(409,'Only an approved report card may be published')
  const updated=await tx.reportCard.update({where:{id},data:{publicationStatus:'POSTED_TO_PORTAL',portalPostedAt:new Date()}})
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'REPORT_CARD_PUBLISHED',targetType:'ReportCard',targetId:id,metadata:{term:current.term,studentId:current.studentId}}})
  return updated
 })
 return success(res,card,'Approved report card published to the portal')
}))

academicRecordsRouter.patch('/transcripts/:studentId/visibility', requireSuperAdmin(), asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const studentId=getRouteParam(req.params.studentId)
 const visible=z.object({visible:z.boolean()}).parse(req.body).visible
 const student=await prisma.studentProfile.update({where:{id:studentId},data:{transcriptVisible:visible},select:{id:true,studentNumber:true,transcriptVisible:true}}).catch(()=>null)
 if(!student)throw new ApiError(404,'Student not found')
 const actorId=req.user!.sub==='configured-superadmin'?(await prisma.user.findUnique({where:{email:process.env.SUPERADMIN_EMAIL||'superadmin@kcsnexus.com'},select:{id:true}}))?.id:req.user!.sub
 await prisma.auditLog.create({data:{actorId:actorId||null,action:visible?'STUDENT_TRANSCRIPT_ACCESS_GRANTED':'STUDENT_TRANSCRIPT_ACCESS_REVOKED',targetType:'StudentProfile',targetId:studentId,metadata:{studentNumber:student.studentNumber}}})
 return success(res,student,visible?'Student transcript access granted':'Student transcript access revoked')
}))

academicRecordsRouter.get('/transcripts/:studentId',requireRoles('admin','staff','teacher','student','parent'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const studentId=getRouteParam(req.params.studentId)
 const student=await prisma.studentProfile.findUnique({where:{id:studentId},include:{user:true}});if(!student)throw new ApiError(404,'Student not found')
 if(req.user!.role==='student'){const own=await prisma.studentProfile.findUnique({where:{userId:req.user!.sub},select:{id:true}});if(own?.id!==studentId)throw new ApiError(403,'Transcript access denied');if(!student.transcriptVisible)throw new ApiError(403,'Le relevé de notes n’est pas encore autorisé par la Super Administration.')}
 if(req.user!.role==='parent'){const link=await prisma.parentStudentLink.findUnique({where:{parentId_studentId:{parentId:req.user!.sub,studentId}}});if(!link)throw new ApiError(403,'Transcript access denied');if(!student.transcriptVisible)throw new ApiError(403,'Le relevé de notes n’est pas encore autorisé par la Super Administration.');const clearance=await getParentAcademicClearance(req.user!.sub);if(!clearance.allowed)throw new ApiError(402,clearance.reason)}
 const [grades,legacy]=await Promise.all([
  prisma.grade.findMany({where:{studentId,assignmentId:null,period:{endsWith:'::APPROVED'}},include:{course:true},orderBy:{period:'asc'}}),
  prisma.legacyTranscriptRecord.findMany({where:{studentId,verificationStatus:'VERIFIED'},orderBy:[{academicYear:'asc'},{term:'asc'},{courseCode:'asc'}]})
 ])
 const currentRows=grades.map(item=>({...item,cycle:parsePeriod(item.period),credits:item.course.credits,qualityPoints:(item.percentage>=90?4:item.percentage>=80?3:item.percentage>=70?2:item.percentage>=60?1:0)*item.course.credits,source:'NEXUS_APPROVED'}))
 const legacyRows=legacy.map(item=>({id:item.id,studentId:item.studentId,percentage:item.percentage,letterGrade:item.letterGrade,cycle:{academicYear:item.academicYear,term:item.term,status:'VERIFIED_LEGACY'},credits:item.credits,qualityPoints:(item.percentage>=90?4:item.percentage>=80?3:item.percentage>=70?2:item.percentage>=60?1:0)*item.credits,course:{id:'legacy-'+item.id,code:item.courseCode,name:item.courseName,credits:item.credits},source:'QUICKSCHOOLS_VERIFIED',gradeLevel:item.gradeLevel,sourceSchool:item.sourceSchool,sourceDocument:item.sourceDocument}))
 const rows=[...legacyRows,...currentRows].sort((left,right)=>left.cycle.academicYear.localeCompare(right.cycle.academicYear)||left.cycle.term.localeCompare(right.cycle.term)||left.course.code.localeCompare(right.course.code))
 const credits=rows.reduce((sum,item)=>sum+item.credits,0),points=rows.reduce((sum,item)=>sum+item.qualityPoints,0)
 return success(res,{student:{id:student.id,studentNumber:student.studentNumber,name:[student.user.lastName,student.user.middleName,student.user.firstName].filter(Boolean).join(' '),grade:student.grade,photoUrl:await officialStudentPortrait(student),transcriptVisible:student.transcriptVisible},rows,summary:{credits,cumulativeGpa:credits?Number((points/credits).toFixed(2)):null,officialRecords:rows.length,legacyRecords:legacyRows.length},generatedAt:new Date().toISOString(),dataPolicy:rows.length?'APPROVED_AND_VERIFIED_LEGACY_RECORDS_ONLY':'NO_OFFICIAL_DATA'})
}))
