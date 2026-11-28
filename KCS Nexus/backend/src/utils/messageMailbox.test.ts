import test from 'node:test'
import assert from 'node:assert/strict'
import {mailboxDirection}from'./messageMailbox.js'
function matches(row:any,where:any):boolean{return Object.entries(where).every(([key,value])=>key==='OR'?(value as any[]).some(v=>matches(row,v)):row[key]===value)}
const user='student-a',role='STUDENT',base={senderId:'school',recipientId:user,recipientArchivedAt:null,senderArchivedAt:null,targetRole:null}
test('a direct message addressed to a parent never leaks through a stale student role label',()=>{for(const box of ['inbox','all'])assert.equal(matches({...base,recipientId:'parent-a',targetRole:'STUDENT'},mailboxDirection(user,role,box)),false)})
test('another learner cannot read a classmate direct message',()=>assert.equal(matches({...base,recipientId:'student-b',targetRole:'STUDENT'},mailboxDirection(user,role,'all')),false))
test('the true recipient sees their message; archived incoming stays archived',()=>{assert.equal(matches(base,mailboxDirection(user,role,'inbox')),true);assert.equal(matches({...base,recipientArchivedAt:new Date()},mailboxDirection(user,role,'inbox')),false)})
test('legacy role broadcasts remain scoped to their role',()=>{assert.equal(matches({...base,recipientId:null,targetRole:'STUDENT'},mailboxDirection(user,role,'inbox')),true);assert.equal(matches({...base,recipientId:null,targetRole:'PARENT'},mailboxDirection(user,role,'all')),false)})
test('a sender retains their own sent message independently of the recipient',()=>assert.equal(matches({...base,senderId:user,recipientId:'school'},mailboxDirection(user,role,'sent')),true))
