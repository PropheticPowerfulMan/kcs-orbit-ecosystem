import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { createHash } from 'node:crypto'
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

const submissionSchema=z.object({
 courseId:z.string().min(1),academicYear:z.string().regex(/^\d{4}-\d{4}$/),term:z.string().min(2).max(80),
 results:z.array(z.object({studentId:z.string().min(1),studentNumber:z.string().trim().min(1).max(100).optional(),percentage:z.number().min(0).max(100),comment:z.string().max(1000).optional()})).min(1)
})
const cycleSchema=z.object({academicYear:z.string().regex(/^\d{4}-\d{4}$/),term:z.string().min(2).max(80)})
const teacherReportDraftSchema=cycleSchema.extend({
 teacherComment:z.string().trim().max(1500).default(''),
 conduct:z.string().trim().max(500).default(''),
})
const letter=(value:number)=>value>=97?'A+':value>=93?'A':value>=90?'A-':value>=87?'B+':value>=83?'B':value>=80?'B-':value>=77?'C+':value>=73?'C':value>=70?'C-':value>=67?'D+':value>=63?'D':value>=60?'D-':'F'
const periodKey=(year:string,term:string,status:'SUBMITTED'|'APPROVED')=>`${year}::${term}::${status}`
const parsePeriod=(period:string)=>{const [academicYear,term,status]=period.split('::');return{academicYear,term,status}}

const attendanceWindow=(year:string,term:string)=>{const key=term.toLowerCase();if(year==='2026-2027'){if(key.includes('trimester 1'))return{gte:new Date('2026-09-07T00:00:00Z'),lte:new Date('2026-12-18T23:59:59Z')};if(key.includes('trimester 2'))return{gte:new Date('2027-01-05T00:00:00Z'),lte:new Date('2027-03-19T23:59:59Z')};if(key.includes('trimester 3'))return{gte:new Date('2027-04-05T00:00:00Z'),lte:new Date('2027-06-11T23:59:59Z')};if(key.includes('semester 1'))return{gte:new Date('2026-09-07T00:00:00Z'),lte:new Date('2027-01-29T23:59:59Z')};if(key.includes('semester 2'))return{gte:new Date('2027-02-01T00:00:00Z'),lte:new Date('2027-06-11T23:59:59Z')}}const [start,end]=year.split('-');return{gte:new Date(`${start}-08-01T00:00:00Z`),lte:new Date(`${end}-07-31T23:59:59Z`)}}
const summarizeAttendance=(records:Array<{status:string}>)=>{const count=(status:string)=>records.filter(item=>item.status===status).length;const attended=records.filter(item=>['PRESENT','LATE','EXCUSED'].includes(item.status)).length;return{total:records.length,present:count('PRESENT'),absent:count('ABSENT'),late:count('LATE'),excused:count('EXCUSED'),sick:count('SICK'),suspended:count('SUSPENDED'),attendanceRate:records.length?Number((attended*100/records.length).toFixed(1)):null}}
const reportCardTerm=(academicYear:string,term:string)=>`${academicYear} · ${term}`
const weightedCourseAverage=(grades:Array<{percentage:number;course:{credits:number}}>)=>{
 const credits=grades.reduce((sum,item)=>sum+Math.max(item.course.credits||1,1),0)
 return credits?Number((grades.reduce((sum,item)=>sum+(item.percentage*Math.max(item.course.credits||1,1)),0)/credits).toFixed(2)):0
}
const homeroomReportContext=async(userId:string,studentId:string,academicYear:string,term:string)=>{
 await ensureTeacherProfile(userId)
 const [teacher,student]=await Promise.all([
  prisma.teacherProfile.findUnique({where:{userId},select:{id:true,status:true,homeroomGrade:true,homeroomSection:true}}),
  prisma.studentProfile.findUnique({
   where:{id:studentId},
   include:{enrollments:{include:{course:true}},attendanceRecords:{where:{date:attendanceWindow(academicYear,term)},select:{status:true}}},
  }),
 ])
 if(!teacher)throw new ApiError(404,'Teacher profile synchronization pending')
 if(!student)throw new ApiError(404,'Student not found')
  if(!isTeacherHomeroomForStudent(teacher,student))throw new ApiError(403,'Only the assigned main teacher may edit or submit this learner report card')
 const submittedGrades=await prisma.grade.findMany({
  where:{studentId,courseId:{in:student.enrollments.map(item=>item.courseId)},assignmentId:null,period:periodKey(academicYear,term,'SUBMITTED')},
  include:{course:true},
  orderBy:{createdAt:'desc'},
 })
 const latestGradeByCourse=new Map<string,(typeof submittedGrades)[number]>()
 for(const grade of submittedGrades)if(!latestGradeByCourse.has(grade.courseId))latestGradeByCourse.set(grade.courseId,grade)
 const uniqueEnrollments=[...student.enrollments.reduce((bySubject,enrollment)=>{
  const subjectKey=[enrollment.course.name,enrollment.course.grade,enrollment.course.teacherId].join('|').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()
  const current=bySubject.get(subjectKey)
  const currentGrade=current?latestGradeByCourse.get(current.courseId):null
  const candidateGrade=latestGradeByCourse.get(enrollment.courseId)
  if(!current||(!currentGrade&&candidateGrade))bySubject.set(subjectKey,enrollment)
  return bySubject
 },new Map<string,(typeof student.enrollments)[number]>()).values()]
 const grades=uniqueEnrollments.map(item=>latestGradeByCourse.get(item.courseId)).filter((item):item is (typeof submittedGrades)[number]=>Boolean(item))
 return{teacher,student,enrollments:uniqueEnrollments,grades,average:weightedCourseAverage(grades),attendanceSummary:summarizeAttendance(student.attendanceRecords)}
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

academicRecordsRouter.get('/report-cards/verify', asyncHandler(async (req, res) => {
 const documentId = z.string().regex(new RegExp('^KCS-RC-[0-9]{8}-[A-Z0-9-]+$','i')).parse(req.query.document)
 const fingerprint = z.string().regex(/^[A-F0-9]{64}$/i).parse(req.query.fingerprint)
 const record = await prisma.auditLog.findFirst({ where: { action: 'REPORT_CARD_VERIFICATION_ISSUED', targetType: 'OfficialReportCard', targetId: documentId }, orderBy: { createdAt: 'desc' } })
 const metadata = (record?.metadata ?? {}) as Record<string, unknown>
 if (!record || metadata.fingerprint !== fingerprint) throw new ApiError(404, 'Report-card authenticity record not found')
 return success(res, { valid: true, documentType: 'REPORT_CARD', documentId, publicationStatus: metadata.publicationStatus, issuedAt: record.createdAt }, 'Authentic KCS report card verified')
}))
academicRecordsRouter.use(authenticate)
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
  include: { user: { select: { id: true, firstName: true, middleName: true, lastName: true, avatar: true } } },
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
academicRecordsRouter.post('/final-grades/submit',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=submissionSchema.parse(req.body)
 const course=await prisma.course.findUnique({where:{id:payload.courseId},include:{teacher:true,enrollments:{select:{studentId:true,student:{select:{studentNumber:true,user:{select:{orbitUserId:true}}}}}}}})
 if(!course)throw new ApiError(404,'Course not found')
 if(course.teacher.userId!==req.user!.sub)throw new ApiError(403,'Only the assigned teacher may submit these grades')
 const enrollmentLookup=new Map<string,string>()
 for(const enrollment of course.enrollments){
  for(const key of [enrollment.studentId,enrollment.student.studentNumber,enrollment.student.user.orbitUserId]){
   if(key)enrollmentLookup.set(key.trim().toLowerCase(),enrollment.studentId)
  }
 }
 const canonicalResults=payload.results.map(item=>{
  const identityKeys=[item.studentId,item.studentNumber].filter((value):value is string=>Boolean(value?.trim()))
  const canonicalStudentId=identityKeys.map(key=>enrollmentLookup.get(key.trim().toLowerCase())).find(Boolean)
  return{...item,studentId:canonicalStudentId??item.studentId}
 })
 const enrolled=new Set(course.enrollments.map(item=>item.studentId))
 const unmatched=canonicalResults.filter(item=>!enrolled.has(item.studentId))
 if(unmatched.length)throw new ApiError(400,`A submitted student could not be matched to the official Nexus course enrollment (${unmatched.slice(0,5).map(item=>item.studentNumber||item.studentId).join(', ')})`)
 if(new Set(canonicalResults.map(item=>item.studentId)).size!==canonicalResults.length)throw new ApiError(400,'Duplicate student in submission after identity reconciliation')
 const lockedCards=await prisma.reportCard.count({where:{studentId:{in:canonicalResults.map(item=>item.studentId)},term:reportCardTerm(payload.academicYear,payload.term),publicationStatus:{in:['APPROVED','EMAILED','POSTED_TO_PORTAL']}}})
 if(lockedCards)throw new ApiError(409,'An approved or published report card is frozen. The Super Administration must reopen it before grades can change')
 const period=periodKey(payload.academicYear,payload.term,'SUBMITTED')
 const saved=await prisma.$transaction(async tx=>{
  await tx.grade.deleteMany({where:{courseId:course.id,assignmentId:null,period}})
  const created=[]
  for(const item of canonicalResults)created.push(await tx.grade.create({data:{courseId:course.id,studentId:item.studentId,assignmentId:null,score:item.percentage,maxScore:100,percentage:item.percentage,letterGrade:letter(item.percentage),period}}))
  const termLabel=reportCardTerm(payload.academicYear,payload.term)
  const draftCards=[]
  for(const item of canonicalResults){
   const submittedGrades=await tx.grade.findMany({where:{studentId:item.studentId,assignmentId:null,period},include:{course:{select:{credits:true}}}})
   const average=weightedCourseAverage(submittedGrades)
   draftCards.push(await tx.reportCard.upsert({
    where:{studentId_term:{studentId:item.studentId,term:termLabel}},
    create:{studentId:item.studentId,term:termLabel,average,principalStatus:'DRAFT',publicationStatus:'DRAFT'},
    update:{average,principalStatus:'DRAFT',publicationStatus:'DRAFT',approvedById:null,approvedAt:null,portalPostedAt:null,emailedAt:null},
   }))
  }
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'FINAL_GRADES_SUBMITTED',targetType:'Course',targetId:course.id,metadata:{academicYear:payload.academicYear,term:payload.term,count:created.length,reportCardDraftsUpdated:draftCards.length,results:canonicalResults}}})
  await synchronizeStudentAcademicMetrics(tx,canonicalResults.map(item=>item.studentId))
  return{created,draftCards}
 })
 return success(res,{course:{id:course.id,name:course.name,code:course.code},academicYear:payload.academicYear,term:payload.term,count:saved.created.length,reportCardDraftsUpdated:saved.draftCards.length},'Final grades submitted and propagated to report-card drafts',201)
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
   user:{select:{firstName:true,lastName:true}},
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
 const submittedPeriod=periodKey(cycle.academicYear,cycle.term,'SUBMITTED')
 const window=attendanceWindow(cycle.academicYear,cycle.term)

 const [students,submittedGrades]=scopedStudentIds.length?await Promise.all([
  prisma.studentProfile.findMany({
   where:{id:{in:scopedStudentIds},status:{equals:'active',mode:'insensitive'}},
   select:{
    id:true,studentNumber:true,grade:true,section:true,
    user:{select:{firstName:true,middleName:true,lastName:true}},
    enrollments:{select:{course:{select:{id:true,name:true,code:true,grade:true,credits:true,teacher:{select:{user:{select:{firstName:true,lastName:true}}}}}}}},
    reportCards:{where:{term:termLabel},take:1},
    attendanceRecords:{where:{date:window},select:{status:true}},
   },
   orderBy:[{grade:'asc'},{section:'asc'},{user:{lastName:'asc'}}],
  }),
  prisma.grade.findMany({
   where:{studentId:{in:scopedStudentIds},assignmentId:null,period:submittedPeriod},
   select:{id:true,studentId:true,courseId:true,percentage:true,letterGrade:true,createdAt:true,course:{select:{id:true,name:true,code:true,credits:true,teacher:{select:{user:{select:{firstName:true,lastName:true}}}}}}},
   orderBy:{createdAt:'desc'},
  }),
 ]):[[],[]]

 const gradeByEnrollment=new Map<string,(typeof submittedGrades)[number]>()
 for(const item of submittedGrades){
  const key=item.studentId+':'+item.courseId
  if(!gradeByEnrollment.has(key))gradeByEnrollment.set(key,item)
 }
 const learners=students.map(student=>{
  const uniqueEnrollments=[...student.enrollments.reduce((bySubject,enrollment)=>{
   const subjectKey=[
    enrollment.course.name,
    enrollment.course.grade,
    enrollment.course.teacher.user.lastName,
    enrollment.course.teacher.user.firstName,
   ].join('|').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()
   const current=bySubject.get(subjectKey)
   const currentGrade=current?gradeByEnrollment.get(student.id+':'+current.course.id):null
   const candidateGrade=gradeByEnrollment.get(student.id+':'+enrollment.course.id)
   if(!current||(!currentGrade&&candidateGrade))bySubject.set(subjectKey,enrollment)
   return bySubject
  },new Map<string,(typeof student.enrollments)[number]>()).values()]
  const subjects=uniqueEnrollments.map(enrollment=>{
   const grade=gradeByEnrollment.get(student.id+':'+enrollment.course.id)
   return{
    courseId:enrollment.course.id,
    courseName:enrollment.course.name,
    courseCode:enrollment.course.code,
    credits:enrollment.course.credits,
    teacherName:[enrollment.course.teacher.user.lastName,enrollment.course.teacher.user.firstName].filter(Boolean).join(' '),
    percentage:grade?.percentage??null,
    letterGrade:grade?.letterGrade??null,
    submittedAt:grade?.createdAt??null,
   }
  })
  const submitted=subjects.filter(subject=>subject.percentage!==null)
  const weightedGrades=uniqueEnrollments.flatMap(enrollment=>{
   const grade=gradeByEnrollment.get(student.id+':'+enrollment.course.id)
   return grade?[grade]:[]
  })
  const reportCard=student.reportCards[0]??null
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
   expectedSubjectCount:subjects.length,
   submittedSubjectCount:submitted.length,
   allSubjectsSubmitted:subjects.length>0&&submitted.length===subjects.length,
   average:weightedGrades.length?weightedCourseAverage(weightedGrades):null,
   attendance:summarizeAttendance(student.attendanceRecords),
   reportCard,
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

academicRecordsRouter.get('/report-cards/student-photo/:studentId',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const studentId=getRouteParam(req.params.studentId)
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
   select:{id:true,grade:true,section:true,officialAvatar:true,user:{select:{avatar:true}}},
  }),
 ])
 if(!teacher)throw new ApiError(404,'Teacher profile synchronization pending')
 if(!student)throw new ApiError(404,'Student not found')
 const allowed=isTeacherHomeroomForStudent(teacher,student)||teacher.courses.length>0
 if(!allowed)throw new ApiError(403,'This learner is outside the assigned teacher scope')
 res.setHeader('Cache-Control','private, max-age=300')
 return success(res,{officialAvatar:student.officialAvatar,avatar:student.user.avatar},'Official learner portrait loaded')
}))
academicRecordsRouter.put('/report-cards/teacher-draft/:studentId',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const studentId=getRouteParam(req.params.studentId)
 const payload=teacherReportDraftSchema.parse(req.body)
 const context=await homeroomReportContext(req.user!.sub,studentId,payload.academicYear,payload.term)
 const termLabel=reportCardTerm(payload.academicYear,payload.term)
 const current=await prisma.reportCard.findUnique({where:{studentId_term:{studentId,term:termLabel}}})
 if(current&&['APPROVED','EMAILED','POSTED_TO_PORTAL'].includes(current.publicationStatus))throw new ApiError(409,'This report card is approved or published and is now read-only for the main teacher')
 const card=await prisma.$transaction(async tx=>{
  const saved=await tx.reportCard.upsert({
   where:{studentId_term:{studentId,term:termLabel}},
   create:{studentId,term:termLabel,average:context.average,teacherComment:payload.teacherComment,conduct:payload.conduct,attendanceSummary:context.attendanceSummary,principalStatus:'DRAFT',publicationStatus:'DRAFT'},
   update:{average:context.average,teacherComment:payload.teacherComment,conduct:payload.conduct,attendanceSummary:context.attendanceSummary,principalStatus:'DRAFT',publicationStatus:'DRAFT',approvedById:null,approvedAt:null,portalPostedAt:null,emailedAt:null},
  })
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'MAIN_TEACHER_REPORT_CARD_DRAFT_SAVED',targetType:'ReportCard',targetId:saved.id,metadata:{studentId,academicYear:payload.academicYear,term:payload.term,submittedCourseGrades:context.grades.length,withdrawnPreviousSubmission:current?.publicationStatus==='READY_FOR_REVIEW'}}})
  return saved
 })
 return success(res,card,'Main-teacher report-card draft saved')
}))

academicRecordsRouter.post('/report-cards/teacher-submit/:studentId',requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const studentId=getRouteParam(req.params.studentId)
 const payload=teacherReportDraftSchema.parse(req.body)
 if(payload.teacherComment.length<5)throw new ApiError(400,'Add the main teacher comment before submitting the report card')
 const context=await homeroomReportContext(req.user!.sub,studentId,payload.academicYear,payload.term)
 const expectedCourseIds=[...new Set(context.enrollments.map(item=>item.courseId))]
 const submittedCourseIds=new Set(context.grades.map(item=>item.courseId))
 const missingCourseIds=expectedCourseIds.filter(courseId=>!submittedCourseIds.has(courseId))
 if(!expectedCourseIds.length)throw new ApiError(409,'This learner has no official course enrollment')
 if(missingCourseIds.length){
  const missingCourses=context.enrollments.filter(item=>missingCourseIds.includes(item.courseId)).map(item=>item.course.code||item.course.name)
  throw new ApiError(409,`Submission blocked: final grades are still missing for ${missingCourses.join(', ')}`)
 }
 const termLabel=reportCardTerm(payload.academicYear,payload.term)
 const current=await prisma.reportCard.findUnique({where:{studentId_term:{studentId,term:termLabel}}})
 if(current&&['APPROVED','EMAILED','POSTED_TO_PORTAL'].includes(current.publicationStatus))throw new ApiError(409,'This report card is already approved or published and cannot be replaced without Super Administration review')
 const replacesPreviousSubmission=current?.publicationStatus==='READY_FOR_REVIEW'
 const result=await prisma.$transaction(async tx=>{
  const saved=await tx.reportCard.upsert({
   where:{studentId_term:{studentId,term:termLabel}},
   create:{studentId,term:termLabel,average:context.average,teacherComment:payload.teacherComment,conduct:payload.conduct,attendanceSummary:context.attendanceSummary,principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW'},
   update:{average:context.average,teacherComment:payload.teacherComment,conduct:payload.conduct,attendanceSummary:context.attendanceSummary,principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW',approvedById:null,approvedAt:null,portalPostedAt:null,emailedAt:null},
  })
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:replacesPreviousSubmission?'MAIN_TEACHER_REPORT_CARD_RESUBMITTED':'MAIN_TEACHER_REPORT_CARD_SUBMITTED',targetType:'ReportCard',targetId:saved.id,metadata:{studentId,academicYear:payload.academicYear,term:payload.term,replacesPreviousSubmission,courseGrades:context.grades.map(item=>({courseId:item.courseId,percentage:item.percentage,credits:item.course.credits}))}}})
  const recipients=await tx.user.findMany({where:{role:'ADMIN'},select:{id:true}})
  if(recipients.length)await tx.notification.createMany({data:recipients.map(({id:userId})=>({userId,title:replacesPreviousSubmission?'Updated report card ready for review':'Report card ready for review',message:`A main teacher ${replacesPreviousSubmission?'replaced the previous submission':'submitted the complete report card'} for ${context.student.studentNumber}.`,type:'INFO',link:'/portal/admin/transcripts'}))})
  return{saved,notified:recipients.length}
 })
  const confirmed=await prisma.reportCard.findUnique({where:{id:result.saved.id},select:{id:true,publicationStatus:true,principalStatus:true}})
  if(!confirmed||confirmed.publicationStatus!=='READY_FOR_REVIEW'||confirmed.principalStatus!=='READY_FOR_REVIEW')throw new ApiError(500,'The report card could not be confirmed in the Super Administration review queue')
  return success(res,{...result.saved,superAdministrationQueued:true,superAdministrationNotified:result.notified,replacesPreviousSubmission},replacesPreviousSubmission?'Previous submission replaced and updated report card sent to Super Administration':'Complete report card submitted to Super Administration')
}))

academicRecordsRouter.get('/review',requireRoles('admin','staff'),asyncHandler(async(req,res)=>{
 const academicYear=String(req.query.academicYear||''),term=String(req.query.term||''),status=String(req.query.status||'SUBMITTED')
 const where:any={assignmentId:null,period:academicYear?{startsWith:`${academicYear}::`,contains:`::${status}`}:{contains:`::${status}`}}
 const grades=await prisma.grade.findMany({
  where,
  include:{student:{include:{user:true}},course:{include:{teacher:{include:{user:true}}}}},
  orderBy:[{period:'desc'},{courseId:'asc'}],
 })
 const filtered=term?grades.filter(item=>parsePeriod(item.period).term===term):grades
 return success(res,filtered.map(item=>({...item,cycle:parsePeriod(item.period)})))
}))

academicRecordsRouter.post('/report-cards/generate',requireRoles('admin','staff'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const payload=cycleSchema.parse(req.body),submitted=periodKey(payload.academicYear,payload.term,'SUBMITTED')
 const grades=await prisma.grade.findMany({where:{assignmentId:null,period:submitted},include:{course:true,student:{include:{user:true}}}})
 if(!grades.length)throw new ApiError(400,'No submitted final grades exist for this cycle')
 const grouped=new Map<string,typeof grades>();for(const grade of grades)grouped.set(grade.studentId,[...(grouped.get(grade.studentId)||[]),grade])
 const window=attendanceWindow(payload.academicYear,payload.term)
 const attendanceRecords=await prisma.attendanceRecord.findMany({where:{studentId:{in:[...grouped.keys()]},date:window},select:{studentId:true,status:true}})
 const cards=await prisma.$transaction(async tx=>{
  const created=[]
  for(const [studentId,items] of grouped){const average=weightedCourseAverage(items);const attendanceSummary=summarizeAttendance(attendanceRecords.filter(item=>item.studentId===studentId));created.push(await tx.reportCard.upsert({where:{studentId_term:{studentId,term:reportCardTerm(payload.academicYear,payload.term)}},create:{studentId,term:reportCardTerm(payload.academicYear,payload.term),average,attendanceSummary,principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW'},update:{average,attendanceSummary,principalStatus:'READY_FOR_REVIEW',publicationStatus:'READY_FOR_REVIEW'}}))}
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'REPORT_CARDS_GENERATED',targetType:'ReportCardCycle',metadata:{...payload,count:created.length,sourceGradeCount:grades.length}}})
  return created
 })
 return success(res,{count:cards.length,cards},'Report cards generated from submitted grades')
}))

academicRecordsRouter.get('/report-cards',requireRoles('admin','staff'),asyncHandler(async(req,res)=>{
 const cards=await prisma.reportCard.findMany({
  where:req.query.status?{publicationStatus:String(req.query.status) as any}:{},
  include:{
   student:{
    include:{
     user:true,
     grades:{
      where:{assignmentId:null,period:{contains:'::SUBMITTED'}},
      include:{course:{select:{name:true,code:true,credits:true}}},
      orderBy:{createdAt:'desc'},
     },
    },
   },
   approvedBy:true,
  },
  orderBy:{updatedAt:'desc'},
 })
 const enriched=cards.map(card=>{
  const {grades,...student}=card.student
  const [academicYear,...termParts]=card.term.split(' · ')
  const expectedPeriod=periodKey(academicYear,termParts.join(' · '),'SUBMITTED')
  const byCourse=new Map<string,(typeof grades)[number]>()
  for(const grade of grades){
   if(grade.period===expectedPeriod&&!byCourse.has(grade.courseId))byCourse.set(grade.courseId,grade)
  }
  const subjects=[...byCourse.values()].sort((left,right)=>(left.course.code||left.course.name).localeCompare(right.course.code||right.course.name,'en',{numeric:true,sensitivity:'base'}))
  return {...card,student,subjects}
 })
 return success(res,enriched)
}))

academicRecordsRouter.patch('/report-cards/:id/approve',requireRoles('admin'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const id=getRouteParam(req.params.id)
 const card=await prisma.$transaction(async tx=>{
  const current=await tx.reportCard.findUnique({where:{id}});if(!current)throw new ApiError(404,'Report card not found')
  const parts=current.term.split(' · ');const academicYear=parts[0],term=parts.slice(1).join(' · ')
  const submitted=periodKey(academicYear,term,'SUBMITTED'),approved=periodKey(academicYear,term,'APPROVED')
  const source=await tx.grade.findMany({where:{studentId:current.studentId,assignmentId:null,period:submitted}})
  if(!source.length)throw new ApiError(409,'The report card has no submitted source grades')
  await tx.grade.deleteMany({where:{studentId:current.studentId,assignmentId:null,period:approved}})
  for(const grade of source)await tx.grade.create({data:{studentId:grade.studentId,courseId:grade.courseId,assignmentId:null,score:grade.score,maxScore:grade.maxScore,percentage:grade.percentage,letterGrade:grade.letterGrade,period:approved}})
  await synchronizeStudentAcademicMetrics(tx,[current.studentId])
  const updated=await tx.reportCard.update({where:{id},data:{principalStatus:'APPROVED',publicationStatus:'APPROVED',approvedById:req.user!.sub,approvedAt:new Date()}})
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:'REPORT_CARD_APPROVED',targetType:'ReportCard',targetId:id,metadata:{previousStatus:current.publicationStatus,academicYear,term,sourceGrades:source.map(x=>({courseId:x.courseId,percentage:x.percentage,letterGrade:x.letterGrade}))}}})
  return updated
 })
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
 return success(res,{student:{id:student.id,studentNumber:student.studentNumber,name:[student.user.lastName,student.user.middleName,student.user.firstName].filter(Boolean).join(' '),grade:student.grade,photoUrl:student.officialAvatar ?? student.user.avatar,transcriptVisible:student.transcriptVisible},rows,summary:{credits,cumulativeGpa:credits?Number((points/credits).toFixed(2)):null,officialRecords:rows.length,legacyRecords:legacyRows.length},generatedAt:new Date().toISOString(),dataPolicy:rows.length?'APPROVED_AND_VERIFIED_LEGACY_RECORDS_ONLY':'NO_OFFICIAL_DATA'})
}))
