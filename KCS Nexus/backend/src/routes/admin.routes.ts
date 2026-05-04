import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { asyncHandler, success } from '../utils/api.js'

export const adminRouter = Router()

adminRouter.use(authenticate, requireRoles('admin'))

adminRouter.get('/stats', asyncHandler(async (_req, res) => {
  const [students, teachers, applications, media, news, events, liveEvents] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.teacherProfile.count(),
    prisma.admissionApplication.count({ where: { status: 'SUBMITTED' } }),
    prisma.mediaItem.count(),
    prisma.newsPost.count(),
    prisma.event.count(),
    prisma.event.count({ where: { liveStreamEnabled: true } }),
  ])

  return success(res, {
    students,
    teachers,
    openApplications: applications,
    mediaItems: media,
    publishedNews: news,
    scheduledEvents: events,
    liveEvents,
  })
}))

adminRouter.get('/analytics', asyncHandler(async (_req, res) => {
  const [recentApplications, recentNews, riskRecommendations] = await Promise.all([
    prisma.admissionApplication.findMany({ take: 5, orderBy: { submittedAt: 'desc' } }),
    prisma.newsPost.findMany({ take: 5, orderBy: { publishedAt: 'desc' } }),
    prisma.aIRecommendation.findMany({ take: 5, orderBy: { createdAt: 'desc' } }),
  ])

  return success(res, {
    recentApplications,
    recentNews,
    riskRecommendations,
    generatedAt: new Date().toISOString(),
  })
}))

adminRouter.get('/export/:type', asyncHandler(async (req, res) => {
  const content = `KCS Nexus export generated for ${req.params.type} at ${new Date().toISOString()}`
  res.setHeader('Content-Type', 'text/plain')
  res.setHeader('Content-Disposition', `attachment; filename=${req.params.type}-export.txt`)
  res.send(content)
}))
