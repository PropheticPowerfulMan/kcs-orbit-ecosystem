import test from 'node:test'
import assert from 'node:assert/strict'
import {teachingCourseScheduleMatches,teachingRosterClass,recordedTeachingRosterClass} from './teachingScheduleScope.js'
import {resolveTeachingSubjects,teachingSubjectScore} from './teachingTimetable.js'
const course={id:'elective-1',name:'French 2 B',code:'F2',grade:'Multi-class',teacher:{user:{firstName:'Alice',lastName:'Example'}},enrollments:[{student:{grade:'Grade 11',section:null}},{student:{grade:'Grade 12',section:null}}]}
const entry={grade:'Grade 9',classGroup:'G9A',subject:'French 2 B',teacherName:'Example Alice',sourceDocument:'Official elective classes.pdf',day:'Tuesday',startTime:'13:30',endTime:'14:00',academicYear:'2026-2027',semester:1}
test('elective classroom headings do not exclude enrolled learners from other grades',()=>{
 assert.equal(teachingCourseScheduleMatches(course,entry),true)
 assert.equal(teachingRosterClass(course,entry,'Grade 9 A'),'Multi-class')
 assert.equal(teachingCourseScheduleMatches({...course,grade:'Grade 10',enrollments:[]},entry),false)
 assert.equal(teachingCourseScheduleMatches(course,{...entry,sourceDocument:'Regular schedule.xlsx'}),false)
})
test('an explicit Principal schedule binds its course id and preserves elective scope on republication',()=>{
 const manual={...entry,subject:'French 2 B (O)',sourceDocument:'Principal course schedule · elective-1'}
 assert.equal(teachingCourseScheduleMatches(course,manual),true)
 assert.equal(teachingCourseScheduleMatches({...course,id:'another'},manual),false)
 assert.equal(teachingRosterClass(course,manual,'Grade 9 A'),'Multi-class')
})
test('ambiguous shared names cannot acquire another teachers timetable; canonical names resolve independently',()=>{
 const a={...course,name:'Entrepreneurship',teacherName:'Example Alice'},b={...a,id:'elective-2',teacherName:'Another Alice'}
 assert.equal(resolveTeachingSubjects({subject:'Entrepreneurship',teacherName:'Alice'},[a,b],c=>c.teacherName).owners.length,0)
 assert.deepEqual(resolveTeachingSubjects({subject:'Entrepreneurship',teacherName:'Example Alice'},[a,b],c=>c.teacherName).owners.map(c=>c.id),[a.id])
})
test('saved elective sessions recover roster scope without changing their historic room or timestamps',()=>{
 const session={academicYear:'2026-2027',semester:1,schoolDate:'2026-11-24',expectedStartAt:new Date('2026-11-24T12:30:00Z'),expectedEndAt:new Date('2026-11-24T13:00:00Z'),className:'Grade 9 A'}
 const before=JSON.stringify(session)
 assert.equal(recordedTeachingRosterClass(course,session,[entry]),'Multi-class')
 assert.equal(JSON.stringify(session),before)
 assert.equal(recordedTeachingRosterClass(course,session,[{...entry,semester:2}]),'Grade 9 A')
 assert.equal(recordedTeachingRosterClass(course,session,[{...entry,teacherName:'Other Teacher'}]),'Grade 9 A')
})
test('EE timetable context resolves Entrepreneurship while distinct subject levels remain separate',()=>{
 assert.equal(teachingSubjectScore('Entrepreneurship in EE (O)','Entrepreneurship'),4)
 assert.equal(teachingSubjectScore('French 2 B','French 1'),0)
})
