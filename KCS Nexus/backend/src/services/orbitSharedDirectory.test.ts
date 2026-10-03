import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/kcs_test'
process.env.JWT_SECRET ||= 'test-only-jwt-secret-at-least-thirty-two-characters'
process.env.JWT_REFRESH_SECRET ||= 'test-only-refresh-secret-at-least-thirty-two-characters'
process.env.KCS_ORBIT_API_URL ||= 'https://orbit.test'
process.env.KCS_ORBIT_API_KEY ||= 'orbit-test-key'
process.env.KCS_ORBIT_ORGANIZATION_ID ||= 'orbit-test-organization'

const directoryModule = import('./orbitSharedDirectory.js')

function parent(index: number) {
  return { id: `parent-${index}`, fullName: `Parent ${index}`, studentIds: [], externalIds: [] }
}

function student(index: number) {
  return { id: `student-${index}`, fullName: `Student ${index}`, externalIds: [] }
}

function teacher(index: number) {
  return { id: `teacher-${index}`, fullName: `Teacher ${index}`, externalIds: [] }
}

function directory(parentCount: number, studentCount: number, teacherCount: number) {
  const parents = Array.from({ length: parentCount }, (_, index) => parent(index))
  const students = Array.from({ length: studentCount }, (_, index) => student(index))
  const teachers = Array.from({ length: teacherCount }, (_, index) => teacher(index))
  return {
    source: 'orbit' as const,
    visibility: 'shared-directory' as const,
    counts: { families: parentCount, parents: parentCount, students: studentCount, teachers: teacherCount },
    parents,
    students,
    teachers,
  }
}

test('protects teacher collection independently from healthy parent and student refreshes', async () => {
  const { reconcileOrbitSharedDirectory } = await directoryModule
  const previous = directory(12, 20, 4)
  const next = directory(13, 21, 0)
  const reconciled = reconcileOrbitSharedDirectory(next, previous)
  assert.equal(reconciled.parents.length, 13)
  assert.equal(reconciled.students.length, 21)
  assert.equal(reconciled.teachers.length, 4)
  assert.equal(reconciled.counts.teachers, 4)
})

test('protects only a collapsed parent collection and keeps fresh teachers', async () => {
  const { reconcileOrbitSharedDirectory } = await directoryModule
  const previous = directory(12, 20, 4)
  const next = directory(1, 21, 5)
  const reconciled = reconcileOrbitSharedDirectory(next, previous)
  assert.equal(reconciled.parents.length, 12)
  assert.equal(reconciled.students.length, 21)
  assert.equal(reconciled.teachers.length, 5)
})

test('rejects a cold non-empty directory that contains no teachers', async () => {
  const { reconcileOrbitSharedDirectory } = await directoryModule
  assert.throws(
    () => reconcileOrbitSharedDirectory(directory(2, 3, 0), null),
    /incomplete shared directory without teachers/i,
  )
})

test('strict freshness rejects a collapsed collection instead of substituting cached records', async () => {
  const { validateStrictFreshOrbitSharedDirectory } = await directoryModule
  const previous = directory(12, 20, 4)
  const next = directory(1, 21, 5)
  assert.throws(
    () => validateStrictFreshOrbitSharedDirectory(next, previous),
    /strict freshness check rejected an incomplete parents collection/i,
  )
})

test('strict freshness returns the exact coherent Orbit snapshot', async () => {
  const { validateStrictFreshOrbitSharedDirectory } = await directoryModule
  const previous = directory(12, 20, 4)
  const next = directory(13, 21, 5)
  assert.equal(validateStrictFreshOrbitSharedDirectory(next, previous), next)
})

test('strict refresh rejects a network failure while ordinary forced refresh keeps the resilient fallback', async () => {
  const { getOrbitSharedDirectory, invalidateOrbitSharedDirectory } = await directoryModule
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => directory(12, 20, 4),
    })) as unknown as typeof fetch
    invalidateOrbitSharedDirectory()
    const baseline = await getOrbitSharedDirectory(true)

    globalThis.fetch = (async () => { throw new Error('simulated Orbit network failure') }) as typeof fetch
    invalidateOrbitSharedDirectory()
    const resilient = await getOrbitSharedDirectory(true)
    assert.equal(resilient, baseline)

    // Even though the resilient call just cached its fallback, strict mode must
    // bypass that cache and reach Orbit again.
    await assert.rejects(
      () => getOrbitSharedDirectory(false, true),
      /simulated Orbit network failure/i,
    )
  } finally {
    globalThis.fetch = originalFetch
    invalidateOrbitSharedDirectory()
  }
})
