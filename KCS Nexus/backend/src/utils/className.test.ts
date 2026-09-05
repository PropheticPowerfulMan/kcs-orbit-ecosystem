import assert from 'node:assert/strict'
import test from 'node:test'
import { compareClassParts, normalizeClassParts, splitClassName } from './className.js'

test('normalizes duplicated Grade names used by imported student records', () => {
  assert.deepEqual(splitClassName('Grade 10 Grade 10'), { grade: 'Grade 10', section: '' })
  assert.deepEqual(splitClassName('Grade 10 Grade 10 A'), { grade: 'Grade 10', section: 'A' })
})

test('preserves canonical grades and normalizes kindergarten names', () => {
  assert.deepEqual(splitClassName('Grade 10'), { grade: 'Grade 10', section: '' })
  assert.deepEqual(splitClassName('Grade 3'), { grade: 'Grade 3', section: '' })
  assert.deepEqual(splitClassName('Kindergarten K3'), { grade: 'K3', section: '' })
  assert.deepEqual(splitClassName('Kindergarten Grade 3'), { grade: 'K3', section: '' })
  assert.deepEqual(splitClassName('K3 B'), { grade: 'K3', section: 'B' })
})

test('normalizes imported grade and section fields into one class identity', () => {
  assert.deepEqual(normalizeClassParts('Kindergarten', 'Grade 3'), { grade: 'K3', section: '' })
  assert.deepEqual(normalizeClassParts('K3', ''), { grade: 'K3', section: '' })
  assert.deepEqual(normalizeClassParts('Grade 7', 'Grade 7'), { grade: 'Grade 7', section: '' })
  assert.deepEqual(normalizeClassParts('7th Grade', ''), { grade: 'Grade 7', section: '' })
  assert.deepEqual(normalizeClassParts('12th Grade', ''), { grade: 'Grade 12', section: '' })
})

test('sorts classes from K3 through Grade 12', () => {
  const classes = [
    { grade: 'Grade 12', section: '' },
    { grade: 'Grade 2', section: '' },
    { grade: 'K5', section: '' },
    { grade: 'Grade 1', section: '' },
    { grade: 'K3', section: '' },
    { grade: 'K4', section: '' },
  ].sort(compareClassParts)

  assert.deepEqual(classes.map((item) => item.grade), ['K3', 'K4', 'K5', 'Grade 1', 'Grade 2', 'Grade 12'])
})
