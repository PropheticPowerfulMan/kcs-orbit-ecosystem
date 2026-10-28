import assert from 'node:assert/strict'
import test from 'node:test'
import { isEventInReminderWindow, userMatchesEventAudience } from './eventReminder.service.js'

const now = new Date('2026-10-28T12:00:00.000Z')
test('event enters the reminder window exactly seven days before it starts', () => {
  assert.equal(isEventInReminderWindow(new Date('2026-11-04T11:59:59.000Z'), 7, now), true)
  assert.equal(isEventInReminderWindow(new Date('2026-11-04T12:00:01.000Z'), 7, now), false)
  assert.equal(isEventInReminderWindow(new Date('2026-10-28T11:59:59.000Z'), 7, now), false)
})

test('grade filters apply to learners and their parents without excluding selected staff roles', () => {
  const event = { audienceRoles: ['STUDENT', 'PARENT', 'TEACHER'] as any, audienceGrades: ['Grade 11'] }
  const base = { id: 'u', email: null, phone: null, firstName: 'KCS', middleName: null, lastName: 'User' }
  assert.equal(userMatchesEventAudience({ ...base, role: 'STUDENT', studentProfile: { grade: 'Grade 11' }, parentLinks: [] } as any, event), true)
  assert.equal(userMatchesEventAudience({ ...base, role: 'STUDENT', studentProfile: { grade: 'Grade 10' }, parentLinks: [] } as any, event), false)
  assert.equal(userMatchesEventAudience({ ...base, role: 'PARENT', studentProfile: null, parentLinks: [{ student: { grade: 'Grade 11' } }] } as any, event), true)
  assert.equal(userMatchesEventAudience({ ...base, role: 'TEACHER', studentProfile: null, parentLinks: [] } as any, event), true)
})
