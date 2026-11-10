import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeAttendanceCorrection, attendanceRateFromStatuses, summarizeAttendanceStatuses } from './attendancePolicy.js'

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

test('editorial attendance rates use on-time plus late presence and every absence category', () => {
 const input={total:999,present:30,late:2,absent:8,excused:3,sick:1,suspended:2,attendanceRate:100}
 assert.deepEqual(normalizeAttendanceCorrection(input),{...input,total:40,attendanceRate:80})
 assert.equal(normalizeAttendanceCorrection({...input,absent:0}).absent,6)
 assert.equal(normalizeAttendanceCorrection({total:99,present:0,late:0,absent:0,excused:0,sick:0,suspended:0,attendanceRate:99}).attendanceRate,null)
})
