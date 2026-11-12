import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { KitchenRole, PersonType } from '@prisma/client'
import { env } from './config.js'

export type KitchenIdentity = {
  userId: string
  orbitPersonId: string
  fullName: string
  email: string | null
  personType: PersonType
  role: KitchenRole
  hasOfficialPhoto: boolean
  canManageOwnCredentials: boolean
}

export type AuthRequest = Request & { kitchenUser?: KitchenIdentity }

export function signSession(identity: KitchenIdentity) {
  return jwt.sign(identity, env.JWT_SECRET, { expiresIn: '8h', issuer: 'kcs-kitchen' })
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization')
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required' })
  try {
    req.kitchenUser = jwt.verify(header.slice(7), env.JWT_SECRET, { issuer: 'kcs-kitchen' }) as KitchenIdentity
    if (req.kitchenUser.personType === 'STUDENT') {
      const url = new URL('/api/integration/read/identity-access/'+encodeURIComponent(req.kitchenUser.orbitPersonId),env.ORBIT_API_URL)
      url.searchParams.set('organizationId',env.ORBIT_ORGANIZATION_ID)
      const response = await fetch(url,{headers:{'x-api-key':env.ORBIT_API_KEY,'x-app-slug':'KCS_KITCHEN'},signal:AbortSignal.timeout(6000)})
      if (!response.ok) return res.status(503).json({message:'Institutional account verification is temporarily unavailable'})
      if (!(await response.json() as {allowed?:boolean}).allowed) return res.status(403).json({message:'Student account is inactive or archived'})
    }
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired session' })
  }
}

export function allow(...roles: KitchenRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.kitchenUser || !roles.includes(req.kitchenUser.role)) {
      return res.status(403).json({ message: 'Insufficient Kitchen permissions' })
    }
    next()
  }
}
