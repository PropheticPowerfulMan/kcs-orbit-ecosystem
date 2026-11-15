import {createHash} from 'node:crypto'
import {z} from 'zod'
import {Prisma} from '@prisma/client'
import { databaseActorId } from '../utils/databaseActor.js'
import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { MAX_MEDIA_UPLOAD_BYTES, safeMediaFilename, validateMediaUpload, publicMediaUrl } from '../utils/mediaUpload.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDIA_UPLOAD_BYTES, files: 1 },
})

const mediaVersion=(item:{id:string;title:string;description:string|null;category:string;tags:string[]})=>createHash('sha256').update(JSON.stringify([item.id,item.title,item.description,item.category,item.tags])).digest('hex')
export const mediaRouter = Router()

mediaRouter.get('/', asyncHandler(async (_req, res) => {
  const items = await prisma.mediaItem.findMany({ orderBy: { uploadedAt: 'desc' } })
  return success(res, items.map(item => ({ ...item, version:mediaVersion(item), url: publicMediaUrl(item.url), thumbnailUrl: item.thumbnailUrl ? publicMediaUrl(item.thumbnailUrl) : item.thumbnailUrl })))
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
      url: `${process.env.PUBLIC_API_BASE_PATH || '/api'}/uploads/media/${filename}`,
      thumbnailUrl: req.body.thumbnailUrl,
      tags: Array.isArray(req.body.tags)
        ? req.body.tags.map(String).map((tag: string) => tag.trim()).filter(Boolean)
        : String(req.body.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    },
  })
  return success(res, {...item,version:mediaVersion(item)}, 'Media uploaded', 201)
}))

mediaRouter.put('/:id',authenticate,requireRoles('admin'),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const id=getRouteParam(req.params.id),input=z.object({title:z.string().trim().min(2).max(200),description:z.string().trim().max(5000).nullable(),category:z.string().trim().min(1).max(120),tags:z.array(z.string().trim().min(1).max(80)).max(30),version:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(req.body);
 const actorId=await databaseActorId(req.user!.sub);
 const item=await prisma.$transaction(async tx=>{
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "MediaItem" WHERE id = ${id} FOR UPDATE`);
  const previous=await tx.mediaItem.findUnique({where:{id}});if(!previous)throw new ApiError(404,'This media no longer exists. Reload the library.');
  if(mediaVersion(previous)!==input.version)throw new ApiError(409,'This media changed in another session. Reload the library before editing.');
  const updated=await tx.mediaItem.update({where:{id},data:{title:input.title,description:input.description,category:input.category,tags:[...new Set(input.tags)]}});
  await tx.auditLog.create({data:{actorId,action:'MEDIA_METADATA_UPDATED',targetType:'MediaItem',targetId:id,metadata:{previous:{title:previous.title,description:previous.description,category:previous.category,tags:previous.tags},next:{title:updated.title,description:updated.description,category:updated.category,tags:updated.tags}}}});return updated;
 });
 return success(res,{...item,version:mediaVersion(item),url:publicMediaUrl(item.url)},'Media details saved and visible on the public website');
}));

mediaRouter.delete('/:id', authenticate, requireRoles('admin'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const mediaItemId = getRouteParam(req.params.id)
  const actorId = await databaseActorId(req.user!.sub)
  const item = await prisma.$transaction(async tx => {
    const existing = await tx.mediaItem.findUnique({ where: { id: mediaItemId } })
    if (existing) {
      const suffix = existing.url.includes('/uploads/') ? existing.url.slice(existing.url.indexOf('/uploads/')) : null
      const urls = [...new Set([existing.url, publicMediaUrl(existing.url), ...(suffix ? ['/api' + suffix, '/nexus/api' + suffix] : [])])]
      await tx.newsPost.updateMany({ where: { coverImage: { in: urls } }, data: { coverImage: null } })
      await tx.event.updateMany({ where: { coverImage: { in: urls } }, data: { coverImage: null } })
      await tx.mediaItem.deleteMany({ where: { id: mediaItemId } })
    }
    await tx.auditLog.create({ data: { actorId, action: existing ? 'MEDIA_ITEM_DELETED' : 'MEDIA_ITEM_DELETE_ALREADY_ABSENT', targetType: 'MediaItem', targetId: mediaItemId, metadata: existing ? { title: existing.title, type: existing.type, url: existing.url } : { alreadyAbsent: true } } })
    return existing
  })
  if (item) await unlink(path.resolve(process.cwd(), 'uploads', 'media', path.basename(item.url))).catch(() => undefined)
  return success(res, { alreadyAbsent: !item }, item ? 'Media deleted' : 'Media was already deleted')
}))
