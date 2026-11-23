import {test} from 'node:test'
import assert from 'node:assert/strict'
import {earlyYearsAssignment,observationDateAllowed,developmentalSnapshot} from './earlyYearsPolicy.js'
test('only assigned early-years main teachers and assistants receive class access',()=>{
 for(const status of ['HOMEROOM_TEACHER','ASSISTANT_TEACHER'])for(const grade of ['K3','K4','K5'])assert.equal(earlyYearsAssignment({status,homeroomGrade:grade})?.grade,grade)
 for(const profile of [null,{status:'TEACHER',homeroomGrade:'K3'},{status:'HOMEROOM_TEACHER',homeroomGrade:'Grade 3'},{status:'ASSISTANT_TEACHER',homeroomGrade:null}])assert.equal(earlyYearsAssignment(profile),null)
 assert.equal(earlyYearsAssignment({status:'ASSISTANT_TEACHER',homeroomGrade:'K4',homeroomSection:'B'})?.section,'B')
})
test('observations use real dates inside the chosen period and cannot be future-dated',()=>{
 const valid=(d:string)=>observationDateAllowed(d,'2026-09-07','2026-11-06','2026-11-23')
 assert.equal(valid('2026-10-12'),true);for(const d of ['2026-09-06','2026-11-07','2026-02-30','invalid'])assert.equal(valid(d),false)
 assert.equal(observationDateAllowed('2026-12-01','2026-11-07','2027-01-29','2026-11-23'),false)
})
test('a backdated entry cannot replace newer evidence, and missing evidence is never a zero grade',()=>{
 const snapshot=developmentalSnapshot([{domain:'social',date:'2026-10-20',stage:'INDEPENDENT'},{domain:'social',date:'2026-09-10',stage:'WITH_SUPPORT',updatedAt:'2026-11-23'}])
 assert.equal(snapshot.find(d=>d.domain==='social')?.latest?.stage,'INDEPENDENT');assert.equal(snapshot.find(d=>d.domain==='literacy')?.latest,null);assert.equal(snapshot.length,7)
})
