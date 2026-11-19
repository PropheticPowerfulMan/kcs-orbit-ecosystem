// Synthetic, isolated HTTP/PostgreSQL verification; refuses production data.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {randomUUID} from 'node:crypto'
const require=createRequire(process.cwd()+'/package.json'),{PrismaClient}=require('@prisma/client'),bcrypt=require('bcryptjs'),express=require('express')
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/nexus_entity_mail_qa')
assert.equal(new URL(process.env.DATABASE_URL).hostname,'kcs-entity-mail-db-qa')
const prefix='alias-qa-'+randomUUID(),id=prefix+'-student',orbitId=prefix+'-orbit',email=prefix+'@example.invalid',matricule='KCS-STU-'+randomUUID().replaceAll('-','').toUpperCase(),canonicalCode=prefix.toUpperCase(),alias='ACC-'+randomUUID().replaceAll('-','').slice(0,10).toUpperCase()
const password='Synthetic-QA-Only!2026',hash=await bcrypt.hash(password,10),db=new PrismaClient(),created=[]
let claim={},providerAccept=true,directoryOk=true
const student={id:orbitId,studentNumber:matricule,email,status:'ACTIVE',accessCode:canonicalCode,firstName:'QA',lastName:'Learner',fullName:'QA Learner',externalIds:[]}
const directory={source:'orbit',visibility:'shared-directory',parents:[],students:[student],teachers:[{id:prefix+'-teacher',fullName:'QA Teacher',externalIds:[]}]}
const mock=createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;res.setHeader('content-type','application/json');if(req.url.includes('account-access/snapshot'))return res.end(JSON.stringify({blockedHashes:[]}));if(req.url.includes('shared-directory')){res.statusCode=directoryOk?200:503;return res.end(JSON.stringify(directoryOk?directory:{}))}if(req.url.includes('/authenticate')){res.statusCode=providerAccept?200:401;return res.end(JSON.stringify(providerAccept?{user:claim}:{}))}res.statusCode=404;res.end('{}')})
await new Promise(resolve=>mock.listen(19966,'127.0.0.1',resolve))
Object.assign(process.env,{NODE_ENV:'test',KCS_ORBIT_API_URL:'http://127.0.0.1:19966',KCS_ORBIT_API_KEY:'synthetic-test-key',KCS_ORBIT_ORGANIZATION_ID:'qa-school',SAVANEX_API_URL:'http://127.0.0.1:19966',SAVANEX_AUTH_API_KEY:'synthetic-test-key',SAVANEX_LOGIN_PATH:'/authenticate',EDUPAY_API_URL:''})
const {authRouter}=await import('./dist/routes/auth.routes.js'),{prisma}=await import('./dist/config/prisma.js')
const app=express();app.use(express.json());app.use('/api/auth',authRouter);app.use((err,req,res,next)=>res.status(err.statusCode||err.status||500).json({error:err.message}))
const server=app.listen(19965,'127.0.0.1');await new Promise(resolve=>server.listening?resolve():server.once('listening',resolve))
const login=async(identifier=alias,pwd=password,twoFactorCode)=>{const r=await fetch('http://127.0.0.1:19965/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier,password:pwd,twoFactorCode})});return{status:r.status,body:await r.json()}}
const pass=label=>{checks++;console.log('PASS '+label)};let checks=0
const expect=async(status,...args)=>{const result=await login(...args);assert.equal(result.status,status,JSON.stringify(result.body));return result.body.data}
const resetClaim=()=>claim={role:'student',email,username:matricule,access_code:alias,first_name:'Untrusted first name',last_name:'Untrusted last name'}
try{
 await db.user.create({data:{id,email,accessCode:canonicalCode,passwordHash:hash,firstName:'QA',lastName:'Learner',role:'STUDENT',orbitUserId:orbitId,permissions:['ecosystem:savanex']}});created.push(id)
 await db.studentProfile.create({data:{userId:id,studentNumber:matricule,grade:'Grade 12',section:'QA'}})
 resetClaim();let result=await expect(200);assert.equal(result.user.id,id);assert.equal(result.user.role,'student');assert.equal(result.user.accessCode,canonicalCode)
 let account=await db.user.findUnique({where:{id}});assert.equal(account.passwordHash,hash);assert.equal(account.firstName,'QA');assert.equal(account.lastName,'Learner');assert.equal(account.orbitUserId,orbitId)
 pass('Verified secondary access code logs into existing student; official code, identity, role and password unchanged')
 await expect(200,email);await expect(200,canonicalCode);pass('Existing email and official access code still work')
 resetClaim();claim.username='KCS-STU-DIFFERENT123';await expect(409);resetClaim();student.email='another-'+email;await expect(409);student.email=email
 pass('Mismatched matricule and official email cannot redirect an existing student')
 resetClaim();await expect(401,alias,'Another-Application-Password!2026');assert.equal((await db.user.findUnique({where:{id}})).passwordHash,hash)
 pass('External provider cannot replace a different Nexus password')
 await db.user.update({where:{id},data:{twoFactorEnabled:true,twoFactorSecret:'JBSWY3DPEHPK3PXP'}});await expect(428);await db.user.update({where:{id},data:{twoFactorEnabled:false,twoFactorSecret:null}})
 pass('Alias login cannot bypass Nexus two-factor authentication')
 await db.user.update({where:{id},data:{loginLockedUntil:new Date(Date.now()+600000)}});await expect(423);await db.user.update({where:{id},data:{loginLockedUntil:null}})
 pass('Alias login cannot bypass a temporary account lock')
 await db.user.update({where:{id},data:{accountBlockedAt:new Date()}});await expect(403);await db.user.update({where:{id},data:{accountBlockedAt:null}})
 await db.studentProfile.update({where:{userId:id},data:{status:'archived'}});await expect(403);await db.studentProfile.update({where:{userId:id},data:{status:'active'}})
 pass('Blocked and archived students remain denied')
 directoryOk=false;await expect(503);directoryOk=true;await expect(200)
 pass('Alias proof requires a live official directory; stale cached identity is refused')
 const other=prefix+'-other';await db.user.create({data:{id:other,email:'other-'+email,accessCode:alias,firstName:'Other',lastName:'Account',role:'STUDENT',passwordHash:await bcrypt.hash('Other-Student-Password!2026',10)}});created.push(other)
 await expect(401);assert.equal((await db.user.findUnique({where:{id:other}})).accessCode,alias)
 pass('Existing access code owner wins; no merge or takeover of a second account')
 console.log(JSON.stringify({status:'PASS',checks,verifiedAlias:true,credentialsUnchanged:true,officialCodePreserved:true,identityCollisionRejected:true,twoFactorAndLocksEnforced:true,noProductionAccess:true}))
}finally{await db.auditLog.deleteMany({where:{actorId:{in:created}}});await db.user.deleteMany({where:{id:{in:created}}});await db.$disconnect();await prisma.$disconnect();await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>mock.close(resolve))}
