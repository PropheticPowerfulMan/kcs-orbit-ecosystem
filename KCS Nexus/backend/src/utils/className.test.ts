import assert from 'node:assert/strict'
import test from 'node:test'
import { classAssignmentsOverlap, compareClassParts, formatClassName, normalizeClassParts, resolveSynchronizedStudentClass, splitClassName } from './className.js'

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
  assert.deepEqual(splitClassName('Grade 9A'), { grade: 'Grade 9', section: 'A' })
  assert.deepEqual(splitClassName('Grade 9-B'), { grade: 'Grade 9', section: 'B' })
  assert.deepEqual(splitClassName('K3C'), { grade: 'K3', section: 'C' })
})

test('normalizes imported grade and section fields into one class identity', () => {
  assert.deepEqual(normalizeClassParts('Kindergarten', 'Grade 3'), { grade: 'K3', section: '' })
  assert.deepEqual(normalizeClassParts('K3', ''), { grade: 'K3', section: '' })
  assert.deepEqual(normalizeClassParts('Grade 7', 'Grade 7'), { grade: 'Grade 7', section: '' })
  assert.deepEqual(normalizeClassParts('7th Grade', ''), { grade: 'Grade 7', section: '' })
  assert.deepEqual(normalizeClassParts('12th Grade', ''), { grade: 'Grade 12', section: '' })
})

test('formats sectioned and whole-class assignments without preserving a stale section', () => {
  assert.equal(formatClassName('Grade 9', 'A'), 'Grade 9 A')
  assert.equal(formatClassName('Grade 9', ''), 'Grade 9')
  assert.deepEqual(splitClassName(formatClassName('Grade 9', '')), { grade: 'Grade 9', section: '' })
})

test('treats a whole-class responsibility as overlapping every section of that grade', () => {
  assert.equal(classAssignmentsOverlap({ grade: 'Grade 9', section: '' }, { grade: 'Grade 9', section: 'A' }), true)
  assert.equal(classAssignmentsOverlap({ grade: 'Grade 9', section: 'A' }, { grade: 'Grade 9', section: 'B' }), false)
  assert.equal(classAssignmentsOverlap({ grade: 'Grade 9', section: 'A' }, { grade: 'Grade 10', section: 'A' }), false)
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

test('does not erase an official class section when Orbit temporarily returns only the base grade', () => {
  assert.deepEqual(
    resolveSynchronizedStudentClass('Grade 9', { grade: 'Grade 9', section: 'A' }),
    { grade: 'Grade 9', section: 'A' },
  )
})

test('accepts an explicit section or a genuine grade change from Orbit', () => {
  assert.deepEqual(
    resolveSynchronizedStudentClass('Grade 9B', { grade: 'Grade 9', section: 'A' }),
    { grade: 'Grade 9', section: 'B' },
  )
  assert.deepEqual(
    resolveSynchronizedStudentClass('Grade 10', { grade: 'Grade 9', section: 'A' }),
    { grade: 'Grade 10', section: '' },
  )
})

test('accepts free-form future class sections without limiting them to A-D', () => {
  assert.deepEqual(splitClassName('Grade 9 Advanced STEM 2'), { grade: 'Grade 9', section: 'Advanced STEM 2' })
  assert.deepEqual(splitClassName('Grade 9 Section 12'), { grade: 'Grade 9', section: 'Section 12' })
})