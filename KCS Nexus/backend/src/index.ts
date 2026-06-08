import { env } from './config/env.js'
import { prisma } from './config/prisma.js'
import { app } from './app.js'
import { isDatabaseReady, setDatabaseReady } from './config/runtimeStatus.js'
import { ensureUserAccessCodeColumn } from './utils/userAccessCode.js'

const start = async () => {
  try {
    await prisma.$connect()
    await ensureUserAccessCodeColumn(prisma)
    setDatabaseReady(true)
  } catch (error) {
    setDatabaseReady(false)
    console.error('KCS Nexus database unavailable; starting API in degraded mode.', error)
  }

  app.listen(env.PORT, () => {
    const mode = isDatabaseReady() ? 'ready' : 'degraded: database unavailable'
    console.log(`KCS Nexus API listening on port ${env.PORT} (${mode})`)
  })
}

start().catch(async (error) => {
  console.error('Failed to start server', error)
  await prisma.$disconnect()
  process.exit(1)
})
