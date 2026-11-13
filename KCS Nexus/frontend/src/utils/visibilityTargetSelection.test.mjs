import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
const compiled=ts.transpileModule(readFileSync(new URL('./visibilityTargetSelection.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {visibilityTargetOptions:options,filterVisibilityOptions:search,updateVisibilitySelection:update}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
const students=[{studentNumber:'ST-A',grade:'Grade 9',section:'A',user:{firstName:'Lévana',lastName:'Lokala'}},{studentNumber:'ST-B',grade:'Grade 9',section:'B',user:{firstName:'Bella',lastName:'Mbuyi'}},{studentNumber:'ST-C',grade:'Grade 11',section:null,user:{firstName:'Chris',lastName:'Mbuyi'}}]
const parents=[{id:'PA',firstName:'Éric',lastName:'Lokala',email:'eric@example.invalid',parentLinks:[{student:{studentNumber:'ST-A',grade:'Grade 9',section:'A'}}]},{id:'PB',firstName:'Jane',lastName:'Mbuyi',email:'jane@example.invalid',parentLinks:[{student:{studentNumber:'ST-B',grade:'Grade 9',section:'B'}},{student:{studentNumber:'ST-C',grade:'Grade 11'}}]}]
const courses=[{id:'ALG',name:'Algebra',code:'ALG9',grade:'Grade 9',teacherName:'Teacher One',studentNumbers:['ST-A']},{id:'SC',name:'Science',code:'SC9B',grade:'Grade 9',studentNumbers:['ST-B']},{id:'MIX',name:'Choir',code:'CHOIR',grade:'Mixed',studentNumbers:['ST-A','ST-C']},{id:'EMPTY',name:'No enrollment',grade:'Grade 9',studentNumbers:[]}]
const blank={grade:'',section:'',studentNumbers:[],parentIds:[]}
test('without a target the optional lists keep every option and no selection is implied',()=>{
 const result=options(students,parents,courses,blank);assert.equal(result.students.length,3);assert.equal(result.parents.length,2);assert.equal(result.courses.length,4);assert.equal(result.hasCourseScope,false)
})
test('class and section restrict learners and their linked parents, using real enrollment including mixed-class courses',()=>{
 const result=options(students,parents,courses,{...blank,grade:'Grade 9',section:'A'});assert.deepEqual(result.students.map(x=>x.id),['ST-A']);assert.deepEqual(result.parents.map(x=>x.id),['PA']);assert.deepEqual(result.courses.map(x=>x.id),['ALG','MIX']);assert.equal(result.courseLearners,1)
})
test('specific learners filter parents and enrolled courses, without locking the learner list to the selection itself',()=>{
 const result=options(students,parents,courses,{...blank,studentNumbers:['ST-B']});assert.equal(result.students.length,3);assert.deepEqual(result.parents.map(x=>x.id),['PB']);assert.deepEqual(result.courses.map(x=>x.id),['SC'])
})
test('selected parents narrow learners and courses to their own children',()=>{
 const result=options(students,parents,courses,{...blank,parentIds:['PB']});assert.deepEqual(result.students.map(x=>x.id),['ST-B','ST-C']);assert.deepEqual(result.courses.map(x=>x.id),['MIX','SC']);assert.equal(result.parents.length,2)
})
test('all criteria intersect; incompatible targets never fall back to the whole school',()=>{
 const result=options(students,parents,courses,{...blank,grade:'Grade 9',section:'A',studentNumbers:['ST-A'],parentIds:['PB']});assert.deepEqual(result.students,[]);assert.deepEqual(result.courses,[]);assert.equal(result.courseLearners,0)
})
test('search matches accents, multiple tokens, parent emails and a child identity without case sensitivity',()=>{
 const result=options(students,parents,courses,blank);assert.deepEqual(search(result.parents,'ERIC levana').map(x=>x.id),['PA']);assert.deepEqual(search(result.students,'eric@ grade 9').map(x=>x.id),['ST-A']);assert.deepEqual(search(result.courses,'teacher alg9').map(x=>x.id),['ALG']);assert.deepEqual(search(result.parents,'jane ST-C').map(x=>x.id),['PB']);assert.deepEqual(search(result.courses,'missing'),[])
})
test('bulk actions affect search results only, preserve hidden selections and remove duplicates',()=>{
 const selected=['HIDDEN','ALG'];assert.deepEqual(update(selected,['ALG','MIX'],true),['HIDDEN','ALG','MIX']);assert.deepEqual(update(selected,['ALG'],false),['HIDDEN']);assert.deepEqual(selected,['HIDDEN','ALG']);assert.deepEqual(update(selected,[],true),selected)
})
test('changing filters keeps every selected option available for clear display rather than discarding it',()=>{
 const result=options(students,parents,courses,{...blank,grade:'Grade 9',section:'B'});assert.equal(result.courses.some(x=>x.id==='ALG'),false);assert.equal(result.allCourses.some(x=>x.id==='ALG'),true);assert.equal(result.allStudents.some(x=>x.id==='ST-A'),true)
})
test('registry membership is compared case-insensitively, never by course grade alone',()=>{
 const result=options(students,parents,[{id:'MIXED',name:'Real enrollment',grade:'Grade 12',studentNumbers:['st-a']},{id:'MISLEADING',name:'Not enrolled',grade:'Grade 9',studentNumbers:['ST-B']}],{...blank,studentNumbers:['st-a']});assert.deepEqual(result.courses.map(x=>x.id),['MIXED'])
})
