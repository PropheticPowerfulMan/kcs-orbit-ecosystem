import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { formatClassName, splitClassName } from '../utils/className.js'
import { ApiError } from '../utils/api.js'

export type OrbitStudentIdentity = {
  id: string
  parentId?: string | null
  fullName?: string | null
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  studentNumber?: string | null
  email?: string | null
  phone?: string | null
  accessCode?: string | null
  className?: string | null
  status?: string | null
  dateOfBirth?: string | null
  photoData?: string | null
  externalIds?: Array<{ appSlug: string; externalId: string }>
}

type OrbitStudentClassReference = {
  orbitUserId?: string | null
  studentNumber: string
  grade: string
  section?: string | null
}

export async function updateOrbitStudentClassAssignment(
  student: OrbitStudentClassReference,
  grade: string,
  section?: string | null,
) {
  if (!env.KCS_ORBIT_API_URL || !env.KCS_ORBIT_API_KEY || !env.KCS_ORBIT_ORGANIZATION_ID) {
    return { synchronized: false as const }
  }

  const identifier = student.orbitUserId || student.studentNumber
  const identifierType = student.orbitUserId ? 'orbitId' : 'externalId'
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL.replace(/\/$/, '')}/api/integration/registry/student/${encodeURIComponent(identifier)}?organizationId=${encodeURIComponent(env.KCS_ORBIT_ORGANIZATION_ID)}&identifierType=${identifierType}`,
    {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.KCS_ORBIT_API_KEY,
        'x-app-slug': 'KCS_NEXUS',
      },
      body: JSON.stringify({ className: formatClassName(grade, section) }),
      signal: AbortSignal.timeout(10_000),
    },
  )
  const payload = await response.json().catch(() => ({})) as { message?: string }
  if (!response.ok) {
    throw new ApiError(response.status, payload.message || `Orbit class assignment failed with status ${response.status}`)
  }
  return { synchronized: true as const }
}

const identityName = (student: OrbitStudentIdentity) => {
  const parts = (student.fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: student.firstName?.trim() || parts.at(-1) || 'Student',
    middleName: student.middleName?.trim() || (parts.length > 2 ? parts.slice(1, -1).join(' ') : null),
    lastName: student.lastName?.trim() || parts[0] || 'KCS',
  }
}

const studentKeys = (student: OrbitStudentIdentity) => [
  student.studentNumber,
  ...((student.externalIds ?? []).map((item) => item.externalId)),
  student.id,
].map((value) => String(value || '').trim()).filter(Boolean)

export async function ensureOrbitStudentProfile(student: OrbitStudentIdentity) {
  const keys = studentKeys(student)
  const existingProfile = await prisma.studentProfile.findFirst({
    where: { OR: [{ studentNumber: { in: keys } }, { user: { orbitUserId: student.id } }] },
    select: { id: true, studentNumber: true, userId: true },
  })

  const normalizedEmail = student.email?.trim().toLowerCase() || null
  let user = existingProfile
    ? await prisma.user.findUnique({ where: { id: existingProfile.userId }, select: { id: true, email: true, accessCode: true, role: true } })
    : await prisma.user.findFirst({
    where: { OR: [{ orbitUserId: student.id }, ...(normalizedEmail ? [{ email: normalizedEmail }] : [])] },
    select: { id: true, email: true, accessCode: true, role: true },
  })
  const name = identityName(student)
  const fallbackEmail = `orbit-student-${student.id.toLowerCase()}@nexus.local`
  const requestedAccessCode = student.accessCode?.trim().toUpperCase() || `ACC-STU-${student.id.slice(-12).toUpperCase()}`

  if (!user) {
    const accessOwner = await prisma.user.findUnique({ where: { accessCode: requestedAccessCode }, select: { id: true } })
    const emailOwner = normalizedEmail ? await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }) : null
    user = await prisma.user.create({
      data: {
        email: emailOwner ? fallbackEmail : (normalizedEmail || fallbackEmail),
        accessCode: accessOwner ? `ACC-STU-${student.id.slice(-8).toUpperCase()}-NEX` : requestedAccessCode,
        firstName: name.firstName,
        middleName: name.middleName,
        lastName: name.lastName,
        phone: student.phone?.trim() || null,
        avatar: student.photoData || null,
        role: 'STUDENT',
        orbitUserId: student.id,
        orbitOrganizationId: env.KCS_ORBIT_ORGANIZATION_ID || null,
        permissions: ['ecosystem:orbit'],
      },
      select: { id: true, email: true, accessCode: true, role: true },
    })
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'STUDENT',
        orbitUserId: student.id,
        orbitOrganizationId: env.KCS_ORBIT_ORGANIZATION_ID || null,
        firstName: name.firstName,
        middleName: name.middleName,
        lastName: name.lastName,
        ...(student.phone !== undefined ? { phone: student.phone?.trim() || null } : {}),

      },
    })
  }

  const canonicalNumber = student.studentNumber?.trim()
    || student.externalIds?.find((item) => item.appSlug.toUpperCase() === 'SAVANEX')?.externalId
    || student.id
  const classParts = splitClassName(student.className)
  const profileData = {
    userId: user.id,
    studentNumber: canonicalNumber,
    ...(student.className?.trim() ? { grade: classParts.grade || student.className.trim(), section: classParts.section } : {}),
    status: (student.status || 'active').toLowerCase(),
    ...(student.photoData !== undefined ? { officialAvatar: student.photoData || null } : {}),
    ...(student.dateOfBirth ? { dateOfBirth: new Date(student.dateOfBirth) } : {}),
  }
  const profile = existingProfile
    ? await prisma.studentProfile.update({
        where: { id: existingProfile.id },
        data: profileData,
        select: { id: true, studentNumber: true },
      })
    : await prisma.studentProfile.create({
        data: { ...profileData, grade: classParts.grade || student.className?.trim() || 'Unassigned', section: classParts.section },
        select: { id: true, studentNumber: true },
      })

  if (student.parentId) {
    const parent = await prisma.user.findFirst({ where: { orbitUserId: student.parentId, role: 'PARENT' }, select: { id: true } })
    if (parent) {
      await prisma.$transaction([
        prisma.parentStudentLink.deleteMany({ where: { studentId: profile.id, parentId: { not: parent.id } } }),
        prisma.parentStudentLink.upsert({
          where: { parentId_studentId: { parentId: parent.id, studentId: profile.id } },
          update: { relation: 'Official parent' },
          create: { parentId: parent.id, studentId: profile.id, relation: 'Official parent' },
        }),
      ])
    }
  }

  return profile
}
