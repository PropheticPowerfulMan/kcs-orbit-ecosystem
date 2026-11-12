import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyGraduationApproval} from './graduation-approval';
const secret='synthetic-graduation-test-key';
const claims={organizationId:'school',academicYear:'2026-2027',closed:true,expiresAt:Date.now()+60000,students:[{id:'student',average:70}]};
const sign=(value:unknown)=>{const payload=JSON.stringify(value);return {payload,signature:createHmac('sha256',secret).update(payload).digest('hex')}};
test('approved annual result and explicit closure survive signature verification',()=>assert.deepEqual(verifyGraduationApproval(sign(claims),'school',secret),claims));
test('forged, expired and cross-school approvals cannot authorize graduation',()=>{
 assert.equal(verifyGraduationApproval({...sign(claims),signature:'0'.repeat(64)},'school',secret),null);
 assert.equal(verifyGraduationApproval(sign({...claims,expiresAt:Date.now()-1}),'school',secret),null);
 assert.equal(verifyGraduationApproval(sign(claims),'other-school',secret),null);
 assert.equal(verifyGraduationApproval(undefined,'school',secret),null);
});
test('failing, invalid and duplicate annual results are rejected',()=>{
 for(const average of [69.99,101,-1,NaN])assert.equal(verifyGraduationApproval(sign({...claims,students:[{id:'student',average}]}),'school',secret),null);
 assert.equal(verifyGraduationApproval(sign({...claims,students:[...claims.students,...claims.students]}),'school',secret),null);
});
