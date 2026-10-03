import { Prisma, type UserRole } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/api.js'
import { resolveSynchronizedStudentClass, splitClassName } from '../utils/className.js'

export type OrbitRegistryEntityType = 'parent' | 'student' | 'teacher'

export type OrbitRegistryEntitySnapshot = {
  id?: string | null
  organizationId?: string | null
  fullName?: string | null
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  accessCode?: string | null
  photoData?: string | null
  photoSource?: string | null
  physicalAddress?: string | null
  studentNumber?: string | null
  studentIds?: string[]
  className?: string | null
  status?: string | null
  dateOfBirth?: string | Date | null
  gender?: string | null
  parentId?: string | null
  employeeId?: string | null
  employeeType?: string | null
  department?: string | null
  jobTitle?: string | null
  subject?: string | null
  mustChangePassword?: boolean
  familyContacts?: Array<{ email?: string | null; phone?: string | null }>
  externalIds?: Array<{ appSlug: string; externalId: string }>
}

type SynchronizationInput = {
  entityType: OrbitRegistryEntityType
  entity: OrbitRegistryEntitySnapshot
  previous?: OrbitRegistryEntitySnapshot | null
  patch?: OrbitRegistryEntitySnapshot | null
  identifier?: string
  actorId?: string | null
}

type LocalUser = Prisma.UserGetPayload<{
  include: { studentProfile: true; teacherProfile: true; staffProfile: true }
}>

export type OrbitRollbackPlan = {
  patch: OrbitRegistryEntitySnapshot
  complete: boolean
  missingFields: string[]
}

const owns = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const clean = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const unique = (values: Array<string | null | undefined>) => [...new Set(values.map(clean).filter((value): value is string => Boolean(value)))]

const mutableOrbitFields = new Set([
  'fullName', 'firstName', 'middleName', 'lastName', 'email', 'phone', 'accessCode',
  'photoData', 'photoSource', 'physicalAddress', 'studentNumber', 'studentIds',
  'className', 'status', 'dateOfBirth', 'gender', 'parentId', 'employeeId',
  'employeeType', 'department', 'jobTitle', 'subject', 'mustChangePassword', 'familyContacts',
])

export function buildOrbitRollbackPatch(before: OrbitRegistryEntitySnapshot, requestedPatch: OrbitRegistryEntitySnapshot): OrbitRollbackPlan {
  const patch: OrbitRegistryEntitySnapshot = {}
  const missingFields: string[] = []
  for (const key of Object.keys(requestedPatch)) {
    if (!mutableOrbitFields.has(key)) continue
    if (!owns(before, key)) {
      missingFields.push(key)
      continue
    }
    ;(patch as Record<string, unknown>)[key] = (before as Record<string, unknown>)[key]
  }
  return { patch, complete: missingFields.length === 0, missingFields }
}

function normalizedEmployeeType(value: unknown) {
  return clean(value)?.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? null
}

export function resolveEmployeeUserRole(employeeType: unknown, currentRole: UserRole): UserRole {
  if (currentRole === 'ADMIN') return 'ADMIN'
  const normalized = normalizedEmployeeType(employeeType)
  if (!normalized) return currentRole
  const teaching = ['teacher', 'enseignant', 'professeur', 'faculty', 'homeroom', 'main teacher', 'assistant teacher']
    .some((label) => normalized.includes(label))
  return teaching ? 'TEACHER' : 'STAFF'
}

function identityParts(entity: OrbitRegistryEntitySnapshot) {
  const words = clean(entity.fullName)?.split(/\s+/).filter(Boolean) ?? []
  return {
    firstName: clean(entity.firstName) ?? words.at(-1) ?? null,
    middleName: clean(entity.middleName) ?? (words.length > 2 ? words.slice(1, -1).join(' ') : null),
    lastName: clean(entity.lastName) ?? words[0] ?? null,
  }
}

function entityKeys(entity?: OrbitRegistryEntitySnapshot | null) {
  return unique([
    entity?.id,
    entity?.studentNumber,
    entity?.employeeId,
    ...(entity?.externalIds?.map((link) => link.externalId) ?? []),
  ])
}

function entityEmails(entity?: OrbitRegistryEntitySnapshot | null) {
  return unique([entity?.email]).map((email) => email.toLowerCase())
}

function entityAccessCodes(entity?: OrbitRegistryEntitySnapshot | null) {
  return unique([entity?.accessCode]).map((code) => code.toUpperCase())
}

function typeCompatible(entityType: OrbitRegistryEntityType, user: LocalUser) {
  if (entityType === 'parent') return user.role === 'PARENT'
  if (entityType === 'student') return user.role === 'STUDENT' || Boolean(user.studentProfile)
  return user.role === 'TEACHER' || user.role === 'STAFF' || user.role === 'ADMIN' || Boolean(user.teacherProfile) || Boolean(user.staffProfile)
}

async function findLocalUser(entityType: OrbitRegistryEntityType, entity: OrbitRegistryEntitySnapshot, previous?: OrbitRegistryEntitySnapshot | null, identifier?: string) {
  const keys = unique([identifier, ...entityKeys(previous), ...entityKeys(entity)])
  const emails = unique([...entityEmails(previous), ...entityEmails(entity)])
  const accessCodes = unique([...entityAccessCodes(previous), ...entityAccessCodes(entity)])
  const filters: Prisma.UserWhereInput[] = [
    ...(keys.length ? [{ orbitUserId: { in: keys } }] : []),
    ...(emails.length ? [{ email: { in: emails, mode: 'insensitive' as const } }] : []),
    ...(accessCodes.length ? [{ accessCode: { in: accessCodes } }] : []),
  ]
  if (entityType === 'student' && keys.length) filters.push({ studentProfile: { studentNumber: { in: keys } } })
  if (entityType === 'teacher' && keys.length) {
    filters.push({ teacherProfile: { employeeNumber: { in: keys } } })
    filters.push({ staffProfile: { employeeNumber: { in: keys } } })
  }
  if (!filters.length) return null

  const candidates = await prisma.user.findMany({
    where: { OR: filters },
    include: { studentProfile: true, teacherProfile: true, staffProfile: true },
  })
  const oldKeys = new Set(entityKeys(previous).map((value) => value.toLowerCase()))
  const oldEmails = new Set(entityEmails(previous))
  const oldCodes = new Set(entityAccessCodes(previous))
  const orbitIds = new Set(unique([identifier, previous?.id, entity.id]).map((value) => value.toLowerCase()))
  const hasPreviousIdentity = oldKeys.size > 0 || oldEmails.size > 0 || oldCodes.size > 0
  const currentKeys = new Set(entityKeys(entity).map((value) => value.toLowerCase()))
  const currentEmails = new Set(entityEmails(entity))
  const currentCodes = new Set(entityAccessCodes(entity))

  const best = candidates
    .filter((candidate) => typeCompatible(entityType, candidate))
    .map((candidate) => {
      let score = candidate.orbitUserId && orbitIds.has(candidate.orbitUserId.toLowerCase()) ? 1000 : 0
      if (candidate.studentProfile && oldKeys.has(candidate.studentProfile.studentNumber.toLowerCase())) score += 500
      if (candidate.teacherProfile && oldKeys.has(candidate.teacherProfile.employeeNumber.toLowerCase())) score += 500
      if (candidate.staffProfile && oldKeys.has(candidate.staffProfile.employeeNumber.toLowerCase())) score += 500
      if (oldEmails.has(candidate.email.toLowerCase())) score += 250
      if (oldCodes.has(candidate.accessCode.toUpperCase())) score += 250
      if (!hasPreviousIdentity) {
        if (candidate.studentProfile && currentKeys.has(candidate.studentProfile.studentNumber.toLowerCase())) score += 200
        if (candidate.teacherProfile && currentKeys.has(candidate.teacherProfile.employeeNumber.toLowerCase())) score += 200
        if (candidate.staffProfile && currentKeys.has(candidate.staffProfile.employeeNumber.toLowerCase())) score += 200
        if (currentEmails.has(candidate.email.toLowerCase())) score += 100
        if (currentCodes.has(candidate.accessCode.toUpperCase())) score += 100
      }
      if (candidate.role === ({ parent: 'PARENT', student: 'STUDENT', teacher: 'TEACHER' } as const)[entityType]) score += 25
      return { candidate, score }
    })
    .sort((left, right) => right.score - left.score)[0]
  return best && best.score >= 100 ? best.candidate : null
}

async function assertUniqueLocalIdentity(entityType: OrbitRegistryEntityType, localUser: LocalUser | null, patch: OrbitRegistryEntitySnapshot) {
  const email = clean(patch.email)?.toLowerCase()
  if (email) {
    const owner = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, ...(localUser ? { id: { not: localUser.id } } : {}) }, select: { id: true } })
    if (owner) throw new ApiError(409, `Email already belongs to another KCS Nexus account: ${email}`)
  }
  const accessCode = clean(patch.accessCode)?.toUpperCase()
  if (accessCode) {
    const owner = await prisma.user.findFirst({ where: { accessCode, ...(localUser ? { id: { not: localUser.id } } : {}) }, select: { id: true } })
    if (owner) throw new ApiError(409, `Access code already belongs to another KCS Nexus account: ${accessCode}`)
  }
  if (entityType === 'student') {
    const studentNumber = clean(patch.studentNumber)
    if (studentNumber) {
      const owner = await prisma.studentProfile.findFirst({ where: { studentNumber, ...(localUser?.studentProfile ? { id: { not: localUser.studentProfile.id } } : {}) }, select: { id: true } })
      if (owner) throw new ApiError(409, `Student number already belongs to another KCS Nexus profile: ${studentNumber}`)
    }
  }
  if (entityType === 'teacher') {
    const employeeNumber = clean(patch.employeeId)
    if (employeeNumber) {
      const [teacherOwner, staffOwner] = await Promise.all([
        prisma.teacherProfile.findFirst({ where: { employeeNumber, ...(localUser?.teacherProfile ? { id: { not: localUser.teacherProfile.id } } : {}) }, select: { id: true } }),
        prisma.staffProfile.findFirst({ where: { employeeNumber, ...(localUser?.staffProfile ? { id: { not: localUser.staffProfile.id } } : {}) }, select: { id: true } }),
      ])
      if (teacherOwner || staffOwner) throw new ApiError(409, `Employee number already belongs to another KCS Nexus profile: ${employeeNumber}`)
    }
  }
}

async function uniqueFallbackAccessCode(entityType: OrbitRegistryEntityType, orbitId: string, employeeType?: string | null) {
  const role = entityType === 'parent' ? 'PAR' : entityType === 'student' ? 'STU' : resolveEmployeeUserRole(employeeType, 'STAFF') === 'TEACHER' ? 'TCH' : 'EMP'
  const base = `ACC-${role}-${orbitId.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase() || 'ORBIT'}`
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix ? `${base}-${suffix}` : base
    const owner = await prisma.user.findUnique({ where: { accessCode: candidate }, select: { id: true } })
    if (!owner) return candidate
  }
  throw new ApiError(409, 'Unable to allocate a unique Nexus access code for this Orbit identity.')
}

export function mergeOrbitEntityPatch(
  entity: OrbitRegistryEntitySnapshot,
  patch: OrbitRegistryEntitySnapshot,
): OrbitRegistryEntitySnapshot {
  return { ...entity, ...patch }
}

export function shouldReconcileStudentParentLinks(patch?: OrbitRegistryEntitySnapshot | null) {
  return Boolean(patch && owns(patch, 'parentId'))
}
async function validateMaterializableEntity(
  entityType: OrbitRegistryEntityType,
  entity: OrbitRegistryEntitySnapshot,
) {
  const orbitId = clean(entity.id)
  const email = clean(entity.email)?.toLowerCase()
  if (!orbitId) throw new ApiError(409, 'Orbit returned no stable identifier; the Nexus account was not modified.')
  if (!email) throw new ApiError(422, 'This entity has no institutional email. Add a valid email before editing it from KCS Nexus.')
  const names = identityParts(entity)
  if (!names.firstName || !names.lastName) {
    throw new ApiError(422, 'The Orbit identity is incomplete; first and last names are required before Nexus synchronization.')
  }
  await assertUniqueLocalIdentity(entityType, null, entity)
  return { orbitId, email, names }
}

type MaterializationResult = {
  localUserId: string
  changedFields: string[]
}

async function materializeLocalEntity(
  entityType: OrbitRegistryEntityType,
  entity: OrbitRegistryEntitySnapshot,
): Promise<MaterializationResult> {
  const { orbitId, email, names } = await validateMaterializableEntity(entityType, entity)
  const accessCode = clean(entity.accessCode)?.toUpperCase()
    || await uniqueFallbackAccessCode(entityType, orbitId, entity.employeeType)
  const targetRole: UserRole = entityType === 'parent'
    ? 'PARENT'
    : entityType === 'student'
      ? 'STUDENT'
      : resolveEmployeeUserRole(entity.employeeType, 'STAFF')
    const changedFields = ['user']

  const localUserId = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: {
      email,
      accessCode,
      firstName: names.firstName!,
      middleName: names.middleName,
      lastName: names.lastName!,
      role: targetRole,
      phone: clean(entity.phone),
      // Student self-service avatars must remain independent from the official portrait.
      avatar: entityType === 'student' ? null : clean(entity.photoData),
      orbitUserId: orbitId,
      orbitOrganizationId: clean(entity.organizationId) || env.KCS_ORBIT_ORGANIZATION_ID || null,
      permissions: ['ecosystem:orbit'],
    } })

    if (entityType === 'student') {
      const classParts = clean(entity.className) ? splitClassName(entity.className) : null
      const birthDate = parsedDate(entity.dateOfBirth)
      const profile = await tx.studentProfile.create({ data: {
        userId: user.id,
        studentNumber: clean(entity.studentNumber) || orbitId,
        grade: classParts?.grade || 'Unassigned',
        section: classParts?.section || '',
        status: clean(entity.status)?.toLowerCase() || 'active',
        ...(birthDate !== undefined ? { dateOfBirth: birthDate } : {}),
        ...(owns(entity, 'photoData') ? { officialAvatar: clean(entity.photoData) } : {}),
      } })
      changedFields.push('studentProfile')
      const parentOrbitId = clean(entity.parentId)
      if (parentOrbitId) {
        const parent = await tx.user.findFirst({
          where: { role: 'PARENT', orbitUserId: parentOrbitId },
          select: { id: true },
        })
        if (parent) {
          await tx.parentStudentLink.create({ data: {
            parentId: parent.id,
            studentId: profile.id,
            relation: 'Official parent',
          } })
          changedFields.push('parentStudentLinks')
        }
      }
    } else if (entityType === 'teacher') {
      const employeeNumber = clean(entity.employeeId)
        || `${targetRole === 'TEACHER' ? 'TCH' : 'EMP'}-${orbitId.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase()}`
      await tx.staffProfile.create({ data: {
        userId: user.id,
        employeeNumber,
        function: clean(entity.jobTitle) || clean(entity.employeeType) || 'Employee',
        department: clean(entity.department) || 'General',
      } })
      changedFields.push('staffProfile')
      if (targetRole === 'TEACHER') {
        await tx.teacherProfile.create({ data: {
          userId: user.id,
          employeeNumber,
          department: clean(entity.department) || 'Academics',
          qualification: clean(entity.jobTitle) || clean(entity.subject) || 'Teacher',
          yearsOfExperience: 0,
        } })
        changedFields.push('teacherProfile')
      }
    } else if (entity.studentIds?.length) {
      const requestedStudentIds = unique(entity.studentIds)
      const students = await tx.studentProfile.findMany({
        where: { OR: [
          { user: { orbitUserId: { in: requestedStudentIds } } },
          { studentNumber: { in: requestedStudentIds } },
        ] },
        select: { id: true },
      })
      if (students.length !== requestedStudentIds.length) {
        throw new ApiError(409, 'One or more selected children are not available in Nexus; the local account creation was cancelled.')
      }
      for (const student of students) {
        await tx.parentStudentLink.create({ data: {
          parentId: user.id,
          studentId: student.id,
          relation: 'Official parent',
        } })
      }
      changedFields.push('parentStudentLinks')
    }
    return user.id
  })

  return { localUserId, changedFields }
}

export async function assertOrbitEntityUpdateCanSynchronize(input: Omit<SynchronizationInput, 'actorId'> & { patch: OrbitRegistryEntitySnapshot }) {
  if (owns(input.patch, 'email') && !clean(input.patch.email)) {
    throw new ApiError(422, 'The institutional login email cannot be cleared because Nexus requires it. Replace it with another valid email instead.')
  }
  // The effective identity is validated, not only the stale pre-update snapshot. This
  // deliberately permits adding the first institutional email to an Orbit identity.
  const effectiveEntity = mergeOrbitEntityPatch(input.entity, input.patch)
  const localUser = await findLocalUser(input.entityType, input.entity, input.previous, input.identifier)
  if (!localUser) {
    await validateMaterializableEntity(input.entityType, effectiveEntity)
    return { localUserId: null, materialized: false, requiresMaterialization: true }
  }
  await assertUniqueLocalIdentity(input.entityType, localUser, effectiveEntity)
  return { localUserId: localUser.id, materialized: false, requiresMaterialization: false }
}
function parsedDate(value: string | Date | null | undefined) {
  if (value === null) return null
  if (value === undefined) return undefined
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

type AuditDeliveryStatus = {
  logged: boolean
  degraded: boolean
  reason?: string
}

async function recordSynchronizationAudit(input: {
  actorId?: string | null
  entityType: OrbitRegistryEntityType
  localUserId: string
  orbitUserId: string | null
  changedFields: string[]
}): Promise<AuditDeliveryStatus> {
  try {
    const auditActor = input.actorId
      ? await prisma.user.findUnique({ where: { id: input.actorId }, select: { id: true } })
      : null
    await prisma.auditLog.create({ data: {
      actorId: auditActor?.id || null,
      action: 'ORBIT_REGISTRY_ENTITY_SYNCHRONIZED',
      targetType: input.entityType,
      targetId: input.localUserId,
      metadata: { source: 'KCS_ORBIT', orbitUserId: input.orbitUserId, changedFields: input.changedFields },
    } })
    return { logged: true, degraded: false }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown audit-log failure'
    console.error('[orbit-entity-sync] Entity saved, but audit logging is degraded', {
      entityType: input.entityType,
      localUserId: input.localUserId,
      reason,
    })
    return { logged: false, degraded: true, reason }
  }
}

export async function synchronizeOrbitEntityToNexus(input: SynchronizationInput) {
  let localUser = await findLocalUser(input.entityType, input.entity, input.previous, input.identifier)
  const orbitUserId = clean(input.entity.id) ?? clean(input.previous?.id) ?? clean(input.identifier)
  if (!localUser) {
    // Materialization happens only after Orbit has accepted the change. It is a single
    // local transaction, so a failed materialization leaves no partial Nexus account.
    const materialized = await materializeLocalEntity(input.entityType, input.entity)
    const auditDelivery = await recordSynchronizationAudit({
      actorId: input.actorId,
      entityType: input.entityType,
      localUserId: materialized.localUserId,
      orbitUserId,
      changedFields: materialized.changedFields,
    })
    return {
      synchronized: true as const,
      localUserId: materialized.localUserId,
      changedFields: materialized.changedFields,
      materialized: true,
      auditDelivery,
    }
  }
  await assertUniqueLocalIdentity(input.entityType, localUser, input.entity)

  const names = identityParts(input.entity)
  const email = clean(input.entity.email)?.toLowerCase()
  const accessCode = clean(input.entity.accessCode)?.toUpperCase()
  const changedFields: string[] = []
  const nextRole = input.entityType === 'teacher'
    ? resolveEmployeeUserRole(input.entity.employeeType, localUser.role)
    : localUser.role
  const userData: Prisma.UserUpdateInput = {
    ...(orbitUserId ? { orbitUserId } : {}),
    ...(clean(input.entity.organizationId) || env.KCS_ORBIT_ORGANIZATION_ID ? { orbitOrganizationId: clean(input.entity.organizationId) || env.KCS_ORBIT_ORGANIZATION_ID } : {}),
    ...(names.firstName ? { firstName: names.firstName } : {}),
    ...(owns(input.entity, 'middleName') ? { middleName: clean(input.entity.middleName) } : {}),
    ...(names.lastName ? { lastName: names.lastName } : {}),
    ...(email ? { email } : {}),
    ...(accessCode ? { accessCode } : {}),
    ...(owns(input.entity, 'phone') ? { phone: clean(input.entity.phone) } : {}),
    ...(input.entityType !== 'student' && owns(input.entity, 'photoData') ? { avatar: clean(input.entity.photoData) } : {}),
    ...(nextRole !== localUser.role ? { role: nextRole } : {}),
  }
  for (const field of ['orbitUserId', 'orbitOrganizationId', 'firstName', 'middleName', 'lastName', 'email', 'accessCode', 'phone', 'avatar', 'role']) {
    if (field in userData) changedFields.push(`user.${field}`)
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: localUser.id }, data: userData })

    if (input.entityType === 'student') {
      const existing = localUser.studentProfile
      const classParts = input.patch && owns(input.patch, 'className')
        ? splitClassName(input.entity.className)
        : resolveSynchronizedStudentClass(input.entity.className, existing)
      const studentNumber = clean(input.entity.studentNumber)
        ?? existing?.studentNumber
        ?? clean(input.entity.externalIds?.find((link) => link.appSlug?.toUpperCase() === 'SAVANEX')?.externalId)
        ?? orbitUserId
      if (!studentNumber) throw new ApiError(409, 'The Orbit student cannot be synchronized without a student number or Orbit identifier.')
      const birthDate = parsedDate(input.entity.dateOfBirth)
      const profileData: Prisma.StudentProfileUncheckedUpdateInput = {
        ...(clean(input.entity.studentNumber) ? { studentNumber: clean(input.entity.studentNumber)! } : {}),
        ...(classParts ? { grade: classParts.grade, section: classParts.section } : {}),
        ...(owns(input.entity, 'status') && clean(input.entity.status) ? { status: clean(input.entity.status)!.toLowerCase() } : {}),
        ...(owns(input.entity, 'dateOfBirth') && birthDate !== undefined ? { dateOfBirth: birthDate } : {}),
        ...(owns(input.entity, 'photoData') ? { officialAvatar: clean(input.entity.photoData) } : {}),
      }
      const profile = existing
        ? await tx.studentProfile.update({ where: { id: existing.id }, data: profileData })
        : await tx.studentProfile.create({ data: {
            userId: localUser.id,
            studentNumber,
            grade: classParts?.grade || 'Unassigned',
            section: classParts?.section || '',
            status: clean(input.entity.status)?.toLowerCase() || 'active',
            ...(birthDate !== undefined ? { dateOfBirth: birthDate } : {}),
            ...(owns(input.entity, 'photoData') ? { officialAvatar: clean(input.entity.photoData) } : {}),
          } })
      changedFields.push('studentProfile')

      if (shouldReconcileStudentParentLinks(input.patch)) {
        const parentOrbitId = clean(input.entity.parentId)
        const parent = parentOrbitId ? await tx.user.findFirst({ where: { role: 'PARENT', orbitUserId: parentOrbitId }, select: { id: true } }) : null
        await tx.parentStudentLink.deleteMany({ where: { studentId: profile.id, ...(parent ? { parentId: { not: parent.id } } : {}) } })
        if (parent) await tx.parentStudentLink.upsert({
          where: { parentId_studentId: { parentId: parent.id, studentId: profile.id } },
          update: { relation: 'Official parent' },
          create: { parentId: parent.id, studentId: profile.id, relation: 'Official parent' },
        })
      }
    }

    if (input.entityType === 'parent' && input.patch && owns(input.patch, 'studentIds')) {
      const requestedStudentIds = unique(input.patch.studentIds ?? [])
      const localStudents = requestedStudentIds.length
        ? await tx.studentProfile.findMany({
            where: { OR: [{ user: { orbitUserId: { in: requestedStudentIds } } }, { studentNumber: { in: requestedStudentIds } }] },
            select: { id: true },
          })
        : []
      if (localStudents.length !== requestedStudentIds.length) throw new ApiError(409, 'One or more selected children could not be materialized in Nexus; the local transaction was cancelled.')
      const localStudentIds = localStudents.map((student) => student.id)
      await tx.parentStudentLink.deleteMany({ where: { parentId: localUser.id, ...(localStudentIds.length ? { studentId: { notIn: localStudentIds } } : {}) } })
      for (const studentId of localStudentIds) {
        await tx.parentStudentLink.upsert({
          where: { parentId_studentId: { parentId: localUser.id, studentId } },
          update: { relation: 'Official parent' },
          create: { parentId: localUser.id, studentId, relation: 'Official parent' },
        })
      }
      changedFields.push('parentStudentLinks')
    }

    if (input.entityType === 'teacher') {
      const employeeNumber = clean(input.entity.employeeId)
        || localUser.teacherProfile?.employeeNumber
        || localUser.staffProfile?.employeeNumber
        || `EMP-${(orbitUserId || localUser.id).replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase()}`
      const department = clean(input.entity.department)
      const qualification = clean(input.entity.jobTitle) ?? clean(input.entity.subject)
      const staffData = {
        employeeNumber,
        function: clean(input.entity.jobTitle) || clean(input.entity.employeeType) || localUser.staffProfile?.function || 'Employee',
        department: department || localUser.staffProfile?.department || 'General',
      }
      if (localUser.staffProfile) await tx.staffProfile.update({ where: { id: localUser.staffProfile.id }, data: staffData })
      else await tx.staffProfile.create({ data: { userId: localUser.id, ...staffData } })
      changedFields.push('staffProfile')

      if (nextRole === 'TEACHER' || localUser.teacherProfile) {
        const teacherData = {
          employeeNumber,
          department: department || localUser.teacherProfile?.department || 'Academics',
          qualification: qualification || localUser.teacherProfile?.qualification || 'Teacher',
        }
        if (localUser.teacherProfile) await tx.teacherProfile.update({ where: { id: localUser.teacherProfile.id }, data: teacherData })
        else await tx.teacherProfile.create({ data: { userId: localUser.id, ...teacherData, yearsOfExperience: 0 } })
        changedFields.push('teacherProfile')
      }
    }

    return localUser.id
  })

  const auditDelivery = await recordSynchronizationAudit({
    actorId: input.actorId,
    entityType: input.entityType,
    localUserId: result,
    orbitUserId,
    changedFields,
  })
  return {
    synchronized: true as const,
    localUserId: result,
    changedFields,
    materialized: false,
    auditDelivery,
  }
}