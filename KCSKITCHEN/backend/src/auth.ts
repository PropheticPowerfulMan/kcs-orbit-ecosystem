import {cashierSessionMatches} from './cashier-session.js'
import { prisma } from './db.js'
import type { NextFunction, Request, Response } from 'express'
import {createAccessVerifier} from './ecosystemAccessVerifier.js'
import jwt from 'jsonwebtoken'
import type { KitchenRole, PersonType } from '@prisma/client'
import { env } from './config.js'

const verifyEcosystemAccess=createAccessVerifier({url:env.ORBIT_API_URL,key:env.ORBIT_API_KEY,organization:env.ORBIT_ORGANIZATION_ID,app:'KCS_KITCHEN'})

export type KitchenIdentity = {
  userId: string
  orbitPersonId: string
  fullName: string
  email: string | null
  personType: PersonType
  role: KitchenRole
  hasOfficialPhoto: boolean
  isSuperAdministrator?: boolean
  credentialScope?: 'KITCHEN_LOCAL' | 'KITCHEN_CASHIER_LOCAL'
  credentialVersion?: number
  canManageOwnCredentials: boolean
}

export type AuthRequest = Request & { kitchenUser?: KitchenIdentity }

export async function verifyKitchenIdentityAccess(identity:KitchenIdentity){await verifyEcosystemAccess([identity.userId,identity.orbitPersonId,identity.email])}

export function signSession(identity: KitchenIdentity) {
  return jwt.sign(identity, env.JWT_SECRET, { expiresIn: '8h', issuer: 'kcs-kitchen' })
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization')
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required' })
  try {
    req.kitchenUser = jwt.verify(header.slice(7), env.JWT_SECRET, { issuer: 'kcs-kitchen' }) as KitchenIdentity
    if(req.kitchenUser.userId.startsWith('kitchen-cashier:')){
      const account=await prisma.kitchenCashierAccount.findUnique({where:{id:req.kitchenUser.userId.slice('kitchen-cashier:'.length)}})
      if(!cashierSessionMatches(req.kitchenUser,account))return res.status(401).json({message:'Kitchen cashier credentials changed or access is disabled. Sign in again.'})
    }else await verifyEcosystemAccess([req.kitchenUser.userId,req.kitchenUser.orbitPersonId,req.kitchenUser.email])
    if (req.kitchenUser.role === 'KITCHEN_ADMIN' || req.kitchenUser.credentialScope === 'KITCHEN_LOCAL' || (req.kitchenUser.role === 'CASHIER' && !req.kitchenUser.userId.startsWith('kitchen-cashier:'))) {
      const row=await prisma.kitchenManagerCredential.findUnique({where:{orbitPersonId:req.kitchenUser.orbitPersonId}})
      if(row){
        const access=await prisma.kitchenAccess.findUnique({where:{orbitPersonId:req.kitchenUser.orbitPersonId}})
        if(!access?.isActive||access.role!=='KITCHEN_ADMIN')return res.status(403).json({message:'Kitchen manager access is disabled'})
        if(row.nexusUserId!==req.kitchenUser.userId||req.kitchenUser.credentialScope!=='KITCHEN_LOCAL'||row.version!==req.kitchenUser.credentialVersion)return res.status(401).json({message:'Kitchen credentials changed. Sign in again.'})
        req.kitchenUser.email=row.email
      }else if(req.kitchenUser.role==='CASHIER')return res.status(401).json({message:'Use the independent local Kitchen cashier account.'})
      else if(req.kitchenUser.credentialScope==='KITCHEN_LOCAL')return res.status(401).json({message:'Kitchen manager account is no longer available'})
      else if(req.kitchenUser.role==='KITCHEN_ADMIN'&&!req.kitchenUser.isSuperAdministrator){const access=await prisma.kitchenAccess.findUnique({where:{orbitPersonId:req.kitchenUser.orbitPersonId}});if(!access?.isActive||access.role!=='KITCHEN_ADMIN')return res.status(403).json({message:'Kitchen manager access is disabled'})}
    }
    if (req.kitchenUser.personType === 'STUDENT') {
      const url = new URL('/api/integration/read/identity-access/'+encodeURIComponent(req.kitchenUser.orbitPersonId),env.ORBIT_API_URL)
      url.searchParams.set('organizationId',env.ORBIT_ORGANIZATION_ID)
      const response = await fetch(url,{headers:{'x-api-key':env.ORBIT_API_KEY,'x-app-slug':'KCS_KITCHEN'},signal:AbortSignal.timeout(6000)})
      if (!response.ok) return res.status(503).json({message:'Institutional account verification is temporarily unavailable'})
      if (!(await response.json() as {allowed?:boolean}).allowed) return res.status(403).json({message:'Student account is inactive or archived'})
    }
    next()
  } catch(error:any) {
    if(error?.status===403||error?.status===503)return res.status(error.status).json({message:error.message})
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
