import assert from 'node:assert/strict'
import test from 'node:test'
import {reportCardReceiptToken,reportCardReceiptUrl,verifyReportCardReceipt} from './reportCardReceipt.js'
const row={id:'receipt-qa-123',reportCardId:'card-1',recipientEmail:'parent@example.invalid',metadata:{reportCardReceiptVersion:1,receiptDocumentId:'KCS-QA',receiptFingerprint:'abc123'}}
test('receipt token is bound to the actual document, recipient and delivery',()=>{
 const token=reportCardReceiptToken(row,'synthetic-test-secret')!
 assert.equal(verifyReportCardReceipt(row,token,'synthetic-test-secret'),true)
 for(const altered of [{...row,id:'other'},{...row,recipientEmail:'other@example.invalid'},{...row,reportCardId:'other'},{...row,metadata:{...row.metadata,receiptFingerprint:'changed'}}])assert.equal(verifyReportCardReceipt(altered,token,'synthetic-test-secret'),false)
 assert.equal(verifyReportCardReceipt(row,'0'.repeat(64),'synthetic-test-secret'),false)
 assert.equal(verifyReportCardReceipt(row,'not-hex','synthetic-test-secret'),false)
})
test('receipt URL keeps the signed bearer token out of its HTTP path and query',()=>{
 const url=new URL(reportCardReceiptUrl(row,'https://school.example','synthetic-test-secret','fr')!)
 assert.equal(url.searchParams.get('lang'),'fr');assert.equal(url.searchParams.has('token'),false);assert.ok(url.hash.includes('token='))
 assert.equal(reportCardReceiptToken({...row,reportCardId:null},'synthetic-test-secret'),null)
 assert.equal(reportCardReceiptToken({...row,metadata:{}},'synthetic-test-secret'),null)
})
