import {createHash} from 'node:crypto'
import { prisma } from './db.js'
import { env } from './config.js'
import type { KitchenIdentity } from './auth.js'
import { hashLocalPassword, verifyLocalPassword } from './local-password.js'
import { canManageOwnKitchenCredentials, reauthenticatedAsSameAccount } from './credential-policy.js'
export class KitchenCredentialError extends Error { constructor(public statusCode:number,message:string){super(message)} }
export async function bootstrapManagerCredential(identity:KitchenIdentity,password:string,verifiedUser:{id?:unknown;isSuperAdministrator?:boolean},identifier?:string) {
 const access=await prisma.kitchenAccess.findUnique({where:{orbitPersonId:identity.orbitPersonId}})
 if(verifiedUser.isSuperAdministrator||!reauthenticatedAsSameAccount(identity.userId,verifiedUser.id)||!canManageOwnKitchenCredentials({userId:identity.userId,orbitPersonId:identity.orbitPersonId,explicitKitchenAdmin:Boolean(access?.isActive&&access.role==='KITCHEN_ADMIN')}))throw new KitchenCredentialError(403,'Only the designated Kitchen manager may manage local credentials. Nexus administration is protected.')
 if(!identity.email)throw new KitchenCredentialError(409,'A manager email is required before local credentials can be created')
 const row=await prisma.kitchenManagerCredential.upsert({where:{orbitPersonId:identity.orbitPersonId},create:{orbitPersonId:identity.orbitPersonId,nexusUserId:identity.userId,email:identity.email.toLowerCase(),passwordHash:hashLocalPassword(password)},update:{}})
 if(row.nexusUserId!==identity.userId||!verifyLocalPassword(password,row.passwordHash))throw new KitchenCredentialError(401,'Use your current Kitchen manager email and password')
 if(identifier)await registerManagerCredentialAlias(row,identifier,verifiedUser)
 return row
}
export async function managerCredentialForChange(identity:KitchenIdentity,password:string) {
 const access=await prisma.kitchenAccess.findUnique({where:{orbitPersonId:identity.orbitPersonId}})
 if(!canManageOwnKitchenCredentials({userId:identity.userId,orbitPersonId:identity.orbitPersonId,explicitKitchenAdmin:Boolean(access?.isActive&&access.role==='KITCHEN_ADMIN')}))throw new KitchenCredentialError(403,'Only the designated Kitchen manager may change local credentials')
 let row=await prisma.kitchenManagerCredential.findUnique({where:{orbitPersonId:identity.orbitPersonId}})
 if(!row){
  if(!identity.email)throw new KitchenCredentialError(409,'Sign in again before changing local credentials')
  const response=await fetch(new URL('/api/auth/login',env.NEXUS_API_URL),{method:'POST',headers:{'content-type':'application/json','x-kcs-client':'KCS_KITCHEN'},body:JSON.stringify({identifier:identity.email,password}),signal:AbortSignal.timeout(12000)})
  const body=await response.json().catch(()=>null)as any
  if(!response.ok||!body?.data?.user)throw new KitchenCredentialError(400,'Current password is incorrect')
  row=await bootstrapManagerCredential(identity,password,body.data.user)
 }
 if(row.nexusUserId!==identity.userId)throw new KitchenCredentialError(409,'This Kitchen session does not match the credential owner')
 if(!verifyLocalPassword(password,row.passwordHash))throw new KitchenCredentialError(400,'Current Kitchen password is incorrect')
 return row
}

const aliasKey=(identifier:string)=>'kitchen-manager-login-alias:'+createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex')
export async function managerCredentialByIdentifier(identifier:string){
 const normalized=identifier.trim().toLowerCase()
 const direct=await prisma.kitchenManagerCredential.findUnique({where:{email:normalized}})
 if(direct||normalized.includes('@'))return direct
 const proof=await prisma.auditLog.findUnique({where:{id:aliasKey(normalized)}})
 if(!proof||proof.action!=='KITCHEN_MANAGER_LOGIN_ALIAS_VERIFIED'||proof.entityType!=='KitchenManagerCredential')return null
 const owner=proof.newValue as {nexusUserId?:string;orbitPersonId?:string}|null
 const credential=await prisma.kitchenManagerCredential.findUnique({where:{id:proof.entityId}})
 return credential&&owner?.nexusUserId===credential.nexusUserId&&owner?.orbitPersonId===credential.orbitPersonId?credential:null
}
export async function registerManagerCredentialAlias(row:{id:string;orbitPersonId:string;nexusUserId:string},identifier:string,verifiedUser:{id?:unknown;isSuperAdministrator?:boolean}){
 const normalized=identifier.trim().toLowerCase()
 if(!normalized||normalized.includes('@'))return
 if(verifiedUser.isSuperAdministrator||!reauthenticatedAsSameAccount(row.nexusUserId,verifiedUser.id))throw new KitchenCredentialError(403,'A verified matching manager identity is required for this alias')
 const access=await prisma.kitchenAccess.findUnique({where:{orbitPersonId:row.orbitPersonId}})
 if(!access?.isActive||access.role!=='KITCHEN_ADMIN')throw new KitchenCredentialError(403,'Kitchen manager access is disabled')
 const id=aliasKey(normalized),proof=await prisma.auditLog.upsert({where:{id},create:{id,actorId:row.orbitPersonId,actorRole:'KITCHEN_ADMIN',action:'KITCHEN_MANAGER_LOGIN_ALIAS_VERIFIED',entityType:'KitchenManagerCredential',entityId:row.id,newValue:{nexusUserId:row.nexusUserId,orbitPersonId:row.orbitPersonId},reason:'Verified institutional identifier linked to an independent Kitchen manager credential'},update:{}})
 const owner=proof.newValue as {nexusUserId?:string;orbitPersonId?:string}|null
 if(proof.action!=='KITCHEN_MANAGER_LOGIN_ALIAS_VERIFIED'||proof.entityId!==row.id||owner?.nexusUserId!==row.nexusUserId||owner?.orbitPersonId!==row.orbitPersonId)throw new KitchenCredentialError(409,'This identifier is already linked to a different Kitchen manager. No password was changed.')
}
