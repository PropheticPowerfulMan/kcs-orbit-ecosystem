import {test} from 'node:test'
import assert from 'node:assert/strict'
import {uniqueMessageTargets} from './messageBatch.js'
test('one communication copy per normalized address and telephone, retaining each distinct family contact',()=>{
 const rows=uniqueMessageTargets([{userId:'a',name:'Parent A',email:' Main@EXAMPLE.ORG ',phone:'+243 800-100'}, {userId:'a',name:'Additional',email:'main@example.org',phone:null}, {userId:'a',name:'Mother',email:'mother@example.org',phone:'+243800100'}, {userId:'b',name:'Parent B',email:'MAIN@example.org',phone:'+243800200'}])
 assert.deepEqual(rows.map(r=>[r.email,r.phone]),[['main@example.org','+243 800-100'],['mother@example.org',null],[null,'+243800200']])
})
test('a missing contact is retained for an explicit failure rather than falsely queued',()=>{
 assert.deepEqual(uniqueMessageTargets([{userId:'a',name:'No email',email:null,phone:null}]),[{userId:'a',name:'No email',email:null,phone:null}])
})
