import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { sendSchoolMail } from '../utils/mail.js'

export const MAIL_QUEUE_VERSION = 1
export const MAIL_QUEUE_INTERVAL_MS = 45_000

type QueueMetadata = {
  mailQueueVersion?: number
  internalMessageId?: string
  recipientId?: string
  attempts?: number
  nextAttemptAt?: string
  lastAttemptAt?: string
}

const queueMetadata = (value: unknown): QueueMetadata => value && typeof value === 'object' && !Array.isArray(value) ? value as QueueMetadata : {}
const rateLimited = (detail = '') => /max\s*120|rate.?limit|too many messages|sender.*(?:limit|rate)|4\.7\.1/i.test(detail)
const connectionLimited = (detail = '') => /too many connections|4\.7\.0/i.test(detail)

export function isRetryableMailFailure(reason?: string, detail?: string) {
  const value = `${reason ?? ''} ${detail ?? ''}`
  return reason === 'SMTP_NOT_CONFIGURED' || /\b4(?:21|22|23|24|25|50|51|52)\b|timeout|timed out|connection|ECONN|EAI_AGAIN|temporar|rate.?limit|too many/i.test(value)
}

export function mailRetryDelayMs(detail: string | undefined, attempts: number) {
  if (rateLimited(detail)) return 66 * 60_000
  if (connectionLimited(detail)) return 5 * 60_000
  return Math.min(60 * 60_000, Math.max(5 * 60_000, 5 * 60_000 * 2 ** Math.max(0, attempts - 1)))
}

let processing = false

export async function processOutboundMailQueue() {
  if (processing) return
  processing = true
  try {
    const rows = await prisma.correspondenceLog.findMany({
      where: { channel: 'EMAIL', status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
    const now = new Date()
    const row = rows.find((candidate) => {
      const metadata = queueMetadata(candidate.metadata)
      if (metadata.mailQueueVersion !== MAIL_QUEUE_VERSION) return false
      const nextAttemptAt = metadata.nextAttemptAt ? new Date(metadata.nextAttemptAt) : null
      return !nextAttemptAt || Number.isNaN(nextAttemptAt.getTime()) || nextAttemptAt <= now
    })
    if (!row) return
    const metadata = queueMetadata(row.metadata)
    if (!row.recipientEmail) {
      await prisma.correspondenceLog.update({ where: { id: row.id }, data: { status: 'FAILED', failureReason: 'RECIPIENT_EMAIL_MISSING' } })
      return
    }
    const message = metadata.internalMessageId ? await prisma.internalMessage.findUnique({
      where: { id: metadata.internalMessageId },
      select: { attachmentName: true, attachmentMime: true, attachmentData: true },
    }) : null
    const attachmentNote = message?.attachmentName ? `\n\nDocument joint : ${message.attachmentName}. Disponible aussi dans votre boîte Nexus.` : ''
    const result = await sendSchoolMail({
      to: row.recipientEmail,
      subject: row.subject,
      text: row.body + attachmentNote,
      attachments: message?.attachmentData && message.attachmentName ? [{ filename: message.attachmentName, content: Buffer.from(message.attachmentData), contentType: message.attachmentMime ?? undefined }] : undefined,
      branded: true,
    })
    const attempts = (metadata.attempts ?? 0) + 1
    if (result.sent) {
      await prisma.correspondenceLog.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: new Date(), failureReason: null, metadata: { ...metadata, attempts, lastAttemptAt: now.toISOString(), nextAttemptAt: null } as Prisma.InputJsonValue },
      })
      return
    }
    const retryable = isRetryableMailFailure(result.reason, result.providerDetail)
    const delay = mailRetryDelayMs(result.providerDetail, attempts)
    await prisma.correspondenceLog.update({
      where: { id: row.id },
      data: {
        status: retryable ? 'QUEUED' : 'FAILED',
        failureReason: result.providerDetail || result.reason,
        metadata: { ...metadata, attempts, lastAttemptAt: now.toISOString(), nextAttemptAt: retryable ? new Date(now.getTime() + delay).toISOString() : null } as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    console.error('[mail-queue] Worker iteration failed', error)
  } finally {
    processing = false
  }
}

export function startOutboundMailQueue() {
  const initial = setTimeout(() => void processOutboundMailQueue(), 5_000)
  initial.unref()
  const timer = setInterval(() => void processOutboundMailQueue(), MAIL_QUEUE_INTERVAL_MS)
  timer.unref()
  console.log(`[mail-queue] Persistent worker started (${MAIL_QUEUE_INTERVAL_MS / 1000}s interval, one message per interval)`)
}
