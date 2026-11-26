import {academicWorkspaceFor,selectedAcademicWorkspace} from '../utils/academicApplicationAccess.js'
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
  const selected=selectedAcademicWorkspace(user,req.user!.sub==='configured-superadmin',req.header('X-Nexus-Academic-Workspace'));if(!selected||selected==='student')throw new ApiError(403,'This academic workspace is not authorized. / Cet espace académique n’est pas autorisé.')
  const ticket=plannerTickets.issue({userId:user.id,email:user.email,firstName:user.firstName,middleName:user.middleName,lastName:user.lastName,role:user.role,accessRoles,workspace:selected})
  return success(res, { url: `/lesson-plan/#/sso?ticket=${encodeURIComponent(ticket)}` })
}))
lessonPlanRouter.post('/exchange', asyncHandler(async (req, res) => {
  const identity=plannerTickets.consume(req.body?.ticket)
  await assertAccountAccess(identity.userId)
  const user=await prisma.user.findUnique({where:{id:identity.userId},include:{teacherProfile:true}})
  const root=Boolean(user&&process.env.SUPERADMIN_EMAIL&&user.email.toLowerCase()===process.env.SUPERADMIN_EMAIL.trim().toLowerCase());const workspace=selectedAcademicWorkspace(user,root,identity.workspace)
  if(!user||!workspace||workspace==='student')throw new ApiError(403,'Eduplanner access is not enabled for this identity')
  return success(res,{...identity,role:user.role,workspace,grantedWorkspace:academicWorkspaceFor(user,root)})
}))
lessonPlanRouter.post('/academy-exchange',asyncHandler(async(req,res)=>{
 const identity=plannerTickets.consume(req.body?.ticket,'academy-read')
  await assertAccountAccess(identity.userId)
  const user=await prisma.user.findUnique({where:{id:identity.userId},include:{teacherProfile:true}})
  const root=Boolean(user&&process.env.SUPERADMIN_EMAIL&&user.email.toLowerCase()===process.env.SUPERADMIN_EMAIL.trim().toLowerCase());const workspace=selectedAcademicWorkspace(user,root,identity.workspace)
  if(!user||!workspace||workspace==='student')throw new ApiError(403,'Eduplanner access is not enabled for this identity')
  return success(res,{...identity,role:user.role,workspace,grantedWorkspace:academicWorkspaceFor(user,root)})
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

// Refresh access from the canonical Nexus identity, never from a browser-supplied role.
lessonPlanRouter.post('/session-identity', asyncHandler(async (req, res) => {
 const authorization=req.header('authorization')||''
 if(!authorization.startsWith('Bearer '))throw new ApiError(401,'An Eduplanner session is required')
 const verified=await fetch(new URL('/api/ecosystem/session-check',process.env.LESSON_PLAN_INTERNAL_URL||'http://lessonplan_api:3001'),{method:'POST',headers:{authorization},signal:AbortSignal.timeout(8000)})
 const session=await verified.json().catch(()=>null) as {allowed?:boolean;nexusUserId?:string;verifiedEmail?:string}|null
 if(!verified.ok||!session?.allowed)throw new ApiError([401,403].includes(verified.status)?verified.status:503,'The Eduplanner session could not be verified')
 const linkedId=session.nexusUserId
 const email=typeof session.verifiedEmail==='string'?session.verifiedEmail.trim().toLowerCase():''
 if(!linkedId&&!email)throw new ApiError(404,'This Eduplanner account has no verified institutional link')
 const user=await prisma.user.findUnique({where:linkedId?(linkedId==='configured-superadmin'?{email:(process.env.SUPERADMIN_EMAIL||'').trim().toLowerCase()}:{id:linkedId}):{email},include:{teacherProfile:true}})
 if(!user)throw new ApiError(404,'This Eduplanner account has no matching institutional identity')
 const id=linkedId||user.id
 await assertAccountAccess(id)
 const superadmin=Boolean(user&&process.env.SUPERADMIN_EMAIL&&user.email.toLowerCase()===process.env.SUPERADMIN_EMAIL.trim().toLowerCase())
 const workspace=selectedAcademicWorkspace(user,superadmin,req.body?.workspace)
 if(!user||!workspace||workspace==='student')throw new ApiError(403,'Eduplanner access is not enabled for this identity')
 res.set('Cache-Control','private, no-store').vary('Authorization')
 return success(res,{id,userId:id,role:user.role,workspace,grantedWorkspace:academicWorkspaceFor(user,superadmin)})
}))
