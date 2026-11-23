import {test} from 'node:test';import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync} from 'node:fs';
const js=ts.transpileModule(readFileSync(new URL('./gradebookSaveScope.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {preserveReadOnlyGradebook}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const q1='Semester 1 · Quarter 1',q2='Semester 1 · Quarter 2',task=(id,term)=>({id,term,title:id,maxPoints:100,type:'quiz',category:'quiz',date:'2026-11-23',description:''});
test('Q2 save preserves exact closed Q1 tasks, zero marks and comments despite browser recovery',()=>{
 const old={assignments:[task('q1',q1)],scores:{'q1:old-student':'0'},comments:{'q1:old-student':'Original'}};
 const draft={assignments:[{...task('q1',q1),description:'Reformatted'},task('q2',q2)],scores:{'q1:new-student':'95','q2:learner':'88'},comments:{'q1:new-student':'Recovered'},categories:[],savedAt:'now'};
 const result=preserveReadOnlyGradebook(old,draft,t=>t===q1);assert.deepEqual(result.assignments[0],old.assignments[0]);assert.deepEqual(result.scores,{'q1:old-student':'0','q2:learner':'88'});assert.deepEqual(result.comments,old.comments);assert.equal(result.savedAt,'now');assert.deepEqual(old.scores,{'q1:old-student':'0'});
});
test('reopened Q1 remains editable and independent of Q2',()=>{const d={assignments:[task('q1',q1)],scores:{'q1:s':'97'},comments:{},categories:[]};assert.deepEqual(preserveReadOnlyGradebook(undefined,d,()=>false).scores,d.scores)});
test('a browser-only closed task is retained locally but is not invented in the locked server period',()=>{const d={assignments:[task('old',q1),task('open',q2)],scores:{'old:s':'91','open:s':'0'},comments:{},categories:[]};const a=preserveReadOnlyGradebook({},d,t=>t===q1);assert.deepEqual(a.assignments,[task('open',q2)]);assert.deepEqual(a.scores,{'open:s':'0'});assert.equal(d.scores['old:s'],'91')});

test('historical columns without an explicit term retain their original representation',()=>{const old={assignments:[{...task('legacy',q1),term:undefined}],scores:{'legacy:s':'0'},comments:{}};const d={...old,assignments:[task('legacy',q1),task('next',q2)],scores:{'legacy:s':'90','next:s':'82'},categories:[]};const a=preserveReadOnlyGradebook(old,d,t=>(t||q1)===q1);assert.equal(a.assignments[0].term,undefined);assert.equal(a.scores['legacy:s'],'0');assert.equal(a.scores['next:s'],'82')});
