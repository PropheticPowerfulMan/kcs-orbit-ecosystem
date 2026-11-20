
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import QRCode from 'qrcode'
const source=readFileSync(new URL('./adminInstitutionalReportPrint.ts',import.meta.url),'utf8').replace(/^import .*$/gm,'')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/export /g,'')
const {institutionalReportSummary,buildAdminInstitutionalReport}=new Function('QRCode','getAssetUrl','showOfficialDocument',js+';return {institutionalReportSummary,buildAdminInstitutionalReport}')(QRCode,v=>'/'+v,()=>{})
globalThis.location={origin:'https://kinshasachristianschool.org'}
const rows=[{section:'Enrollment',metric:'Learners',value:22,detail:'22 active learners',action:'Review new admissions'},{section:'Academic',metric:'GPA',value:'No data',detail:'Unavailable',action:''},{section:'Academic',metric:'Attendance',value:'91%',detail:'Actual attendance',action:'Review absence records'}]
const input=language=>({title:'Institutional report',period:'16–20 Nov 2026',category:'Full report',cadence:'Weekly',language,author:'QA Administrator',rows})
test('report graphs count indicators without mixing percentages, GPA and headcounts',()=>{
 assert.deepEqual(institutionalReportSummary(rows),{indicators:3,sections:2,actions:2,groups:[{section:'Enrollment',count:1},{section:'Academic',count:2}]})
})
test('bilingual reports preserve each original value and action and identify the reference QR limitations',async()=>{
 for(const language of ['en','fr']){
  const before=structuredClone(rows),d=await buildAdminInstitutionalReport(input(language))
  assert.deepEqual(rows,before)
  for(const row of rows)for(const value of Object.values(row))if(value)assert.ok(d.html.includes(String(value)))
  assert.match(d.html,/<svg[^>]*viewBox=/);assert.match(d.fingerprint,/^[a-f0-9]{64}$/);assert.match(d.html,/counter\(pages\)/)
  assert.match(d.html,language==='fr'?/ne constitue pas une signature électronique/:/not an electronic signature/)
  assert.equal(d.fingerprint,(await buildAdminInstitutionalReport(input(language))).fingerprint)
  assert.doesNotMatch(d.html,/<script>/)
 }
})
test('empty and hostile report data retain explicit missing values and escape markup',async()=>{
 const empty=await buildAdminInstitutionalReport({...input('en'),rows:[]});assert.match(empty.html,/No indicators available/);assert.doesNotMatch(empty.html,/NaN|Infinity/)
 const hostile=await buildAdminInstitutionalReport({...input('en'),rows:[{section:'<script>',metric:'<img src=x>',value:0,detail:'A & B',action:'<b>Inspect</b>'}]})
 assert.match(hostile.html,/&lt;script&gt;/);assert.match(hostile.html,/&lt;img src=x&gt;/);assert.match(hostile.html,/A &amp; B/);assert.match(hostile.html,/class="value">0</)
})
