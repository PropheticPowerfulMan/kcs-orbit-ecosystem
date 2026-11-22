import {readLessonPlanDashboardPhoto} from '../services/lessonPlanDashboardPhoto.js'
import {assertAccountAccess} from '../services/accountAccess.service.js'
import {plannerTickets} from '../services/lessonPlanTickets.js'
import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'

export const lessonPlanRouter = Router()
lessonPlanRouter.post('/launch', authenticate, requireRoles('teacher', 'staff', 'admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = req.user!.sub === 'configured-superadmin'
    ? await prisma.user.findUnique({ where: { email: (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase() }, include: { teacherProfile: true } })
    : await prisma.user.findUnique({ where: { id: req.user!.sub }, include: { teacherProfile: true } })
  const accessRoles = Array.from(new Set([user?.role?.toLowerCase(), user?.teacherProfile ? 'teacher' : null].filter(Boolean))) as string[]
  const isTeacher = user?.role === 'TEACHER' || Boolean(user?.teacherProfile) || accessRoles.includes('teacher')
  if (!user || (!isTeacher && user.role !== 'ADMIN')) throw new ApiError(403, 'EduPlanner access is not enabled for this identity')
  if (!user.email) throw new ApiError(409, 'This institutional identity does not have an email address')
  await assertAccountAccess(user.id)
  const ticket=plannerTickets.issue({userId:user.id,email:user.email,firstName:user.firstName,middleName:user.middleName,lastName:user.lastName,role:user.role,accessRoles})
  return success(res, { url: `/lesson-plan/#/sso?ticket=${encodeURIComponent(ticket)}` })
}))
lessonPlanRouter.post('/exchange', asyncHandler(async (req, res) => {
  const identity=plannerTickets.consume(req.body?.ticket)
  await assertAccountAccess(identity.userId)
  return success(res,identity)
}))
lessonPlanRouter.post('/academy-exchange',asyncHandler(async(req,res)=>{
 const identity=plannerTickets.consume(req.body?.ticket,'academy-read')
 await assertAccountAccess(identity.userId)
 return success(res,identity)
}))

// Eduplanner supplies its own session; only its server-verified link chooses the Nexus account.
lessonPlanRouter.get('/dashboard-avatar', asyncHandler(async (req, res) => {
  const result = await readLessonPlanDashboardPhoto(req.header('authorization') || '', {
    verifySession: async authorization => {
      const response = await fetch(new URL('/api/ecosystem/session-check', process.env.LESSON_PLAN_INTERNAL_URL || 'http://lessonplan_api:3001'), {method:'POST',headers:{authorization},signal:AbortSignal.timeout(8000)})
      if (!response.ok) throw new ApiError([401,403].includes(response.status)?response.status:503, 'The Eduplanner session could not be verified')
      return response.json() as Promise<{allowed?:boolean;nexusUserId?:unknown}>
    },
    readAvatar: async id => {
      await assertAccountAccess(id)
      const user = await prisma.user.findUnique({where:id==='configured-superadmin'?{email:(process.env.SUPERADMIN_EMAIL||'').trim().toLowerCase()}:{id},select:{avatar:true}})
      if(!user)throw new ApiError(404,'Nexus account not found')
      return user.avatar
    },
  })
  res.set('Cache-Control','private, no-store').vary('Authorization')
  return success(res,result)
}))
