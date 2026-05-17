import { env } from './config/env.js'
import { prisma } from './config/prisma.js'
import { app } from './app.js'

const ensureUserAccessCodeColumn = async () => {
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

const start = async () => {
  await prisma.$connect()
  await ensureUserAccessCodeColumn()

  app.listen(env.PORT, () => {
    console.log(`KCS Nexus API listening on port ${env.PORT}`)
  })
}

start().catch(async (error) => {
  console.error('Failed to start server', error)
  await prisma.$disconnect()
  process.exit(1)
})
