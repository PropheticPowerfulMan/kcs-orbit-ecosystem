import assert from 'node:assert/strict'
import test from 'node:test'
import { splitClassName } from './className.js'

test('normalizes duplicated Grade names used by imported student records', () => {
  assert.deepEqual(splitClassName('Grade 10 Grade 10'), { grade: 'Grade 10', section: '' })
  assert.deepEqual(splitClassName('Grade 10 Grade 10 A'), { grade: 'Grade 10', section: 'A' })
})

test('preserves canonical grades and normalizes kindergarten names', () => {
  assert.deepEqual(splitClassName('Grade 10'), { grade: 'Grade 10', section: '' })
  assert.deepEqual(splitClassName('Kindergarten K3'), { grade: 'K3', section: '' })
  assert.deepEqual(splitClassName('K3 B'), { grade: 'K3', section: 'B' })
})
