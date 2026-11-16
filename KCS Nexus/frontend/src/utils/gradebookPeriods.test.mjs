import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('./gradebookPeriods.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } })
const { canonicalGradebookTerm, openingGradebookTerm, annualGradebookSummaryReady } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`)
const terms = ['Semester 1 · Quarter 1', 'Semester 1 · Quarter 2', 'Semester 2 · Quarter 3', 'Semester 2 · Quarter 4', 'Annual final']

test('a calendar rollover keeps previously populated grades visible', () => {
  assert.equal(openingGradebookTerm([{ term: terms[0] }], null, terms[1], terms), terms[0])
})
test('a teacher can deliberately open a new empty quarter and keep that choice', () => {
  assert.equal(openingGradebookTerm([{ term: terms[0] }], terms[1], terms[1], terms), terms[1])
})
test('new gradebooks use the active official quarter', () => {
  assert.equal(openingGradebookTerm([], null, terms[1], terms), terms[1])
})
test('old trimester labels recover their corresponding quarter', () => {
  assert.equal(canonicalGradebookTerm('Semester 1 · Trimester 1'), terms[0])
  assert.equal(openingGradebookTerm([{ term: 'Semester 1 · Trimester 1' }], null, terms[1], terms), terms[0])
})
test('each course opens its most recent populated quarter', () => {
  assert.equal(openingGradebookTerm([{ term: terms[0] }, { term: terms[1] }], null, terms[2], terms), terms[1])
})

test('annual summary requires explicit complete closure, not dates or remembered selection', () => {
 const year='2026-2027', access={closedPeriods:[]};
 assert.equal(annualGradebookSummaryReady(null,year),false);
 assert.equal(annualGradebookSummaryReady(access,year),false);
 assert.equal(openingGradebookTerm([{term:terms[0]}], 'Annual final', terms[0],terms),terms[0]);
 access.closedPeriods=terms.slice(0,3).map(term=>({academicYear:year,term}));
 assert.equal(annualGradebookSummaryReady(access,year),false);
 access.closedPeriods.push({academicYear:year,term:terms[3]});
 assert.equal(annualGradebookSummaryReady(access,year),true);
 assert.equal(annualGradebookSummaryReady(access,'2025-2026'),false);
 assert.equal(openingGradebookTerm([], 'Annual final', terms[0], terms,true),'Annual final');
 assert.equal(annualGradebookSummaryReady({closedPeriods:['Semester 1','Semester 2'].map(term=>({academicYear:year,term}))},year),true);
});
