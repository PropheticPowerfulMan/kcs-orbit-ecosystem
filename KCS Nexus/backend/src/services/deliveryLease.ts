import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'

export async function claimQueuedDelivery(row: { id: string; metadata: Prisma.JsonValue | null }) {
  if (!row.metadata || typeof row.metadata !== 'object' || Array.isArray(row.metadata)) return null
  const metadata = row.metadata as Record<string, unknown>
  if (typeof metadata.leaseUntil === 'string' && Date.parse(metadata.leaseUntil) > Date.now()) return null
  const claimed: Record<string, unknown> = { ...metadata, leaseId: randomUUID(), leaseUntil: new Date(Date.now() + 120_000).toISOString() }
  const result = await prisma.correspondenceLog.updateMany({
    where: { id: row.id, status: 'QUEUED', metadata: { equals: row.metadata as Prisma.InputJsonValue } },
    data: { metadata: claimed as Prisma.InputJsonValue },
  })
  return result.count === 1 ? claimed : null
}
