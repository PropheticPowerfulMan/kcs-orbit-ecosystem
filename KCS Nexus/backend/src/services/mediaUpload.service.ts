import multer from 'multer'
import {randomUUID} from 'node:crypto'
import path from 'node:path'
import {createWriteStream} from 'node:fs'
import {mkdir,open,rename,readdir,stat,statfs,unlink} from 'node:fs/promises'
import {Transform} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import type {Request,Response,NextFunction} from 'express'
import type {AuthenticatedRequest} from '../middleware/auth.js'
import {ApiError,asyncHandler} from '../utils/api.js'
import {uploadPath,uploadRoot} from '../utils/uploadStorage.js'
import {MAX_VIDEO_UPLOAD_BYTES,mediaUploadLimit,supportedMediaType,validateMediaUpload} from '../utils/mediaUpload.js'

const temporaryRoot=uploadPath('.media-upload-tmp'),reserveBytes=256*1024*1024
let active=0
const tr=(req:Request,fr:string,en:string)=>req.get('x-ui-language')==='fr'?fr:en
export async function assertMediaUploadSpace(bytes=2*MAX_VIDEO_UPLOAD_BYTES+reserveBytes,language='en'){
 await mkdir(uploadRoot,{recursive:true});const free=await statfs(uploadRoot)
 if(free.bavail*free.bsize<bytes)throw new ApiError(507,language==='fr'?'Espace de stockage insuffisant pour cette vidéo. Contactez l’administration.':'Insufficient storage for this video. Contact the administrator.')
}
class DiskMediaStorage implements multer.StorageEngine{
 _handleFile(req:Request,file:Express.Multer.File,callback:(error?:any,info?:Partial<Express.Multer.File>)=>void){
  if(active>=2)return callback(new ApiError(429,tr(req,'Deux fichiers sont déjà en cours de téléversement. Réessayez dans un instant.','Two files are already uploading. Please try again shortly.')))
  active++;const controller=new AbortController(),aborted=()=>controller.abort(),filename=randomUUID()+'.tmp',destination=temporaryRoot,filePath=path.join(destination,filename),limit=mediaUploadLimit(file.mimetype);let size=0,lastCheck=0
  req.once('aborted',aborted)
  const meter=new Transform({transform(chunk:Buffer,_encoding,done){
   size+=chunk.length
   if(size>limit)return done(new ApiError(413,tr(req,file.mimetype.startsWith('video/')?'Une vidéo ne peut pas dépasser 500 Mo.':'Une image ne peut pas dépasser 10 Mo.',file.mimetype.startsWith('video/')?'A video must not exceed 500 MB.':'An image must not exceed 10 MB.')))
   if(size-lastCheck>=32*1024*1024){lastCheck=size;void assertMediaUploadSpace(reserveBytes,req.get('x-ui-language')).then(()=>done(null,chunk),error=>done(error));return}
   done(null,chunk)
  }})
  void(async()=>{try{await mkdir(destination,{recursive:true});await assertMediaUploadSpace(limit+reserveBytes,req.get('x-ui-language'));await pipeline(file.stream,meter,createWriteStream(filePath,{flags:'wx'}),{signal:controller.signal});callback(null,{destination,filename,path:filePath,size})}catch(error){await unlink(filePath).catch(()=>undefined);callback(error)}finally{active--;req.off('aborted',aborted)}})()
 }
 _removeFile(_req:Request,file:Express.Multer.File,callback:(error:Error|null)=>void){void unlink(file.path).then(()=>callback(null),error=>callback(error.code==='ENOENT'?null:error))}
}
const parser=multer({storage:new DiskMediaStorage(),limits:{fileSize:MAX_VIDEO_UPLOAD_BYTES+1,files:1,fields:12,fieldSize:65536,parts:14},fileFilter:(_req,file,callback)=>supportedMediaType(file.originalname,file.mimetype)?callback(null,true):callback(new ApiError(415,'Unsupported media type. Use JPG, PNG, WebP, GIF, MP4 or WebM.'))}).single('file')

export function mediaUploadMiddleware(req:Request,res:Response,next:NextFunction){
 parser(req,res,error=>next(error instanceof multer.MulterError&&error.code==='LIMIT_FILE_SIZE'?new ApiError(413,tr(req,'Limite : 500 Mo par vidéo et 10 Mo par image.','Limit: 500 MB per video and 10 MB per image.')):error))
}
export async function validateDiskMedia(file:Express.Multer.File){
 const descriptor=await open(file.path,'r');try{const buffer=Buffer.alloc(16),read=await descriptor.read(buffer,0,buffer.length,0);return file.size<=mediaUploadLimit(file.mimetype)&&validateMediaUpload({...file,buffer:buffer.subarray(0,read.bytesRead)})}finally{await descriptor.close()}
}
export async function promoteMediaFile(file:Express.Multer.File,filename:string){const root=uploadPath('media');await mkdir(root,{recursive:true});const target=path.join(root,filename);await rename(file.path,target);return target}
/** Every validation/database error also removes the private temporary upload. */
export function mediaFileHandler(handler:(req:AuthenticatedRequest,res:Response)=>Promise<unknown>){return asyncHandler(async(req:AuthenticatedRequest,res:Response)=>{try{return await handler(req,res)}finally{if(req.file?.path)await unlink(req.file.path).catch(()=>undefined)}})}

/** Only abandoned UUID temporary files are eligible; published media is outside this directory. */
export async function cleanAbandonedMediaUploads(now=Date.now()){
 await mkdir(temporaryRoot,{recursive:true});let removed=0
 for(const item of await readdir(temporaryRoot,{withFileTypes:true})){
  if(!item.isFile()||!/^[a-f0-9-]{36}\.tmp$/.test(item.name))continue
  const target=path.join(temporaryRoot,item.name),info=await stat(target).catch(()=>null)
  if(info&&info.mtimeMs<now-24*60*60*1000){await unlink(target).catch(()=>undefined);removed++}
 }
 return removed
}
let cleanupStarted=false
export function startMediaUploadCleanup(){if(cleanupStarted)return;cleanupStarted=true;const run=()=>void cleanAbandonedMediaUploads().catch(()=>undefined);setTimeout(run,60000).unref();setInterval(run,3600000).unref()}
