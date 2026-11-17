import { prisma } from './db.js'
import { env } from './config.js'
import type { KitchenIdentity } from './auth.js'
import { hashLocalPassword, verifyLocalPassword } from './local-password.js'
import { canManageOwnKitchenCredentials, reauthenticatedAsSameAccount } from './credential-policy.js'
export class KitchenCredentialError extends Error { constructor(public statusCode:number,message:string){super(message)} }
export async function bootstrapManagerCredential(identity:KitchenIdentity,password:string,verifiedUser:{id?:unknown;isSuperAdministrator?:boolean}) {
 const access=await prisma.kitchenAccess.findUnique({where:{orbitPersonId:identity.orbitPersonId}})
 if(verifiedUser.isSuperAdministrator||!reauthenticatedAsSameAccount(identity.userId,verifiedUser.id)||!canManageOwnKitchenCredentials({userId:identity.userId,orbitPersonId:identity.orbitPersonId,explicitKitchenAdmin:Boolean(access?.isActive&&access.role==='KITCHEN_ADMIN')}))throw new KitchenCredentialError(403,'Only the designated Kitchen manager may manage local credentials. Nexus administration is protected.')
 if(!identity.email)throw new KitchenCredentialError(409,'A manager email is required before local credentials can be created')
 const row=await prisma.kitchenManagerCredential.upsert({where:{orbitPersonId:identity.orbitPersonId},create:{orbitPersonId:identity.orbitPersonId,nexusUserId:identity.userId,email:identity.email.toLowerCase(),passwordHash:hashLocalPassword(password)},update:{}})
 if(row.nexusUserId!==identity.userId||!verifyLocalPassword(password,row.passwordHash))throw new KitchenCredentialError(401,'Use your current Kitchen manager email and password')
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
