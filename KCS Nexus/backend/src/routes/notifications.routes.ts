import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
import { asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const notificationsRouter = Router()

notificationsRouter.use(authenticate)

notificationsRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: 'desc' },
  })
  return success(res, notifications)
}))

notificationsRouter.patch('/:id/read', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const notificationId = getRouteParam(req.params.id)
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: req.user!.sub },
    data: { isRead: true },
  })
  return success(res, { id: notificationId }, 'Notification marked as read')
}))

notificationsRouter.patch('/read-all', asyncHandler(async (req: AuthenticatedRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.sub, isRead: false },
    data: { isRead: true },
  })
  return success(res, null, 'All notifications marked as read')
}))
