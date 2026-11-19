import test from 'node:test'
import assert from 'node:assert/strict'
import {insideCampus,combineTeachingSlots} from './teachingPresenceProof.js'
const campus={latitude:-4.4,longitude:15.3,radiusMeters:150,maxAccuracyMeters:50,version:'v1'}
test('campus boundary accounts for measurement uncertainty and rejects off-campus, inaccurate or malformed samples',()=>{
 assert.equal(insideCampus({latitude:-4.4,longitude:15.3,accuracy:10},campus).accepted,true)
 assert.equal(insideCampus({latitude:-4.5,longitude:15.3,accuracy:10},campus).accepted,false)
 assert.equal(insideCampus({latitude:-4.4,longitude:15.3,accuracy:51},campus).accepted,false)
 assert.equal(insideCampus({latitude:NaN,longitude:15.3,accuracy:10},campus).accepted,false)
 assert.equal(insideCampus({latitude:-4.4,longitude:15.3013,accuracy:20},campus).accepted,false)
 assert.equal(insideCampus({latitude:-4.4,longitude:15.3,accuracy:-1},campus).accepted,false)
})
const slot=(key:string,start:string,end:string,extra={})=>({id:null as string|null,courseReference:'algebra',teacherUserId:'teacher',className:'Grade 11',room:'Room A',schoolDate:'2026-11-19',academicYear:'2026-2027',term:'Semester 1',scheduleKey:key,expectedStartAt:new Date('2026-11-19T'+start+':00Z'),expectedEndAt:new Date('2026-11-19T'+end+':00Z'),...extra})
const group=(rows:ReturnType<typeof slot>[])=>combineTeachingSlots(rows,keys=>'lesson-block:'+keys.join('-'))
test('consecutive same-course periods form one stable 90-minute lesson',()=>{
 const a=group([slot('p1','07:30','08:15'),slot('p2','08:15','09:00')])
 assert.equal(a.length,1);assert.equal(a[0].scheduleKey,'lesson-block:p1-p2');assert.equal(a[0].expectedEndAt.toISOString(),'2026-11-19T09:00:00.000Z')
})
test('never merge across a break, different room/class, subject or recorded period',()=>{
 for(const extra of [{room:'Room B'},{className:'Grade 12'},{courseReference:'french'},{id:'saved'}])assert.equal(group([slot('p1','07:30','08:15'),slot('p2','08:15','09:00',extra)]).length,2)
 assert.equal(group([slot('p1','07:30','08:15'),slot('p2','08:30','09:15')]).length,2)
})
test('persisted combined lesson replaces its planned components without losing the recorded identity',()=>{
 const saved=slot('lesson-block:p1-p2','07:30','09:00',{id:'saved'})
 const result=group([slot('p1','07:30','08:15'),slot('p2','08:15','09:00'),saved])
 assert.equal(result.length,1);assert.equal(result[0].id,'saved')
})
