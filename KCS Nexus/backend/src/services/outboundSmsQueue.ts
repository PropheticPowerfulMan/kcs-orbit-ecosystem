import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { sendSchoolSms } from '../utils/sms.js'
import { claimQueuedDelivery } from './deliveryLease.js'

let processing = false

export async function processOutboundSmsQueue() {
  if (processing) return
  processing = true
  try {
    const rows = await prisma.correspondenceLog.findMany({ where: { channel: 'TEXT', status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, take: 200 })
    const now = Date.now()
    const candidates = rows.filter((row) => {
      const metadata = row.metadata as { smsQueueVersion?: number; nextAttemptAt?: string } | null
      return metadata?.smsQueueVersion === 1 && (!metadata.nextAttemptAt || Date.parse(metadata.nextAttemptAt) <= now)
    }).slice(0, 20)
    for (const row of candidates) {
      const metadata = await claimQueuedDelivery(row)
      if (!metadata) continue
      const result = await sendSchoolSms(row.recipientPhone, row.subject + '\n\n' + row.body, { brand: false })
      const attempts = Number(metadata.attempts ?? 0) + 1
      const retryable = !result.sent && !['PHONE_MISSING', 'SMS_INVALID_PHONE'].includes(result.reason)
      await prisma.correspondenceLog.update({ where: { id: row.id }, data: {
        status: result.sent ? 'SENT' : retryable ? 'QUEUED' : 'FAILED',
        sentAt: result.sent ? new Date() : null,
        failureReason: result.sent ? null : result.reason,
        metadata: { ...metadata, leaseId: null, leaseUntil: null, attempts, lastAttemptAt: new Date().toISOString(), nextAttemptAt: retryable ? new Date(Date.now() + Math.min(60, 5 * attempts) * 60_000).toISOString() : null } as Prisma.InputJsonValue,
      } })
    }
  } catch (error) {
    console.error('[sms-queue] Worker iteration failed', error)
  } finally {
    processing = false
  }
}

export function startOutboundSmsQueue() {
  const timer = setInterval(() => void processOutboundSmsQueue(), 5_000)
  timer.unref()
}
