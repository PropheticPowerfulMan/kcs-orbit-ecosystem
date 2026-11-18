// Run only against the isolated entity-mail QA services. Never production.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(process.cwd() + '/package.json')
const { PrismaClient } = require('@prisma/client')
const jwt = require('jsonwebtoken')
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/nexus_entity_mail_qa')
assert.equal(new URL(process.env.KCS_ORBIT_API_URL).hostname, 'suite_orbit_api')
assert.equal(process.env.KCS_ORBIT_ORGANIZATION_ID, 'qa-school')
const db = new PrismaClient()
const stamp = Date.now().toString(36)
const id = 'qa-student-edit-' + stamp
const email = id + '@example.invalid'
const headers = { 'content-type': 'application/json', 'x-api-key': process.env.KCS_ORBIT_API_KEY, 'x-app-slug': 'KCS_NEXUS' }
const orbit = process.env.KCS_ORBIT_API_URL
const token = (role = 'admin') => jwt.sign({ sub: role === 'admin' ? 'configured-superadmin' : 'qa-teacher', role }, process.env.JWT_SECRET, { expiresIn: '15m' })
const call = async (path, method = 'GET', body, role = 'admin') => {
  const response = await fetch('http://127.0.0.1:5000/api' + path, {
    method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token(role) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: response.status, body: await response.json() }
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result.body)); return result.body.data }
const canonical = async () => {
  const response = await fetch(orbit + '/api/integration/read/shared-directory?organizationId=qa-school', { headers })
  assert.equal(response.status, 200)
  return response.json()
}
let checks = 0
const pass = label => { checks++; console.log('PASS ' + label) }
try {
  // This reaches the same PUT used by Admin > Students > Edit. The old handler
  // crashes before it can return 404 as soon as it scans a different student.
  ok(await call('/students/' + id + '-missing', 'PUT', { firstName: 'Nobody' }), 404)
  pass('Unknown student returns 404 without a reference error or a write')

  const created = await fetch(orbit + '/api/integration/registry/student', {
    method: 'POST', headers,
    body: JSON.stringify({ organizationId: 'qa-school', firstName: 'Zzz', lastName: id, gender: 'F', studentNumber: id, email, className: 'Grade 7 A', status: 'active' }),
  })
  assert.equal(created.status, 201, await created.clone().text())
  const entity = await created.json()
  const orbitId = entity.orbitId
  assert.ok(orbitId)
  await db.user.create({ data: { id: id + '-user', email, firstName: 'Zzz', lastName: id, role: 'STUDENT', orbitUserId: orbitId, accessCode: id.toUpperCase(), passwordHash: 'qa-preserved-password', avatar: 'qa-personal-avatar', studentProfile: { create: { id, studentNumber: id, grade: 'Grade 7', section: 'A', status: 'active' } } } })
  assert.ok(await db.course.findUnique({ where: { id: 'qa-course' } }), 'Seed the isolated entity-mail QA fixtures first')
  await db.enrollment.create({ data: { studentId: id, courseId: 'qa-course' } })
  await db.grade.create({ data: { id: id + '-grade', studentId: id, courseId: 'qa-course', score: 85, maxScore: 100, percentage: 85, letterGrade: 'B', period: '2026-2027::Semester 1 · Quarter 1' } })
  await db.attendanceRecord.create({ data: { studentId: id, date: new Date('2026-10-05'), className: 'Grade 7 A', status: 'PRESENT' } })

  // Fresh list loads the new entity into the server directory. It must not be
  // the first item: scanning preceding students exposed the original failure.
  ok(await call('/students?refresh=true'))
  const directory = await canonical()
  assert.notEqual(directory.students[0].id, orbitId)
  const baseline = await db.user.findUnique({ where: { id: id + '-user' }, include: { applicationCredentials: true } })
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1kAAAAASUVORK5CYII='
  const saved = ok(await call('/students/' + orbitId, 'PUT', { firstName: 'Updated', middleName: null, lastName: id, email, studentNumber: id, grade: 'Grade 8', section: 'B', status: 'active', dateOfBirth: '2013-01-02', photoData: photo }))
  assert.equal(saved.canonicalEntity.id, orbitId)
  assert.equal(saved.localSynchronization.synchronized, true)
  let user = await db.user.findUnique({ where: { id: id + '-user' }, include: { studentProfile: true, applicationCredentials: true } })
  assert.equal(user.firstName, 'Updated')
  assert.equal(user.studentProfile.grade, 'Grade 8')
  assert.equal(user.studentProfile.section, 'B')
  assert.equal(user.studentProfile.officialAvatar, photo)
  assert.equal(user.studentProfile.dateOfBirth.toISOString().slice(0, 10), '2013-01-02')
  assert.equal(user.passwordHash, baseline.passwordHash)
  assert.equal(user.accessCode, baseline.accessCode)
  assert.equal(user.avatar, baseline.avatar)
  assert.deepEqual(user.applicationCredentials, baseline.applicationCredentials)
  assert.equal(await db.enrollment.count({ where: { studentId: id, courseId: 'qa-course' } }), 0)
  assert.equal(await db.grade.count({ where: { id: id + '-grade' } }), 1)
  assert.equal(await db.attendanceRecord.count({ where: { studentId: id } }), 1)
  pass('Full edit persists names, class, section, birth date and official portrait; preserves grades, attendance, credentials and personal photo')

  let listed = ok(await call('/students?refresh=true')).find(row => row.id === orbitId)
  assert.equal(listed.user.firstName, 'Updated')
  assert.equal(listed.grade, 'Grade 8')
  assert.equal(listed.section, 'B')
  assert.equal((await canonical()).students.find(row => row.id === orbitId).className, 'Grade 8 B')
  pass('New authenticated read sees the saved values in both Nexus and the canonical Orbit registry')

  ok(await call('/students/' + id, 'PUT', { firstName: 'LocalIdUpdate' }))
  assert.equal((await canonical()).students.find(row => row.id === orbitId).firstName, 'LocalIdUpdate')
  ok(await call('/students/' + entity.externalId, 'PUT', { firstName: 'ExternalIdUpdate' }))
  assert.equal((await canonical()).students.find(row => row.id === orbitId).firstName, 'ExternalIdUpdate')
  pass('Nexus profile and linked external identifiers resolve to the same canonical student')

  ok(await call('/students/' + orbitId, 'PUT', { firstName: 'Unauthorized' }, 'teacher'), 403)
  ok(await call('/students/' + orbitId, 'PUT', { email: 'teacher@example.invalid' }), 409)
  ok(await call('/students/' + orbitId, 'PUT', { email: 'not-an-email' }), 400)
  assert.equal((await canonical()).students.find(row => row.id === orbitId).firstName, 'ExternalIdUpdate')
  user = await db.user.findUnique({ where: { id: id + '-user' } })
  assert.equal(user.passwordHash, baseline.passwordHash)
  assert.equal(user.email, email)
  pass('Permissions, email uniqueness and input validation reject invalid updates without changing the account')
  console.log(JSON.stringify({ status: 'PASS', checks, productionUntouched: true }))
} finally {
  await db.$disconnect()
}
