import {forumClass,sameForumClass,type ForumScope} from '../utils/studentForumScope.js'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { lightweightForumRecord, sendForumMedia, validateForumMedia } from '../utils/forumMedia.js'

export const studentForumRouter = Router()
const forumAuthor={select:{id:true,firstName:true,middleName:true,lastName:true,avatar:true}}

const postSchema = z.object({
  title: z.string().min(4),
  content: z.string().max(10000).optional().default(''),
  category: z.string().min(2),
  audience: z.enum(['SCHOOL','CLASS']).default('SCHOOL'),
  attachmentType: z.enum(['image', 'video', 'audio', 'document']).optional(),
  attachmentData: z.string().max(12_000_000).optional(),
  attachmentName: z.string().max(255).optional(),
})

const commentSchema = z.object({
  content: z.string().max(10000).optional().default(''),
  attachmentType: z.enum(['image','video','audio','document']).optional(),
  attachmentData: z.string().max(12_000_000).optional(),
  attachmentName: z.string().max(255).optional(),
})

const analyzeTone = (text: string) => {
  const lower = text.toLowerCase()
  const urgentWords = ['danger', 'urgent', 'unsafe', 'violence', 'harassment', 'abuse', 'security', 'self-harm', 'bully', 'bullying']
  const concernWords = ['stress', 'problem', 'concern', 'confused', 'worried', 'pressure', 'difficult', 'anxious', 'excluded']
  const positiveWords = ['thank', 'great', 'excellent', 'happy', 'improved', 'appreciate', 'helpful']

  if (urgentWords.some((word) => lower.includes(word))) return { sentiment: 'high-concern', priority: 'urgent' }
  if (concernWords.some((word) => lower.includes(word))) return { sentiment: 'concerned', priority: 'elevated' }
  if (positiveWords.some((word) => lower.includes(word))) return { sentiment: 'positive', priority: 'normal' }
  return { sentiment: 'neutral', priority: 'normal' }
}

const resolveForumActorId = async (req: AuthenticatedRequest) => {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  if (req.user.sub !== 'configured-superadmin') {
    const actor = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true } })
    if (!actor) throw new ApiError(401, 'Your Nexus session is no longer linked to an active account. Please sign in again.')
    return actor.id
  }

  const superAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com', mode: 'insensitive' } },
        { accessCode: 'ACC-ADM-SUPER1' },
      ],
      role: 'ADMIN',
    },
    select: { id: true },
  })
  if (!superAdmin) throw new ApiError(500, 'The configured superadministrator account is not synchronized with the Nexus user registry.')
  return superAdmin.id
}


const classroomFor = async (req:AuthenticatedRequest,actorId:string) => {
  if(req.user?.role!=='student')return null
  const student=await prisma.studentProfile.findUnique({where:{userId:actorId},select:{grade:true,section:true,status:true}})
  return student&&student.status==='active'&&student.grade ? forumClass(student.grade,student.section) : null
}
const assertVisible = async (req:AuthenticatedRequest, post:ForumScope|null) => {
  if(!post)throw new ApiError(404,'Student forum post not found / Discussion introuvable')
  if(req.user?.role==='student'&&!sameForumClass(post,await classroomFor(req,await resolveForumActorId(req))))
    throw new ApiError(404,'Student forum post not found / Discussion introuvable')
}
studentForumRouter.get('/context',authenticate,requireRoles('admin','teacher','student'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const classroom=await classroomFor(req,await resolveForumActorId(req))
  res.setHeader('Cache-Control','private, no-store')
  return success(res,{classroom})
}))

studentForumRouter.get('/posts', authenticate, requireRoles('admin', 'teacher', 'student'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  const actorId = await resolveForumActorId(req)
  const audience=z.enum(['SCHOOL','CLASS']).optional().parse(req.query.audience)
  const classroom=await classroomFor(req,actorId)
  const chosen=audience || (req.user.role==='student'?'SCHOOL':undefined)
  if(chosen==='CLASS'&&!classroom)throw new ApiError(403,'No active class assigned / Aucune classe active affectée')
  const posts = await prisma.studentForumPost.findMany({
    where: chosen==='CLASS' ? {audience:'CLASS',classroomGrade:classroom!.grade,classroomSection:classroom!.section} : chosen==='SCHOOL' ? {audience:'SCHOOL'} : undefined,
    include: {
      author: forumAuthor,
      comments: { include: { author: forumAuthor }, orderBy: { createdAt: 'asc' } },
      likes: { where: { userId: actorId }, select: { id: true } },
      _count: { select: { likes: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  res.setHeader('Cache-Control','private, no-store')
  return success(res, posts.map(({ likes, _count, ...post }) => lightweightForumRecord({
    ...post,
    likeCount: _count.likes,
    likedByMe: likes.length > 0,
  })))
}))

studentForumRouter.post('/posts', authenticate, requireRoles('student', 'admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  const actorId = await resolveForumActorId(req)
  const data = postSchema.parse(req.body)
  const media = validateForumMedia(data.attachmentData, data.attachmentType, data.attachmentName)
  if (!data.content.trim() && !media.attachmentData) throw new ApiError(400, 'A message or attachment is required')
  const classroom=await classroomFor(req,actorId)
  if(data.audience==='CLASS'&&!classroom)throw new ApiError(403,'No active class assigned / Aucune classe active affectée')
  const { attachmentData: _data, attachmentType: _type, attachmentName: _name, ...text } = data
  const tone = analyzeTone(`${data.title} ${data.content}`)

  const post = await prisma.studentForumPost.create({
    data: {
      ...text,
      classroomGrade:data.audience==='CLASS'?classroom!.grade:null,
      classroomSection:data.audience==='CLASS'?classroom!.section:null,
      ...media,
      authorId: actorId,
      sentiment: tone.sentiment,
      priority: tone.priority,
    },
    include: { author: forumAuthor, comments: true },
  })

  return success(res, lightweightForumRecord(post), 'Student forum post created', 201)
}))

studentForumRouter.post('/posts/:id/comments', authenticate, requireRoles('student', 'teacher', 'admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  const actorId = await resolveForumActorId(req)
  const postId = getRouteParam(req.params.id)
  const data = commentSchema.parse(req.body)
  const content = data.content.trim()
  const media = validateForumMedia(data.attachmentData, data.attachmentType, data.attachmentName)
  if (!content && !media.attachmentData) throw new ApiError(400, 'A reply or attachment is required')
  const tone = analyzeTone(content)

  const post = await prisma.studentForumPost.findUnique({ where: { id: postId } })
  await assertVisible(req,post)

  const comment = await prisma.studentForumComment.create({
    data: {
      postId,
      authorId: actorId,
      content,
      ...media,
      sentiment: tone.sentiment,
    },
    include: { author: forumAuthor },
  })

  if (tone.priority === 'urgent' && post!.priority !== 'urgent') {
    await prisma.studentForumPost.update({ where: { id: postId }, data: { priority: 'urgent' } })
  }

  return success(res, lightweightForumRecord(comment), 'Student forum comment created', 201)
}))

studentForumRouter.get('/posts/:id/attachment', authenticate, requireRoles('admin', 'teacher', 'student'), asyncHandler(async (req:AuthenticatedRequest, res) => {
  const record = await prisma.studentForumPost.findUnique({ where: { id: getRouteParam(req.params.id) }, select: { audience:true,classroomGrade:true,classroomSection:true,attachmentData: true, attachmentName: true } })
  await assertVisible(req,record)
  return sendForumMedia(res, record!, 'private, no-store')
}))

studentForumRouter.get('/comments/:id/attachment', authenticate, requireRoles('admin', 'teacher', 'student'), asyncHandler(async (req:AuthenticatedRequest, res) => {
  const record = await prisma.studentForumComment.findUnique({ where: { id: getRouteParam(req.params.id) }, select: { post:{select:{audience:true,classroomGrade:true,classroomSection:true}},attachmentData: true, attachmentName: true } })
  if (!record) throw new ApiError(404, 'Student forum comment not found')
  await assertVisible(req,record.post)
  return sendForumMedia(res, record!, 'private, no-store')
}))

studentForumRouter.post('/posts/:id/likes', authenticate, requireRoles('student', 'teacher', 'admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  const actorId = await resolveForumActorId(req)
  const postId = getRouteParam(req.params.id)
  const post = await prisma.studentForumPost.findUnique({ where: { id: postId }, select: { id: true,audience:true,classroomGrade:true,classroomSection:true } })
  await assertVisible(req,post)

  const key = { postId_userId: { postId, userId: actorId } }
  const existing = await prisma.studentForumLike.findUnique({ where: key })
  if (existing) {
    await prisma.studentForumLike.delete({ where: key })
  } else {
    await prisma.studentForumLike.create({ data: { postId, userId: actorId } })
  }
  const likeCount = await prisma.studentForumLike.count({ where: { postId } })
  return success(res, { liked: !existing, likeCount })
}))

studentForumRouter.get('/ai-report', authenticate, requireRoles('admin', 'teacher'), asyncHandler(async (_req, res) => {
  const posts = await prisma.studentForumPost.findMany({
    include: { comments: true },
    orderBy: { createdAt: 'desc' },
    take: 150,
  })

  const categories = posts.reduce<Record<string, number>>((acc, post) => {
    acc[post.category] = (acc[post.category] ?? 0) + 1
    return acc
  }, {})
  const urgent = posts.filter((post) => post.priority === 'urgent')
  const concerned = posts.filter((post) => post.sentiment === 'concerned' || post.sentiment === 'high-concern')
  const topTopics = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic]) => topic)

  return success(res, {
    title: 'Student Forum Intelligence Report',
    summary: posts.length
      ? `${posts.length} student discussions reviewed. ${concerned.length} threads show student concern signals and ${urgent.length} require immediate adult review.`
      : 'No student forum conversations have been recorded yet.',
    sentiment: urgent.length > 0 ? 'high-concern' : concerned.length > posts.length / 3 ? 'mixed' : 'stable',
    riskLevel: urgent.length > 0 ? 'high' : concerned.length > 4 ? 'medium' : 'low',
    keyTopics: topTopics,
    recommendations: [
      urgent.length ? 'Assign a counselor or administrator to review urgent student concerns immediately.' : 'Keep homeroom teachers engaged in weekly student pulse checks.',
      'Turn repeated academic stress signals into targeted support groups or tutor sessions.',
      'Share anonymized student voice themes with leadership while protecting student privacy.',
    ],
    actionItems: urgent.map((post) => `Immediate review: ${post.title}`).slice(0, 5),
    metrics: {
      totalPosts: posts.length,
      totalComments: posts.reduce((sum, post) => sum + post.comments.length, 0),
      urgentThreads: urgent.length,
      concernedThreads: concerned.length,
    },
  })
}))
