import{Router,type Request}from'express'
import{createHash,timingSafeEqual}from'node:crypto'
import{z}from'zod'
import{env}from'../config/env.js'
import{prisma}from'../config/prisma.js'
import{asyncHandler,ApiError}from'../utils/api.js'
export const personalPortraitsRouter=Router()
const trusted=new Map<string,number>(),apps=new Set(['KCS_KITCHEN','KCS_SENTINEL','EDUPAY','EDUSYNCAI','SAVANEX','KCS_NEXUS'])
const same=(a:string,b:string)=>{const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right)}
async function ownServicePortrait(req:Request){
 const app=req.header('x-app-slug')||'',key=req.header('x-api-key')||''
 if(!apps.has(app)||key.length<16||key.length>512)throw new ApiError(401,'Service authorization required')
 const signature=createHash('sha256').update(app+'\0'+key).digest('hex')
 const kitchen=app==='KCS_KITCHEN'&&Boolean(env.KCS_KITCHEN_INTEGRATION_KEY)&&same(key,env.KCS_KITCHEN_INTEGRATION_KEY!)
 if(!kitchen&&(trusted.get(signature)||0)<Date.now()){
  if(!env.KCS_ORBIT_API_URL||!env.KCS_ORBIT_ORGANIZATION_ID)throw new ApiError(503,'Portrait identity validation unavailable')
  const url=new URL('/api/integration/read/academic-calendar',env.KCS_ORBIT_API_URL);url.searchParams.set('organizationId',env.KCS_ORBIT_ORGANIZATION_ID)
  const check=await fetch(url,{headers:{'x-api-key':key,'x-app-slug':app},signal:AbortSignal.timeout(5000)}).catch(()=>null)
  if(!check)throw new ApiError(503,'Portrait identity validation unavailable')
  if(!check.ok)throw new ApiError(check.status===401||check.status===403?401:503,'Service authorization unavailable')
  await check.arrayBuffer();if(trusted.size>64)trusted.clear();trusted.set(signature,Date.now()+300000)
 }
 const id=z.string().min(1).max(160).parse(req.params.id),kind=z.enum(['nexus','orbit','accessCode','adminEmail']).parse(req.query.kind||'nexus')
 const where=kind==='adminEmail'?{email:id.toLowerCase(),role:'ADMIN' as const}:kind==='orbit'?{orbitUserId:id}:kind==='accessCode'?{accessCode:id}:id==='configured-superadmin'?{email:process.env.SUPERADMIN_EMAIL||'superadmin@kcsnexus.com'}:{id}
 const users=await prisma.user.findMany({where,take:2,select:{id:true,avatar:true,accountBlockedAt:true}})
 if(users.length>1)throw new ApiError(409,'Ambiguous institutional portrait identity')
 return{user:users[0]??null,app}
}
personalPortraitsRouter.get('/:id',asyncHandler(async(req,res)=>{
 const{user}=await ownServicePortrait(req)
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-KCS-Portrait-Source','personal')
 if(!user||user.accountBlockedAt||!user.avatar)return res.status(204).end()
 const match=user.avatar.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
 if(!match)return res.status(204).end()
 const buffer=Buffer.from(match[2],'base64');if(buffer.length>1500000)return res.status(204).end()
 return res.type(match[1]).send(buffer)
}))
personalPortraitsRouter.put('/:id',asyncHandler(async(req,res)=>{
 const{user,app}=await ownServicePortrait(req);if(app!=='EDUPAY')throw new ApiError(403,'This application has read-only personal portrait access');if(!user||user.accountBlockedAt)throw new ApiError(403,'No active linked personal account')
 const input=z.object({image:z.string().max(1500000).refine(value=>value===''||/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))}).strict().parse(req.body)
 await prisma.$transaction(async tx=>{await tx.user.update({where:{id:user.id},data:{avatar:input.image}});await tx.auditLog.create({data:{actorId:user.id,action:'PERSONAL_DASHBOARD_PORTRAIT_UPDATED',targetType:'User',targetId:user.id,metadata:{application:app,removed:!input.image,scope:'PERSONAL_DASHBOARDS_ONLY'}}})})
 res.setHeader('Cache-Control','private, no-store');return res.json({image:input.image||null})
}))
