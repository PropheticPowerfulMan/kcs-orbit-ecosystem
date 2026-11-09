import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
const code = ts.transpileModule(readFileSync(new URL('./reportCardStatistics.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText
const { reportStatistics } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
test('statistical summaries retain real zero grades and exclude unavailable results', () => {
  const result = reportStatistics([100, 90, 80, 70, 60, 0, null, undefined, NaN, 101])
  assert.equal(result.count, 6)
  assert.equal(result.missing, 4)
  assert.equal(result.median, 75)
  assert.equal(result.q1, 62.5)
  assert.equal(result.q3, 87.5)
  assert.equal(result.passed, 4)
  assert.equal(result.min, 0)
  assert.equal(result.max, 100)
  assert.equal(result.distribution.reduce((sum, bucket) => sum + bucket.count, 0), 6)
})
test('population standard deviation and empty or tied cohorts are well-defined', () => {
  assert.equal(reportStatistics([10, 20]).deviation, 5)
  const empty = reportStatistics([null])
  assert.equal(empty.mean, null)
  assert.equal(empty.passRate, null)
  const ties = reportStatistics([75, 75, 75])
  assert.equal(ties.deviation, 0)
  assert.equal(ties.q1, 75)
  assert.equal(ties.q3, 75)
  assert.equal(ties.passRate, 100)
})
