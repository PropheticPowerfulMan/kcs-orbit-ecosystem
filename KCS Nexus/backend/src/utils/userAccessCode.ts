import { Prisma, PrismaClient } from '@prisma/client'
import { env } from '../config/env.js'

let ensureAccessCodePromise: Promise<void> | null = null

export const isMissingAccessCodeColumnError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
    return true
  }

  const message = error instanceof Error ? error.message : ''
  return /accessCode/i.test(message) && /column|colonne/i.test(message)
}

const applyAccessCodeCompatibility = async (prisma: PrismaClient) => {
  if (!env.DATABASE_URL.startsWith('postgres')) {
    return
  }

  await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accessCode" TEXT')
  await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "accessCode" = CONCAT('ACC-', LEFT(COALESCE("role"::text, 'USR'), 3), '-', UPPER(SUBSTRING(MD5("id"), 1, 6)))
    WHERE "accessCode" IS NULL OR BTRIM("accessCode") = ''
  `)
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "User_accessCode_key" ON "User"("accessCode")')
}

export const ensureUserAccessCodeColumn = async (prisma: PrismaClient, force = false) => {
  if (force) {
    await applyAccessCodeCompatibility(prisma)
    return
  }

  if (!ensureAccessCodePromise) {
    ensureAccessCodePromise = applyAccessCodeCompatibility(prisma).catch((error) => {
      ensureAccessCodePromise = null
      throw error
    })
  }

  await ensureAccessCodePromise
}