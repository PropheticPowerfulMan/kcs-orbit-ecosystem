import assert from 'node:assert/strict'
import test from 'node:test'
import { attendanceRateFromStatuses, summarizeAttendanceStatuses } from './attendancePolicy.js'

test('KCS absence policy aggregates every non-attendance status', () => {
  const summary = summarizeAttendanceStatuses(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'SICK', 'SUSPENDED'])
  assert.deepEqual(summary, {
    total: 6,
    present: 1,
    absent: 4,
    late: 1,
    excused: 1,
    sick: 1,
    suspended: 1,
    attendanceRate: 33.3,
  })
})

test('an empty attendance register has no misleading percentage', () => {
  assert.equal(attendanceRateFromStatuses([]), null)
})
