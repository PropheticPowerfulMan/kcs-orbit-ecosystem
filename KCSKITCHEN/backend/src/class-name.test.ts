import assert from 'node:assert/strict'
import test from 'node:test'
import { compareClassNames, normalizeClassName } from './class-name.js'

test('duplicate class labels are reduced to one canonical label', () => {
  assert.equal(normalizeClassName('Grade 1Grade 1'), 'Grade 1')
  assert.equal(normalizeClassName('Grade 9 Grade 9'), 'Grade 9')
  assert.equal(normalizeClassName('grade 9-b'), 'Grade 9B')
})

test('class labels follow the official K3 to Grade 12 order', () => {
  const values = ['Grade 12', 'Grade 1', 'K5', 'K3', 'Grade 9B', 'Grade 9A']
  assert.deepEqual(values.sort(compareClassNames), ['K3', 'K5', 'Grade 1', 'Grade 9A', 'Grade 9B', 'Grade 12'])
})
