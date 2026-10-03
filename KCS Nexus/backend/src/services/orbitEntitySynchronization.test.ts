import assert from 'node:assert/strict'
import test from 'node:test'

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/kcs_test'
process.env.JWT_SECRET ||= 'test-only-jwt-secret-at-least-thirty-two-characters'
process.env.JWT_REFRESH_SECRET ||= 'test-only-refresh-secret-at-least-thirty-two-characters'

const synchronizationModule = import('./orbitEntitySynchronization.js')

test('maps employee type changes without demoting the principal role', async () => {
  const { resolveEmployeeUserRole } = await synchronizationModule
  assert.equal(resolveEmployeeUserRole('Teacher', 'STAFF'), 'TEACHER')
  assert.equal(resolveEmployeeUserRole('Professeur titulaire', 'STAFF'), 'TEACHER')
  assert.equal(resolveEmployeeUserRole('Administrative staff', 'TEACHER'), 'STAFF')
  assert.equal(resolveEmployeeUserRole('Teacher', 'ADMIN'), 'ADMIN')
})

test('builds a complete compensating Orbit patch including explicit nulls', async () => {
  const { buildOrbitRollbackPatch } = await synchronizationModule
  const rollback = buildOrbitRollbackPatch(
    { email: 'before@ourkcs.org', middleName: null, className: 'Grade 9 A', status: 'ACTIVE' },
    { email: 'after@ourkcs.org', middleName: 'New', className: 'Grade 9 B', status: 'INACTIVE' },
  )
  assert.deepEqual(rollback, {
    patch: { email: 'before@ourkcs.org', middleName: null, className: 'Grade 9 A', status: 'ACTIVE' },
    complete: true,
    missingFields: [],
  })
})

test('reports fields that cannot be compensated from the pre-update snapshot', async () => {
  const { buildOrbitRollbackPatch } = await synchronizationModule
  const rollback = buildOrbitRollbackPatch(
    { email: 'before@ourkcs.org' },
    { email: 'after@ourkcs.org', physicalAddress: 'New address' },
  )
  assert.deepEqual(rollback.patch, { email: 'before@ourkcs.org' })
  assert.equal(rollback.complete, false)
  assert.deepEqual(rollback.missingFields, ['physicalAddress'])
})
test('merges the requested patch before validating a first institutional email', async () => {
  const { mergeOrbitEntityPatch } = await synchronizationModule
  const effective = mergeOrbitEntityPatch(
    { id: 'orbit-student-1', firstName: 'First', lastName: 'Student', email: null },
    { email: 'first.student@ourkcs.org', phone: '+243000000000' },
  )
  assert.equal(effective.id, 'orbit-student-1')
  assert.equal(effective.email, 'first.student@ourkcs.org')
  assert.equal(effective.phone, '+243000000000')
})
test('reconciles official parent links only when parentId is explicitly edited', async () => {
  const { shouldReconcileStudentParentLinks } = await synchronizationModule
  assert.equal(shouldReconcileStudentParentLinks({ firstName: 'Updated', photoData: 'image' }), false)
  assert.equal(shouldReconcileStudentParentLinks({ parentId: 'orbit-parent-2' }), true)
  assert.equal(shouldReconcileStudentParentLinks({ parentId: null }), true)
})