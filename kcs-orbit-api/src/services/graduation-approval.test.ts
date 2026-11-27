import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyGraduationApproval,officialAnnualAverage} from './graduation-approval';
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

test('official yearly results accept Grade 1-12 including genuine zero, never Kindergarten',()=>{
 const yearly={...claims,annualResults:[{id:'grade1',average:0,grade:'Grade 1'},{id:'grade11',average:70,grade:'Grade 11'}],endDate:'2027-06-11'};
 assert.ok(verifyGraduationApproval(sign(yearly),'school',secret));assert.equal(verifyGraduationApproval(sign({...yearly,annualResults:[{id:'k4',average:100,grade:'K4'}]}),'school',secret),null)
});
test('kindergarten decisions require a recorded reason in the signed approval',()=>{
 assert.equal(verifyGraduationApproval(sign({...claims,earlyYearsDecisions:[{studentId:'k4',decision:'PROMOTE',reason:'ok'}]}),'school',secret),null)
})

test('failing Grade12 remains a real annual result and does not become missing or eligible for graduation',()=>{
 const data={...claims,students:[],annualResults:[{id:'student',average:69.99,grade:'Grade 12'},{id:'zero',average:0,grade:'Grade 1'}]};assert.equal(officialAnnualAverage(data,'student','Grade 12 A'),69.99);assert.equal(officialAnnualAverage(data,'zero','Grade 1'),0);assert.equal(officialAnnualAverage(data,'zero','Grade 2'),null);assert.equal(officialAnnualAverage(data,'student','K5'),null)
})
