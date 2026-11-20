
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const source=readFileSync(new URL('./certificateFilename.ts',import.meta.url),'utf8')
const load=s=>new Function(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/export /g,'')+';return {certificateFilename,attendanceBatchFilename}')()
const {certificateFilename,attendanceBatchFilename}=load(source)
const rcSource=readFileSync(new URL('../../../backend/src/utils/reportCardFilename.ts',import.meta.url),'utf8')
const {reportCardFilename}=new Function(ts.transpileModule(rcSource,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/export /g,'')+';return {reportCardFilename}')()
test('certificate names follow report-card class/year/learner ordering and preserve accents',()=>{
 for(const documentType of ['completion','attendance'])for(const studentName of ['Lokala Lomboto Lévana','Name/\\<bad>:?','Le\u0301vana','A very long learner name '.repeat(25)]){
  const input={documentType,grade:'Grade 8 A',academicYear:'2026-2027',studentName}
  assert.equal(certificateFilename(input),reportCardFilename({grade:input.grade,term:input.academicYear,studentName}).slice(0,-4).replace(/^RC/,documentType==='attendance'?'ATT':'CERT').slice(0,200)+'.pdf')
  assert.ok(certificateFilename(input).length<=204)
  assert.doesNotMatch(certificateFilename(input),/[<>:"|?*\\/\u0000-\u001f]/)
 }
})
test('attendance single and batch files are unambiguous, localized and end in one PDF extension',()=>{
 assert.equal(attendanceBatchFilename([{grade:'Grade 4',studentName:'Example Learner'}],'2026-2027','en'),'ATT - Grade 4 - 2026-2027 - Example Learner.pdf')
 assert.equal(attendanceBatchFilename([{grade:'Grade 4',studentName:'One'},{grade:'Grade 4',studentName:'Two'}],'2026-2027','en'),'ATT - Grade 4 - 2026-2027 - 2 learners.pdf')
 assert.equal(attendanceBatchFilename([{grade:'Grade 4',studentName:'One'},{grade:'Grade 8',studentName:'Two'}],'2026-2027','fr'),'ATT - Classes multiples - 2026-2027 - 2 élèves.pdf')
})
test('server e-mail attachments and browser downloads use identical filename rules',()=>{
 assert.equal(source,readFileSync(new URL('../../../backend/src/utils/certificateFilename.ts',import.meta.url),'utf8'))
})
