import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
const source = ts.transpileModule(readFileSync(new URL('./gradebookRanking.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText
const { rankGradebookRows } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
test('ranking uses descending percentages, preserves ties, and excludes missing grades', () => {
  const input = [{ name: 'Zara', average: 90 }, { name: 'Alain', average: 90 }, { name: 'Bella', average: 95 }, { name: 'No grades', average: null }, { name: 'Zero', average: 0 }]
  const result = rankGradebookRows(input)
  assert.deepEqual(result.map(row => [row.name, row.rank]), [['Bella', 1], ['Alain', 2], ['Zara', 2], ['Zero', 4]])
  assert.equal(input[0].name, 'Zara')
})
test('ranking compares the same two-decimal percentages shown in the document', () => {
  assert.deepEqual(rankGradebookRows([{ name: 'Zed', average: 95.001 }, { name: 'Ann', average: 95.004 }]).map(row => [row.name, row.rank]), [['Ann', 1], ['Zed', 1]])
})
