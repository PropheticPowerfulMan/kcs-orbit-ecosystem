import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'
import { prisma } from '../lib/prisma.js'
import { ApiError } from '../utils/ApiError.js'
import { success } from '../utils/response.js'

export const syllabiRouter = Router()
const root = path.resolve(process.env.UPLOAD_ROOT || '/app/uploads', 'syllabi')
const accepted = new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:1},fileFilter:(_r,f,cb)=>accepted.has(f.mimetype)?cb(null,true):cb(new ApiError(400,'PDF, DOC or DOCX required'))})
const input = z.object({academicYear:z.string().trim().regex(/^\d{4}-\d{4}$/),title:z.string().trim().min(2).max(180),description:z.string().trim().max(2000).optional()})
type Meta={academicYear:string;title:string;description?:string;fileName:string;storedName:string;mimeType:string;fileSize:number;publishedAt:string}
const parse=(value:string|null):Meta|null=>{if(!value)return null;try{return JSON.parse(value) as Meta}catch{return null}}
const item=(course:any)=>({id:course.id,...parse(course.syllabus),course:{id:course.id,name:course.name,code:course.code,grade:course.grade,teacher:course.teacher}})

syllabiRouter.get('/',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const role=req.user!.role; const where:any={}
 if(role==='teacher')where.teacher={userId:req.user!.sub}
 else if(role==='student')where.enrollments={some:{student:{userId:req.user!.sub}}}
 else if(!['admin','staff'].includes(role))throw new ApiError(403,'Syllabus access denied')
 const courses=await prisma.course.findMany({where:{...where,syllabus:{not:null}},select:{id:true,name:true,code:true,grade:true,syllabus:true,teacher:{select:{user:{select:{firstName:true,middleName:true,lastName:true}}}}},orderBy:[{grade:'asc'},{name:'asc'}]})
 return success(res,courses.map(item).filter(x=>x.fileName))
}))

syllabiRouter.get('/teacher-courses',authenticate,requireRoles('teacher'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const courses=await prisma.course.findMany({where:{teacher:{userId:req.user!.sub}},select:{id:true,name:true,code:true,grade:true,syllabus:true},orderBy:[{grade:'asc'},{name:'asc'}]})
 return success(res,courses.map(c=>({...c,syllabus:parse(c.syllabus)})))
}))

syllabiRouter.post('/:courseId',authenticate,requireRoles('teacher'),upload.single('file'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 if(!req.file)throw new ApiError(400,'Syllabus document is required')
 const payload=input.parse(req.body)
 const course=await prisma.course.findFirst({where:{id:String(req.params.courseId),teacher:{userId:req.user!.sub}},include:{enrollments:{select:{student:{select:{userId:true}}}},teacher:{select:{user:{select:{firstName:true,middleName:true,lastName:true}}}}}})
 if(!course)throw new ApiError(403,'This course is not assigned to the authenticated teacher')
 const previous=parse(course.syllabus); const ext=req.file.mimetype==='application/pdf'?'.pdf':req.file.mimetype==='application/msword'?'.doc':'.docx'; const storedName=randomUUID()+ext
 await mkdir(root,{recursive:true}); await writeFile(path.join(root,storedName),req.file.buffer)
 const meta:Meta={...payload,fileName:req.file.originalname,storedName,mimeType:req.file.mimetype,fileSize:req.file.size,publishedAt:new Date().toISOString()}
 const saved=await prisma.$transaction(async tx=>{
  const updated=await tx.course.update({where:{id:course.id},data:{syllabus:JSON.stringify(meta)},select:{id:true,name:true,code:true,grade:true,syllabus:true,teacher:{select:{user:{select:{firstName:true,middleName:true,lastName:true}}}}}})
  const recipients=[...new Set(course.enrollments.map(x=>x.student.userId))]
  if(recipients.length)await tx.notification.createMany({data:recipients.map(userId=>({userId,title:'New syllabus · '+course.name,message:'The '+payload.academicYear+' syllabus for '+course.name+' is available in your dashboard.',type:'INFO',link:'/course-syllabi'}))})
  await tx.auditLog.create({data:{actorId:req.user!.sub,action:previous?'COURSE_SYLLABUS_REPLACED':'COURSE_SYLLABUS_PUBLISHED',targetType:'Course',targetId:course.id,metadata:{academicYear:payload.academicYear,recipients:recipients.length,fileSize:req.file!.size}}})
  return updated
 })
 if(previous?.storedName)await unlink(path.join(root,previous.storedName)).catch(()=>undefined)
 return success(res,item(saved),previous?'Syllabus replaced and learners notified':'Syllabus published and learners notified',201)
}))

syllabiRouter.get('/:courseId/download',authenticate,asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const course=await prisma.course.findUnique({where:{id:String(req.params.courseId)},include:{teacher:true,enrollments:{include:{student:true}}}})
 if(!course)throw new ApiError(404,'Course not found')
 const role=req.user!.role; const permitted=['admin','staff'].includes(role)||(role==='teacher'&&course.teacher.userId===req.user!.sub)||(role==='student'&&course.enrollments.some(x=>x.student.userId===req.user!.sub))
 if(!permitted)throw new ApiError(403,'You are not enrolled in this course')
 const meta=parse(course.syllabus); if(!meta)throw new ApiError(404,'No syllabus has been published for this course')
 res.setHeader('Content-Type',meta.mimeType);res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(meta.fileName));return res.sendFile(path.join(root,meta.storedName))
}))

syllabiRouter.delete('/:courseId',authenticate,requireRoles('teacher','admin'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const course=await prisma.course.findUnique({where:{id:String(req.params.courseId)},include:{teacher:true}})
 if(!course)throw new ApiError(404,'Course not found')
 if(req.user!.role==='teacher'&&course.teacher.userId!==req.user!.sub)throw new ApiError(403,'This course belongs to another teacher')
 const meta=parse(course.syllabus);await prisma.course.update({where:{id:course.id},data:{syllabus:null}});if(meta?.storedName)await unlink(path.join(root,meta.storedName)).catch(()=>undefined)
 return success(res,{id:course.id},'Syllabus removed')
}))
