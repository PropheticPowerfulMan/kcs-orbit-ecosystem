import {randomUUID} from 'node:crypto'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import path from 'node:path'
import type {Prisma} from '@prisma/client'
import {prisma} from '../config/prisma.js'
import {uploadPath} from './uploadStorage.js'
import {ApiError} from './api.js'
export type NewsAttachment={id:string;name:string;mime:string;size:number;url:string}
const fileKey=(id:string)=>'news-attachment-'+id
const postKey=(id:string)=>'news-post-attachments-'+id
export const MAX_NEWS_ATTACHMENT_BYTES=12*1024*1024
export function validateNewsDocument(name:string,buffer:Buffer){
 const ext=path.extname(name).toLowerCase(),types:Record<string,string>={'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.txt':'text/plain'}
 if(!types[ext]||!buffer.length||buffer.length>MAX_NEWS_ATTACHMENT_BYTES)throw new ApiError(400,'Use a PDF, DOCX, XLSX, PPTX or TXT file of up to 12 MB.')
 if(ext==='.pdf'&&!buffer.subarray(0,5).equals(Buffer.from('%PDF-')))throw new ApiError(400,'This file does not contain a valid PDF header.')
 if(['.docx','.xlsx','.pptx'].includes(ext)){const entry=ext==='.docx'?'word/document.xml':ext==='.xlsx'?'xl/workbook.xml':'ppt/presentation.xml';if(buffer.length<4||buffer.readUInt32LE(0)!==0x04034b50||!buffer.includes(Buffer.from('[Content_Types].xml'))||!buffer.includes(Buffer.from(entry)))throw new ApiError(400,'The Office file does not match its document type.')}
 return {extension:ext,mime:types[ext]}
}
export async function registerNewsDocument(file:Express.Multer.File,actorId:string){
 const format=validateNewsDocument(file.originalname,file.buffer),id=randomUUID(),filename=id+format.extension;await mkdir(uploadPath('.news-documents'),{recursive:true});await writeFile(uploadPath('.news-documents',filename),file.buffer,{flag:'wx',mode:0o600})
 const attachment:NewsAttachment={id,name:file.originalname.replace(/[\/\0\r\n]/g,'_').slice(0,180),mime:format.mime,size:file.size,url:'/api/news/attachments/'+id+'/download'}
 await prisma.auditLog.create({data:{id:fileKey(id),actorId,action:'NEWS_ATTACHMENT_REGISTERED',targetType:'NewsAttachment',targetId:id,metadata:{...attachment,filename}}});return attachment
}
export async function saveNewsAttachments(tx:Prisma.TransactionClient,postId:string,ids:string[],actorId:string){
 if(new Set(ids).size!==ids.length||ids.length>8)throw new ApiError(400,'Select up to eight distinct attachments.')
 const rows=ids.length?await tx.auditLog.findMany({where:{id:{in:ids.map(fileKey)},action:'NEWS_ATTACHMENT_REGISTERED'},select:{metadata:true}}):[]
 const attachments=ids.map(id=>rows.map(row=>row.metadata as unknown as NewsAttachment).find(row=>row.id===id));if(attachments.some(row=>!row))throw new ApiError(400,'An attachment is unavailable. Upload it again before publishing.')
 const metadata={attachments:attachments as NewsAttachment[]};await tx.auditLog.upsert({where:{id:postKey(postId)},create:{id:postKey(postId),actorId,action:'NEWS_POST_ATTACHMENTS',targetType:'NewsPost',targetId:postId,metadata},update:{metadata}})
}
export async function attachNewsDocuments<T extends {id:string}>(posts:T[]){
 const rows=posts.length?await prisma.auditLog.findMany({where:{id:{in:posts.map(post=>postKey(post.id))},action:'NEWS_POST_ATTACHMENTS'},select:{targetId:true,metadata:true}}):[]
 return posts.map(post=>({...post,attachments:((rows.find(row=>row.targetId===post.id)?.metadata as {attachments?:NewsAttachment[]}|undefined)?.attachments??[])}))
}
export async function publishedNewsDocument(id:string){
 const registered=await prisma.auditLog.findUnique({where:{id:fileKey(id)},select:{metadata:true}});if(!registered)throw new ApiError(404,'Document not found')
 const associations=await prisma.auditLog.findMany({where:{action:'NEWS_POST_ATTACHMENTS'},select:{targetId:true,metadata:true}})
 const postIds=associations.filter(row=>(row.metadata as {attachments?:NewsAttachment[]}|null)?.attachments?.some(file=>file.id===id)).map(row=>row.targetId).filter((value):value is string=>Boolean(value))
 if(!postIds.length||!await prisma.newsPost.findFirst({where:{id:{in:postIds}},select:{id:true}}))throw new ApiError(404,'This document is not attached to a published article')
 const attachment=registered.metadata as unknown as NewsAttachment&{filename:string};if(!new RegExp('^'+id+'\\.(pdf|docx|xlsx|pptx|txt)$').test(attachment.filename))throw new ApiError(404,'Document unavailable')
 const buffer=await readFile(uploadPath('.news-documents',attachment.filename)).catch(()=>{throw new ApiError(404,'Document file unavailable')});return {...attachment,buffer}
}
