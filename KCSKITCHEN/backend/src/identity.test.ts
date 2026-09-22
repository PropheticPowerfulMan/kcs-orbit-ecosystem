import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyDirectoryEmployee } from './identity.js'

test('the official employee type separates teachers from non-teaching staff', () => {
  assert.equal(classifyDirectoryEmployee({ employeeType: 'TEACHER', jobTitle: 'Algebra Teacher', subject: 'Math' }), 'TEACHER')
  assert.equal(classifyDirectoryEmployee({ employeeType: 'STAFF', jobTitle: 'Driver', subject: null }), 'STAFF')
  assert.equal(classifyDirectoryEmployee({ employeeType: 'EMPLOYEE', jobTitle: 'Accountant', subject: null }), 'STAFF')
})

test('subject evidence keeps legacy teacher records compatible', () => {
  assert.equal(classifyDirectoryEmployee({ employeeType: null, jobTitle: null, subject: 'English' }), 'TEACHER')
})

test('an explicitly described non-teaching employee never inherits the teacher role', () => {
  assert.equal(classifyDirectoryEmployee({ employeeType: 'STAFF', jobTitle: 'School nurse', subject: null }), 'STAFF')
})
