import test from 'node:test'
import assert from 'node:assert/strict'
import { automaticAcademicClosures,academicClosureGraceEndDate,type ClosureCalendar } from './academicAutoClosure.js'
const calendar:ClosureCalendar={name:'2026-2027',status:'PUBLISHED',isCurrent:true,startDate:'2026-09-07',endDate:'2027-06-11',periods:[
 {type:'QUARTER',sequence:1,startDate:'2026-09-07',endDate:'2026-11-06'},
 {type:'QUARTER',sequence:2,startDate:'2026-11-07',endDate:'2027-01-29'},
 {type:'QUARTER',sequence:3,startDate:'2027-01-30',endDate:'2027-03-31'},
 {type:'QUARTER',sequence:4,startDate:'2027-04-01',endDate:'2027-06-11'},
 {type:'SEMESTER',sequence:1,startDate:'2026-09-07',endDate:'2027-01-29'},
 {type:'SEMESTER',sequence:2,startDate:'2027-01-30',endDate:'2027-06-11'},
]}
test('keeps all seven complete grace days; closes at the next Kinshasa midnight',()=>{
 assert.equal(academicClosureGraceEndDate('2026-11-06'),'2026-11-13')
 assert.deepEqual(automaticAcademicClosures([calendar],new Date('2026-11-13T22:59:59Z')),[])
 assert.deepEqual(automaticAcademicClosures([calendar],new Date('2026-11-13T23:00:00Z')).map(p=>p.term),['Semester 1 · Quarter 1'])
})
test('uses school time even when the process or device time zone differs',()=>{
 const old=process.env.TZ;try{process.env.TZ='Pacific/Honolulu';assert.equal(automaticAcademicClosures([calendar],new Date('2026-11-13T23:00:00Z')).length,1)}finally{if(old)process.env.TZ=old;else delete process.env.TZ}
})
test('grace calculation handles year boundaries and leap years',()=>{
 assert.equal(academicClosureGraceEndDate('2026-12-31'),'2027-01-07')
 assert.equal(academicClosureGraceEndDate('2028-02-28'),'2028-03-06')
 assert.equal(academicClosureGraceEndDate('2027-02-28'),'2027-03-07')
})
test('orders quarters before their semester and annual closure without changing input',()=>{
 const before=JSON.stringify(calendar),result=automaticAcademicClosures([calendar],new Date('2027-06-20T12:00:00Z')).map(p=>p.term)
 assert.deepEqual(result,['Semester 1 · Quarter 1','Semester 1 · Quarter 2','Semester 1','Semester 2 · Quarter 3','Semester 2 · Quarter 4','Semester 2','Annual final'])
 assert.equal(JSON.stringify(calendar),before)
})
test('never closes draft, malformed, future or out-of-calendar periods',()=>{
 assert.deepEqual(automaticAcademicClosures([{...calendar,status:'DRAFT'}],new Date('2028-01-01')),[])
 assert.deepEqual(automaticAcademicClosures([{...calendar,name:'2026-2029'}],new Date('2028-01-01')),[])
 assert.equal(academicClosureGraceEndDate('2026-02-31'),null)
 assert.deepEqual(automaticAcademicClosures([{...calendar,periods:[{type:'QUARTER',sequence:1,startDate:'2026-09-07',endDate:'2026-02-31'}]}],new Date('2026-11-20')),[])
 assert.deepEqual(automaticAcademicClosures([calendar],new Date('invalid')),[])
})
test('recognizes legacy quarter type and deduplicates the same published period',()=>{
 const legacy={...calendar,periods:[{...calendar.periods![0],type:'TRIMESTER'}]}
 assert.equal(automaticAcademicClosures([legacy,legacy],new Date('2026-11-20')).length,1)
})
