import {Prisma} from '@prisma/client'
import type {Response,Request} from 'express'
import multer from 'multer';
import { createReadStream } from 'node:fs';
import { mkdir, open, unlink, statfs } from 'node:fs/promises';
import { resolve, extname, basename } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { prisma } from './database.js';
import { id } from './validation.js';
import { type Actor, projectAccess, audit } from './policy.js';
import { candidateAccess } from './portfolio.js';
import { JuryError, safeFilename } from './security.js';
const root = resolve(process.env.JURY_STORAGE_DIR || '/var/lib/kcs-jury/private');
const types: Record<string, {
    mime: string;
    magic: (b: Buffer) => boolean;
}> = { '.pdf': { mime: 'application/pdf', magic: b => b.subarray(0, 5).toString() === '%PDF-' }, '.png': { mime: 'image/png', magic: b => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }, '.jpg': { mime: 'image/jpeg', magic: b => b[0] === 255 && b[1] === 216 && b[2] === 255 }, '.jpeg': { mime: 'image/jpeg', magic: b => b[0] === 255 && b[1] === 216 && b[2] === 255 }, '.webp': { mime: 'image/webp', magic: b => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' }, '.mp4': { mime: 'video/mp4', magic: b => b.subarray(4, 8).toString() === 'ftyp' }, '.webm': { mime: 'video/webm', magic: b => b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) }, '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: b => b[0] === 80 && b[1] === 75 }, '.pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', magic: b => b[0] === 80 && b[1] === 75 }, '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: b => b[0] === 80 && b[1] === 75 }, '.txt': { mime: 'text/plain', magic: b => !b.includes(0) } };
const fileLimit=100*1024*1024
const limit=(name:string,fallback:number)=>{const n=Number(process.env[name]);return Number.isSafeInteger(n)&&n>0?n:fallback}
const storageLimit=limit('JURY_MAX_STORAGE_BYTES',20*1024**3),projectLimit=limit('JURY_MAX_PROJECT_BYTES',2*1024**3),personLimit=limit('JURY_MAX_PERSON_PROJECT_BYTES',512*1024**2),minimumFree=limit('JURY_MIN_FREE_BYTES',1024**3)
let activeUploads=0
/** Reserve bounded streaming capacity before Multer writes. No school record is changed. */
export async function reserveUploadCapacity(_req:Request,res:Response,scope:{projectId:string;uploader:string}){
 if(activeUploads>=2){res.setHeader('Retry-After','10');throw new JuryError('UPLOAD_CAPACITY_BUSY','Two documents are uploading. Retry shortly. / Deux documents sont en cours de dépôt. Réessayez dans un instant.',429)}
 activeUploads++;let released=false;const release=()=>{if(!released){released=true;activeUploads--}};res.once('finish',release);res.once('close',release)
 try{const[all,project,person]=await Promise.all([prisma.juryAttachment.aggregate({_sum:{bytes:true}}),prisma.juryAttachment.aggregate({where:{projectId:scope.projectId},_sum:{bytes:true}}),prisma.juryAttachment.aggregate({where:{projectId:scope.projectId,uploadedByReference:scope.uploader},_sum:{bytes:true}})]);if((all._sum.bytes??0)>=storageLimit||(project._sum.bytes??0)>=projectLimit||(person._sum.bytes??0)>=personLimit)throw new JuryError('UPLOAD_QUOTA_EXCEEDED','The storage allowance is reached. Contact school administration. / Le quota de stockage est atteint. Contactez la direction.',413);await mkdir(root,{recursive:true,mode:0o700});const fs=await statfs(root);if(fs.bavail*fs.bsize<minimumFree+activeUploads*fileLimit)throw new JuryError('UPLOAD_STORAGE_FULL','Storage safety reserve reached. Contact school administration. / La réserve de sécurité du stockage est atteinte. Contactez la direction.',507)}catch(error){release();throw error}
}
export const upload = multer({ storage: multer.diskStorage({ destination: (_req, _file, cb) => { mkdir(root, { recursive: true, mode: 0o700 }).then(() => cb(null, root)).catch(error => cb(error, '')); }, filename: (_req, file, cb) => { const ext = extname(file.originalname).toLowerCase(); if (!types[ext])
            return cb(new JuryError('UPLOAD_TYPE_NOT_ALLOWED', 'Use PDF, Office documents, images, text or supported video.'), ''); cb(null, randomUUID() + ext); } }), limits: { fileSize: fileLimit, files: 1, fields: 4 }, fileFilter: (_req, file, cb) => { const type = types[extname(file.originalname).toLowerCase()]; cb(type ? null : new JuryError('UPLOAD_TYPE_NOT_ALLOWED', 'This file format is not allowed.') as any, Boolean(type)); } });
export async function attachFile(actor: Actor, projectId: string, file: Express.Multer.File | undefined, rawSubmissionId?: unknown) { if (!file)
    throw new JuryError('FILE_REQUIRED', 'Choose a file to upload.'); try {
    const submissionId = rawSubmissionId ? id.parse(rawSubmissionId) : undefined;
    const access = await projectAccess(actor, projectId);
    if (submissionId) {
        const submission = await prisma.jurySubmission.findUnique({ where: { id: submissionId } });
        if (!submission || submission.projectId !== projectId)
            throw new JuryError('SUBMISSION_NOT_FOUND', 'This submission was not found.', 404);
        const a = await candidateAccess(actor, submission.candidateId, true);
        if (!a.access.manager && (!['REGISTRATION_OPEN', 'SUBMISSION_OPEN'].includes(a.access.project.status) || a.access.project.submissionDeadline && a.access.project.submissionDeadline < new Date()))
            throw new JuryError('SUBMISSION_CLOSED', 'The submission period is closed.', 409);
    }
    else if (!access.manager)
        throw new JuryError('PROJECT_FILE_ACCESS_DENIED', 'Only organizers may upload shared project documents.', 403);
    const ext = extname(file.originalname).toLowerCase(), type = types[ext], handle = await open(file.path, 'r');
    let head = Buffer.alloc(512);
    try {
        const { bytesRead } = await handle.read(head, 0, head.length, 0);
        head = head.subarray(0, bytesRead);
    }
    finally {
        await handle.close();
    }
    if (!type?.magic(head))
        throw new JuryError('UPLOAD_SIGNATURE_INVALID', 'The file contents do not match the selected file format.');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file.path))
        hash.update(chunk);
    const sha256=hash.digest('hex')
    // This short transaction serializes quota accounting across API replicas.
    // Removed files still consume storage, so soft deletion cannot bypass quotas.
    const row=await prisma.$transaction(async tx=>{
        await tx.$queryRaw(Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(1247105625,1)`)
        const [all,project,person]=await Promise.all([
            tx.juryAttachment.aggregate({_sum:{bytes:true}}),
            tx.juryAttachment.aggregate({where:{projectId},_sum:{bytes:true}}),
            tx.juryAttachment.aggregate({where:{projectId,uploadedByReference:actor.reference},_sum:{bytes:true}}),
        ])
        if((all._sum.bytes??0)+file.size>storageLimit||(project._sum.bytes??0)+file.size>projectLimit||(person._sum.bytes??0)+file.size>personLimit)throw new JuryError('UPLOAD_QUOTA_EXCEEDED','The project or account storage allowance is reached. Contact school administration. / Le quota de stockage du projet ou du compte est atteint. Contactez la direction.',413)
        const created=await tx.juryAttachment.create({data:{projectId,submissionId,originalName:safeFilename(file.originalname),mimeType:type.mime,bytes:file.size,sha256,storageKey:basename(file.path),purpose:submissionId?'PORTFOLIO':'PROJECT_RESOURCE',uploadedByReference:actor.reference}})
        await audit(tx,actor,projectId,'ATTACHMENT_UPLOADED','Attachment',created.id,{bytes:created.bytes,mimeType:created.mimeType})
        return created
    },{maxWait:5000,timeout:10000})
    return { id: row.id, originalName: row.originalName, mimeType: row.mimeType, bytes: row.bytes };
}
catch (error) {
    await unlink(file.path).catch(() => undefined);
    throw error;
} }
export async function attachmentAccess(actor: Actor, id: string) { const row = await prisma.juryAttachment.findUnique({ where: { id }, include: { submission: { select: { candidateId: true } } } }); if (!row || row.removedAt)
    throw new JuryError('ATTACHMENT_NOT_FOUND', 'This document was not found.', 404); if (row.submission)
    await candidateAccess(actor, row.submission.candidateId);
else
    await projectAccess(actor, row.projectId); if (basename(row.storageKey) !== row.storageKey)
    throw new JuryError('ATTACHMENT_PATH_INVALID', 'This protected document is unavailable.', 500); return { row, path: resolve(root, row.storageKey) }; }
export async function removeAttachment(actor: Actor, id: string) { const { row } = await attachmentAccess(actor, id), access = await projectAccess(actor, row.projectId); if (!access.manager && row.uploadedByReference !== actor.reference)
    throw new JuryError('ATTACHMENT_DELETE_DENIED', 'You cannot remove this document.', 403); if (!access.manager && !['REGISTRATION_OPEN', 'SUBMISSION_OPEN'].includes(access.project.status))
    throw new JuryError('SUBMISSION_CLOSED', 'Project files are protected after the submission period.', 409); await prisma.juryAttachment.update({ where: { id }, data: { removedAt: new Date() } }); await audit(prisma, actor, row.projectId, 'ATTACHMENT_REMOVED', 'Attachment', id); return { removed: true }; }
