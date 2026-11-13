import type { Response,NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth.js'
import { filterAcademicPayload } from '../services/academicVisibility.service.js'
// Apply after route authentication, at serialization, so alternate learner endpoints cannot bypass release controls.
export function academicVisibilityResponseGuard(req:AuthenticatedRequest,res:Response,next:NextFunction){
 const json=res.json.bind(res)
 res.json=((body:any)=>{
  const role=req.user?.role
  if(res.locals.academicDocumentReleased||!/^\/(students|academic-records|intelligence|diagnostic|courses|teachers)(?:\/|$)/.test(req.originalUrl.replace(/^\/api/,''))||!['student','parent'].includes(role??'')||!body?.success||!Object.prototype.hasOwnProperty.call(body,'data'))return json(body)
  res.setHeader('Cache-Control','private, no-store, no-cache, must-revalidate')
  void filterAcademicPayload(req.user!.sub,role as 'student'|'parent',body.data).then(data=>{if(!res.headersSent)json({...body,data})}).catch(next)
  return res
 }) as typeof res.json
 next()
}
