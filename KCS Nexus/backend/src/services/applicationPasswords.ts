import {verifyTotp} from '../utils/totp.js'
import {randomBytes,createHash} from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {z} from 'zod'
import type {Router} from 'express'
import type {User} from '@prisma/client'
import {prisma} from '../config/prisma.js'
import {env} from '../config/env.js'
import {ApiError,asyncHandler,success} from '../utils/api.js'
import {strongPasswordSchema,assertPasswordDoesNotContainIdentity} from '../utils/passwordPolicy.js'
import {sendSchoolMail} from '../utils/mail.js'
import {isMediaAccount} from '../utils/mediaAccount.js'

export const credentialApplications=['KCS_SENTINEL','KCS_ACADEMY','KCS_KITCHEN'] as const
export type CredentialApplication=typeof credentialApplications[number]
const applicationSchema=z.enum(credentialApplications)
const names:Record<CredentialApplication,string>={KCS_SENTINEL:'KCS Sentinel',KCS_ACADEMY:'KCS Nexus Academy',KCS_KITCHEN:'KCS Kitchen'}
const digest=(token:string)=>createHash('sha256').update(token).digest('hex')
type Dependencies={resolveInitial:(identifier:string,password:string)=>Promise<User|null>;safeUser:(user:User)=>Promise<unknown>;checkAccess:(user:User)=>Promise<unknown>}

export async function assertApplicationToken(token:string,expected?:CredentialApplication){
 let payload:jwt.JwtPayload
 try{payload=jwt.verify(token,env.JWT_SECRET,{audience:'kcs-application-password',algorithms:['HS256']}) as jwt.JwtPayload}catch{throw new ApiError(401,'Invalid or expired application session')}
 const application=applicationSchema.safeParse(payload.application)
 if(!application.success||!payload.sub||(expected&&application.data!==expected))throw new ApiError(403,'Application session scope mismatch')
 const credential=await prisma.applicationCredential.findUnique({where:{application_userId:{application:application.data,userId:payload.sub}},include:{user:true}})
 if(!credential||credential.version!==payload.credentialVersion||credential.user.accountBlockedAt)throw new ApiError(401,'Application credentials changed. Sign in again.')
 return{payload,credential,application:application.data}
}

export function registerApplicationPasswordRoutes(router:Router,deps:Dependencies){
 const identity=z.object({application:applicationSchema,identifier:z.string().trim().min(2).max(254),password:z.string().min(1).max(512),twoFactorCode:z.string().max(6).optional()})
 const account=async(application:CredentialApplication,identifier:string,password:string)=>{
  const user=await deps.resolveInitial(identifier,password)
  if(!user?.passwordHash||isMediaAccount(user))throw new ApiError(401,'Incorrect application identifier or password')
  await deps.checkAccess(user)
  // Insert-only. A later Nexus password update can never replace this application's hash.
  const credential=await prisma.applicationCredential.upsert({where:{application_userId:{application,userId:user.id}},create:{application,userId:user.id,passwordHash:user.passwordHash},update:{}})
  return{user,credential}
 }
 const verify=async(application:CredentialApplication,identifier:string,password:string,twoFactorCode?:string)=>{
  const data=await account(application,identifier,password),row=data.credential
  if(row.loginLockedUntil&&row.loginLockedUntil>new Date())throw new ApiError(429,'Account locked for '+Math.max(1,Math.ceil((row.loginLockedUntil.getTime()-Date.now())/60000))+' minute(s) in '+names[application]+'.')
  if(row.loginLockedUntil&&row.loginLockedUntil<=new Date())await prisma.applicationCredential.update({where:{id:row.id},data:{failedLoginAttempts:0,loginLockedUntil:null}})
  if(!await bcrypt.compare(password,row.passwordHash)){
   const failed=await prisma.applicationCredential.update({where:{id:row.id},data:{failedLoginAttempts:{increment:1}}})
   if(failed.failedLoginAttempts>=6)await prisma.applicationCredential.update({where:{id:row.id},data:{loginLockedUntil:new Date(Date.now()+15*60000)}})
   throw new ApiError(401,'Incorrect '+names[application]+' identifier or password')
  }
  if(data.user.twoFactorEnabled&&(!data.user.twoFactorSecret||!twoFactorCode||!verifyTotp(data.user.twoFactorSecret,twoFactorCode)))throw new ApiError(428,'Two-factor authentication code required for this account')
  await prisma.applicationCredential.update({where:{id:row.id},data:{failedLoginAttempts:0,loginLockedUntil:null}})
  return data
 }
 router.post('/application/login',asyncHandler(async(req,res)=>{
  const input=identity.parse(req.body),{user,credential}=await verify(input.application,input.identifier,input.password,input.twoFactorCode)
  const token=jwt.sign({sub:user.id,role:user.role.toLowerCase(),application:input.application,credentialVersion:credential.version},env.JWT_SECRET,{audience:'kcs-application-password',expiresIn:'12h'})
  return success(res,{user:await deps.safeUser(user),token,credentialScope:input.application},'Signed in to '+names[input.application])
 }))
 router.post('/application/change-password',asyncHandler(async(req,res)=>{
  const input=identity.extend({newPassword:strongPasswordSchema}).parse(req.body),{user,credential}=await verify(input.application,input.identifier,input.password,input.twoFactorCode)
  if(input.password===input.newPassword)throw new ApiError(400,'The new password must be different')
  const issues=assertPasswordDoesNotContainIdentity(input.newPassword,user);if(issues.length)throw new ApiError(400,issues.join(' '))
  const passwordHash=await bcrypt.hash(input.newPassword,12)
  await prisma.$transaction(async tx=>{
   const saved=await tx.applicationCredential.updateMany({where:{id:credential.id,version:credential.version},data:{passwordHash,version:{increment:1},failedLoginAttempts:0,loginLockedUntil:null,changedAt:new Date()}})
   if(saved.count!==1)throw new ApiError(409,'Application credentials changed concurrently. Retry with the current password.')
   await tx.applicationPasswordResetToken.updateMany({where:{credentialId:credential.id,usedAt:null},data:{usedAt:new Date()}})
   await tx.auditLog.create({data:{actorId:user.id,action:'APPLICATION_LOCAL_PASSWORD_CHANGED',targetType:'ApplicationCredential',targetId:credential.id,metadata:{application:input.application,otherApplicationsUnchanged:true}}})
  })
  return success(res,{application:input.application,otherApplicationsUnchanged:true},'Password changed only in '+names[input.application])
 }))
 router.post('/application/forgot-password',asyncHandler(async(req,res)=>{
  const input=z.object({application:applicationSchema,identifier:z.string().trim().min(2).max(254)}).parse(req.body)
  // Password recovery never authenticates against or resets a different application.
  const user=await prisma.user.findFirst({where:{OR:[{email:{equals:input.identifier,mode:'insensitive'}},{accessCode:input.identifier.toUpperCase()}]}})
  if(user?.passwordHash&&!user.accountBlockedAt&&!isMediaAccount(user)){
   try{await deps.checkAccess(user)}catch{return success(res,null,'If this account exists, an application-specific recovery link has been sent.')}
   const row=await prisma.applicationCredential.upsert({where:{application_userId:{application:input.application,userId:user.id}},create:{application:input.application,userId:user.id,passwordHash:user.passwordHash},update:{}})
   const raw=randomBytes(32).toString('base64url'),tokenHash=digest(raw)
   await prisma.$transaction(async tx=>{
    await tx.applicationPasswordResetToken.updateMany({where:{credentialId:row.id,usedAt:null},data:{usedAt:new Date()}})
    await tx.applicationPasswordResetToken.create({data:{credentialId:row.id,tokenHash,credentialVersion:row.version,expiresAt:new Date(Date.now()+30*60000)}})
   })
   const link=env.FRONTEND_URL.replace(/\/$/,'')+'/application-access?app='+input.application+'#resetToken='+encodeURIComponent(raw)
   await sendSchoolMail({to:user.email,subject:names[input.application]+' · Password recovery / Récupération du mot de passe',text:'Hello / Bonjour '+[user.firstName,user.lastName].join(' ')+',\n\n'+names[input.application]+'\nReset only this application’s password / Réinitialisez uniquement le mot de passe de cette application :\n'+link+'\n\nThis link expires in 30 minutes. Other application passwords remain unchanged.\nCe lien expire dans 30 minutes. Les mots de passe des autres applications restent inchangés.'}).catch(()=>undefined)
  }
  return success(res,null,'If this account exists, an application-specific recovery link has been sent.')
 }))
 router.post('/application/reset-password',asyncHandler(async(req,res)=>{
  const input=z.object({application:applicationSchema,token:z.string().min(32).max(256),password:strongPasswordSchema}).parse(req.body)
  const row=await prisma.applicationPasswordResetToken.findUnique({where:{tokenHash:digest(input.token)},include:{credential:{include:{user:true}}}})
  if(!row||row.usedAt||row.expiresAt<new Date()||row.credential.application!==input.application||row.credentialVersion!==row.credential.version)throw new ApiError(400,'Invalid or expired link for this application')
  await deps.checkAccess(row.credential.user)
  const issues=assertPasswordDoesNotContainIdentity(input.password,row.credential.user);if(issues.length)throw new ApiError(400,issues.join(' '))
  const passwordHash=await bcrypt.hash(input.password,12)
  await prisma.$transaction(async tx=>{
   const claimed=await tx.applicationPasswordResetToken.updateMany({where:{id:row.id,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}})
   if(claimed.count!==1)throw new ApiError(400,'This recovery link has already been used')
   const saved=await tx.applicationCredential.updateMany({where:{id:row.credentialId,version:row.credentialVersion},data:{passwordHash,version:{increment:1},failedLoginAttempts:0,loginLockedUntil:null,changedAt:new Date()}})
   if(saved.count!==1)throw new ApiError(409,'Credentials changed after this link was issued')
   await tx.applicationPasswordResetToken.updateMany({where:{credentialId:row.credentialId,usedAt:null},data:{usedAt:new Date()}})
   await tx.auditLog.create({data:{actorId:row.credential.userId,action:'APPLICATION_LOCAL_PASSWORD_RESET',targetType:'ApplicationCredential',targetId:row.credentialId,metadata:{application:input.application,otherApplicationsUnchanged:true}}})
  })
  return success(res,{application:input.application,otherApplicationsUnchanged:true},'Password reset only in '+names[input.application])
 }))
}
