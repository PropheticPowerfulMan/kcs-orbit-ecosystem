import { env } from './config/env.js'
import { prisma } from './config/prisma.js'
import { app } from './app.js'

const start = async () => {
  await prisma.$connect()

  app.listen(env.PORT, () => {
    console.log(`KCS Nexus API listening on port ${env.PORT}`)
  })
}

start().catch(async (error) => {
  console.error('Failed to start server', error)
  await prisma.$disconnect()
  process.exit(1)
})
