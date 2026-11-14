import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Explicit, audited grant to one designated Principal. Never changes roles or other permissions. */
export async function grantPrincipalCalendarAccess(db, email, apply = false, actorEmail = process.env.SUPERADMIN_EMAIL) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('One explicit Principal email is required')
  return db.$transaction(async tx => {
    const matches = await tx.user.findMany({ where: { email: { equals: email.trim(), mode: 'insensitive' } }, select: { id: true, role: true, permissions: true, accountBlockedAt: true }, take: 2 })
    if (matches.length !== 1) throw new Error('The exact Principal account must exist once')
    const user = matches[0]
    if (!['ADMIN', 'STAFF'].includes(user.role) || user.accountBlockedAt) throw new Error('The designated Principal must be an active administrative account')
    const present = user.permissions.includes('academic_calendar_manage')
    if (!apply || present) return { mode: apply ? 'apply' : 'dry-run', targetMatched: true, calendarPermissionPresent: present, changed: false }
    const actor = actorEmail && await tx.user.findUnique({ where: { email: actorEmail }, select: { id: true } })
    if (!actor) throw new Error('The SuperAdmin audit actor must exist before granting access')
    await tx.user.update({ where: { id: user.id }, data: { permissions: { push: 'academic_calendar_manage' } } })
    await tx.auditLog.create({ data: { actorId: actor.id, action: 'ACADEMIC_CALENDAR_MANAGER_GRANTED', targetType: 'User', targetId: user.id, metadata: { permission: 'academic_calendar_manage', reason: 'Explicitly designated Principal calendar access', previousPermissions: user.permissions, roleUnchanged: true } } })
    const saved = await tx.user.findUnique({ where: { id: user.id }, select: { permissions: true, role: true } })
    if (saved.role !== user.role || !user.permissions.every(p => saved.permissions.includes(p)) || !saved.permissions.includes('academic_calendar_manage')) throw new Error('Calendar permission readback failed')
    return { mode: 'apply', targetMatched: true, calendarPermissionPresent: true, changed: true, audited: true, roleUnchanged: true, otherPermissionsPreserved: true }
  })
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 const args = process.argv.slice(2), email = args[args.indexOf('--email') + 1]
 const require = createRequire(resolve(process.cwd(), 'package.json')), { PrismaClient } = require('@prisma/client'), db = new PrismaClient()
 try { console.log(JSON.stringify(await grantPrincipalCalendarAccess(db, email, args.includes('--apply')))) }
 finally { await db.$disconnect() }
}
