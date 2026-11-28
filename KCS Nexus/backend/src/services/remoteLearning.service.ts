import {assertAccountAccess} from './accountAccess.service.js'
import type {Prisma} from '@prisma/client'
import {AccessToken,RoomServiceClient,WebhookReceiver,TokenVerifier,TrackSource} from 'livekit-server-sdk'
import {randomUUID} from 'node:crypto'
import {prisma} from '../config/prisma.js'
import {ApiError} from '../utils/api.js'
import {databaseActorId} from '../utils/databaseActor.js'
import type {AuthenticatedRequest} from '../middleware/auth.js'
import {academicPeriodAccess,assertAcademicPeriodOpen} from './academicPeriodAccess.service.js'
export async function remoteActor(req:AuthenticatedRequest){
 const id=await databaseActorId(req.user!.sub);if(!id)throw new ApiError(403,'Institutional account unavailable / Compte institutionnel indisponible')
 const user=await prisma.user.findUniqueOrThrow({where:{id},select:{id:true,role:true,firstName:true,lastName:true,middleName:true,permissions:true,teacherProfile:{select:{id:true}},studentProfile:{select:{id:true,status:true}}}})
 const root=req.user!.sub==='configured-superadmin',principal=req.user!.role!=='teacher'&&(user.role==='ADMIN'||user.permissions.includes('nexus:principal-workspace')),senior=req.user!.role!=='teacher'&&user.permissions.includes('nexus:senior-teacher-workspace')
 return{...user,root,principal,academic:root||principal||senior,reference:req.user!.sub,name:[user.lastName,user.middleName,user.firstName].filter(Boolean).join(' ')}
}
export type RemoteActor=Awaited<ReturnType<typeof remoteActor>>
export function videoConfigured(){return Boolean(process.env.KCS_CLASSROOM_URL&&process.env.KCS_CLASSROOM_INTERNAL_URL&&process.env.KCS_CLASSROOM_API_KEY&&process.env.KCS_CLASSROOM_API_SECRET)}
export function roomClient(){if(!videoConfigured())throw new ApiError(503,'KCS video is not configured yet / La vidéo KCS n’est pas encore configurée');return new RoomServiceClient(process.env.KCS_CLASSROOM_INTERNAL_URL!,process.env.KCS_CLASSROOM_API_KEY!,process.env.KCS_CLASSROOM_API_SECRET!)}
export async function remoteSettings(){const row=await prisma.auditLog.findFirst({where:{action:'REMOTE_LEARNING_SETTINGS'},orderBy:{createdAt:'desc'},select:{metadata:true}});return{enabled:(row?.metadata as any)?.enabled===true,reason:String((row?.metadata as any)?.reason||''),videoConfigured:videoConfigured(),maxRooms:2,maxParticipants:32}}
export async function remoteCourseScope(a:RemoteActor):Promise<Prisma.CourseWhereInput>{
 if(a.academic)return{}
 if(a.teacherProfile)return{teacherId:a.teacherProfile.id}
 if(a.studentProfile&&a.studentProfile.status.toLowerCase()==='active')return{enrollments:{some:{studentId:a.studentProfile.id}}}
 if(a.role==='PARENT')return{enrollments:{some:{student:{parentLinks:{some:{parentId:a.id}},status:{equals:'active',mode:'insensitive'}}}}}
 return{id:'not-authorized'}
}
export async function lessonAccess(a:RemoteActor,id:string,write=false){
 const lesson=await prisma.remoteLesson.findUnique({where:{id},include:{course:{select:{id:true,teacherId:true}},resources:{select:{id:true,name:true,mime:true,createdAt:true}}}})
 if(!lesson)throw new ApiError(404,'Class not found / Cours à distance introuvable')
 const manages=a.academic||lesson.ownerId===a.id
 if(write&&!manages)throw new ApiError(403,'Only the organizer or academic leadership can manage this class / Gestion réservée à l’organisateur ou à la direction')
 if(!manages){const course=lesson.courseId&&await prisma.course.findFirst({where:{id:lesson.courseId,...await remoteCourseScope(a)},select:{id:true}});if(!course)throw new ApiError(403,'Class access denied / Accès au cours refusé')}
 return{lesson,manages}
}
export async function lessonWritable(a:RemoteActor,lesson:{academicYear:string;term:string}){assertAcademicPeriodOpen(await academicPeriodAccess(prisma,a.reference),lesson.academicYear,lesson.term)}
export async function classroomToken(a:RemoteActor,id:string){
 const {lesson,manages}=await lessonAccess(a,id)
 if(a.role==='PARENT'&&!a.teacherProfile&&!a.academic)throw new ApiError(403,'Parents follow resources and schedules; video access is for enrolled learners / Accès vidéo réservé aux élèves inscrits')
 if(!(await remoteSettings()).enabled)throw new ApiError(409,'Remote learning is not activated / Enseignement à distance non activé')
 if(lesson.blockedUserIds.includes(a.id))throw new ApiError(403,'Removed from this class / Accès à ce cours retiré')
 if(lesson.status!=='LIVE'||Date.now()>lesson.endsAt.getTime()+15*60000)throw new ApiError(409,'This class is not live / Ce cours n’est pas en direct')
 await lessonWritable(a,lesson)
 const token=new AccessToken(process.env.KCS_CLASSROOM_API_KEY!,process.env.KCS_CLASSROOM_API_SECRET!,{identity:a.id,name:a.name,ttl:'2m',metadata:JSON.stringify({lessonId:id,moderator:manages})})
 token.addGrant({roomJoin:true,room:lesson.roomName,canSubscribe:true,canPublish:true,canPublishData:true,canPublishSources:manages?[TrackSource.MICROPHONE,TrackSource.CAMERA,TrackSource.SCREEN_SHARE,TrackSource.SCREEN_SHARE_AUDIO]:[TrackSource.MICROPHONE,TrackSource.CAMERA]})
 return{token:await token.toJwt(),url:process.env.KCS_CLASSROOM_URL,moderator:manages,lessonId:id,expiresAt:new Date(Date.now()+120000).toISOString()}
}
export async function processClassroomWebhook(raw:string,authorization:string|undefined){
 if(!videoConfigured())throw new ApiError(503,'Video unavailable')
 const event=await new WebhookReceiver(process.env.KCS_CLASSROOM_API_KEY!,process.env.KCS_CLASSROOM_API_SECRET!).receive(raw,authorization)
 if(!event.id)return
 const lesson=event.room?.name&&await prisma.remoteLesson.findUnique({where:{roomName:event.room.name}});if(!lesson)return
 await prisma.$transaction(async tx=>{
  const stored=await tx.remoteWebhookEvent.createMany({data:[{id:event.id!}],skipDuplicates:true});if(!stored.count)return
  const p=event.participant,at=new Date(Number(event.createdAt||Math.floor(Date.now()/1000))*1000)
  if(p?.sid&&p.identity&&['participant_joined','participant_left'].includes(event.event!)){
   const known=await tx.user.findUnique({where:{id:p.identity},select:{id:true}})
   const dates=event.event==='participant_joined'?{joinedAt:at}:{leftAt:at}
   await tx.remoteConnection.upsert({where:{connectionSid:p.sid},create:{id:randomUUID(),connectionSid:p.sid,lessonId:lesson.id,userReference:p.identity,userId:known?.id,...dates},update:dates})
  }
  if(event.event==='room_finished')await tx.remoteLesson.updateMany({where:{id:lesson.id,status:'LIVE'},data:{status:'ENDED',endedAt:at,revision:{increment:1}}})
 })
}

/** Only the private signaling proxy calls this gate. A media JWT never bypasses current school access. */
export async function authorizeMedia(token:string){
 if(!videoConfigured()||!token||token.length>12000)throw new ApiError(403,'Classroom authorization denied')
 let claims;try{claims=await new TokenVerifier(process.env.KCS_CLASSROOM_API_KEY!,process.env.KCS_CLASSROOM_API_SECRET!).verify(token)}catch{throw new ApiError(403,'Classroom authorization denied')}
 if(!claims.sub||!claims.video?.roomJoin||!claims.video.room)throw new ApiError(403,'Classroom authorization denied')
 const [lesson,user]=await Promise.all([
  prisma.remoteLesson.findUnique({
   where:{roomName:claims.video.room},
   include:{course:{select:{enrollments:{
    where:{student:{userId:claims.sub,status:{equals:'active',mode:'insensitive'}}},
    select:{id:true}
   }}}}
  }),
  prisma.user.findUnique({where:{id:claims.sub},select:{id:true,email:true,role:true,permissions:true,passwordChangedAt:true}})
 ])
 if(!lesson||!user||lesson.status!=='LIVE'||lesson.endsAt.getTime()+15*60000<Date.now()||lesson.blockedUserIds.includes(user.id)||user.passwordChangedAt&&user.passwordChangedAt.getTime()>Number(claims.iat||0)*1000)throw new ApiError(403,'Classroom authorization denied')
 await assertAccountAccess(user.id)
 const leadership=user.role==='ADMIN'&&user.email.toLowerCase()===(process.env.SUPERADMIN_EMAIL||'').toLowerCase()||user.permissions.some(p=>['nexus:principal-workspace','nexus:senior-teacher-workspace'].includes(p))||lesson.ownerId===user.id
 if(!leadership&&!lesson.course?.enrollments.length)throw new ApiError(403,'Classroom enrollment required')
 if(!(await remoteSettings()).enabled)throw new ApiError(403,'Remote learning disabled')
}
