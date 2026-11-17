import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,open,unlink,rmdir} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {validateDiskMedia} from './mediaUpload.service.js'
import {MAX_VIDEO_UPLOAD_BYTES,mediaUploadLimit,supportedMediaType} from '../utils/mediaUpload.js'
const make=async(name:string,mime:string,size:number,header:Buffer)=>{const directory=await mkdtemp(path.join(os.tmpdir(),'nexus-video-unit-')),filePath=path.join(directory,name),fd=await open(filePath,'w');await fd.write(header);await fd.truncate(size);await fd.close();return{file:{path:filePath,originalname:name,mimetype:mime,size}as Express.Multer.File,cleanup:async()=>{await unlink(filePath);await rmdir(directory)}}}
test('validates a 500 MB sparse video from its header without allocating the payload',async()=>{const value=await make('large.mp4','video/mp4',MAX_VIDEO_UPLOAD_BYTES,Buffer.from([0,0,0,24,102,116,121,112,105,115,111,109]));try{const before=process.memoryUsage().rss;assert.equal(await validateDiskMedia(value.file),true);assert.ok(process.memoryUsage().rss-before<32*1024*1024)}finally{await value.cleanup()}})
test('rejects video over the limit even if its first bytes are correct',async()=>{const value=await make('large.mp4','video/mp4',MAX_VIDEO_UPLOAD_BYTES+1,Buffer.from([0,0,0,24,102,116,121,112]));try{assert.equal(await validateDiskMedia(value.file),false)}finally{await value.cleanup()}})
test('disk validation rejects a forged MIME or incomplete header',async()=>{for(const[name,mime,header]of[['movie.mp4','image/png',Buffer.from('not an image')],['photo.png','image/png',Buffer.from([0x89,0x50])]]as const){const value=await make(name,mime,header.length,header);try{assert.equal(await validateDiskMedia(value.file),false)}finally{await value.cleanup()}}})
test('large-video eligibility never extends the image or executable allowance',()=>{assert.ok(mediaUploadLimit('video/mp4')>mediaUploadLimit('image/png'));assert.equal(supportedMediaType('movie.mp4','video/mp4'),true);assert.equal(supportedMediaType('movie.exe','video/mp4'),false);assert.equal(supportedMediaType('movie.mp4','image/png'),false)})
