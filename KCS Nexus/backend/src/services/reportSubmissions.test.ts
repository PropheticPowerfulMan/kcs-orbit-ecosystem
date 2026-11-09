import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateReportCardResults } from './annualReportCard.service.js'
import { studentReportAverage } from './studentReportAverage.service.js'
const grade=(year:string,term:string,courseId:string,percentage:number,credits=1)=>({studentId:'student',courseId,percentage,period:year+'::'+term+'::SUBMITTED',assignmentId:null,course:{credits},createdAt:new Date('2026-11-01')})
const q1='Semester 1 · Quarter 1',q2='Semester 1 · Quarter 2'
test('semester results use available quarters and preserve school-year isolation',()=>{
 const rows=[grade('2025-2026',q1,'a',100),grade('2026-2027',q1,'a',80),grade('2026-2027',q2,'a',60)]
 assert.equal(aggregateReportCardResults(rows,'2026-2027','Semester 1').get('student:a')?.percentage,70)
 assert.equal(aggregateReportCardResults(rows.slice(0,2),'2026-2027','Semester 1').get('student:a')?.percentage,80)
})
test('student overall average uses the same year, quarter, credits and visibility as the report card',()=>{
 const grades=[grade('2025-2026',q1,'a',100),grade('2026-2027',q1,'a',80),grade('2026-2027',q1,'b',60,3),grade('2026-2027',q2,'a',10)]
 const cards=[{term:'2026-2027 · '+q1,average:65,publicationStatus:'DRAFT',updatedAt:new Date('2026-11-08'),academicCorrections:{hiddenCourseIds:[] as string[]}}]
 assert.equal(studentReportAverage(grades,cards).average,65)
 cards[0].academicCorrections.hiddenCourseIds.push('b')
 assert.equal(studentReportAverage(grades,cards).average,80)
})
test('published editorial average is authoritative',()=>{
 const cards=[{term:'2026-2027 · '+q1,average:72.5,publicationStatus:'EMAILED',updatedAt:new Date('2026-11-08')}]
 assert.equal(studentReportAverage([grade('2026-2027',q1,'a',80)],cards).average,72.5)
})
