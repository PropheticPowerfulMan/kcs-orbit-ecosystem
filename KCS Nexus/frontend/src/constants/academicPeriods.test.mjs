import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
const source = readFileSync(new URL('./academicPeriods.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}})
const {ACADEMIC_REPORT_PERIODS,academicPeriodLabel,reportPeriodIncludesSource}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`)
test('all four quarters, both semesters and annual final remain selectable in either language',()=>{
 assert.equal(ACADEMIC_REPORT_PERIODS.length,7)
 assert.equal(academicPeriodLabel('Semester 2 · Quarter 4','fr'),'Semestre 2 · Quarter 4')
 assert.equal(academicPeriodLabel('Annual final','fr'),'Bilan annuel')
 assert.equal(academicPeriodLabel('Semester 1','en'),'Semester 1')
})
test('semester and annual generation recognize submitted source quarters without mixing semesters',()=>{
 assert.equal(reportPeriodIncludesSource('Annual final','Semester 1 · Quarter 1'),true)
 assert.equal(reportPeriodIncludesSource('Semester 2','Semester 2 · Quarter 3'),true)
 assert.equal(reportPeriodIncludesSource('Semester 1','Semester 2 · Quarter 3'),false)
 assert.equal(reportPeriodIncludesSource('Semester 1 · Quarter 1','Semester 1 · Trimester 1'),true)
})
