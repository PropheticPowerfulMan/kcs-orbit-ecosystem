import assert from 'node:assert/strict'
import test from 'node:test'
import { reportCardPeriodEndDate as end } from './reportCardPeriodEndDate.js'
const calendars = [{name:'2026-2027',startDate:'2026-09-07',endDate:'2027-06-11',periods:[{type:'SEMESTER',sequence:1,startDate:'2026-09-07',endDate:'2027-01-29'},{type:'QUARTER',sequence:1,startDate:'2026-09-07',endDate:'2026-11-06T00:00:00.000Z'},{type:'QUARTER',sequence:3,startDate:'2027-02-01',endDate:'2027-04-02'}]}]
test('quarter takes precedence over semester and dates follow the official calendar',()=>{
 assert.equal(end('2026-2027','Semester 1 · Quarter 1',calendars),'2026-11-06')
 assert.equal(end('2026-2027','Semester 2 · Quarter 3',calendars),'2027-04-02')
 assert.equal(end('2026-2027','Semester 1',calendars),'2027-01-29')
 assert.equal(end('2026-2027','Annual final',calendars),'2027-06-11')
})
test('missing years and periods never use another period or today as a substitute',()=>{
 assert.equal(end('2025-2026','Semester 1 · Quarter 1',calendars),null)
 assert.equal(end('2026-2027','Semester 1 · Quarter 2',calendars),null)
})
