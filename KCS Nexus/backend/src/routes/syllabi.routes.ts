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
})
type Meta = {
  academicYear: string
  title: string
  description?: string
  fileName: string
  storedName: string
  mimeType: string
  fileSize: number
  publishedAt: string
}
const parse = (value: string | null): Meta | null => {
  if (!value) return null
  try { return JSON.parse(value) as Meta } catch { return null }
}
const item = (course: any) => ({
  id: course.id,
  ...parse(course.syllabus),
  course: { id: course.id, name: course.name, code: course.code, grade: course.grade, teacher: course.teacher },
})

syllabiRouter.get('/', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const role = req.user!.role
  const where: any = {}
  if (role === 'teacher') where.teacher = { userId: req.user!.sub }
  else if (role === 'student') where.enrollments = { some: { student: { userId: req.user!.sub } } }
  else if (!['admin', 'staff'].includes(role)) throw new ApiError(403, 'Syllabus access denied')
  const courses = await prisma.course.findMany({
    where: { ...where, syllabus: { not: null } },
    select: { id: true, name: true, code: true, grade: true, syllabus: true, teacher: { select: { user: { select: { firstName: true, middleName: true, lastName: true } } } } },
    orderBy: [{ grade: 'asc' }, { name: 'asc' }],
  })
  return success(res, courses.map(item).filter((entry) => entry.fileName))
}))

syllabiRouter.get('/teacher-courses', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const courses = await prisma.course.findMany({
    where: { teacher: { userId: req.user!.sub } },
    select: { id: true, name: true, code: true, grade: true, syllabus: true },
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
  }
  const saved = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.course.update({
      where: { id: course.id },
      data: { syllabus: JSON.stringify(meta) },
      select: { id: true, name: true, code: true, grade: true, syllabus: true, teacher: { select: { user: { select: { firstName: true, middleName: true, lastName: true } } } } },
    })
    const recipients = [...new Set(course.enrollments.map((entry) => entry.student.userId))]
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
        metadata: { academicYear: payload.academicYear, recipients: recipients.length, fileSize: meta.fileSize, fileReplaced: Boolean(req.file) },
      },
    })
    return updated
  })
  if (req.file && previous?.storedName && previous.storedName !== meta.storedName) {
    await unlink(path.join(root, previous.storedName)).catch(() => undefined)
  }
  return success(res, item(saved), previous ? 'Syllabus updated and learners notified' : 'Syllabus published and learners notified', 201)
}))

syllabiRouter.get('/:courseId/download', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const course = await prisma.course.findUnique({ where: { id: String(req.params.courseId) }, include: { teacher: true, enrollments: { include: { student: true } } } })
  if (!course) throw new ApiError(404, 'Course not found')
  const role = req.user!.role
  const permitted = ['admin', 'staff'].includes(role)
    || (role === 'teacher' && course.teacher.userId === req.user!.sub)
    || (role === 'student' && course.enrollments.some((entry) => entry.student.userId === req.user!.sub))
  if (!permitted) throw new ApiError(403, 'You are not enrolled in this course')
  const meta = parse(course.syllabus)
  if (!meta) throw new ApiError(404, 'No syllabus has been published for this course')
  res.setHeader('Content-Type', meta.mimeType)
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(meta.fileName))
  return res.sendFile(path.join(root, meta.storedName))
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
  const recipients = [...new Set(course.enrollments.map((entry) => entry.student.userId))]
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
  await unlink(path.join(root, meta.storedName)).catch(() => undefined)
  return success(res, { id: course.id }, 'Syllabus removed')
}))
