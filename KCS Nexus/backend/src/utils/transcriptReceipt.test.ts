import test from 'node:test'
import assert from 'node:assert/strict'
import {transcriptReceiptToken,verifyTranscriptReceipt,transcriptReceiptUrl}from './transcriptReceipt.js'
import {transcriptDeliveryEvidence}from './transcriptDeliveryEvidence.js'
import {reportCardReceiptToken}from './reportCardReceipt.js'
const row={id:'qa-transcript-log',studentId:'qa-learner',reportCardId:null,recipientEmail:'parent@example.invalid',metadata:{transcriptReceiptVersion:2,receiptDocumentId:'KCS-TR-QA',receiptFingerprint:'fingerprint',transcriptAttachmentSha256:'a'.repeat(64)}}
test('transcript receipt binds learner, recipient, exact PDF and document identity',()=>{
 const token=transcriptReceiptToken(row,'test-only-secret')!;assert.equal(token.length,64);assert.equal(verifyTranscriptReceipt(row,token,'test-only-secret'),true)
 for(const changed of [{...row,studentId:'different'},{...row,recipientEmail:'other@example.invalid'},{...row,metadata:{...row.metadata,transcriptAttachmentSha256:'b'.repeat(64)}}])assert.equal(verifyTranscriptReceipt(changed,token,'test-only-secret'),false)
 assert.equal(reportCardReceiptToken(row,'test-only-secret'),null)
 const url=new URL(transcriptReceiptUrl(row,'https://kcs.example','test-only-secret','fr')!);assert.equal(url.pathname,'/api/transcript-receipts/qa-transcript-log');assert.equal(url.searchParams.get('token'),null);assert.ok(url.hash.includes(token))
})
test('SMTP acceptance, a tracking open or a manual delivery status never imply parent receipt',()=>{
 const data={status:'DELIVERED',sentAt:new Date(),deliveredAt:new Date(),metadata:{...row.metadata,smtpAcceptedAt:new Date().toISOString(),transcriptEmailOpenedAt:new Date().toISOString()}}
 assert.equal(transcriptDeliveryEvidence(data).confirmedAt,null);assert.equal(transcriptDeliveryEvidence(data).receiptState,'AWAITING_CONFIRMATION')
 assert.equal(transcriptDeliveryEvidence({...data,metadata:{...data.metadata,transcriptReceiptConfirmedAt:new Date().toISOString()}}).receiptState,'CONFIRMED')
 assert.equal(transcriptDeliveryEvidence({...data,metadata:{documentId:'KCS-TR-OLD'}}).confirmationAvailable,false)
})
