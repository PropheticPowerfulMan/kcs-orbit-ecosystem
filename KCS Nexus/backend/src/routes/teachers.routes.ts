import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const teachersRouter = Router()

teachersRouter.get('/', asyncHandler(async (_req, res) => {
  const teachers = await prisma.teacherProfile.findMany({ include: { user: true, courses: true } })
  return success(res, teachers)
}))

teachersRouter.get('/:id', asyncHandler(async (req, res) => {
  const teacherId = getRouteParam(req.params.id)
  const teacher = await prisma.teacherProfile.findUnique({
    where: { id: teacherId },
    include: { user: true, courses: { include: { schedules: true } } },
  })
  if (!teacher) throw new ApiError(404, 'Teacher not found')
  return success(res, teacher)
}))

teachersRouter.post('/', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const teacher = await prisma.teacherProfile.create({ data: req.body, include: { user: true } })
  return success(res, teacher, 'Teacher created', 201)
}))

teachersRouter.put('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const teacherId = getRouteParam(req.params.id)
  const teacher = await prisma.teacherProfile.update({ where: { id: teacherId }, data: req.body, include: { user: true } })
  return success(res, teacher, 'Teacher updated')
}))
