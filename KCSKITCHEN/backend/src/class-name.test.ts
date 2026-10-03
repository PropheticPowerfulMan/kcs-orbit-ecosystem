import assert from 'node:assert/strict'
import test from 'node:test'
import { compareClassNames, normalizeClassName } from './class-name.js'

test('duplicate and heterogeneous class labels are reduced to one canonical label', () => {
  assert.equal(normalizeClassName('Grade 1Grade 1'), 'Grade 1')
  assert.equal(normalizeClassName('Grade 9 Grade 9'), 'Grade 9')
  assert.equal(normalizeClassName('Grade 1 Grade 1 A'), 'Grade 1 A')
  assert.equal(normalizeClassName('grade 9-b'), 'Grade 9 B')
  assert.equal(normalizeClassName('Grade 9A'), 'Grade 9 A')
  assert.equal(normalizeClassName('K3A'), 'K3 A')
  assert.equal(normalizeClassName('Kindergarten K3'), 'K3')
  assert.equal(normalizeClassName('Kindergarten Grade 3'), 'K3')
  assert.equal(normalizeClassName('1st Grade'), 'Grade 1')
  assert.equal(normalizeClassName('GRADE 12 / b'), 'Grade 12 B')
  assert.equal(normalizeClassName('Grade 13'), 'Grade 13')
})

test('class labels follow the official K3 to Grade 12 order, including compact sections', () => {
  const values = ['Grade 12', 'Grade 1', 'K5', 'K3A', 'K3', 'Grade 9B', 'Grade 9 A', 'K4', 'Grade 2']
  assert.deepEqual(values.sort(compareClassNames), ['K3', 'K3A', 'K4', 'K5', 'Grade 1', 'Grade 2', 'Grade 9 A', 'Grade 9B', 'Grade 12'])
})