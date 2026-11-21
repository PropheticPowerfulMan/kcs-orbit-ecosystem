import test from 'node:test'
import assert from 'node:assert/strict'
import {forumClass,sameForumClass} from './studentForumScope.js'
test('classes are canonical and Grade 9 A stays distinct from Grade 9 B',()=>{
 const a={audience:'CLASS',classroomGrade:'Grade 9',classroomSection:'A'}
 assert.equal(sameForumClass(a,{grade:'grade9',section:'a'}),true)
 assert.equal(sameForumClass(a,{grade:'Grade 9',section:'B'}),false)
 assert.equal(sameForumClass(a,{grade:'Grade 10',section:'A'}),false)
 assert.deepEqual(forumClass('Grade 9 A'),{grade:'Grade 9',section:'A'})
})
test('school discussions stay available and an unassigned class never grants private access',()=>{
 assert.equal(sameForumClass({audience:'SCHOOL',classroomGrade:null,classroomSection:null},null),true)
 assert.equal(sameForumClass({audience:'CLASS',classroomGrade:'Grade 1',classroomSection:''},null),false)
 assert.equal(sameForumClass({audience:'BROKEN',classroomGrade:null,classroomSection:null},{grade:'Grade 1',section:''}),false)
})
