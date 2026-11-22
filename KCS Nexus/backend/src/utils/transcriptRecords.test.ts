import test from 'node:test'
import assert from 'node:assert/strict'
import {buildTranscriptRecords} from './transcriptRecords.js'
const course={id:'algebra',code:'ALG',name:'Algebra',credits:2,grade:'Grade 9'}
const grade=(term:string,pct:number,year='2026-2027',name=course)=>({id:year+term,studentId:'s',courseId:name.id,percentage:pct,letterGrade:'B',period:year+'::'+term+'::APPROVED',createdAt:new Date('2026-11-01'),course:name})
const input={studentGrade:'Grade 9',activeAcademicYear:'2026-2027',grades:[] as ReturnType<typeof grade>[],legacy:[] as any[]}
test('keeps quarter detail without multiplying annual credits',()=>{const result=buildTranscriptRecords({...input,grades:[grade('Semester 1 · Quarter 1',80),grade('Semester 1 · Quarter 2',90)]});assert.equal(result.rows.length,2);assert.equal(result.summary.credits,2);assert.equal(result.summary.cumulativeAverage,85);assert.equal(result.summary.representedCourses,1)})
test('annual result takes precedence over semester and quarter summaries',()=>{const result=buildTranscriptRecords({...input,grades:[grade('Semester 1 · Quarter 1',70),grade('Semester 1',85),grade('Annual final',93)]});assert.equal(result.summary.cumulativeAverage,93);assert.equal(result.summary.credits,2);assert.equal(result.rows.length,3)})
test('uses the same granular-quarter precedence as official report cards',()=>{const result=buildTranscriptRecords({...input,grades:[grade('Semester 1 · Quarter 1',60),grade('Semester 1',80),grade('Semester 2 · Quarter 3',90)]});assert.equal(result.summary.cumulativeAverage,75)})
test('excludes elementary grades and unpublished results',()=>{const result=buildTranscriptRecords({...input,studentGrade:'Grade 4',grades:[grade('Semester 1 · Quarter 1',80),{...grade('Semester 1',80),period:'2026-2027::Semester 1::PENDING'}]});assert.equal(result.rows.length,0);assert.equal(result.summary.credits,0)})
test('historical grade snapshots remain authoritative after promotion',()=>{const result=buildTranscriptRecords({...input,studentGrade:'Grade 12',gradeSnapshots:{'2025-2026::Semester 1 · Quarter 1':'Grade 10'},grades:[grade('Semester 1 · Quarter 1',80,'2025-2026',{...course,grade:'Mixed'})]});assert.equal(result.rows[0].gradeLevel,'Grade 10');assert.ok(result.summary.missingGradeLevels.includes('Grade 11'))})
test('verified imports merge with Nexus without double counting and keep source provenance',()=>{const legacy={id:'l',studentId:'s',academicYear:'2025-2026',gradeLevel:'Grade 9',term:'Annual final',courseCode:'ALG',courseName:'Algebra',credits:2,percentage:82,letterGrade:'B',verificationStatus:'VERIFIED',sourceSchool:'KCS',sourceDocument:'QuickSchools export',updatedAt:new Date('2026-10-01')};const result=buildTranscriptRecords({...input,legacy:[legacy,{...legacy,id:'rejected',verificationStatus:'PENDING',courseCode:'BAD'}],grades:[grade('Annual final',90,'2025-2026')]});assert.equal(result.rows.length,1);assert.equal(result.rows[0].source,'NEXUS_APPROVED');assert.equal(result.rows[0].gradeLevel,'Grade 9');assert.equal(result.summary.credits,2)})
test('unknown historical classes are identified rather than projected backwards',()=>{const result=buildTranscriptRecords({...input,studentGrade:'Grade 12',grades:[grade('Annual final',90,'2024-2025',{...course,grade:'Mixed'})]});assert.equal(result.rows.length,0);assert.equal(result.summary.unclassifiedRecords,1)})

test('partial attendance does not treat missing quarters as zero or overweight a single quarter',()=>{const result=buildTranscriptRecords({...input,grades:[grade('Semester 1 · Quarter 1',80),grade('Semester 1 · Quarter 2',90),grade('Semester 2 · Quarter 3',70)]});assert.equal(result.summary.cumulativeAverage,80)})

test('a later transfer to high school does not convert elementary course grades into transcript credit',()=>{const result=buildTranscriptRecords({...input,studentGrade:'Grade 11',grades:[grade('Semester 1 · Quarter 1',95,'2026-2027',{...course,grade:'Grade 1'})]});assert.equal(result.rows.length,0);assert.equal(result.summary.credits,0)})


test('a complete Grade 9–12 journey remains retrievable with 2050 as active year',()=>{
 const grades=Array.from({length:4},(_,i)=>grade('Annual final',80+i*2,(2023+i)+'-'+(2024+i),{...course,id:'math-'+i,grade:'Grade '+(9+i)}));
 const result=buildTranscriptRecords({...input,studentGrade:'Graduated',activeAcademicYear:'2050-2051',grades});
 assert.deepEqual(result.summary.missingGradeLevels,[]);assert.equal(result.summary.credits,8);assert.equal(result.summary.cumulativeAverage,83);assert.equal(result.rows.length,4);
 assert.deepEqual(result.rows.map(row=>row.gradeLevel),['Grade 9','Grade 10','Grade 11','Grade 12']);
 assert.deepEqual(result.rows.map(row=>row.cycle.academicYear),['2023-2024','2024-2025','2025-2026','2026-2027']);
});
test('verified imported Grade 9–11 report cards complement approved Grade 12 records',()=>{
 const legacy=[9,10,11].map((level,i)=>({id:'legacy-'+level,studentId:'s',academicYear:(2023+i)+'-'+(2024+i),gradeLevel:'Grade '+level,term:'Annual final',courseCode:'ALG',courseName:'Algebra',credits:2,percentage:80+i*2,letterGrade:'B',verificationStatus:'VERIFIED',sourceSchool:'KCS',sourceDocument:'Official imported report card '+level,updatedAt:new Date('2026-10-01')}));
 const result=buildTranscriptRecords({...input,studentGrade:'Grade 12',legacy,grades:[grade('Annual final',86,'2026-2027',{...course,grade:'Grade 12'})]});assert.equal(result.summary.legacyRecords,3);assert.equal(result.summary.credits,8);assert.equal(result.summary.cumulativeAverage,83);assert.deepEqual(result.summary.missingGradeLevels,[]);assert.equal(result.rows.filter(row=>row.sourceDocument).length,3);
});


test('preserved approved grades remain on the transcript after operational course deletion',()=>{const archived={...grade('Annual final',88,'2026-2027'),archived:true};const result=buildTranscriptRecords({...input,grades:[archived]});assert.equal(result.rows[0].source,'NEXUS_ARCHIVED_APPROVED');assert.equal(result.summary.cumulativeAverage,88);assert.equal(result.summary.credits,2)})
