import type { Event, User, UserRole } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { sendSchoolSms } from '../utils/sms.js'

const DAY_MS = 24 * 60 * 60 * 1000
const WORKER_INTERVAL_MS = 5 * 60 * 1000
const ALL_ROLES: UserRole[] = ['ADMIN', 'STAFF', 'TEACHER', 'STUDENT', 'PARENT']
type ReminderUser = Pick<User, 'id' | 'role' | 'email' | 'phone' | 'firstName' | 'middleName' | 'lastName'> & {
  studentProfile: { grade: string } | null
  parentLinks: Array<{ student: { grade: string } }>
}
type ReminderEvent = Event

const normalized = (value: string | null | undefined) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
export const isEventInReminderWindow = (eventStart: Date, daysBefore: number, now = new Date()) =>
  eventStart > now && eventStart.getTime() <= now.getTime() + Math.max(1, daysBefore) * DAY_MS

export const userMatchesEventAudience = (user: ReminderUser, event: Pick<ReminderEvent, 'audienceRoles' | 'audienceGrades'>) => {
  const roles = event.audienceRoles.length ? event.audienceRoles : ALL_ROLES
  if (!roles.includes(user.role)) return false
  if (!event.audienceGrades.length || !['STUDENT', 'PARENT'].includes(user.role)) return true
  const grades = new Set(event.audienceGrades.map(normalized))
  if (user.role === 'STUDENT') return Boolean(user.studentProfile && grades.has(normalized(user.studentProfile.grade)))
  return user.parentLinks.some((link) => grades.has(normalized(link.student.grade)))
}

const eventMessage = (event: ReminderEvent) => {
  const whenFr = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'full', timeStyle: 'short' }).format(event.startDate)
  const whenEn = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kinshasa', dateStyle: 'full', timeStyle: 'short' }).format(event.startDate)
  const title = `Rappel calendrier / Calendar reminder · ${event.title}`
  const body = `Rappel KCS : « ${event.title} » aura lieu le ${whenFr}, à ${event.location}.\n\nKCS reminder: “${event.title}” will take place on ${whenEn}, at ${event.location}.\n\n${event.description}`
  const sms = `KCS · Rappel/Reminder: ${event.title}. ${whenFr}. ${event.location}. Consultez votre dashboard / Check your dashboard.`
  return { title, body, sms }
}

async function ensureDelivery(event: ReminderEvent, user: ReminderUser) {
  return prisma.eventReminderDelivery.upsert({
    where: { eventId_userId_revision: { eventId: event.id, userId: user.id, revision: event.reminderRevision } },
    create: { eventId: event.id, userId: user.id, revision: event.reminderRevision },
    update: {},
  })
}

async function deliverReminder(event: ReminderEvent, user: ReminderUser) {
  let delivery = await ensureDelivery(event, user)
  const channels = new Set(event.reminderChannels)
  const message = eventMessage(event)
  const link = `/?event=${encodeURIComponent(event.id)}#news-events`
  if (channels.has('IN_APP') && !delivery.inAppSentAt) {
    delivery = await prisma.$transaction(async (tx) => {
      await tx.notification.create({ data: { userId: user.id, title: message.title, message: message.body, type: 'INFO', link } })
      return tx.eventReminderDelivery.update({ where: { id: delivery.id }, data: { inAppSentAt: new Date() } })
    })
  }
  if (channels.has('EMAIL') && !delivery.emailQueuedAt && !delivery.emailFailure) {
    if (!user.email?.trim()) {
      delivery = await prisma.eventReminderDelivery.update({ where: { id: delivery.id }, data: { emailFailure: 'RECIPIENT_EMAIL_MISSING' } })
    } else {
      const fullName = [user.lastName, user.middleName, user.firstName].filter(Boolean).join(' ')
      delivery = await prisma.$transaction(async (tx) => {
        const now = new Date()
        await tx.correspondenceLog.create({ data: {
          channel: 'EMAIL', status: 'QUEUED', subject: message.title, body: message.body,
          recipientName: fullName, recipientEmail: user.email,
          metadata: { mailQueueVersion: 1, recipientId: user.id, eventId: event.id, reminderRevision: event.reminderRevision, attempts: 0, nextAttemptAt: now.toISOString(), priority: 'NORMAL' },
        } })
        return tx.eventReminderDelivery.update({ where: { id: delivery.id }, data: { emailQueuedAt: now } })
      })
    }
  }
  if (channels.has('SMS') && !delivery.smsAttemptedAt) {
    delivery = await prisma.eventReminderDelivery.update({ where: { id: delivery.id }, data: { smsAttemptedAt: new Date() } })
    const result = await sendSchoolSms(user.phone, message.sms, { brand: false })
    await prisma.eventReminderDelivery.update({ where: { id: delivery.id }, data: result.sent ? { smsSentAt: new Date(), smsFailure: null } : { smsFailure: result.reason } })
  }
}

let processing = false
export async function processEventReminders(now = new Date()) {
  if (processing) return { events: 0, recipients: 0, skipped: true }
  processing = true
  try {
    const events = await prisma.event.findMany({
      where: { reminderEnabled: true, startDate: { gt: now, lte: new Date(now.getTime() + 31 * DAY_MS) }, liveStreamStatus: { not: 'cancelled' } },
      orderBy: { startDate: 'asc' }, take: 50,
    })
    const dueEvents = events.filter((event) => isEventInReminderWindow(event.startDate, event.reminderDaysBefore, now))
    let recipients = 0
    for (const event of dueEvents) {
      const users = await prisma.user.findMany({
        where: { role: { in: event.audienceRoles.length ? event.audienceRoles : ALL_ROLES }, accountBlockedAt: null },
        select: { id: true, role: true, email: true, phone: true, firstName: true, middleName: true, lastName: true, studentProfile: { select: { grade: true } }, parentLinks: { select: { student: { select: { grade: true } } } } },
      })
      const audience = users.filter((user) => userMatchesEventAudience(user, event))
      for (let index = 0; index < audience.length; index += 10) {
        await Promise.all(audience.slice(index, index + 10).map((user) => deliverReminder(event, user)))
      }
      recipients += audience.length
    }
    return { events: dueEvents.length, recipients, skipped: false }
  } finally { processing = false }
}

export function startEventReminderWorker() {
  const initial = setTimeout(() => void processEventReminders().catch((error) => console.error('[event-reminder] Initial pass failed', error)), 12_000)
  initial.unref()
  const timer = setInterval(() => void processEventReminders().catch((error) => console.error('[event-reminder] Worker pass failed', error)), WORKER_INTERVAL_MS)
  timer.unref()
  console.log(`[event-reminder] Persistent worker started (${WORKER_INTERVAL_MS / 60_000} minute interval)`)
}
