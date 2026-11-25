import {app} from '../app.js'
import {prisma} from './database.js'
import {setDatabaseReady} from '../config/runtimeStatus.js'
import {startJuryWorkers} from './worker.js'
if(process.env.JURY_ENVIRONMENT!=='staging'||process.env.JURY_ENABLED!=='true')throw Error('This test entry point is restricted to Jury staging.')
await prisma.$queryRaw`SELECT 1`
setDatabaseReady(true)
const server=app.listen(Number(process.env.PORT||5000),'0.0.0.0',()=>console.log('JURY_STAGING_READY'))
const stopWorkers=startJuryWorkers()
process.on('SIGTERM',()=>{stopWorkers();server.close(()=>{void prisma.$disconnect()})})
