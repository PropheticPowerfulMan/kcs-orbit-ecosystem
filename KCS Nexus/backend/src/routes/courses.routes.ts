import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const coursesRouter = Router()

coursesRouter.get('/', asyncHandler(async (_req, res) => {
  const courses = await prisma.course.findMany({
    include: { teacher: { include: { user: true } }, schedules: true },
    orderBy: { name: 'asc' },
  })
  return success(res, courses)
}))

coursesRouter.get('/:id', asyncHandler(async (req, res) => {
  const courseId = getRouteParam(req.params.id)
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { teacher: { include: { user: true } }, schedules: true, assignments: true, enrollments: true },
  })
  if (!course) throw new ApiError(404, 'Course not found')
  return success(res, course)
}))

coursesRouter.post('/', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const course = await prisma.course.create({ data: req.body, include: { schedules: true } })
  return success(res, course, 'Course created', 201)
}))

coursesRouter.put('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const courseId = getRouteParam(req.params.id)
  const course = await prisma.course.update({ where: { id: courseId }, data: req.body })
  return success(res, course, 'Course updated')
}))

coursesRouter.delete('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const courseId = getRouteParam(req.params.id)
  await prisma.course.delete({ where: { id: courseId } })
  return success(res, null, 'Course deleted')
}))
