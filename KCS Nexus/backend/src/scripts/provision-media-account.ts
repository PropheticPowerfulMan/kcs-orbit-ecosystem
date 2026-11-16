import {prisma} from '../config/prisma.js'
import {env} from '../config/env.js'
import {randomBytes} from 'node:crypto'
import bcrypt from 'bcryptjs'
import {writeFile,chmod,unlink} from 'node:fs/promises'
import {MEDIA_ONLY_PERMISSION,isMediaAccount} from '../utils/mediaAccount.js'
import {assertPasswordDoesNotContainIdentity} from '../utils/passwordPolicy.js'
const email='media@kinshasachristianschool.org',id='nexus-media-office',file='/tmp/kcs-nexus-media-credentials.json'
let written=false
async function main(){
 const existing=await prisma.user.findFirst({where:{OR:[{email:{equals:email,mode:'insensitive'}},{id}]},select:{id:true,email:true,role:true,permissions:true}})
 if(existing){if(!isMediaAccount(existing)||existing.role!=='STAFF')throw new Error('The requested identity belongs to a different account');console.log(JSON.stringify({created:false,id:existing.id,email:existing.email,existingPasswordPreserved:true}));return}
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({created:false,dryRun:true,email}));return}
 const identity={firstName:'Media',lastName:'',email,accessCode:'ACC-MED-'+randomBytes(6).toString('hex').toUpperCase()}
 let password:string
 do{password='R7!v'+randomBytes(18).toString('base64url')}while(assertPasswordDoesNotContainIdentity(password,identity).length)
 const passwordHash=await bcrypt.hash(password,12)
 await writeFile(file,JSON.stringify({email,accessCode:identity.accessCode,password,loginUrl:'https://kinshasachristianschool.org/login',dashboardUrl:'https://kinshasachristianschool.org/portal/media/news',scope:['News & Events','Gallery & Videos','Personal Settings']},null,2),{flag:'wx',mode:0o600});written=true
 try{
  await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT 1 AS acquired FROM pg_advisory_xact_lock(hashtext('nexus-media-account-provision'))`
   const created=await tx.user.create({data:{id,...identity,role:'STAFF',staffFunction:'MEDIA',permissions:[MEDIA_ONLY_PERMISSION],passwordHash}})
   const actor=await tx.user.findUnique({where:{email:env.SUPERADMIN_EMAIL},select:{id:true}})
   await tx.auditLog.create({data:{actorId:actor?.id??null,action:'NEXUS_MEDIA_ACCOUNT_PROVISIONED',targetType:'User',targetId:created.id,metadata:{email,scope:'NEXUS_WEBSITE_ONLY',requestedBy:'Super Administration',method:'authorized targeted deployment'}}})
  })
 }catch(error){await unlink(file);written=false;throw error}
 await chmod(file,0o600)
 console.log(JSON.stringify({created:true,id,email,scope:'NEXUS_WEBSITE_ONLY',credentialsFile:file}))
}
main().catch(()=>{console.error('Media provisioning stopped. Existing accounts and passwords have not been changed.');process.exitCode=1}).finally(()=>prisma.$disconnect())
