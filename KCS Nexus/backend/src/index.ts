import {prepareAnnualPromotionReviews} from './services/annualPromotionReview.service.js'
import {startJuryWorkers} from './jury/worker.js'
import {startMediaUploadCleanup} from './services/mediaUpload.service.js'
import { startAcademicAutoClosureWorker } from './services/academicAutoClosure.service.js'
import {startRegistryMirrorReconciliation} from './services/registryMirror.service.js'
import {ensureUploadStorage} from './utils/uploadStorage.js'
import {startSentinelStaffAttendanceSync} from './services/sentinelStaffAttendance.service.js'
import { startOutboundSmsQueue } from './services/outboundSmsQueue.js'
import { env } from './config/env.js'
import { prisma } from './config/prisma.js'
import { app } from './app.js'
import { isDatabaseReady, setDatabaseReady } from './config/runtimeStatus.js'
import { ensureUserAccessCodeColumn } from './utils/userAccessCode.js'
import { startOutboundMailQueue } from './services/outboundMailQueue.js'
import { startEventReminderWorker } from './services/eventReminder.service.js'

const start = async () => {
  await ensureUploadStorage()
  try {
    await prisma.$connect()
    await ensureUserAccessCodeColumn(prisma)
    setDatabaseReady(true)
    startOutboundMailQueue()
    startOutboundSmsQueue()
    startEventReminderWorker()
    startAcademicAutoClosureWorker()
    void prepareAnnualPromotionReviews().catch(error=>console.error('[annual-review]',error instanceof Error?error.message:'Review unavailable'))
    startMediaUploadCleanup()
    startSentinelStaffAttendanceSync()
    startRegistryMirrorReconciliation()
    if(process.env.JURY_ENABLED==='true')startJuryWorkers()
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

const annualReviewTimer=setInterval(()=>{void prepareAnnualPromotionReviews().catch(error=>console.error('[annual-review]',error instanceof Error?error.message:'Review unavailable'))},3600000);annualReviewTimer.unref();
