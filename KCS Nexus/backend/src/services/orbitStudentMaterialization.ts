import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { splitClassName } from '../utils/className.js'

export type OrbitStudentIdentity = {
  id: string
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
    select: { id: true, studentNumber: true },
  })
  if (existingProfile) return existingProfile

  const normalizedEmail = student.email?.trim().toLowerCase() || null
  let user = await prisma.user.findFirst({
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
        ...(student.photoData ? { avatar: student.photoData } : {}),
      },
    })
  }

  const canonicalNumber = student.studentNumber?.trim()
    || student.externalIds?.find((item) => item.appSlug.toUpperCase() === 'SAVANEX')?.externalId
    || student.id
  const classParts = splitClassName(student.className)
  return prisma.studentProfile.create({
    data: {
      userId: user.id,
      studentNumber: canonicalNumber,
      grade: classParts.grade || student.className?.trim() || 'Unassigned',
      section: classParts.section,
      status: (student.status || 'active').toLowerCase(),
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth) : null,
    },
    select: { id: true, studentNumber: true },
  })
}
