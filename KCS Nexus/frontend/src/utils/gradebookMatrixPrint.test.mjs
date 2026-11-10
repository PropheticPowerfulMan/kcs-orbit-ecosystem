import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('./gradebookMatrixPrint.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {gradebookMatrixPages,renderGradebookMatrix}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
const assessments=Array.from({length:50},(_,i)=>({id:'t'+i,title:'Task <'+i+'>',date:'2026-10-'+String(i%28+1).padStart(2,'0'),category:'Quiz',maxPoints:100,term:'Semester 1 · Quarter 1'}))
const rows=Array.from({length:40},(_,i)=>({name:'Learner '+i,className:'Grade 5',average:85+i/100,letter:'B',scores:Object.fromEntries(assessments.map(task=>[task.id,'80']))}))
test('matrix preserves all 2000 cells across readable horizontal and vertical pages',()=>{
 const pages=gradebookMatrixPages(assessments,rows)
 assert.equal(pages.length,27)
 const cells=new Set()
 for(const page of pages){assert.ok(page.assessments.length<=6);assert.ok(page.rows.length<=16);for(const row of page.rows)for(const task of page.assessments)cells.add(row.name+'::'+task.id)}
 assert.equal(cells.size,2000)
 assert.equal(gradebookMatrixPages([],[]).length,1)
 assert.equal(gradebookMatrixPages(assessments.slice(0,6),rows.slice(0,16)).length,1)
})
test('matrix escapes user input, repeats exact averages and includes every column',()=>{
 const html=renderGradebookMatrix({courseName:'Spelling <script>',academicYear:'2026-2027',term:'Quarter 1',assessments,rows,categories:[{name:'Quiz',weight:100}],classAverage:85,median:85,successRate:100,origin:'https://example.invalid',documentId:'KCS-GB-TEST',fingerprint:'A'.repeat(64),qr:'data:image/png;base64,test',verificationUrl:'https://example.invalid/verify',issuedAt:'2026-11-10T12:00:00Z',french:true})
 assert.ok(html.includes('Spelling &lt;script&gt;'))
 for(const task of assessments)assert.ok(html.includes(task.title.replace('<','&lt;').replace('>','&gt;')))
 assert.equal((html.match(/class="final">85.00%/g)||[]).length,9)
 assert.ok(html.includes('Page 27 / 27'))
})
