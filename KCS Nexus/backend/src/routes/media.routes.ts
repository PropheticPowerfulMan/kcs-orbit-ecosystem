import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { MAX_MEDIA_UPLOAD_BYTES, safeMediaFilename, validateMediaUpload } from '../utils/mediaUpload.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDIA_UPLOAD_BYTES, files: 1 },
})

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
  if (!validateMediaUpload(req.file)) throw new ApiError(415, 'Unsupported or invalid media file')

  const filename = safeMediaFilename(req.file.originalname)
  const mediaRoot = path.resolve(process.cwd(), 'uploads', 'media')
  await mkdir(mediaRoot, { recursive: true })
  await writeFile(path.join(mediaRoot, filename), req.file.buffer)

  const item = await prisma.mediaItem.create({
    data: {
      title: String(req.body.title || req.file.originalname),
      description: req.body.description,
      category: String(req.body.category || 'General'),
      type: String(req.body.type || 'IMAGE').toUpperCase() as 'IMAGE' | 'VIDEO',
      url: `${process.env.PUBLIC_API_BASE_PATH || '/nexus/api'}/uploads/media/${filename}`,
      thumbnailUrl: req.body.thumbnailUrl,
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    },
  })
  return success(res, item, 'Media uploaded', 201)
}))

mediaRouter.delete('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const mediaItemId = getRouteParam(req.params.id)
  const item = await prisma.mediaItem.findUnique({ where: { id: mediaItemId } })
  if (item) {
    await prisma.mediaItem.deleteMany({ where: { id: mediaItemId } })
    await unlink(path.resolve(process.cwd(), 'uploads', 'media', path.basename(item.url))).catch(() => undefined)
  }
  await prisma.auditLog.create({ data: { actorId: req.user!.sub, action: item ? 'MEDIA_ITEM_DELETED' : 'MEDIA_ITEM_DELETE_ALREADY_ABSENT', targetType: 'MediaItem', targetId: mediaItemId, metadata: item ? { title: item.title, type: item.type, url: item.url } : { alreadyAbsent: true } } })
  return success(res, { alreadyAbsent: !item }, item ? 'Media deleted' : 'Media was already deleted')
}))
