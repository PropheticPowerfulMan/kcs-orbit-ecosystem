import {test} from 'node:test'
import assert from 'node:assert/strict'
import {officialTranscriptDocument} from './officialTranscriptPdf.js'
import {buildTranscriptRecords} from './transcriptRecords.js'

function fixture(approved:boolean){
 const records=buildTranscriptRecords({studentGrade:'Grade 9',activeAcademicYear:'2026-2027',grades:approved?[{id:'g1',studentId:'s1',courseId:'c1',percentage:88,letterGrade:'B',period:'2026-2027::Semester 1 · Quarter 1::APPROVED',createdAt:new Date('2026-11-01'),course:{id:'c1',code:'ALG',name:'Algebra',credits:2,grade:'Grade 9'}}]:[],legacy:[]})
 return{...records,student:{id:'s1',studentNumber:'QA-ST-1',name:'Synthetic Learner',grade:'Grade 9',transcriptVisible:false,photoUrl:null},sourceVersion:'synthetic-source',activeAcademicYear:'2026-2027',generatedAt:'2026-11-14T00:00:00Z',dataPolicy:approved?'APPROVED_AND_VERIFIED_LEGACY_RECORDS_ONLY':'NO_OFFICIAL_DATA'}
}
test('an empty administrative preview renders without claiming official issuance',async()=>{
 const doc=await officialTranscriptDocument(fixture(false))
 assert.equal(doc.preview,true)
 assert.match(doc.documentId,/^KCS-TR-PREVIEW-/)
 assert.match(doc.html,/PREVIEW · NOT AN ISSUED ACADEMIC TRANSCRIPT/)
 assert.match(doc.html,/QR verifies the registered preview and its status/)
 assert.match(doc.html,/alt="Verification QR code"/)
 assert.match(doc.html,/Digital document identity/)
 assert.match(doc.html,/Generated \(UTC\)/)
 assert.match(doc.html,/SHA-256:/)
 assert.equal(new URL(doc.verificationUrl).searchParams.get('document'),doc.documentId)
 assert.equal(new URL(doc.verificationUrl).searchParams.get('fingerprint'),doc.fingerprint)
 assert.doesNotMatch(doc.html,/Official · Verified source/)
 assert.match(doc.html,/class="watermark"/)
 assert.match(doc.html,/www.kinshasachristianschool.org/)
})
test('approved records retain the official English transcript and verification QR',async()=>{
 const doc=await officialTranscriptDocument(fixture(true))
 assert.equal(doc.preview,false)
 assert.doesNotMatch(doc.documentId,/PREVIEW/)
 assert.match(doc.html,/Official Academic Transcript/)
 assert.match(doc.html,/Official · Verified source/)
 assert.match(doc.html,/alt="Verification QR code"/)
 assert.match(doc.html,/Algebra/)
 assert.doesNotMatch(doc.html,/NOT AN ISSUED/)
})

test('verification links use the configured staging frontend without changing official fingerprints',async()=>{
 const previous=process.env.FRONTEND_URL
 try{
  process.env.FRONTEND_URL='https://staging.example.invalid/'
  for(const approved of [false,true]){
   const doc=await officialTranscriptDocument(fixture(approved))
   assert.equal(new URL(doc.verificationUrl).origin,'https://staging.example.invalid')
   assert.match(doc.html,/alt="Verification QR code"/)
   assert.match(doc.html,/Issuer:<\/b> Kinshasa Christian School/)
  }
 }finally{if(previous===undefined)delete process.env.FRONTEND_URL;else process.env.FRONTEND_URL=previous}
})
