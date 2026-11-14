import {test,afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {academicRecordsRouter} from './academic-records.routes.js'
import {prisma} from '../config/prisma.js'

const audit=prisma.auditLog as unknown as {findFirst:(args:any)=>Promise<any>}
const original=audit.findFirst
afterEach(()=>{audit.findFirst=original})
const layer=academicRecordsRouter.stack.find((layer:any)=>layer.route?.path==='/transcripts/verify') as any
assert.ok(layer)
const handler:(request:any,response:any,next:(error:any)=>void)=>void=layer.route.stack.at(-1).handle
const fingerprint='A'.repeat(64)
const invoke=(document:string,hash=fingerprint)=>new Promise<any>((resolve,reject)=>{
 const response={statusCode:200,status(value:number){this.statusCode=value;return this},json(body:any){resolve({status:this.statusCode,body});return this}}
 handler({query:{document,fingerprint:hash}},response,reject)
})
test('preview QR verifies a registered origin without certifying official academic results',async()=>{
 const document='KCS-TR-PREVIEW-20261114-ABC123'
 audit.findFirst=async(args:any)=>{
  assert.deepEqual(args.where,{action:'TRANSCRIPT_PREVIEW_GENERATED',targetType:'TranscriptPreview',targetId:document})
  return{createdAt:new Date('2026-11-14T00:00:00Z'),metadata:{fingerprint,studentName:'Private learner',studentNumber:'Private ID'}}
 }
 const response=await invoke(document),data=response.body.data
 assert.equal(data.valid,false);assert.equal(data.registered,true);assert.equal(data.preview,true);assert.equal(data.official,false)
 assert.equal(data.documentStatus,'PREVIEW');assert.equal(data.fingerprintAlgorithm,'SHA-256')
 assert.equal(data.studentName,undefined);assert.equal(data.studentNumber,undefined)
})
test('official QR verification remains compatible and validates the official audit only',async()=>{
 const document='KCS-TR-20261114-ABC123'
 audit.findFirst=async(args:any)=>{
  assert.deepEqual(args.where,{action:'TRANSCRIPT_VERIFICATION_ISSUED',targetType:'OfficialTranscript',targetId:document})
  return{createdAt:new Date(),metadata:{fingerprint}}
 }
 const data=(await invoke(document)).body.data
 assert.equal(data.valid,true);assert.equal(data.official,true);assert.equal(data.preview,false);assert.equal(data.documentStatus,'OFFICIAL')
})
test('unknown or altered QR fingerprints cannot be verified',async()=>{
 audit.findFirst=async()=>null
 await assert.rejects(invoke('KCS-TR-PREVIEW-20261114-ABC123'),(error:any)=>error.statusCode===404)
 audit.findFirst=async()=>({createdAt:new Date(),metadata:{fingerprint}})
 await assert.rejects(invoke('KCS-TR-PREVIEW-20261114-ABC123','B'.repeat(64)),(error:any)=>error.statusCode===404)
})
test('malformed document references are rejected before looking up the register',async()=>{
 let queried=false;audit.findFirst=async()=>{queried=true;return null}
 await assert.rejects(invoke('not-a-transcript'),(error:any)=>error.name==='ZodError')
 assert.equal(queried,false)
})
