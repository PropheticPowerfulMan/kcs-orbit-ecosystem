import {databaseActorId} from '../utils/databaseActor.js'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
import { asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const notificationsRouter = Router()

notificationsRouter.use(authenticate)

notificationsRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = await databaseActorId(req.user!.sub)
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  return success(res, notifications)
}))

notificationsRouter.post('/bulk-delete', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = await databaseActorId(req.user!.sub)
  const ids = z.array(z.string().min(1)).min(1).max(250).parse(req.body?.ids)
  const result = await prisma.notification.deleteMany({
    where: {
      id: { in: [...new Set(ids)] },
      userId,
    },
  })
  return success(res, { deletedCount: result.count }, 'Notifications deleted')
}))

notificationsRouter.patch('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = await databaseActorId(req.user!.sub)
  const notificationId = getRouteParam(req.params.id)
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  })
  return success(res, { id: notificationId }, 'Notification marked as read')
}))

notificationsRouter.patch('/read-all', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = await databaseActorId(req.user!.sub)
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
  return success(res, null, 'All notifications marked as read')
}))
