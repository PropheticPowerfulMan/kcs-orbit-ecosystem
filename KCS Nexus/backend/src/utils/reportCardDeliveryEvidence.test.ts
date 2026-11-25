import assert from 'node:assert/strict'
import test from 'node:test'
import {reportCardDeliveryEvidence} from './reportCardDeliveryEvidence.js'
const base={status:'SENT',sentAt:new Date('2026-11-20T08:00:00Z'),deliveredAt:null,metadata:{reportCardReceiptVersion:2,receiptDocumentId:'KCS-QA',receiptFingerprint:'f',reportCardAttachmentName:'RC - Grade 11.pdf',reportCardAttachmentSha256:'a'.repeat(64)}}
test('SMTP acceptance proves sending, not parent receipt',()=>{
 const evidence=reportCardDeliveryEvidence(base)
 assert.equal(evidence.receiptState,'AWAITING_CONFIRMATION')
 assert.equal(evidence.confirmedAt,null)
 assert.equal(evidence.providerAcceptedAt,'2026-11-20T08:00:00.000Z')
 assert.equal(evidence.attachmentName,'RC - Grade 11.pdf')
})
test('legacy delivery labels and image opens never confirm parental receipt',()=>{
 for(const row of [{...base,status:'DELIVERED',deliveredAt:new Date()},{...base,metadata:{...base.metadata,reportCardEmailOpenedAt:'2026-11-20T08:01:00Z'}}]){
  const evidence=reportCardDeliveryEvidence(row);assert.equal(evidence.confirmedAt,null);assert.equal(evidence.receiptState,'AWAITING_CONFIRMATION')
 }
})
test('only explicit recorded acknowledgement confirms email and PDF receipt',()=>{
 const evidence=reportCardDeliveryEvidence({...base,metadata:{...base.metadata,reportCardReceiptConfirmedAt:'2026-11-20T08:02:00Z',reportCardReceiptConfirmationMethod:'PARENT_EMAIL_AND_PDF_ACKNOWLEDGEMENT',reportCardReceiptEmailConfirmed:true,reportCardReceiptPdfConfirmed:true}})
 assert.equal(evidence.receiptState,'CONFIRMED');assert.equal(evidence.confirmationSource,'PARENT_ACKNOWLEDGEMENT')
 assert.equal(evidence.confirmedAt,'2026-11-20T08:02:00.000Z')
})
test('malformed timestamps cannot produce a false confirmation',()=>assert.equal(reportCardDeliveryEvidence({...base,metadata:{reportCardReceiptConfirmedAt:'not-a-time'}}).confirmedAt,null))
test('queued and failed deliveries remain distinguishable',()=>{
 assert.equal(reportCardDeliveryEvidence({...base,status:'QUEUED',sentAt:null}).receiptState,'QUEUED')
 assert.equal(reportCardDeliveryEvidence({...base,status:'FAILED',sentAt:null}).receiptState,'FAILED')
})

test('older acknowledgements without explicit email and PDF confirmation remain distinguishable',()=>{const result=reportCardDeliveryEvidence({...base,metadata:{...base.metadata,reportCardReceiptConfirmedAt:'2026-11-20T08:02:00Z'}});assert.equal(result.confirmedAt,null);assert.equal(result.confirmationScope,'LEGACY_ACKNOWLEDGEMENT');assert.equal(result.legacyAcknowledgedAt,'2026-11-20T08:02:00.000Z')})
test('active queue lease is sending; expired lease returns to queued',()=>{for(const[delay,state]of[[120000,'SENDING'],[-1000,'QUEUED']]as const){const result=reportCardDeliveryEvidence({...base,status:'QUEUED',sentAt:null,metadata:{leaseId:'qa-lease',leaseUntil:new Date(Date.now()+delay).toISOString()}});assert.equal(result.receiptState,state)}})
test('expected parent without a delivery log is not sent',()=>assert.equal(reportCardDeliveryEvidence({...base,status:'NOT_SENT',sentAt:null,metadata:{}}).receiptState,'NOT_SENT'))
