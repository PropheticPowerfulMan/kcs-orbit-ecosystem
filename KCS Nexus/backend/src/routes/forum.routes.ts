import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const forumRouter = Router()

const postSchema = z.object({
  title: z.string().min(4),
  content: z.string().min(8),
  category: z.string().min(2),
})

const commentSchema = z.object({
  content: z.string().min(2),
})

const analyzeTone = (text: string) => {
  const lower = text.toLowerCase()
  const urgentWords = ['danger', 'urgent', 'unsafe', 'violence', 'harassment', 'abuse', 'security']
  const concernWords = ['problem', 'concern', 'late', 'issue', 'difficult', 'confused', 'worried']
  const positiveWords = ['thank', 'great', 'excellent', 'happy', 'improved', 'appreciate']

  if (urgentWords.some((word) => lower.includes(word))) return { sentiment: 'high-concern', priority: 'urgent' }
  if (concernWords.some((word) => lower.includes(word))) return { sentiment: 'concerned', priority: 'elevated' }
  if (positiveWords.some((word) => lower.includes(word))) return { sentiment: 'positive', priority: 'normal' }
  return { sentiment: 'neutral', priority: 'normal' }
}

forumRouter.get('/posts', authenticate, requireRoles('admin', 'parent', 'teacher'), asyncHandler(async (_req, res) => {
  const posts = await prisma.parentForumPost.findMany({
    include: {
      author: true,
      comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return success(res, posts)
}))

forumRouter.post('/posts', authenticate, requireRoles('parent', 'admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  const data = postSchema.parse(req.body)
  const tone = analyzeTone(`${data.title} ${data.content}`)

  const post = await prisma.parentForumPost.create({
    data: {
      ...data,
      authorId: req.user.sub,
      sentiment: tone.sentiment,
      priority: tone.priority,
    },
    include: { author: true, comments: true },
  })

  return success(res, post, 'Forum post created', 201)
}))

forumRouter.post('/posts/:id/comments', authenticate, requireRoles('parent', 'admin', 'teacher'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  const postId = getRouteParam(req.params.id)
  const { content } = commentSchema.parse(req.body)
  const tone = analyzeTone(content)

  const post = await prisma.parentForumPost.findUnique({ where: { id: postId } })
  if (!post) throw new ApiError(404, 'Forum post not found')

  const comment = await prisma.parentForumComment.create({
    data: {
      postId,
      authorId: req.user.sub,
      content,
      sentiment: tone.sentiment,
    },
    include: { author: true },
  })

  if (tone.priority === 'urgent' && post.priority !== 'urgent') {
    await prisma.parentForumPost.update({ where: { id: postId }, data: { priority: 'urgent' } })
  }

  return success(res, comment, 'Forum comment created', 201)
}))

forumRouter.get('/ai-report', authenticate, requireRoles('admin', 'teacher'), asyncHandler(async (_req, res) => {
  const posts = await prisma.parentForumPost.findMany({
    include: { comments: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const categories = posts.reduce<Record<string, number>>((acc, post) => {
    acc[post.category] = (acc[post.category] ?? 0) + 1
    return acc
  }, {})
  const urgent = posts.filter((post) => post.priority === 'urgent')
  const concerned = posts.filter((post) => post.sentiment === 'concerned' || post.sentiment === 'high-concern')
  const topTopics = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic]) => topic)

  const report = {
    title: 'Parent Forum Intelligence Report',
    summary: posts.length
      ? `${posts.length} parent discussions reviewed. ${concerned.length} threads show concern signals and ${urgent.length} need fast leadership attention.`
      : 'No parent forum conversations have been recorded yet.',
    sentiment: urgent.length > 0 ? 'high-concern' : concerned.length > posts.length / 3 ? 'mixed' : 'stable',
    riskLevel: urgent.length > 0 ? 'high' : concerned.length > 3 ? 'medium' : 'low',
    keyTopics: topTopics,
    recommendations: [
      urgent.length ? 'Assign an administrator to respond to urgent parent concerns within 24 hours.' : 'Maintain weekly moderation and acknowledge parent contributions.',
      'Share a monthly parent pulse summary with leadership and homeroom teachers.',
      'Convert repeated parent concerns into tracked action items with visible owner and due date.',
    ],
    actionItems: urgent.map((post) => `Review urgent thread: ${post.title}`).slice(0, 5),
    metrics: {
      totalPosts: posts.length,
      totalComments: posts.reduce((sum, post) => sum + post.comments.length, 0),
      urgentThreads: urgent.length,
      concernedThreads: concerned.length,
    },
  }

  return success(res, report)
}))
