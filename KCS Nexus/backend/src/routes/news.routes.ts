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
  coverImage: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
})

export const newsRouter = Router()

newsRouter.get('/', asyncHandler(async (_req, res) => {
  const posts = await prisma.newsPost.findMany({
    orderBy: { publishedAt: 'desc' },
    include: { author: true },
  })
  return success(res, posts)
}))

newsRouter.get('/slug/:slug', asyncHandler(async (req, res) => {
  const slug = getRouteParam(req.params.slug)
  const post = await prisma.newsPost.findUnique({
    where: { slug },
    include: { author: true },
  })
  if (!post) throw new ApiError(404, 'Post not found')
  return success(res, post)
}))

newsRouter.get('/:id', asyncHandler(async (req, res) => {
  const postId = getRouteParam(req.params.id)
  const post = await prisma.newsPost.findUnique({ where: { id: postId }, include: { author: true } })
  if (!post) throw new ApiError(404, 'Post not found')
  return success(res, post)
}))

newsRouter.post('/', authenticate, requireRoles('admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = newsSchema.parse(req.body)
  const post = await prisma.newsPost.create({
    data: {
      ...payload,
      authorId: req.user!.sub,
    },
  })
  return success(res, post, 'Post created', 201)
}))

newsRouter.put('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const postId = getRouteParam(req.params.id)
  const payload = newsSchema.partial().parse(req.body)
  const post = await prisma.newsPost.update({ where: { id: postId }, data: payload })
  return success(res, post, 'Post updated')
}))

newsRouter.delete('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const postId = getRouteParam(req.params.id)
  await prisma.newsPost.delete({ where: { id: postId } })
  return success(res, null, 'Post deleted')
}))
