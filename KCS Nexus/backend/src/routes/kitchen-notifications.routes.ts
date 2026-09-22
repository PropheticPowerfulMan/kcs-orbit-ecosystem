import { timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { asyncHandler, ApiError, success } from '../utils/api.js'
import { sendSchoolMail } from '../utils/mail.js'

export const kitchenNotificationsRouter = Router()

function validKitchenKey(provided: string | undefined) {
  const expected = env.KCS_KITCHEN_INTEGRATION_KEY
  if (!provided || !expected) return false
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

kitchenNotificationsRouter.post('/deliver', asyncHandler(async (req, res) => {
  if (!validKitchenKey(req.header('x-api-key'))) throw new ApiError(401, 'Unauthorized KCS Kitchen service')
  const input = z.object({
    eventId: z.string().min(8).max(100),
    orbitPersonId: z.string().min(1).max(120),
    eventType: z.string().min(3).max(100),
    channels: z.array(z.enum(['IN_APP', 'EMAIL', 'SMS'])).min(1),
    title: z.string().min(3).max(180),
    text: z.string().min(3).max(3000)
  }).parse(req.body)

  const user = await prisma.user.findFirst({ where: { orbitUserId: input.orbitPersonId }, select: { id: true, email: true } })
  if (!user) {
    return success(res, { delivered: true, nexusAccount: false, email: 'SKIPPED' }, 'Kitchen notification remains available in KCS Kitchen')
  }

  const eventLink = '/kitchen/#event-' + encodeURIComponent(input.eventId)
  const existing = await prisma.notification.findFirst({ where: { userId: user.id, link: eventLink }, select: { id: true } })
  if (existing) {
    return success(res, { delivered: true, duplicate: true, notificationId: existing.id }, 'Kitchen event already delivered')
  }

  let email: 'SENT' | 'SKIPPED' = 'SKIPPED'
  if (input.channels.includes('EMAIL') && user.email) {
    const result = await sendSchoolMail({ to: user.email, subject: input.title, text: input.text, branded: true })
    if (!result.sent) throw new ApiError(502, result.reason)
    email = 'SENT'
  }

  const notification = input.channels.includes('IN_APP')
    ? await prisma.notification.create({
        data: { userId: user.id, title: input.title, message: input.text, type: 'INFO', link: eventLink }
      })
    : null

  return success(res, {
    delivered: true,
    nexusAccount: true,
    notificationId: notification?.id || null,
    email
  }, 'Kitchen event delivered')
}))
