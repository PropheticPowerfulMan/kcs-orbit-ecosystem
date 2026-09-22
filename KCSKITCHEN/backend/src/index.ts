import { app } from './app.js'
import { env } from './config.js'
import { prisma } from './db.js'
import { startNotificationWorker } from './notifications.js'

const server = app.listen(env.PORT, () => console.log('KCS Kitchen API listening on ' + env.PORT))
const stopNotificationWorker = startNotificationWorker()
async function shutdown() {
  stopNotificationWorker()
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
