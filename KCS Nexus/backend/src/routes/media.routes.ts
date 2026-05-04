import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

const upload = multer({ storage: multer.memoryStorage() })

export const mediaRouter = Router()

mediaRouter.get('/', asyncHandler(async (_req, res) => {
  const items = await prisma.mediaItem.findMany({ orderBy: { uploadedAt: 'desc' } })
  return success(res, items)
}))

mediaRouter.get('/categories', asyncHandler(async (_req, res) => {
  const items = await prisma.mediaItem.findMany({ select: { category: true } })
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1
    return acc
  }, {})
  const categories = Object.entries(counts).map(([name, count]) => ({ name, count }))
  return success(res, categories)
}))

mediaRouter.post('/upload', authenticate, requireRoles('admin'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded')

  const item = await prisma.mediaItem.create({
    data: {
      title: String(req.body.title || req.file.originalname),
      description: req.body.description,
      category: String(req.body.category || 'General'),
      type: String(req.body.type || 'IMAGE').toUpperCase() as 'IMAGE' | 'VIDEO',
      url: `uploads/media/${req.file.originalname}`,
      thumbnailUrl: req.body.thumbnailUrl,
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    },
  })
  return success(res, item, 'Media uploaded', 201)
}))

mediaRouter.delete('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const mediaItemId = getRouteParam(req.params.id)
  await prisma.mediaItem.delete({ where: { id: mediaItemId } })
  return success(res, null, 'Media deleted')
}))
