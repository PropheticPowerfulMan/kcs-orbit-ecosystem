import { env } from './config.js'
import { prisma } from './db.js'
import { buildKitchenNotification } from './notification-template.js'

const MAX_ATTEMPTS = 5
let processing = false

export async function processNotificationOutbox(limit = 25) {
  if (processing) return { processed: 0, sent: 0, failed: 0, deferred: 0, busy: true }
  processing = true
  let processed = 0
  let sent = 0
  let failed = 0
  let deferred = 0
  try {
    const rows = await prisma.notificationOutbox.findMany({
      where: { status: { in: ['QUEUED', 'FAILED'] }, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: limit
    })
    for (const row of rows) {
      const retryDelay = Math.min(60 * 60_000, 30_000 * (2 ** row.attempts))
      if (row.processedAt && Date.now() - row.processedAt.getTime() < retryDelay) {
        deferred += 1
        continue
      }
      processed += 1
      try {
        const content = buildKitchenNotification(row.eventType, row.payload as Record<string, unknown>)
        const response = await fetch(env.NEXUS_NOTIFICATION_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': env.NEXUS_INTEGRATION_KEY || ''
          },
          body: JSON.stringify({
            eventId: row.id,
            orbitPersonId: row.orbitPersonId,
            eventType: row.eventType,
            channels: row.channels,
            title: content.title,
            text: content.text
          }),
          signal: AbortSignal.timeout(20_000)
        })
        const responseBody = await response.json().catch(() => ({})) as { message?: string }
        if (!response.ok) throw new Error(responseBody.message || 'Nexus notification bridge returned ' + response.status)
        await prisma.notificationOutbox.update({
          where: { id: row.id },
          data: { status: 'SENT', attempts: { increment: 1 }, lastError: null, processedAt: new Date() }
        })
        sent += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown notification error'
        await prisma.notificationOutbox.update({
          where: { id: row.id },
          data: { status: 'FAILED', attempts: { increment: 1 }, lastError: message.slice(0, 500), processedAt: new Date() }
        })
        failed += 1
      }
    }
    return { processed, sent, failed, deferred, busy: false }
  } finally {
    processing = false
  }
}

export function startNotificationWorker() {
  if (!env.NOTIFICATION_WORKER_ENABLED) {
    console.log('KCS Kitchen notification worker is disabled')
    return () => undefined
  }
  const run = () => void processNotificationOutbox().catch(error => console.error('[kitchen-notifications]', error))
  const initial = setTimeout(run, 5_000)
  const timer = setInterval(run, env.NOTIFICATION_INTERVAL_MS)
  initial.unref()
  timer.unref()
  console.log('KCS Kitchen notification worker enabled')
  return () => {
    clearTimeout(initial)
    clearInterval(timer)
  }
}
