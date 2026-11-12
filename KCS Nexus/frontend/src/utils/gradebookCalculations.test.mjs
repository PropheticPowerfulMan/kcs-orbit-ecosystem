import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('./gradebookCalculations.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {gradebookScorePercentage,gradebookWeightedAverage,zeroWeightScoredAssessments,proposeScoredCategoryWeights}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
const weights=[{id:'quiz',name:'Quiz',weight:0},{id:'test',name:'Test',weight:100}]
const tasks=[{id:'quiz',category:'quiz',maxPoints:100},{id:'test',category:'test',maxPoints:100}]
test('removing the last weighted task explains an undefined average without losing scores',()=>{
 const scores={'quiz:s1':'90','test:s1':'80'}
 assert.equal(gradebookWeightedAverage('s1',tasks,weights,scores),80)
 const remaining=[tasks[0]]
 assert.equal(gradebookWeightedAverage('s1',remaining,weights,scores),null)
 assert.deepEqual(zeroWeightScoredAssessments(remaining,weights,scores,['s1']),remaining)
 assert.deepEqual(scores,{'quiz:s1':'90','test:s1':'80'})
})
test('the proposal preserves quiz labels and positive-weight proportions and totals 100',()=>{
 const next=proposeScoredCategoryWeights(weights,['quiz'],[{id:'quiz',weight:15}])
 assert.deepEqual(next.map(c=>c.weight),[15,85])
 assert.deepEqual(weights.map(c=>c.weight),[0,100])
 assert.equal(gradebookWeightedAverage('s1',[tasks[0]],next,{'quiz:s1':'90'}),90)
 assert.equal(gradebookWeightedAverage('s1',tasks,next,{'quiz:s1':'90','test:s1':'80'}),81.5)
})
test('Health and successive course snapshots keep separate averages and accept missing cells',()=>{
 assert.equal(gradebookWeightedAverage('s1',[tasks[1]],weights,{'test:s1':'75'}),75)
 assert.equal(gradebookWeightedAverage('s1',[tasks[1]],weights,{'test:s1':'95'}),95)
 assert.equal(gradebookWeightedAverage('s2',[tasks[1]],weights,{'test:s1':'95'}),null)
 assert.equal(gradebookScorePercentage('0',100),0)
 assert.equal(gradebookScorePercentage('M',100),0)
 assert.equal(gradebookScorePercentage('E',100),null)
})

test('proposed weights remain nonnegative and total 100 with uneven ratios',()=>{
 const configured=[2,2,2,93,1,0].map((weight,index)=>({id:String(index),name:String(index),weight}))
 const next=proposeScoredCategoryWeights(configured,['5'],[{id:'5',weight:25}])
 assert.ok(next.every(category=>category.weight>=0))
 assert.equal(next.reduce((sum,category)=>sum+category.weight,0),100)
})
