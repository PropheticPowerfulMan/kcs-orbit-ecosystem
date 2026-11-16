import multer from 'multer'
import {MAX_NEWS_ATTACHMENT_BYTES,registerNewsDocument,saveNewsAttachments,attachNewsDocuments,publishedNewsDocument} from '../utils/newsAttachments.js'
import { publicMediaUrl } from '../utils/mediaUpload.js'
import { databaseActorId } from '../utils/databaseActor.js'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireWebsiteEditor, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

const newsSchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3),
  excerpt: z.string().min(10),
  content: z.string().min(20),
  category: z.enum(['NEWS', 'EVENT', 'ANNOUNCEMENT', 'ACHIEVEMENT', 'SPORTS', 'ARTS']),
  coverImage: z.string().trim().refine((value) => /^https?:\/\//i.test(value) || /\/uploads\/media\//i.test(value) || /^\/images\/kcs\/[a-z0-9._-]+$/i.test(value), 'Cover image must be an HTTPS URL, an uploaded KCS media path or a school website image').nullable().optional(),
  tags: z.array(z.string()).default([]),
  attachmentIds:z.array(z.string().uuid()).max(8).optional(),
})

export const newsRouter = Router()
const newsDocumentUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_NEWS_ATTACHMENT_BYTES,files:1}})
newsRouter.post('/attachments',authenticate,requireWebsiteEditor(),newsDocumentUpload.single('file'),asyncHandler(async(req:AuthenticatedRequest,res)=>{if(!req.file)throw new ApiError(400,'Choose a document to upload');const attachment=await registerNewsDocument(req.file,await databaseActorId(req.user!.sub));return success(res,attachment,'Document uploaded; publish an article to make it available',201)}))
newsRouter.get('/attachments/:id/download',asyncHandler(async(req,res)=>{const id=z.string().uuid().parse(req.params.id),file=await publishedNewsDocument(id);res.setHeader('Content-Type',file.mime);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(file.name));res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.send(file.buffer)}))

newsRouter.get('/', asyncHandler(async (_req, res) => {
  const posts = await prisma.newsPost.findMany({
    orderBy: { publishedAt: 'desc' },
    include: { author: { select: { id: true, firstName: true, middleName: true, lastName: true } } },
  })
  return success(res, await attachNewsDocuments(posts.map(post => ({ ...post, coverImage: post.coverImage ? publicMediaUrl(post.coverImage) : post.coverImage }))))
}))

newsRouter.get('/slug/:slug', asyncHandler(async (req, res) => {
  const slug = getRouteParam(req.params.slug)
  const post = await prisma.newsPost.findUnique({
    where: { slug },
    include: { author: { select: { id: true, firstName: true, middleName: true, lastName: true } } },
  })
  if (!post) throw new ApiError(404, 'Post not found')
  return success(res, (await attachNewsDocuments([{ ...post, coverImage: post.coverImage ? publicMediaUrl(post.coverImage) : post.coverImage }]))[0])
}))

newsRouter.get('/:id', asyncHandler(async (req, res) => {
  const postId = getRouteParam(req.params.id)
  const post = await prisma.newsPost.findUnique({ where: { id: postId }, include: { author: { select: { id: true, firstName: true, middleName: true, lastName: true } } } })
  if (!post) throw new ApiError(404, 'Post not found')
  return success(res, (await attachNewsDocuments([{ ...post, coverImage: post.coverImage ? publicMediaUrl(post.coverImage) : post.coverImage }]))[0])
}))

newsRouter.post('/', authenticate, requireWebsiteEditor(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = newsSchema.parse(req.body)
  const conflict = await prisma.newsPost.findUnique({ where: { slug: payload.slug }, select: { id: true } })
  if (conflict) throw new ApiError(409, 'An article already uses this title. Choose a distinct title.')
  const {attachmentIds=[],...fields}=payload,actorId=await databaseActorId(req.user!.sub)
  const post=await prisma.$transaction(async tx=>{const created=await tx.newsPost.create({data:{...fields,authorId:actorId}});await saveNewsAttachments(tx,created.id,attachmentIds,actorId);return created})
  return success(res, post, 'Post created', 201)
}))

newsRouter.put('/:id', authenticate, requireWebsiteEditor(), asyncHandler(async (req:AuthenticatedRequest, res) => {
  const postId = getRouteParam(req.params.id)
  const payload = newsSchema.partial().parse(req.body)
  const current = await prisma.newsPost.findUnique({ where: { id: postId }, select: { id: true } })
  if (!current) throw new ApiError(404, 'Post not found')
  const {attachmentIds,...fields}=payload,actorId=await databaseActorId(req.user!.sub)
  const post=await prisma.$transaction(async tx=>{const saved=await tx.newsPost.update({where:{id:postId},data:fields});if(attachmentIds!==undefined)await saveNewsAttachments(tx,postId,attachmentIds,actorId);return saved})
  return success(res, post, 'Post updated')
}))

newsRouter.delete('/:id', authenticate, requireWebsiteEditor(), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const postId = getRouteParam(req.params.id)
  const post = await prisma.newsPost.findUnique({ where: { id: postId }, select: { title: true, slug: true } })
  if (post) await prisma.newsPost.deleteMany({ where: { id: postId } })
  await prisma.auditLog.create({ data: { actorId: await databaseActorId(req.user!.sub), action: 'NEWS_POST_DELETED', targetType: 'NewsPost', targetId: postId, metadata: post ? { title: post.title, slug: post.slug } : { alreadyAbsent: true } } })
  return success(res, null, 'Post deleted')
}))
