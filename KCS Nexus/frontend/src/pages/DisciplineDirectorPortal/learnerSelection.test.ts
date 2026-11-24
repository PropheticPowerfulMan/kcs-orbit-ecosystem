import test from 'node:test'
import assert from 'node:assert/strict'
import {disciplineClasses,filterDisciplineLearners,learnerMatchesClass} from './learnerSelection'
const learner=(id:string,name:string,grade:string,section='')=>({id,name,grade,section,studentNumber:'ID-'+id,active:true,parents:[]})
test('class choices always span K3 to Grade 12 even before those learners are enrolled',()=>{
 const choices=disciplineClasses([]);assert.equal(choices[0],'K3');assert.equal(choices.at(-1),'Grade 12');assert.equal(choices.length,15)
 assert.deepEqual(disciplineClasses([learner('a','Alice','Grade 9','B')]).filter(c=>c.startsWith('Grade 9')),['Grade 9','Grade 9 B'])
})
test('class filtering distinguishes Grade 1 from Grade 11 and supports exact sections',()=>{
 assert.equal(learnerMatchesClass(learner('a','A','Grade 11'),'Grade 1'),false)
 assert.equal(learnerMatchesClass(learner('a','A','Grade 9','B'),'Grade 9'),true)
 assert.equal(learnerMatchesClass(learner('a','A','Grade 9','B'),'Grade 9 A'),false)
})
test('learner selection combines unordered name tokens, accents, learner ID and exact class',()=>{
 const rows=[learner('a','Lokala Léa','Grade 1'),learner('b','Lokala Léa','Grade 11'),learner('c','Another Child','K3')]
 assert.deepEqual(filterDisciplineLearners(rows,'lea lokala','Grade 1').map(s=>s.id),['a'])
 assert.deepEqual(filterDisciplineLearners(rows,'ID-b','').map(s=>s.id),['b'])
 assert.equal(filterDisciplineLearners(rows,'absent','K3').length,0)
})
