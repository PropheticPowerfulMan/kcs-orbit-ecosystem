import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const suggestionsRouter = Router()
suggestionsRouter.use(authenticate)

const createSuggestionSchema = z.object({
  category: z.string().trim().min(2).max(80),
  message: z.string().trim().min(5).max(5000),
})

suggestionsRouter.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const data = createSuggestionSchema.parse(req.body)
  const role = req.user!.role.toUpperCase() as 'ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT' | 'PARENT'
  const record = await prisma.suggestion.create({
    data: { ...data, authorId: req.user!.sub, anonymousRole: role },
    select: { id: true, category: true, message: true, status: true, createdAt: true },
  })
  return success(res, record, 'Confidential suggestion submitted', 201)
}))

suggestionsRouter.get('/', requireRoles('admin'), asyncHandler(async (_req, res) => {
  const records = await prisma.suggestion.findMany({
    include: { author: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  return success(res, records)
}))

suggestionsRouter.patch('/:id/status', requireRoles('admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = getRouteParam(req.params.id)
  const { status } = z.object({ status: z.enum(['New', 'Under review', 'Resolved']) }).parse(req.body)
  const existing = await prisma.suggestion.findUnique({ where: { id } })
  if (!existing) throw new ApiError(404, 'Suggestion not found')
  const record = await prisma.suggestion.update({ where: { id }, data: { status } })
  await prisma.auditLog.create({ data: { actorId: req.user!.sub, action: 'SUGGESTION_STATUS_UPDATED', targetType: 'Suggestion', targetId: id, metadata: { status } } })
  return success(res, record, 'Suggestion status updated')
}))
