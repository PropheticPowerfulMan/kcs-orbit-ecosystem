import {assertMediaUploadSpace,mediaUploadMiddleware,mediaFileHandler,validateDiskMedia,promoteMediaFile} from '../services/mediaUpload.service.js'
import {uploadPath} from '../utils/uploadStorage.js'
import {createHash,randomUUID} from 'node:crypto'
import {z} from 'zod'
import {Prisma} from '@prisma/client'
import { databaseActorId } from '../utils/databaseActor.js'
import { Router } from 'express'
import path from 'node:path'
import { unlink } from 'node:fs/promises'
import { prisma } from '../config/prisma.js'
import { authenticate, requireWebsiteEditor, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'
import { MAX_MEDIA_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES, safeMediaFilename, publicMediaUrl } from '../utils/mediaUpload.js'

const mediaVersion=(item:{id:string;title:string;description:string|null;category:string;tags:string[];url:string;thumbnailUrl:string|null;type:string})=>createHash('sha256').update(JSON.stringify([item.id,item.title,item.description,item.category,item.tags,item.url,item.thumbnailUrl,item.type])).digest('hex')
export const mediaRouter = Router()

mediaRouter.get('/', asyncHandler(async (_req, res) => {
  res.setHeader('Cache-Control','no-store')
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

mediaRouter.get('/uploads/access',authenticate,requireWebsiteEditor(),asyncHandler(async(_req,res)=>{await assertMediaUploadSpace(undefined,_req.get('x-ui-language'));res.setHeader('Cache-Control','private, no-store');return success(res,{imageLimit:MAX_MEDIA_UPLOAD_BYTES,videoLimit:MAX_VIDEO_UPLOAD_BYTES})}))

mediaRouter.post(['/upload','/uploads/file'], authenticate, requireWebsiteEditor(), mediaUploadMiddleware, mediaFileHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded')
  const file=req.file
  if (!await validateDiskMedia(file)) throw new ApiError(415, 'Unsupported or invalid media file')

  const filename = safeMediaFilename(randomUUID()+path.extname(file.originalname))
  const filePath = await promoteMediaFile(file,filename)
  try {

  const actorId=await databaseActorId(req.user!.sub)
  const item = await prisma.$transaction(async tx=>{const created=await tx.mediaItem.create({
    data: {
      title: String(req.body.title || file.originalname),
      description: req.body.description,
      category: String(req.body.category || 'General'),
      type: file.mimetype.startsWith('video/')?'VIDEO':'IMAGE',
      url: `${process.env.PUBLIC_API_BASE_PATH || '/api'}/uploads/media/${filename}`,
      thumbnailUrl: req.body.thumbnailUrl,
      tags: Array.isArray(req.body.tags)
        ? req.body.tags.map(String).map((tag: string) => tag.trim()).filter(Boolean)
        : String(req.body.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    },
  });await tx.auditLog.create({data:{actorId,action:'MEDIA_FILE_UPLOADED',targetType:'MediaItem',targetId:created.id,metadata:{size:file.size,contentType:file.mimetype}}});return created})
  return success(res, {...item,version:mediaVersion(item)}, 'Media uploaded', 201)
  } catch(error){await unlink(filePath).catch(()=>undefined);throw error}
}))

// Links are stored as public viewing URLs; the API never fetches external video content.
mediaRouter.post('/video-link',authenticate,requireWebsiteEditor(),asyncHandler(async(req:AuthenticatedRequest,res)=>{
 const https=z.string().trim().url().max(2000).refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password},'Use a public HTTPS viewing URL');
 const input=z.object({id:z.string().optional(),version:z.string().regex(/^[a-f0-9]{64}$/).optional(),title:z.string().trim().min(2).max(200),description:z.string().trim().max(5000).default(''),url:https,thumbnailUrl:https.nullable().optional()}).strict().parse(req.body);
 const actorId=await databaseActorId(req.user!.sub);
 const item=await prisma.$transaction(async tx=>{
  const details={title:input.title,description:input.description,url:input.url,thumbnailUrl:input.thumbnailUrl||null,category:'Gallery',type:'VIDEO' as const,tags:['gallery','video']};
  if(input.id){
   await tx.$queryRaw(Prisma.sql`SELECT id FROM "MediaItem" WHERE id = ${input.id} FOR UPDATE`);
   const current=await tx.mediaItem.findUnique({where:{id:input.id}});
   if(!current||current.type!=='VIDEO')throw new ApiError(404,'This video no longer exists.');
   if(!input.version||mediaVersion(current)!==input.version)throw new ApiError(409,'This video changed elsewhere. Reload the library.');
   const updated=await tx.mediaItem.update({where:{id:input.id},data:{...details,tags:current.tags}});
   await tx.auditLog.create({data:{actorId,action:'WEBSITE_VIDEO_LINK_UPDATED',targetType:'MediaItem',targetId:updated.id,metadata:{previousUrl:current.url,url:updated.url}}});return updated;
  }
  const created=await tx.mediaItem.create({data:details});
  await tx.auditLog.create({data:{actorId,action:'WEBSITE_VIDEO_LINK_CREATED',targetType:'MediaItem',targetId:created.id,metadata:{url:created.url}}});return created;
 });return success(res,{...item,version:mediaVersion(item)},'Video published',input.id?200:201);
}));

mediaRouter.put('/:id',authenticate,requireWebsiteEditor(),asyncHandler(async(req:AuthenticatedRequest,res)=>{
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


// A replacement keeps the media identity and references; a fresh URL prevents stale image caches.
mediaRouter.post(['/:id/file','/uploads/:id/file'],authenticate,requireWebsiteEditor(),mediaUploadMiddleware,mediaFileHandler(async(req:AuthenticatedRequest,res)=>{
 const id=getRouteParam(req.params.id);if(!req.file)throw new ApiError(400,'Choose a replacement file.');if(!await validateDiskMedia(req.file))throw new ApiError(415,'Unsupported or invalid media file');
 let details:unknown;try{details=JSON.parse(String(req.body.details||'{}'))}catch{throw new ApiError(400,'Invalid media details')}
 const input=z.object({title:z.string().trim().min(2).max(200),description:z.string().trim().max(5000).nullable(),category:z.string().trim().min(1).max(120),tags:z.array(z.string().trim().min(1).max(80)).max(30),version:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse({...details as object,version:req.body.version});
 const existing=await prisma.mediaItem.findUnique({where:{id}});if(!existing)throw new ApiError(404,'This media no longer exists.');if(mediaVersion(existing)!==input.version)throw new ApiError(409,'This media changed elsewhere. Reload the library.');
 const kind=req.file.mimetype.startsWith('video/')?'VIDEO':'IMAGE';if(existing.type!==kind)throw new ApiError(415,'Keep the same media type when replacing a file.');
 const actorId=await databaseActorId(req.user!.sub),mediaRoot=uploadPath('media'),filename=safeMediaFilename(randomUUID()+path.extname(req.file.originalname)),filePath=path.join(mediaRoot,filename),url=`${process.env.PUBLIC_API_BASE_PATH||'/api'}/uploads/media/${filename}`;
 await promoteMediaFile(req.file,filename);
 try{
  const item=await prisma.$transaction(async tx=>{
   await tx.$queryRaw(Prisma.sql`SELECT id FROM "MediaItem" WHERE id = ${id} FOR UPDATE`);const current=await tx.mediaItem.findUnique({where:{id}});if(!current)throw new ApiError(404,'This media no longer exists.');if(mediaVersion(current)!==input.version)throw new ApiError(409,'This media changed elsewhere. Reload the library.');
   const suffix=current.url.includes('/uploads/')?current.url.slice(current.url.indexOf('/uploads/')):null,aliases=[...new Set([current.url,publicMediaUrl(current.url),...(suffix?['/api'+suffix,'/nexus/api'+suffix]:[])])];
   const updated=await tx.mediaItem.update({where:{id},data:{title:input.title,description:input.description,category:input.category,tags:[...new Set(input.tags)],url,thumbnailUrl:null}});
   if(kind==='IMAGE'){await tx.newsPost.updateMany({where:{coverImage:{in:aliases}},data:{coverImage:url}});await tx.event.updateMany({where:{coverImage:{in:aliases}},data:{coverImage:url}})}
   await tx.auditLog.create({data:{actorId,action:'MEDIA_FILE_REPLACED',targetType:'MediaItem',targetId:id,metadata:{previousUrl:current.url,newUrl:url,previousTitle:current.title,title:updated.title,previousFileRetained:true}}});return updated;
  });return success(res,{...item,version:mediaVersion(item),url:publicMediaUrl(item.url)},'Media file and details saved');
 }catch(error){await unlink(filePath).catch(()=>undefined);throw error}
}));

mediaRouter.delete('/:id', authenticate, requireWebsiteEditor(), asyncHandler(async (req: AuthenticatedRequest, res) => {
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
  if (item && /^(?:\/nexus)?\/api\/uploads\/media\//.test(item.url)) await unlink(uploadPath('media',path.basename(item.url))).catch(() => undefined)
  return success(res, { alreadyAbsent: !item }, item ? 'Media deleted' : 'Media was already deleted')
}))
