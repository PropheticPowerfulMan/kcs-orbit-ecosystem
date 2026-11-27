import test from 'node:test'
import assert from 'node:assert/strict'
import {certificateReceiptToken,verifyCertificateReceipt,certificateReceiptUrl}from './certificateReceipt.js'
import {certificateDeliveryEvidence}from './certificateDeliveryEvidence.js'
import {transcriptReceiptToken}from './transcriptReceipt.js'
import {reportCardReceiptToken}from './reportCardReceipt.js'
const row={id:'qa-certificate-log',studentId:'qa-learner',reportCardId:null,recipientEmail:'parent@example.invalid',metadata:{certificateReceiptVersion:2,receiptDocumentId:'KCS-CERT-QA',receiptFingerprint:'fingerprint',certificateAttachmentSha256:'a'.repeat(64)}}
test('certificate receipt binds learner, recipient, exact PDF and document identity',()=>{
 const token=certificateReceiptToken(row,'test-only-secret')!;assert.equal(token.length,64);assert.equal(verifyCertificateReceipt(row,token,'test-only-secret'),true)
 for(const changed of [{...row,studentId:'different'},{...row,recipientEmail:'other@example.invalid'},{...row,metadata:{...row.metadata,certificateAttachmentSha256:'b'.repeat(64)}}])assert.equal(verifyCertificateReceipt(changed,token,'test-only-secret'),false)
 assert.equal(reportCardReceiptToken(row,'test-only-secret'),null);assert.equal(transcriptReceiptToken(row,'test-only-secret'),null)
 const url=new URL(certificateReceiptUrl(row,'https://kcs.example','test-only-secret','fr')!);assert.equal(url.pathname,'/api/certificate-receipts/qa-certificate-log');assert.equal(url.searchParams.get('token'),null);assert.ok(url.hash.includes(token))
})
test('SMTP acceptance, a tracking open or a manual delivery status never imply parent receipt',()=>{
 const data={status:'DELIVERED',sentAt:new Date(),deliveredAt:new Date(),metadata:{...row.metadata,smtpAcceptedAt:new Date().toISOString(),certificateEmailOpenedAt:new Date().toISOString()}}
 assert.equal(certificateDeliveryEvidence(data).confirmedAt,null);assert.equal(certificateDeliveryEvidence(data).receiptState,'AWAITING_CONFIRMATION')
 assert.equal(certificateDeliveryEvidence({...data,metadata:{...data.metadata,certificateReceiptConfirmedAt:new Date().toISOString()}}).receiptState,'CONFIRMED')
 assert.equal(certificateDeliveryEvidence({...data,metadata:{documentId:'KCS-TR-OLD'}}).confirmationAvailable,false)
})
