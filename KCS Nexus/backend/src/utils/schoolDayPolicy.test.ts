import test from 'node:test'
import assert from 'node:assert/strict'
import {schoolDayDecision,DRC_HOLIDAYS} from './schoolDayPolicy.js'
const calendar={name:'2026-2027',status:'ACTIVE',startDate:'2026-09-07',endDate:'2027-06-11',periods:[{type:'QUARTER',sequence:1,startDate:'2026-09-07',endDate:'2026-11-06'},{type:'QUARTER',sequence:2,startDate:'2026-11-09',endDate:'2027-01-29'},{type:'QUARTER',sequence:3,startDate:'2027-02-01',endDate:'2027-04-02'},{type:'QUARTER',sequence:4,startDate:'2027-04-05',endDate:'2027-06-11'}]}
test('Friday remains a working school day; Saturday and Sunday are blocked',()=>{
 assert.equal(schoolDayDecision('2026-11-13',[calendar]).allowed,true)
 for(const day of ['2026-11-14','2026-11-15'])assert.equal(schoolDayDecision(day,[calendar]).code,'WEEKEND')
})
test('all ten statutory DRC holidays are blocked across school years',()=>{
 assert.equal(DRC_HOLIDAYS.length,10)
 const c={name:'2027',status:'ACTIVE',startDate:'2027-01-01',endDate:'2027-12-31'}
 for(const[md]of DRC_HOLIDAYS)assert.equal(schoolDayDecision('2027-'+md,[c]).allowed,false)
 assert.equal(schoolDayDecision('2026-12-25',[calendar]).code,'DRC_HOLIDAY')
})
test('published breaks are inclusive and do not spill into the following school day',()=>{
 const ranges=[{startDate:'2026-12-21',endDate:'2027-01-04',label:'Christmas Break'}]
 assert.equal(schoolDayDecision('2026-12-21',[calendar],ranges).code,'SCHOOL_CLOSED')
 assert.equal(schoolDayDecision('2027-01-04',[calendar],ranges).allowed,false)
 assert.equal(schoolDayDecision('2027-01-05',[calendar],ranges).allowed,true)
})
test('invalid, unpublished, out-of-year dates and instructional gaps cannot be used',()=>{
 assert.equal(schoolDayDecision('2027-02-30',[calendar]).code,'INVALID_DATE')
 assert.equal(schoolDayDecision('2026-08-31',[calendar]).allowed,false)
 assert.equal(schoolDayDecision('2026-11-13',[{...calendar,status:'PLANNED'}]).allowed,false)
 const c={...calendar,periods:calendar.periods.map(p=>p.sequence===1?{...p,endDate:'2026-11-04'}:p)}
 assert.equal(schoolDayDecision('2026-11-05',[c]).code,'BETWEEN_SCHOOL_PERIODS')
})
