import {assertApplicationToken} from '../services/applicationPasswords.js'
import {hasStaffWorkspaceAccess,requestedWorkspaceRole} from '../utils/staffWorkspace.js'
import {isMediaAccount,mediaRequestAllowed} from '../utils/mediaAccount.js'
import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { assertAccountAccess } from '../services/accountAccess.service.js'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { ApiError } from '../utils/api.js'

type AuthPayload = {
  mediaOnly?:boolean
  staffWorkspaceAllowed?:boolean
  sub: string
  role: 'admin' | 'staff' | 'teacher' | 'student' | 'parent'
}

export type AuthenticatedRequest = Request & {
  user?: AuthPayload
}

export const authenticate = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication required'))
  }

  try {
    const token = header.replace('Bearer ', '')
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload
    if ((payload as any).application) {
      const path=new URL(req.originalUrl,'http://nexus.internal').pathname
      if(req.method!=='POST'||path!=='/api/academy/launch'||(payload as any).application!=='KCS_ACADEMY')throw new ApiError(403,'This application session cannot access Nexus.')
      await assertApplicationToken(token,'KCS_ACADEMY')
    }
    const account=await assertAccountAccess(payload.sub)
    const mediaOnly=isMediaAccount(account)
    if(mediaOnly&&!mediaRequestAllowed(req.method,req.originalUrl,payload.sub))return next(new ApiError(403,'This Media account can only manage the school website and its own settings. / Ce compte Media est limité au site web de l’école et à ses propres paramètres.'))
    // Context is per request and verified against current database grants, never trusted from the client.
    const requested = req.get('X-Nexus-Workspace')
    let effectiveRole = mediaOnly ? 'staff' as const : payload.role
    if (requested && !mediaOnly) {
      const trustedAccount = payload.sub === 'configured-superadmin' ? {role:'ADMIN'} : account
      const teaching = requested === 'teacher' && trustedAccount?.role !== 'TEACHER'
        ? Boolean(await prisma.teacherProfile.findUnique({where:{userId:payload.sub},select:{id:true}})) : false
      const resolved = requestedWorkspaceRole(trustedAccount, requested, teaching)
      if (!resolved) throw new ApiError(403, 'This workspace is not authorized for your account. / Cet espace n’est pas autorisé pour votre compte.')
      effectiveRole = resolved
    }
    _res.vary('Authorization')
    _res.vary('X-Nexus-Workspace')
    req.user = {...payload,role:effectiveRole,mediaOnly,staffWorkspaceAllowed:payload.sub==='configured-superadmin'||hasStaffWorkspaceAccess(account)}
    next()
  } catch(error:any) {
    if(error instanceof ApiError)return next(error)
    if(error?.status===503||error?.status===403)return next(new ApiError(error.status,error.message))
    next(new ApiError(401, 'Invalid or expired token'))
  }
}

export const requireRoles = (...roles: AuthPayload['role'][]) => {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(403, 'Insufficient permissions'))
    }

    if (req.user.role === 'admin' || (roles.includes(req.user.role) && (req.user.role !== 'staff' || req.user.staffWorkspaceAllowed === true))) {
      return next()
    }

    try {
      const needsTeacherAccess = roles.includes('teacher')
      const needsStaffAccess = roles.includes('staff')
      if (needsTeacherAccess || needsStaffAccess) {
        const profile = await prisma.user.findUnique({
          where: { id: req.user.sub },
          select: { role:true, permissions:true, teacherProfile: { select: { id: true } } },
        })
        if ((needsTeacherAccess && profile?.teacherProfile) || (needsStaffAccess && hasStaffWorkspaceAccess(profile))) {
          return next()
        }
      }
      return next(new ApiError(403, 'Insufficient permissions'))
    } catch (error) {
      return next(error)
    }
  }
}

export const requireAdmin = () => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ApiError(403, 'Administrator permissions required'))
    }

    next()
  }
}

export const requireSuperAdmin = () => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || req.user.sub !== 'configured-superadmin') {
      return next(new ApiError(403, 'KCS Nexus superadministrator permissions required'))
    }
    next()
  }
}

/** Website editing is a capability, not a general administrator role. */
export const requireWebsiteEditor=()=> (req:AuthenticatedRequest,_res:Response,next:NextFunction)=>{
 if(req.user&&(req.user.role==='admin'||req.user.mediaOnly))return next()
 return next(new ApiError(403,'Website publishing permission required'))
}

/** Full website co-management is limited to the configured SuperAdmin and the explicit Media capability. */
export const requireWebsiteManager=()=> (req:AuthenticatedRequest,_res:Response,next:NextFunction)=>{
 if(req.user&&(req.user.sub==='configured-superadmin'||req.user.mediaOnly===true))return next()
 return next(new ApiError(403,'Website management permission required'))
}
