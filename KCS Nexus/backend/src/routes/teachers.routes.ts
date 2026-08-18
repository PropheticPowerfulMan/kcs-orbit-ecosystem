import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const teachersRouter = Router()

const workspaceSchema = z.object({
  state: z.record(z.unknown()),
  revision: z.number().int().nonnegative().optional(),
})

teachersRouter.get('/me/workspace', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const workspace = await prisma.teacherWorkspace.findUnique({ where: { userId: req.user!.sub } })
  return success(res, workspace)
}))

teachersRouter.put('/me/workspace', authenticate, requireRoles('teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = workspaceSchema.parse(req.body)
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { id: true, role: true } })
  if (!user) throw new ApiError(404, 'Authenticated user not found')
  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') throw new ApiError(403, 'Teacher workspace access required')

  const workspace = await prisma.$transaction(async (tx) => {
    const existing = await tx.teacherWorkspace.findUnique({ where: { userId: user.id } })
    if (existing && payload.revision !== undefined && payload.revision !== existing.revision) {
      throw new ApiError(409, 'This teacher workspace was updated in another session. Reload it before saving again.')
    }
    if (!existing) {
      return tx.teacherWorkspace.create({ data: { userId: user.id, state: payload.state as Prisma.InputJsonValue } })
    }
    return tx.teacherWorkspace.update({
      where: { userId: user.id },
      data: { state: payload.state as Prisma.InputJsonValue, revision: { increment: 1 } },
    })
  })

  await prisma.auditLog.create({
    data: { actorId: user.id, action: 'TEACHER_WORKSPACE_SAVED', targetType: 'TeacherWorkspace', targetId: workspace.id, metadata: { revision: workspace.revision } },
  })
  return success(res, workspace, 'Teacher workspace saved')
}))

teachersRouter.get('/workspaces', authenticate, requireRoles('staff'), asyncHandler(async (_req, res) => {
  const workspaces = await prisma.teacherWorkspace.findMany({
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return success(res, workspaces)
}))

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
