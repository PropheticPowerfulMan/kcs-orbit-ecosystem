import { Router } from 'express'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, requireSuperAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { asyncHandler, ApiError, success } from '../utils/api.js'
import { databaseActorId } from '../utils/databaseActor.js'
import { uploadPath } from '../utils/uploadStorage.js'
import { MAX_SCHOOL_PDF_BYTES, schoolDocumentKey, safeSchoolPdfName, validSchoolPdf, schoolPdfHash } from '../utils/schoolDocuments.js'

export const schoolDocumentsRouter = Router()
const yearSchema = z.string().regex(/^\d{4}-\d{4}$/).refine(v => Number(v.slice(5)) === Number(v.slice(0,4)) + 1)
const publicMeta = (value: any) => value ? ({
  kind: value.kind, language: value.language, academicYear: value.academicYear,
  version: value.version, revision: value.revision, filename: value.filename, bytes: value.bytes,
  pages: value.pages, sha256: value.sha256, publishedAt: value.publishedAt,
  url: (process.env.PUBLIC_API_BASE_PATH || '/api').replace(/\/$/, '') + '/school-documents/files/' + value.version,
}) : null
schoolDocumentsRouter.get('/', asyncHandler(async(req, res) => {
  const year = req.query.academicYear ? yearSchema.parse(req.query.academicYear) : undefined
  const keys = ['en','fr'].flatMap(language => [schoolDocumentKey('handbook',language), ...(year ? [schoolDocumentKey('calendar',language,year)] : [])])
  const rows = await prisma.auditLog.findMany({ where: { id: { in: keys } }, select: { metadata: true } })
  res.setHeader('Cache-Control','no-store, max-age=0')
  return success(res, rows.map(row => publicMeta(row.metadata)))
}))
schoolDocumentsRouter.get('/files/:version', asyncHandler(async(req, res) => {
  const version = z.string().uuid().parse(req.params.version)
  const row = await prisma.auditLog.findUnique({where:{id:'nexus-school-document-version-'+version},select:{metadata:true}})
  const doc = row?.metadata as any
  if (!doc || doc.version !== version || !/^[a-f0-9-]{36}\.pdf$/.test(doc.storedName || '')) throw new ApiError(404,'School document not found / Document scolaire introuvable')
  res.type('application/pdf')
  res.setHeader('X-Content-Type-Options','nosniff')
  res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'")
  res.setHeader('Cache-Control','public, max-age=31536000, immutable')
  if(req.query.download === '1') res.attachment(safeSchoolPdfName(doc.filename))
  res.sendFile(uploadPath('school-documents',doc.storedName))
}))
schoolDocumentsRouter.get('/upload-access',authenticate,requireSuperAdmin(),asyncHandler(async(_req,res)=>success(res,{allowed:true})))
const parseUpload = multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_SCHOOL_PDF_BYTES,files:1,fields:8,parts:10},fileFilter:(_req,file,cb)=>{
  if(file.mimetype !== 'application/pdf' || !/\.pdf$/i.test(file.originalname)) return cb(new ApiError(415,'Choose a PDF file / Choisissez un fichier PDF'))
  cb(null,true)
}}).single('file')
schoolDocumentsRouter.post('/upload', authenticate, requireSuperAdmin(), (req,res,next) => {
  parseUpload(req,res,error=>next(error instanceof multer.MulterError ? new ApiError(413,'PDF limit: 20 MB / Limite PDF : 20 Mo') : error))
}, asyncHandler(async(req:AuthenticatedRequest,res)=>{
  const input = z.object({kind:z.enum(['handbook','calendar']),language:z.enum(['en','fr']),academicYear:yearSchema.optional(),revision:z.coerce.number().int().min(0),pages:z.coerce.number().int().min(1).max(3000).optional()}).parse(req.body)
  if(input.kind==='calendar'&&!input.academicYear)throw new ApiError(400,'Choose the academic year / Choisissez l’année scolaire')
  const file=req.file
  if(!file||!validSchoolPdf(file.buffer))throw new ApiError(400,'The file is not a complete PDF / Le fichier n’est pas un PDF complet')
  const actorId=await databaseActorId(req.user!.sub),version=randomUUID(),storedName=version+'.pdf',key=schoolDocumentKey(input.kind,input.language,input.academicYear)
  const folder=uploadPath('school-documents'),path=uploadPath('school-documents',storedName)
  await mkdir(folder,{recursive:true});await writeFile(path,file.buffer,{flag:'wx',mode:0o644})
  try {
    const doc=await prisma.$transaction(async tx=>{
      await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))',key)
      const prior=await tx.auditLog.findUnique({where:{id:key},select:{metadata:true}}),previous=prior?.metadata as any
      if((previous?.revision || 0)!==input.revision)throw new ApiError(409,'A newer document was published. Refresh before replacing it. / Un nouveau document a été publié. Actualisez avant de le remplacer.')
      const next={...input,version,storedName,filename:safeSchoolPdfName(file.originalname),bytes:file.size,sha256:schoolPdfHash(file.buffer),publishedAt:new Date().toISOString(),revision:input.revision+1}
      await tx.auditLog.create({data:{id:'nexus-school-document-version-'+version,actorId,action:'SCHOOL_DOCUMENT_VERSION',targetType:'SchoolDocument',targetId:key,metadata:next}})
      await tx.auditLog.upsert({where:{id:key},create:{id:key,actorId,action:'SCHOOL_DOCUMENT_PUBLISHED',targetType:'SchoolDocument',targetId:key,metadata:next},update:{actorId,metadata:next}})
      await tx.auditLog.create({data:{actorId,action:'SCHOOL_DOCUMENT_REPLACED',targetType:'SchoolDocument',targetId:key,metadata:{previous:previous || null,next}}})
      return next
    })
    res.setHeader('Cache-Control','no-store')
    return success(res,publicMeta(doc),'Published school document / Document scolaire publié',201)
  }catch(error){await unlink(path).catch(()=>undefined);throw error}
}))
