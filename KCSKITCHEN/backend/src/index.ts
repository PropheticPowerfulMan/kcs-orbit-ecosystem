import { app } from './app.js'
import { env } from './config.js'
import { prisma } from './db.js'

const server = app.listen(env.PORT, () => console.log('KCS Kitchen API listening on ' + env.PORT))
async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
