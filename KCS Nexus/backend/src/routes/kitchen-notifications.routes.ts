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
    text: z.string().min(3).max(3000),
    recipientEmail: z.string().email().max(254).optional(),
    attachmentName: z.string().trim().min(1).max(180).regex(/^[^\\/:*?"<>|]+\.pdf$/i).optional(),
    attachmentBase64: z.string().max(250_000).optional()
  }).parse(req.body)

  if (Boolean(input.attachmentName) !== Boolean(input.attachmentBase64)) throw new ApiError(400, 'Incomplete Kitchen attachment')

  const user = await prisma.user.findFirst({ where: { orbitUserId: input.orbitPersonId }, select: { id: true, email: true } })
  if (!user && !input.recipientEmail) {
    return success(res, { delivered: true, nexusAccount: false, email: 'SKIPPED' }, 'Kitchen notification remains available in KCS Kitchen')
  }

  const eventLink = '/kitchen/#event-' + encodeURIComponent(input.eventId)
  const existing = user ? await prisma.notification.findFirst({ where: { userId: user.id, link: eventLink }, select: { id: true } }) : null
  if (existing) {
    return success(res, { delivered: true, duplicate: true, notificationId: existing.id }, 'Kitchen event already delivered')
  }

  let email: 'SENT' | 'SKIPPED' = 'SKIPPED'
  const emailRecipient = input.recipientEmail || user?.email
  if (input.channels.includes('EMAIL') && emailRecipient) {
    const result = await sendSchoolMail({
      to: emailRecipient, subject: input.title, text: input.text, branded: true,
      attachments: input.attachmentBase64 && input.attachmentName
        ? [{ filename: input.attachmentName, content: Buffer.from(input.attachmentBase64, 'base64'), contentType: 'application/pdf' }]
        : undefined,
    })
    if (!result.sent) throw new ApiError(502, result.reason)
    email = 'SENT'
  }

  const notification = input.channels.includes('IN_APP') && user
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
