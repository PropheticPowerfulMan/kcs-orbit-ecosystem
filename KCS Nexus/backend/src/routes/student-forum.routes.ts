import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

export const studentForumRouter = Router()

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
  const urgentWords = ['danger', 'urgent', 'unsafe', 'violence', 'harassment', 'abuse', 'security', 'self-harm', 'bully', 'bullying']
  const concernWords = ['stress', 'problem', 'concern', 'confused', 'worried', 'pressure', 'difficult', 'anxious', 'excluded']
  const positiveWords = ['thank', 'great', 'excellent', 'happy', 'improved', 'appreciate', 'helpful']

  if (urgentWords.some((word) => lower.includes(word))) return { sentiment: 'high-concern', priority: 'urgent' }
  if (concernWords.some((word) => lower.includes(word))) return { sentiment: 'concerned', priority: 'elevated' }
  if (positiveWords.some((word) => lower.includes(word))) return { sentiment: 'positive', priority: 'normal' }
  return { sentiment: 'neutral', priority: 'normal' }
}

studentForumRouter.get('/posts', authenticate, requireRoles('admin', 'teacher', 'student'), asyncHandler(async (_req, res) => {
  const posts = await prisma.studentForumPost.findMany({
    include: {
      author: true,
      comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return success(res, posts)
}))

studentForumRouter.post('/posts', authenticate, requireRoles('student', 'admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  const data = postSchema.parse(req.body)
  const tone = analyzeTone(`${data.title} ${data.content}`)

  const post = await prisma.studentForumPost.create({
    data: {
      ...data,
      authorId: req.user.sub,
      sentiment: tone.sentiment,
      priority: tone.priority,
    },
    include: { author: true, comments: true },
  })

  return success(res, post, 'Student forum post created', 201)
}))

studentForumRouter.post('/posts/:id/comments', authenticate, requireRoles('student', 'teacher', 'admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user) throw new ApiError(401, 'Authentication required')
  const postId = getRouteParam(req.params.id)
  const { content } = commentSchema.parse(req.body)
  const tone = analyzeTone(content)

  const post = await prisma.studentForumPost.findUnique({ where: { id: postId } })
  if (!post) throw new ApiError(404, 'Student forum post not found')

  const comment = await prisma.studentForumComment.create({
    data: {
      postId,
      authorId: req.user.sub,
      content,
      sentiment: tone.sentiment,
    },
    include: { author: true },
  })

  if (tone.priority === 'urgent' && post.priority !== 'urgent') {
    await prisma.studentForumPost.update({ where: { id: postId }, data: { priority: 'urgent' } })
  }

  return success(res, comment, 'Student forum comment created', 201)
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
