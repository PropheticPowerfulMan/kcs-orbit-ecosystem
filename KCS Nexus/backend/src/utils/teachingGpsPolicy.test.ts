import test from 'node:test'
import assert from 'node:assert/strict'
import {teachingGpsRequired,declaredTeachingPresence} from './teachingGpsPolicy.js'
test('GPS is optional by default and can only be re-enabled explicitly',()=>{
 const original=process.env.TEACHING_GPS_REQUIRED
 try{delete process.env.TEACHING_GPS_REQUIRED;assert.equal(teachingGpsRequired(),false);process.env.TEACHING_GPS_REQUIRED='false';assert.equal(teachingGpsRequired(),false);process.env.TEACHING_GPS_REQUIRED='true';assert.equal(teachingGpsRequired(),true)}
 finally{if(original===undefined)delete process.env.TEACHING_GPS_REQUIRED;else process.env.TEACHING_GPS_REQUIRED=original}
})
test('no-GPS time remains a declaration pending independent review, never GPS verified',()=>{
 const now=new Date('2026-11-20T07:00:00Z'),proof=declaredTeachingPresence(now)
 assert.equal(proof.status,'PENDING');assert.equal(proof.gpsChecked,false);assert.equal(proof.method,'DECLARATION_GPS_DISABLED');assert.equal(proof.recordedAt,now.toISOString());assert.equal(proof.revision,0)
})
