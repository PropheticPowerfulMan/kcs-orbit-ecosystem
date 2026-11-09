import { publicMediaUrl } from '../utils/mediaUpload.js'
import { databaseActorId } from '../utils/databaseActor.js'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

const newsSchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3),
  excerpt: z.string().min(10),
  content: z.string().min(20),
  category: z.enum(['NEWS', 'EVENT', 'ANNOUNCEMENT', 'ACHIEVEMENT', 'SPORTS', 'ARTS']),
  coverImage: z.string().trim().refine((value) => /^https?:\/\//i.test(value) || /\/uploads\/media\//i.test(value), 'Cover image must be an HTTPS URL or an uploaded KCS media path').nullable().optional(),
  tags: z.array(z.string()).default([]),
})

export const newsRouter = Router()

newsRouter.get('/', asyncHandler(async (_req, res) => {
  const posts = await prisma.newsPost.findMany({
    orderBy: { publishedAt: 'desc' },
    include: { author: { select: { id: true, firstName: true, middleName: true, lastName: true } } },
  })
  return success(res, posts.map(post => ({ ...post, coverImage: post.coverImage ? publicMediaUrl(post.coverImage) : post.coverImage })))
}))

newsRouter.get('/slug/:slug', asyncHandler(async (req, res) => {
  const slug = getRouteParam(req.params.slug)
  const post = await prisma.newsPost.findUnique({
    where: { slug },
    include: { author: { select: { id: true, firstName: true, middleName: true, lastName: true } } },
  })
  if (!post) throw new ApiError(404, 'Post not found')
  return success(res, { ...post, coverImage: post.coverImage ? publicMediaUrl(post.coverImage) : post.coverImage })
}))

newsRouter.get('/:id', asyncHandler(async (req, res) => {
  const postId = getRouteParam(req.params.id)
  const post = await prisma.newsPost.findUnique({ where: { id: postId }, include: { author: { select: { id: true, firstName: true, middleName: true, lastName: true } } } })
  if (!post) throw new ApiError(404, 'Post not found')
  return success(res, { ...post, coverImage: post.coverImage ? publicMediaUrl(post.coverImage) : post.coverImage })
}))

newsRouter.post('/', authenticate, requireRoles('admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = newsSchema.parse(req.body)
  const conflict = await prisma.newsPost.findUnique({ where: { slug: payload.slug }, select: { id: true } })
  if (conflict) throw new ApiError(409, 'An article already uses this title. Choose a distinct title.')
  const post = await prisma.newsPost.create({
    data: {
      ...payload,
      authorId: await databaseActorId(req.user!.sub),
    },
  })
  return success(res, post, 'Post created', 201)
}))

newsRouter.put('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const postId = getRouteParam(req.params.id)
  const payload = newsSchema.partial().parse(req.body)
  const current = await prisma.newsPost.findUnique({ where: { id: postId }, select: { id: true } })
  if (!current) throw new ApiError(404, 'Post not found')
  const post = await prisma.newsPost.update({ where: { id: postId }, data: payload })
  return success(res, post, 'Post updated')
}))

newsRouter.delete('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const postId = getRouteParam(req.params.id)
  const post = await prisma.newsPost.findUnique({ where: { id: postId }, select: { title: true, slug: true } })
  if (post) await prisma.newsPost.deleteMany({ where: { id: postId } })
  await prisma.auditLog.create({ data: { actorId: await databaseActorId(req.user!.sub), action: 'NEWS_POST_DELETED', targetType: 'NewsPost', targetId: postId, metadata: post ? { title: post.title, slug: post.slug } : { alreadyAbsent: true } } })
  return success(res, null, 'Post deleted')
}))
