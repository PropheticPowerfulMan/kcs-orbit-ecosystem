import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { authenticate, requireSuperAdmin } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
export const employeesRouter=Router()
employeesRouter.use(authenticate,requireSuperAdmin())
const id=z.coerce.number().int().positive()
const call=async(path:string,init:RequestInit={})=>{if(!env.SAVANEX_API_URL||!env.KCS_ORBIT_API_KEY)throw new ApiError(503,'Savanex employee integration is not configured');const c=new AbortController(),t=setTimeout(()=>c.abort(),env.SAVANEX_TIMEOUT_SECONDS*1000);try{const response=await fetch(env.SAVANEX_API_URL.replace(/\/$/,'')+'/api/integration/'+path,{...init,signal:c.signal,headers:{'content-type':'application/json','x-api-key':env.KCS_ORBIT_API_KEY,...(init.headers||{})}}),body=await response.json().catch(()=>({}));if(!response.ok)throw new ApiError(response.status,body.detail||body.message||Object.entries(body).map(([field,value])=>field+': '+(Array.isArray(value)?value.join(', '):String(value))).join(' | ')||'Savanex employee operation failed' );return body}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(502,'Savanex employee service is unavailable')}finally{clearTimeout(t)}}
employeesRouter.get('/',asyncHandler(async(_q,res)=>success(res,await call('employees/'))))
employeesRouter.post('/',asyncHandler(async(q,res)=>success(res,await call('employees/',{method:'POST',body:JSON.stringify(q.body)}),'Employee created',201)))
employeesRouter.get('/:id',asyncHandler(async(q,res)=>success(res,await call('employees/'+id.parse(q.params.id)+'/'))))
employeesRouter.patch('/:id',asyncHandler(async(q,res)=>success(res,await call('employees/'+id.parse(q.params.id)+'/',{method:'PATCH',body:JSON.stringify(q.body)}))))
employeesRouter.delete('/:id',asyncHandler(async(q,res)=>success(res,await call('employees/'+id.parse(q.params.id)+'/',{method:'DELETE'}))))
