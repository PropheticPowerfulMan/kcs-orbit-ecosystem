import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canManageOwnKitchenCredentials,
  NEXUS_CONFIGURED_SUPERADMIN_ID,
  reauthenticatedAsSameAccount,
} from './credential-policy.js'

test('the Nexus configured SuperAdmin can never mutate credentials from Kitchen', () => {
  assert.equal(canManageOwnKitchenCredentials({
    userId: NEXUS_CONFIGURED_SUPERADMIN_ID,
    orbitPersonId: NEXUS_CONFIGURED_SUPERADMIN_ID,
    explicitKitchenAdmin: true,
  }), false)
})

test('only an explicitly assigned Kitchen administrator may manage their own credentials', () => {
  assert.equal(canManageOwnKitchenCredentials({ userId: 'manager-user', orbitPersonId: 'manager-person', explicitKitchenAdmin: true }), true)
  assert.equal(canManageOwnKitchenCredentials({ userId: 'another-admin', orbitPersonId: 'another-person', explicitKitchenAdmin: false }), false)
})

test('reauthentication must resolve to the exact session account', () => {
  assert.equal(reauthenticatedAsSameAccount('manager-user', 'manager-user'), true)
  assert.equal(reauthenticatedAsSameAccount('manager-user', 'configured-superadmin'), false)
  assert.equal(reauthenticatedAsSameAccount('manager-user', undefined), false)
})
