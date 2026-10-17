import { timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { asyncHandler, ApiError, success } from '../utils/api.js'
import { sendSchoolMail } from '../utils/mail.js'
import { sendSchoolSms } from '../utils/sms.js'

export const sentinelNotificationsRouter = Router()

function validSentinelKey(provided: string | undefined) {
  const expected = env.KCS_ORBIT_API_KEY
  if (!provided || !expected) return false
  const left = Buffer.from(provided)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

sentinelNotificationsRouter.post('/deliver', asyncHandler(async (req, res) => {
  if (!validSentinelKey(req.header('x-api-key'))) throw new ApiError(401, 'Unauthorized KCS Sentinel service')
  const input = z.object({
    eventId: z.string().uuid(),
    orbitPersonId: z.string().min(1).max(160),
    email: z.string().email().optional(),
    phone: z.string().min(5).max(40).optional(),
    title: z.string().min(3).max(180),
    text: z.string().min(3).max(3000),
    channels: z.array(z.enum(['IN_APP', 'EMAIL', 'SMS'])).min(1),
    source: z.literal('KCS_SENTINEL'),
    timezone: z.literal('Africa/Kinshasa'),
  }).parse(req.body)

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { orbitUserId: input.orbitPersonId },
        { id: input.orbitPersonId },
        ...(input.email ? [{ email: { equals: input.email, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: { id: true, email: true, phone: true },
  })
  const eventLink = `/sentinel/#alert-${encodeURIComponent(input.eventId)}`
  const existing = user
    ? await prisma.notification.findFirst({ where: { userId: user.id, link: eventLink }, select: { id: true } })
    : null
  if (existing) {
    return success(res, { delivered: true, duplicate: true, notificationId: existing.id, email: 'SKIPPED', sms: 'SKIPPED' }, 'Sentinel event already delivered')
  }

  const [emailResult, smsResult] = await Promise.all([
    input.channels.includes('EMAIL') && (user?.email || input.email)
      ? sendSchoolMail({ to: user?.email || input.email, subject: input.title, text: input.text, branded: true })
      : Promise.resolve(null),
    input.channels.includes('SMS')
      ? sendSchoolSms(user?.phone || input.phone, input.text, { brand: false })
      : Promise.resolve(null),
  ])
  const notification = user && input.channels.includes('IN_APP')
    ? await prisma.notification.create({
        data: { userId: user.id, title: input.title, message: input.text, type: 'WARNING', link: eventLink },
      })
    : null

  return success(res, {
    delivered: true,
    nexusAccount: Boolean(user),
    notificationId: notification?.id || null,
    email: emailResult ? (emailResult.sent ? 'SENT' : emailResult.reason) : 'SKIPPED',
    sms: smsResult ? (smsResult.sent ? 'SENT' : smsResult.reason) : 'SKIPPED',
  }, 'Sentinel late-arrival alert processed')
}))
