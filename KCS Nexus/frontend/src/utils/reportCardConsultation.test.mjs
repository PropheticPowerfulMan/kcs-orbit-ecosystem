import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const source=readFileSync(new URL('./reportCardConsultation.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {consultationPeriod,hasReportCardResults}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
const card=(period,scores=[],year='2026-2027')=>({term:year+' · '+period,subjects:scores.map(percentage=>({percentage}))})
test('Principal opens populated Q1 instead of empty Q2 drafts',()=>assert.equal(consultationPeriod([card('Semester 1 · Quarter 1',[82]),card('Semester 1 · Quarter 2')],'2026-2027','Semester 1 · Quarter 2'),'Semester 1 · Quarter 1'))
test('real zero scores remain real results',()=>assert.equal(hasReportCardResults(card('Semester 1 · Quarter 2',[0])),true))
test('the current period stays selected when it has results',()=>assert.equal(consultationPeriod([card('Semester 1 · Quarter 1',[90]),card('Semester 1 · Quarter 2',[75])],'2026-2027','Semester 1 · Quarter 2'),'Semester 1 · Quarter 2'))
test('years, invalid scores and empty drafts cannot provide a false result',()=>assert.equal(consultationPeriod([card('Semester 1 · Quarter 1',[95],'2025-2026'),card('Semester 1 · Quarter 2',[null,NaN])],'2026-2027','Semester 1 · Quarter 2'),null))
test('the latest available reporting period is chosen without mutating records',()=>{const cards=[card('Semester 1 · Quarter 1',[50]),card('Semester 1',[82]),card('Semester 2 · Quarter 3',[75])];const original=JSON.stringify(cards);assert.equal(consultationPeriod(cards,'2026-2027','Semester 2 · Quarter 4'),'Semester 2 · Quarter 3');assert.equal(JSON.stringify(cards),original)})
