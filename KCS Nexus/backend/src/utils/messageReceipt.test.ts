import {test} from 'node:test'
import assert from 'node:assert/strict'
import {messageReceiptToken,verifyMessageReceipt,messageDeliveryEvidence} from './messageReceipt.js'
import {receiptMailbox} from './receiptMailbox.js'
const row={id:'synthetic-receipt-1',recipientEmail:'qa@example.invalid',subject:'School message',body:'Exact communication.',metadata:{messageReceiptVersion:1,messageAttachmentName:'letter.pdf',messageAttachmentSha256:'a'.repeat(64)}}
test('receipt signature binds recipient, exact message and attachment',()=>{
 const token=messageReceiptToken(row,'synthetic-secret')!;assert.equal(verifyMessageReceipt(row,token,'synthetic-secret'),true)
 for(const changed of [{...row,recipientEmail:'other@example.invalid'},{...row,id:'other-id'},{...row,body:'Changed communication'},{...row,metadata:{...row.metadata,messageAttachmentSha256:'b'.repeat(64)}}])assert.equal(verifyMessageReceipt(changed,token,'synthetic-secret'),false)
 assert.equal(verifyMessageReceipt(row,'0'.repeat(64),'synthetic-secret'),false)
})
test('SMTP acceptance and opens are never a recipient acknowledgement',()=>{
 const sent={status:'SENT',sentAt:new Date(),metadata:{...row.metadata,smtpAcceptedAt:new Date().toISOString(),emailOpenedAt:new Date().toISOString()}}
 assert.equal(messageDeliveryEvidence(sent).confirmedAt,null)
 assert.ok(messageDeliveryEvidence({...sent,metadata:{...sent.metadata,messageReceiptConfirmedAt:new Date().toISOString(),messageReceiptEmailConfirmed:true,messageReceiptAttachmentConfirmed:true,messageReceiptConfirmationMethod:'RECIPIENT_EMAIL_AND_ATTACHMENT_ACKNOWLEDGEMENT'}}).confirmedAt)
})
test('mailbox redirect destinations come only from exact known provider domains',()=>{
 assert.ok(receiptMailbox('family@gmail.com')?.startsWith('https://mail.google.com/'))
 assert.equal(receiptMailbox('family@yahoo.fr'),'https://mail.yahoo.com/')
 assert.equal(receiptMailbox('family@gmail.com.attacker.example'),null)
 assert.equal(receiptMailbox('family@school.example'),null)
 assert.equal(receiptMailbox(null),null)
})
