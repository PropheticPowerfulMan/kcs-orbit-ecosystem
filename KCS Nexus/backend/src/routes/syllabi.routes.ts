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
const root = path.resolve(process.env.UPLOAD_ROOT || '/app/uploads', 'syllabi')
const accepted = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => accepted.has(file.mimetype)
    ? callback(null, true)
    : callback(new ApiError(400, 'PDF, DOC or DOCX required')),
})
const input = z.object({
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
type SyllabusVersion = {
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
  fileSize: meta.fileSize, publishedAt: meta.publishedAt,
})
syllabiRouter.get('/', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const role = req.user!.role
  const courses = await prisma.course.findMany({
    where: { syllabus: { not: null } },
    select: { id: true, name: true, code: true, grade: true, syllabus: true, teacher: { select: { userId: true, user: { select: { firstName: true, middleName: true, lastName: true } } } }, enrollments: { select: { student: { select: { userId: true } } } } },
    orderBy: [{ grade: 'asc' }, { name: 'asc' }],
  })
  const entries=courses.map(item)
  return success(res,entries.filter((entry,index)=>{
    if(!entry.fileName)return false
    if(['admin','staff'].includes(role))return true
    if(entry.sharedUserIds?.includes(req.user!.sub))return true
    if(role==='teacher')return courses[index].teacher.userId===req.user!.sub
    if(role==='student')return courses[index].enrollments.some(row=>row.student.userId===req.user!.sub)&&(!entry.targetUserIds?.length||entry.targetUserIds.includes(req.user!.sub))
    if(role==='parent')return false
    return false
  }))
}))

syllabiRouter.get('/recipient-directory',authenticate,requireRoles('teacher'),asyncHandler(async(_req,res)=>{
 const users=await prisma.user.findMany({
  where:{role:{in:['ADMIN','STAFF','TEACHER','PARENT','STUDENT']}},
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
  const previous = parse(course.syllabus)
  if (!req.file && !previous) throw new ApiError(400, 'Syllabus document is required')

  let replacementStoredName: string | undefined
  if (req.file) {
    const extension = req.file.mimetype === 'application/pdf' ? '.pdf' : req.file.mimetype === 'application/msword' ? '.doc' : '.docx'
    replacementStoredName = randomUUID() + extension
    await mkdir(root, { recursive: true })
    await writeFile(path.join(root, replacementStoredName), req.file.buffer)
  }
  const meta: Meta = {
    ...payload,
    fileName: req.file?.originalname ?? previous!.fileName,
    storedName: replacementStoredName ?? previous!.storedName,
    mimeType: req.file?.mimetype ?? previous!.mimeType,
    fileSize: req.file?.size ?? previous!.fileSize,
    publishedAt: new Date().toISOString(),
    history: previous ? [versionSnapshot(previous), ...(previous.history ?? [])].slice(0, 50) : [],
    targetUserIds: payload.targetUserIds.length ? payload.targetUserIds : undefined,
    sharedUserIds: payload.sharedUserIds.length ? [...new Set(payload.sharedUserIds)] : undefined,
  }
  const saved = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.course.update({
      where: { id: course.id },
      data: { syllabus: JSON.stringify(meta) },
      select: { id: true, name: true, code: true, grade: true, syllabus: true, teacher: { select: { user: { select: { firstName: true, middleName: true, lastName: true } } } } },
    })
    const enrolledRecipients = [...new Set(course.enrollments.map((entry) => entry.student.userId))]
    const requestedRecipients = new Set(payload.targetUserIds)
    const learnerRecipients = requestedRecipients.size ? enrolledRecipients.filter((userId) => requestedRecipients.has(userId)) : enrolledRecipients
    const sharedCandidates=[...new Set([...payload.sharedUserIds,...payload.targetUserIds.filter(userId=>!enrolledRecipients.includes(userId))])]
    const validSharedRecipients=sharedCandidates.length?await transaction.user.findMany({where:{id:{in:sharedCandidates}},select:{id:true}}):[]
    const recipients=[...new Set([...learnerRecipients,...validSharedRecipients.map(user=>user.id)])]
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
        actorId: req.user!.sub,
        action: previous ? 'COURSE_SYLLABUS_UPDATED' : 'COURSE_SYLLABUS_PUBLISHED',
        targetType: 'Course',
        targetId: course.id,
        metadata: { academicYear: payload.academicYear, recipients: recipients.length, targetedLearners: requestedRecipients.size, sharedRecipients: validSharedRecipients.length, fileSize: meta.fileSize, fileReplaced: Boolean(req.file) },
      },
    })
    return updated
  })
  return success(res, item(saved), previous ? 'Syllabus updated and learners notified' : 'Syllabus published and learners notified', 201)
}))

syllabiRouter.get('/:courseId/download', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const course = await prisma.course.findUnique({ where: { id: String(req.params.courseId) }, include: { teacher: true, enrollments: { include: { student: true } } } })
  if (!course) throw new ApiError(404, 'Course not found')
  const role = req.user!.role
  const permitted = ['admin', 'staff'].includes(role)
    || (role === 'teacher' && course.teacher.userId === req.user!.sub)
    || (role === 'student' && course.enrollments.some((entry) => entry.student.userId === req.user!.sub))
    || Boolean(parse(course.syllabus)?.sharedUserIds?.includes(req.user!.sub))
  if (!permitted) throw new ApiError(403, 'You are not enrolled in this course')
  const meta = parse(course.syllabus)
  if (!meta) throw new ApiError(404, 'No syllabus has been published for this course')
  if (role === 'student' && meta.targetUserIds?.length && !meta.targetUserIds.includes(req.user!.sub)) throw new ApiError(403, 'This syllabus was not assigned to this learner')
  const requestedVersion = String(req.query.version ?? '')
  const document = requestedVersion ? meta.history?.find((entry) => entry.publishedAt === requestedVersion) : meta
  if (!document) throw new ApiError(404, 'This syllabus version is no longer available')
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
  const recipients = [...new Set([...course.enrollments.map((entry) => entry.student.userId),...(meta.sharedUserIds??[])])]
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
        actorId: req.user!.sub,
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
