import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { ApiError } from '../utils/api.js'

type Recipient = { id: string; role: string; name: string }
type Target = { userId: string; name: string; email: string | null; phone: string | null; relationship?: string }
type Channel = 'email' | 'sms'
type Attachment = { originalname: string; mimetype: string; size: number; buffer: Buffer }
type Result = { sent: boolean; queued?: boolean; reason?: string }
type Delivery = { userId: string; name: string; relationship?: string; email?: Result; sms?: Result }
export type MessageBatchResult = { batchId: string; recipients: number; primaryRecipients: number; channels: Channel[]; delivery: Delivery[]; externalDeliverySucceeded: boolean; emailQueued: number; smsQueued: number }

const messageLink = (role: string) => role === 'PARENT' ? '/portal/parent/messages' : role === 'STUDENT' ? '/portal/student/messages' : role === 'TEACHER' ? '/portal/teacher/messages' : role === 'STAFF' ? '/portal/staff/messages' : '/admin/communications'

export async function queueMessageBatch(input: {
  senderId: string; subject: string; body: string; recipients: Recipient[]; targets: Target[];
  channels: Channel[]; attachment?: Attachment; requestId?: string; intent: unknown; language?: 'fr' | 'en'
}): Promise<MessageBatchResult> {
  const requestId = input.requestId || randomUUID()
  const batchId = 'message-batch-' + createHash('sha256').update(input.senderId + ':' + requestId).digest('hex')
  const requestHash = createHash('sha256').update(JSON.stringify({ intent: input.intent, subject: input.subject, body: input.body, channels: [...input.channels].sort(), attachment: input.attachment ? { name: input.attachment.originalname, mime: input.attachment.mimetype, hash: createHash('sha256').update(input.attachment.buffer).digest('hex') } : null })).digest('hex')
  const replay = async () => {
    const record = await prisma.auditLog.findUnique({ where: { id: batchId }, select: { metadata: true } })
    if (!record) return null
    const metadata = record.metadata as { requestHash?: string; result?: MessageBatchResult }
    if (metadata.requestHash !== requestHash) throw new ApiError(409, 'This delivery request was already used for a different message.')
    return metadata.result ?? null
  }
  const previous = await replay()
  if (previous) return previous
  const ids = new Map(input.recipients.map((recipient) => [recipient.id, randomUUID()]))
  const now = new Date()
  const delivery: Delivery[] = input.targets.map((target) => {
    const row: Delivery = { userId: target.userId, name: target.name, ...(target.relationship ? { relationship: target.relationship } : {}) }
    for (const channel of input.channels) {
      const available = Boolean(channel === 'email' ? target.email : target.phone)
      row[channel] = available ? { sent: false, queued: true, reason: 'QUEUED' } : { sent: false, reason: channel === 'email' ? 'MISSING_OFFICIAL_EMAIL' : 'PHONE_MISSING' }
    }
    return row
  })
  const result: MessageBatchResult = { batchId, recipients: delivery.length, primaryRecipients: input.recipients.length, channels: input.channels, delivery, externalDeliverySucceeded: delivery.some((row) => input.channels.some((channel) => row[channel]?.queued)), emailQueued: delivery.filter((row) => row.email?.queued).length, smsQueued: delivery.filter((row) => row.sms?.queued).length }
  try {
    await prisma.$transaction(async (tx) => {
      // This unique claim and every delivery row commit together. A retried click
      // returns the original batch instead of creating duplicate communications.
      await tx.auditLog.create({ data: { id: batchId, actorId: input.senderId, action: 'MESSAGE_BATCH_QUEUED', targetType: 'MessageBatch', targetId: batchId, metadata: { requestHash, result } as unknown as Prisma.InputJsonValue } })
      const attachment = input.attachment ? await tx.messageAttachment.create({ data: { name: input.attachment.originalname, mime: input.attachment.mimetype, size: input.attachment.size, data: input.attachment.buffer }, select: { id: true } }) : null
      for (let start = 0; start < input.recipients.length; start += 400) {
        const recipients = input.recipients.slice(start, start + 400)
        const created = await tx.internalMessage.createMany({ data: recipients.map((recipient) => ({ id: ids.get(recipient.id)!, senderId: input.senderId, recipientId: recipient.id, subject: input.subject, body: input.body, ...(input.attachment && attachment ? { attachmentName: input.attachment.originalname, attachmentMime: input.attachment.mimetype, attachmentSize: input.attachment.size, sharedAttachmentId: attachment.id } : {}) })) })
        if (created.count !== recipients.length) throw new ApiError(500, 'The complete recipient batch could not be recorded.')
        await tx.notification.createMany({ data: recipients.map((recipient) => ({ userId: recipient.id, title: input.subject, message: input.body, type: 'MESSAGE', link: messageLink(recipient.role) })) })
      }
      const logs = input.targets.flatMap((target, index) => input.channels.map((channel) => {
        const queued = Boolean(delivery[index][channel]?.queued)
        return { channel: channel === 'email' ? 'EMAIL' as const : 'TEXT' as const, status: queued ? 'QUEUED' as const : 'FAILED' as const, subject: input.subject, body: input.body, senderId: input.senderId, recipientName: target.name, recipientEmail: target.email, recipientPhone: target.phone, failureReason: queued ? null : delivery[index][channel]?.reason ?? 'CONTACT_MISSING', metadata: { internalMessageId: ids.get(target.userId), recipientId: target.userId, batchId, relationship: target.relationship ?? 'PRIMARY', ...(channel === 'email' ? { mailQueueVersion: 1 } : { smsQueueVersion: 1 }), attempts: 0, nextAttemptAt: now.toISOString(), priority: input.recipients.length <= 10 ? 'HIGH' : 'BULK', language: input.language ?? 'en' } }
      }))
      for (let start = 0; start < logs.length; start += 400) await tx.correspondenceLog.createMany({ data: logs.slice(start, start + 400) })
    }, { maxWait: 10_000, timeout: 60_000 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const completed = await replay()
      if (completed) return completed
    }
    throw error
  }
  return result
}
