import test from 'node:test'
import assert from 'node:assert/strict'
import {teachingSubjectScore,resolveTeachingSubjects,teachingClassMatches,teachingSearchMatches} from './teachingTimetable.js'

test('official Math headings resolve Algebra 2 and Precalculus without altering course names',()=>{
 assert.equal(teachingSubjectScore('Math','Algebra2'),2)
 assert.equal(teachingSubjectScore('Mathematics','Precalculus'),2)
 assert.ok(teachingSubjectScore('Math','FUNDAMENTALS OF MATH')>0)
 assert.equal(teachingSubjectScore('Algebra 1','Algebra2'),0)
 assert.equal(teachingSubjectScore('Health 2','Total Health 3'),0)
})
test('elective markers and generic grade/level suffixes retain their course identity',()=>{
 assert.equal(teachingSubjectScore('Programming (O)','Programming'),4)
 assert.equal(teachingSubjectScore('Cybersecurity (optional)','Cybersecurity'),4)
 assert.ok(teachingSubjectScore('Science','SCIENCE 6')>0)
 assert.ok(teachingSubjectScore('English','GRAMMAR AND WRITING')>0)
 assert.ok(teachingSubjectScore('Swahili','KISWAHILI')>0)
 assert.ok(teachingSubjectScore('French 2 A','French')>0)
 assert.ok(teachingSubjectScore('Bible 3','BIBLE')>0)
})
const teacher='Lokala Lomboto Jonathan'
const algebra={id:'algebra',name:'Algebra2',code:'ALG2',teacher},programming={id:'programming',name:'Programming',code:'PY',teacher}
test('generic categories are linked only to a unique course after class and period scoping',()=>{
 const found=resolveTeachingSubjects({subject:'Math',teacherName:'Jonathan'},[algebra,programming],row=>row.teacher)
 assert.equal(found.owners[0]?.id,'algebra');assert.equal(found.unresolved.length,0)
 const ambiguous=resolveTeachingSubjects({subject:'Math',teacherName:'Jonathan'},[algebra,{...algebra,id:'other',name:'Geometry'}],row=>row.teacher)
 assert.equal(ambiguous.owners.length,0);assert.equal(ambiguous.unresolved[0].reason,'AMBIGUOUS')
})
test('paired subjects and teachers preserve their pairing instead of giving a colleague both lessons',()=>{
 const science={id:'science',name:'Earth science',code:'ES',teacher:'David Example'}
 const maths={id:'maths',name:'Algebra 1',code:'ALG',teacher:'William Offei'}
 const result=resolveTeachingSubjects({subject:'Mathematics / Science',teacherName:'William / David'},[maths,science],row=>row.teacher)
 assert.deepEqual(result.owners.map(row=>row.id),['maths','science']);assert.equal(result.unresolved.length,0)
})
test('unresolved or conflicting subjects remain explicit rather than silently disappearing',()=>{
 const result=resolveTeachingSubjects({subject:'Physics',teacherName:'Jonathan'},[algebra],row=>row.teacher)
 assert.equal(result.owners.length,0);assert.equal(result.unresolved[0].reason,'NO_COURSE')
 assert.equal(resolveTeachingSubjects({subject:'Assembly',teacherName:null},[algebra],row=>row.teacher).owners.length,0)
})
test('class filters distinguish Grade 1/11 and support entire grades or exact sections',()=>{
 assert.equal(teachingClassMatches('Grade 11','Grade 1'),false)
 assert.equal(teachingClassMatches('Grade 9 B','Grade 9'),true)
 assert.equal(teachingClassMatches('Grade 9 B','G9A'),false)
 assert.equal(teachingClassMatches('Grade 9 B','G9B'),true)
 assert.equal(teachingClassMatches('K4','K4'),true)
})
test('precise search combines names, subject, class and room in any order with accents and quoted phrases',()=>{
 const fields=['Lupemba Pékita','Algebra 2','Grade 11','Room 101']
 assert.equal(teachingSearchMatches(fields,'pek algebra "Grade 11" 101'),true)
 assert.equal(teachingSearchMatches(fields,'"Grade 1"'),false)
 assert.equal(teachingSearchMatches(fields,'Algebra 101 missing'),false)
 assert.equal(teachingSearchMatches(fields,''),true)
})

test('search tolerates compact course and class labels while keeping exact numeric boundaries',()=>{
 assert.equal(teachingSearchMatches(['Algebra2','Grade 11'],'Algebra 2 Grade11'),true)
 assert.equal(teachingSearchMatches(['Algebra 2','Grade11'],'Algebra2 "Grade 11"'),true)
 assert.equal(teachingSearchMatches(['Algebra2','Grade11'],'Grade1'),false)
})
