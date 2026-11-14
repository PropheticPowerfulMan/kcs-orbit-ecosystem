import test from 'node:test'
import assert from 'node:assert/strict'
import { grantPrincipalCalendarAccess } from './nexus-calendar-manager.mjs'
function fixture(role = 'ADMIN', permissions = ['existing_permission']) {
 let user = { id: 'designated-principal', role, permissions, accountBlockedAt: null }, writes = [], audits = []
 const tx = { user: { findMany: async () => [user], findUnique: async q => q.where.email ? { id: 'superadmin-actor' } : user, update: async q => { writes.push(q); user = { ...user, permissions: [...user.permissions, q.data.permissions.push] }; return user } }, auditLog: { create: async q => audits.push(q) } }
 return { db: { $transaction: fn => fn(tx) }, writes, audits }
}
test('dry run never grants anything', async () => { const f = fixture(); assert.equal((await grantPrincipalCalendarAccess(f.db, 'principal@example.invalid')).changed, false); assert.equal(f.writes.length, 0) })
test('grant affects exactly the selected account, retaining all previous permissions', async () => { const f = fixture(); const result = await grantPrincipalCalendarAccess(f.db, 'principal@example.invalid', true, 'superadmin@example.invalid'); assert.equal(result.audited, true); assert.equal(f.writes.length, 1); assert.deepEqual(f.writes[0], { where: { id: 'designated-principal' }, data: { permissions: { push: 'academic_calendar_manage' } } }); assert.equal(f.audits.length, 1) })
test('repeated execution is idempotent', async () => { const f = fixture('ADMIN', ['academic_calendar_manage']); assert.equal((await grantPrincipalCalendarAccess(f.db, 'principal@example.invalid', true)).changed, false); assert.equal(f.writes.length, 0) })
test('teacher, parent and student accounts cannot receive this administrative grant', async () => { for (const role of ['TEACHER', 'PARENT', 'STUDENT']) { const f = fixture(role); await assert.rejects(grantPrincipalCalendarAccess(f.db, 'principal@example.invalid', true), /active administrative/); assert.equal(f.writes.length, 0) } })
