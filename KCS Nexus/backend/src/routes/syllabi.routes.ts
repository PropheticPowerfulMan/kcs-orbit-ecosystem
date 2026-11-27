import {canReadSyllabus,syllabusAudienceMode,type SyllabusAudience} from '../utils/syllabusAccess.js'
import {databaseActorId} from '../utils/databaseActor.js'
import {uploadPath} from '../utils/uploadStorage.js'
import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { prisma } from '../config/prisma.js'

export const syllabiRouter = Router()
const root = uploadPath('syllabi')
const accepted = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => accepted.has(file.mimetype)
    ? callback(null, true)
    : callback(new ApiError(400, 'PDF, DOC or DOCX required')),
})
const input = z.object({
  audienceMode:z.enum(['COURSE','SELECTED']).optional(),
  expectedPublishedAt:z.string().optional(),
  academicYear: z.string().trim().regex(/^\d{4}-\d{4}$/),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  targetUserIds: z.string().optional().transform((value) => {
    if (!value) return [] as string[]
    try { return z.array(z.string().min(1)).max(500).parse(JSON.parse(value)) } catch { throw new ApiError(422, 'Invalid syllabus recipient selection') }
  }),
  sharedUserIds: z.string().optional().transform((value) => {
    if (!value) return [] as string[]
    try { return z.array(z.string().min(1)).max(1000).parse(JSON.parse(value)) } catch { throw new ApiError(422, 'Invalid ecosystem recipient selection') }
  }),
})
type SyllabusVersion = SyllabusAudience & {
  academicYear: string
  title: string
  description?: string
  fileName: string
  storedName: string
  mimeType: string
  fileSize: number
  publishedAt: string
}
type Meta = SyllabusVersion & { history?: SyllabusVersion[]; targetUserIds?: string[]; sharedUserIds?: string[] }
const parse = (value: string | null): Meta | null => {
  if (!value) return null
  try { return JSON.parse(value) as Meta } catch { return null }
}
const item = (course: any) => ({
  id: course.id,
  ...parse(course.syllabus),
  course: { id: course.id, name: course.name, code: course.code, grade: course.grade, teacher: course.teacher },
})

const versionSnapshot = (meta: Meta): SyllabusVersion => ({
  academicYear: meta.academicYear, title: meta.title, description: meta.description,
  fileName: meta.fileName, storedName: meta.storedName, mimeType: meta.mimeType,
  fileSize: meta.fileSize, publishedAt: meta.publishedAt,audienceMode:syllabusAudienceMode(meta),targetUserIds:meta.targetUserIds,sharedUserIds:meta.sharedUserIds,
})
syllabiRouter.get('/', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const role = req.user!.role
  const courses = await prisma.course.findMany({
    where: { syllabus: { not: null } },
    select: { id: true, name: true, code: true, grade: true, syllabus: true, teacher: { select: { userId: true, user: { select: { firstName: true, middleName: true, lastName: true } } } }, enrollments: { select: { student: { select: { userId: true } } } } },
    orderBy: [{ grade: 'asc' }, { name: 'asc' }],
  })
  res.setHeader('Cache-Control','private, no-store')
  return success(res,courses.flatMap<unknown>(course=>{
    const meta=parse(course.syllabus),scope={ownerId:course.teacher.userId,enrolledIds:course.enrollments.map(row=>row.student.userId)},actor={id:req.user!.sub,role}
    if(!meta?.fileName||!canReadSyllabus(actor,scope,meta))return[]
    if(['admin','staff'].includes(role)||scope.ownerId===actor.id)return[item(course)]
    const safe=(v:SyllabusVersion)=>({academicYear:v.academicYear,title:v.title,description:v.description,fileName:v.fileName,mimeType:v.mimeType,fileSize:v.fileSize,publishedAt:v.publishedAt})
    return[{id:course.id,...safe(meta),history:(meta.history||[]).filter(v=>canReadSyllabus(actor,scope,v,true)).map(safe),course:{id:course.id,name:course.name,code:course.code,grade:course.grade,teacher:course.teacher}}]
  }))
}))

syllabiRouter.get('/recipient-directory',authenticate,requireRoles('teacher'),asyncHandler(async(_req,res)=>{
 const users=await prisma.user.findMany({
  where:{accountBlockedAt:null,NOT:{permissions:{has:'nexus:media-only'}},OR:[{role:{in:['ADMIN','STAFF','TEACHER','PARENT']}},{role:'STUDENT',studentProfile:{is:{status:{equals:'active',mode:'insensitive'},archive:{is:null}}}}]},
  select:{id:true,firstName:true,middleName:true,lastName:true,email:true,role:true,studentProfile:{select:{grade:true,section:true,studentNumber:true}},teacherProfile:{select:{department:true,employeeNumber:true}},staffProfile:{select:{department:true,function:true,employeeNumber:true}}},
  orderBy:[{role:'asc'},{lastName:'asc'},{firstName:'asc'}],
 })
 return success(res,users.map(user=>({id:user.id,name:[user.lastName,user.middleName,user.firstName].filter(Boolean).join(' '),email:user.email,role:user.role,detail:user.studentProfile?[user.studentProfile.studentNumber,user.studentProfile.grade,user.studentProfile.section].filter(Boolean).join(' · '):user.teacherProfile?[user.teacherProfile.employeeNumber,user.teacherProfile.department].filter(Boolean).join(' · '):user.staffProfile?[user.staffProfile.employeeNumber,user.staffProfile.function,user.staffProfile.department].filter(Boolean).join(' · '):''})),'Ecosystem syllabus recipient directory loaded')
}))

syllabiRouter.get('/teacher-courses', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const courses = await prisma.course.findMany({
    where: { teacher: { userId: req.user!.sub } },
    select: { id: true, name: true, code: true, grade: true, syllabus: true, enrollments: { select: { student: { select: { userId: true, studentNumber: true, grade: true, section: true, user: { select: { firstName: true, middleName: true, lastName: true } } } } } } },
    orderBy: [{ grade: 'asc' }, { name: 'asc' }],
  })
  return success(res, courses.map((course) => ({ ...course, syllabus: parse(course.syllabus) })))
}))

syllabiRouter.post('/:courseId', authenticate, requireRoles('teacher'), upload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = input.parse(req.body)
  const course = await prisma.course.findFirst({
    where: { id: String(req.params.courseId), teacher: { userId: req.user!.sub } },
    include: {
      enrollments: { select: { student: { select: { userId: true } } } },
      teacher: { select: { user: { select: { firstName: true, middleName: true, lastName: true } } } },
    },
  })
  if (!course) throw new ApiError(403, 'This course is not assigned to the authenticated teacher')
  const mode=payload.audienceMode??syllabusAudienceMode(payload)
  const explicitIds=[...new Set([...payload.targetUserIds,...payload.sharedUserIds])]
  if(mode==='SELECTED'&&!explicitIds.length)throw new ApiError(422,'Choisissez les destinataires : une sélection vide ne diffuse jamais à toute la classe. / Choose recipients: an empty selection never broadcasts to the whole course.')
  const valid=explicitIds.length?await prisma.user.findMany({where:{id:{in:explicitIds},accountBlockedAt:null,NOT:{permissions:{has:'nexus:media-only'}},OR:[{role:{not:'STUDENT'}},{studentProfile:{is:{status:{equals:'active',mode:'insensitive'},archive:{is:null}}}}]},select:{id:true}}):[]
  if(valid.length!==explicitIds.length)throw new ApiError(422,'Un destinataire est indisponible. Actualisez la sélection. / A recipient is unavailable. Refresh the selection.')
  const activeEnrolled=await prisma.enrollment.findMany({where:{courseId:course.id,student:{status:{equals:'active',mode:'insensitive'},archive:{is:null},user:{accountBlockedAt:null}}},select:{student:{select:{userId:true}}}})
  const recipients=[...new Set([...(mode==='COURSE'?activeEnrolled.map(row=>row.student.userId):[]),...explicitIds])]

  const previous = parse(course.syllabus)
  if(payload.expectedPublishedAt&&previous?.publishedAt!==payload.expectedPublishedAt)throw new ApiError(409,'Le syllabus a changé. Rechargez avant de modifier. / Syllabus changed. Reload before editing.')
  if (!req.file && !previous) throw new ApiError(400, 'Syllabus document is required')

  let replacementStoredName: string | undefined
  if (req.file) {
    const extension = req.file.mimetype === 'application/pdf' ? '.pdf' : req.file.mimetype === 'application/msword' ? '.doc' : '.docx'
    replacementStoredName = randomUUID() + extension
    await mkdir(root, { recursive: true })
    await writeFile(path.join(root, replacementStoredName), req.file.buffer)
  }
  const meta: Meta = {
    academicYear:payload.academicYear,title:payload.title,description:payload.description,audienceMode:mode,
    fileName: req.file?.originalname ?? previous!.fileName,
    storedName: replacementStoredName ?? previous!.storedName,
    mimeType: req.file?.mimetype ?? previous!.mimeType,
    fileSize: req.file?.size ?? previous!.fileSize,
    publishedAt: new Date().toISOString(),
    history: previous ? [versionSnapshot(previous), ...(previous.history ?? [])].slice(0, 50) : [],
    targetUserIds: payload.targetUserIds.length ? payload.targetUserIds : undefined,
    sharedUserIds: payload.sharedUserIds.length ? [...new Set(payload.sharedUserIds)] : undefined,
  }
  const actorId=await databaseActorId(req.user!.sub)
  let saved:any
  try { saved = await prisma.$transaction(async (transaction) => {
    const locked=await transaction.$queryRawUnsafe<Array<{syllabus:string|null}>>('SELECT syllabus FROM "Course" WHERE id = $1 FOR UPDATE',course.id)
    if(locked[0]?.syllabus!==course.syllabus)throw new ApiError(409,'Syllabus changed. Reload before editing. / Syllabus modifié. Rechargez avant de modifier.')
    const updated = await transaction.course.update({
      where: { id: course.id },
      data: { syllabus: JSON.stringify(meta) },
      select: { id: true, name: true, code: true, grade: true, syllabus: true, teacher: { select: { user: { select: { firstName: true, middleName: true, lastName: true } } } } },
    })
    if (recipients.length) await transaction.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        title: (previous ? 'Syllabus updated · ' : 'New syllabus · ') + course.name,
        message: 'The ' + payload.academicYear + ' syllabus for ' + course.name + ' is available in your dashboard.',
        type: 'INFO',
        link: '/course-syllabi',
      })),
    })
    await transaction.auditLog.create({
      data: {
        actorId,
        action: previous ? 'COURSE_SYLLABUS_UPDATED' : 'COURSE_SYLLABUS_PUBLISHED',
        targetType: 'Course',
        targetId: course.id,
        metadata: { academicYear: payload.academicYear, recipients: recipients.length, targetedLearners: payload.targetUserIds.length, sharedRecipients: payload.sharedUserIds.length,audienceMode:mode, fileSize: meta.fileSize, fileReplaced: Boolean(req.file) },
      },
    })
    return updated
  }) } catch(error) { if(replacementStoredName)await unlink(path.join(root,replacementStoredName)).catch(()=>undefined);throw error }
  return success(res, {...item(saved),delivery:{recipients:recipients.length,audienceMode:mode}}, previous ? 'Syllabus updated and learners notified' : 'Syllabus published and learners notified', 201)
}))

syllabiRouter.get('/:courseId/download', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const course = await prisma.course.findUnique({ where: { id: String(req.params.courseId) }, include: { teacher: true, enrollments: { include: { student: true } } } })
  if (!course) throw new ApiError(404, 'Course not found')
  const role=req.user!.role,meta=parse(course.syllabus),scope={ownerId:course.teacher.userId,enrolledIds:course.enrollments.map(row=>row.student.userId)},actor={id:req.user!.sub,role}
  if(!meta)throw new ApiError(404,'No syllabus has been published for this course')
  if(!canReadSyllabus(actor,scope,meta))throw new ApiError(403,'This syllabus was not assigned to this account / Ce syllabus ne vous est pas destiné')
  const requestedVersion=String(req.query.version??'')
  const document=requestedVersion?meta.history?.find(entry=>entry.publishedAt===requestedVersion):meta
  if(!document)throw new ApiError(404,'This syllabus version is no longer available')
  if(requestedVersion&&!canReadSyllabus(actor,scope,document,true))throw new ApiError(403,'This version was not assigned to this account / Cette version ne vous est pas destinée')
  if(!/^[a-f0-9-]+\.(?:pdf|doc|docx)$/i.test(document.storedName))throw new ApiError(404,'File unavailable')
  res.setHeader('Cache-Control','private, no-store')
  res.setHeader('Content-Type', document.mimeType)
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(document.fileName))
  return res.sendFile(path.join(root, document.storedName))
}))

syllabiRouter.delete('/:courseId', authenticate, requireRoles('teacher', 'admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const course = await prisma.course.findUnique({
    where: { id: String(req.params.courseId) },
    include: { teacher: true, enrollments: { select: { student: { select: { userId: true } } } } },
  })
  if (!course) throw new ApiError(404, 'Course not found')
  if (req.user!.role === 'teacher' && course.teacher.userId !== req.user!.sub) throw new ApiError(403, 'This course belongs to another teacher')
  const meta = parse(course.syllabus)
  if (!meta) return success(res, { id: course.id, alreadyRemoved: true }, 'Syllabus was already absent')
  const scope={ownerId:course.teacher.userId,enrolledIds:course.enrollments.map(row=>row.student.userId)}
  const users=await prisma.user.findMany({where:{id:{in:[...new Set([...scope.enrolledIds,...(meta.targetUserIds||[]),...(meta.sharedUserIds||[])])]}},select:{id:true,role:true}})
  const recipients=users.filter(user=>canReadSyllabus({id:user.id,role:user.role.toLowerCase()},scope,meta)).map(user=>user.id)
  const actorId=await databaseActorId(req.user!.sub)
  await prisma.$transaction(async (transaction) => {
    await transaction.course.update({ where: { id: course.id }, data: { syllabus: null } })
    if (recipients.length) await transaction.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        title: 'Syllabus removed · ' + course.name,
        message: 'The previous syllabus for ' + course.name + ' was withdrawn by the teacher.',
        type: 'INFO',
        link: '/course-syllabi',
      })),
    })
    await transaction.auditLog.create({
      data: {
        actorId,
        action: 'COURSE_SYLLABUS_REMOVED',
        targetType: 'Course',
        targetId: course.id,
        metadata: { academicYear: meta.academicYear, recipients: recipients.length, fileName: meta.fileName },
      },
    })
  })
  await Promise.all([meta, ...(meta.history ?? [])].map((entry) => unlink(path.join(root, entry.storedName)).catch(() => undefined)))
  return success(res, { id: course.id }, 'Syllabus removed')
}))
