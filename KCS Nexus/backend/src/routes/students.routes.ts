import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, requireSuperAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { splitClassName } from '../utils/className.js'
import { sendSchoolMail } from '../utils/mail.js'
import { sendSchoolSms } from '../utils/sms.js'

function generateAccessCode(role: string) {
  return `ACC-${role.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

async function generateUniqueAccessCode(tx: typeof prisma, role: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const accessCode = generateAccessCode(role)
    const existing = await tx.user.findFirst({ where: { accessCode } })
    if (!existing) {
      return accessCode
    }
  }

  return `ACC-${role.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
}
import { getRouteParam } from '../utils/request.js'

export const studentsRouter = Router()
const assignmentSubmissionSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
})

const schoolLevels = [
  'K3', 'K4', 'K5',
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
] as const

type OrbitPerson = {
  id: string
  displayId?: string | null
  fullName: string
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  accessCode?: string | null
  studentIds?: string[]
  externalIds?: Array<{ appSlug: string; externalId: string }>
}

type OrbitStudent = {
  id: string
  fullName: string
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  studentNumber?: string | null
  email?: string | null
  phone?: string | null
  status?: string | null
  dateOfBirth?: string | null
  accessCode?: string | null
  className?: string | null
  parentId?: string | null
  externalIds?: Array<{ appSlug: string; externalId: string }>
}

type OrbitSharedDirectory = {
  parents: OrbitPerson[]
  students: OrbitStudent[]
}

const studentUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  middleName: z.string().nullable().optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  studentNumber: z.string().min(2).optional(),
  grade: z.enum(schoolLevels).optional(),
  section: z.string().max(10).optional(),
  status: z.string().min(1).optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: 'At least one field must be provided for student update.',
})

function orbitRegistryIsEnabled() {
  return Boolean(env.KCS_ORBIT_API_URL && env.KCS_ORBIT_API_KEY && env.KCS_ORBIT_ORGANIZATION_ID)
}

function orbitStudentKeys(student: OrbitStudent) {
  return [
    student.id,
    student.studentNumber,
    ...(student.externalIds?.map((item) => item.externalId) ?? []),
  ].filter((key): key is string => Boolean(key))
}

async function getSharedDirectoryFromOrbit() {
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/read/shared-directory?organizationId=${encodeURIComponent(env.KCS_ORBIT_ORGANIZATION_ID!)}`,
    {
      headers: {
        'x-api-key': env.KCS_ORBIT_API_KEY!,
        'x-app-slug': 'KCS_NEXUS',
      },
    }
  )

  if (!response.ok) {
    throw new ApiError(response.status, `Orbit shared directory request failed with status ${response.status}`)
  }

  return response.json() as Promise<OrbitSharedDirectory>
}

function splitName(person: { fullName?: string | null; firstName?: string | null; lastName?: string | null }) {
  const cleanFullName = (person.fullName ?? '').trim()
  const parts = cleanFullName.split(/\s+/).filter(Boolean)
  return {
    firstName: person.firstName || parts[0] || '',
    lastName: person.lastName || parts.slice(1).join(' ') || '',
  }
}

function orbitExternalId(student: OrbitStudent) {
  const savanexId = student.externalIds?.find((item) => item.appSlug === 'SAVANEX')?.externalId
  return student.studentNumber || savanexId || student.id
}

function orbitManagingApp(student: OrbitStudent) {
  if (student.externalIds?.some((item) => item.appSlug === 'KCS_NEXUS')) {
    return 'KCS_NEXUS'
  }

  return student.externalIds?.[0]?.appSlug ?? null
}

async function updateRegistryEntityInOrbit(identifier: string, organizationId: string, payload: object, identifierType: 'orbitId' | 'externalId' = 'orbitId') {
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/registry/student/${encodeURIComponent(identifier)}?organizationId=${encodeURIComponent(organizationId)}&identifierType=${encodeURIComponent(identifierType)}`,
    {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.KCS_ORBIT_API_KEY!,
        'x-app-slug': 'KCS_NEXUS',
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(response.status, typeof data?.message === 'string' ? data.message : `Orbit registry update failed with status ${response.status}`)
  }

  return data
}

async function createRegistryEntityInOrbit(entityType: 'parent' | 'student', payload: object) {
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/registry/${entityType}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.KCS_ORBIT_API_KEY!,
        'x-app-slug': 'KCS_NEXUS',
      },
      body: JSON.stringify({
        organizationId: env.KCS_ORBIT_ORGANIZATION_ID!,
        ...payload,
      }),
    }
  )

  const data = await response.json().catch(() => ({}))
  if (response.status === 409 && typeof data?.orbitId === 'string') {
    return data as { orbitId?: string; externalId?: string; entity?: unknown }
  }

  if (!response.ok) {
    throw new ApiError(response.status, typeof data?.message === 'string' ? data.message : `Orbit registry create failed with status ${response.status}`)
  }

  return data as { orbitId?: string; externalId?: string; entity?: unknown }
}

async function deleteRegistryEntityInOrbit(entityType: 'student', identifier: string, organizationId: string, identifierType: 'orbitId' | 'externalId' = 'orbitId') {
  const response = await fetch(
    `${env.KCS_ORBIT_API_URL!.replace(/\/$/, '')}/api/integration/registry/${entityType}/${encodeURIComponent(identifier)}?organizationId=${encodeURIComponent(organizationId)}&identifierType=${encodeURIComponent(identifierType)}`,
    {
      method: 'DELETE',
      headers: {
        'x-api-key': env.KCS_ORBIT_API_KEY!,
        'x-app-slug': 'KCS_NEXUS',
      },
    }
  )

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(response.status, typeof data?.message === 'string' ? data.message : `Orbit registry delete failed with status ${response.status}`)
  }

  return data
}

function orbitStudentsToProfiles(directory: OrbitSharedDirectory) {
  const parentsById = new Map(directory.parents.map((parent) => [parent.id, parent]))

  return directory.students.map((student) => {
    const studentName = splitName(student)
    const parent = student.parentId ? parentsById.get(student.parentId) : undefined
    const parentName = parent ? splitName(parent) : { firstName: '', lastName: '' }
    const classParts = splitClassName(student.className)
    const managingApp = orbitManagingApp(student)

    return {
      id: student.id,
      userId: student.id,
      studentNumber: orbitExternalId(student),
      grade: classParts.grade,
      section: classParts.section,
      status: (student.status ?? 'active').toLowerCase(),
      gpa: null,
      attendanceRate: null,
      enrollmentDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dateOfBirth: student.dateOfBirth ?? null,
      user: {
        id: student.id,
        email: student.email ?? '',
        firstName: student.firstName || studentName.firstName,
        middleName: student.middleName ?? null,
        lastName: studentName.lastName,
        phone: student.phone ?? null,
        role: 'STUDENT',
      },
      parentLinks: parent ? [{
        id: `${student.id}:${parent.id}`,
        studentId: student.id,
        parentId: parent.id,
        relation: 'Parent',
        parent: {
          id: parent.id,
          email: parent.email ?? null,
          firstName: parentName.firstName,
          lastName: parentName.lastName,
          phone: parent.phone ?? null,
          role: 'PARENT',
        },
      }] : [],
      externalIds: student.externalIds ?? [],
      managingApp,
      syncSource: 'orbit',
      isEditable: true,
      isDeletable: true,
    }
  })
}

const createStudentSchema = z.object({
  parent: z.object({
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    relationship: z.string().default('Parent'),
    physicalAddress: z.string().trim().min(1).optional(),
    photoData: z.string().max(8_000_000).optional(),
  }),
  student: z.object({
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    lastName: z.string().min(1),
    email: z.string().email().optional(),
    studentNumber: z.string().min(2).optional(),
    grade: z.enum(schoolLevels),
    section: z.string().default(''),
    dateOfBirth: z.coerce.date(),
    photoData: z.string().max(8_000_000).optional(),
  }),
})

const createFamilySchema = z.object({
  parent: createStudentSchema.shape.parent,
  students: z.array(createStudentSchema.shape.student).min(1),
})

function generateTemporaryPassword(role: 'PAR' | 'STU' = 'STU') {
  return `KCS-${randomInt(0, 1_000_000).toString().padStart(6, '0')}`
}

function schoolEmailToken(value?: string | null) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function generateSchoolEmail(student: { firstName: string; middleName?: string | null; lastName: string }, unavailableEmails: Set<string>) {
  const first = schoolEmailToken(student.firstName) || 'user'
  const middle = schoolEmailToken(student.middleName)
  const last = schoolEmailToken(student.lastName) || 'kcs'
  const bases = [`${first}.${last}`]
  if (middle) bases.push(`${first}.${middle[0]}.${last}`, `${first}.${middle}.${last}`)

  for (const base of bases) {
    const candidate = `${base}@ourkcs.org`
    if (!unavailableEmails.has(candidate)) {
      unavailableEmails.add(candidate)
      return candidate
    }
  }

  for (let sequence = 2; ; sequence += 1) {
    const candidate = `${bases[0]}${sequence}@ourkcs.org`
    if (!unavailableEmails.has(candidate)) {
      unavailableEmails.add(candidate)
      return candidate
    }
  }
}

type FamilyCredential = { displayName?: string; studentId?: string; username: string; accessCode?: string; temporaryPassword: string }

async function deliverFamilyCredentials(input: {
  parentUserId: string
  parentName: string
  parentEmail: string
  parentPhone?: string | null
  parentCredential: FamilyCredential | null
  studentCredentials: Array<FamilyCredential & { userId: string }>
}) {
  const credentialLines = [
    input.parentCredential ? `Parent — identifiant: ${input.parentCredential.username}; code: ${input.parentCredential.accessCode || 'non défini'}; mot de passe temporaire: ${input.parentCredential.temporaryPassword}` : null,
    ...input.studentCredentials.map((student) => `${student.displayName || student.studentId || 'Élève'} — ID: ${student.studentId || 'non défini'}; identifiant: ${student.username}; code: ${student.accessCode || 'non défini'}; mot de passe temporaire: ${student.temporaryPassword}`),
  ].filter(Boolean) as string[]
  const title = 'Identifiants de votre famille KCS Nexus'
  const message = `Bonjour ${input.parentName},\n\nVoici les accès de votre famille :\n${credentialLines.join('\n')}\n\nCes mots de passe doivent être changés à la première connexion.`

  await prisma.notification.create({ data: { userId: input.parentUserId, title, message, type: 'MESSAGE', link: '/parent/messages' } })
  await prisma.notification.createMany({
    data: input.studentCredentials.map((student) => ({
      userId: student.userId,
      title: 'Vos identifiants KCS Nexus',
      message: `Identifiant: ${student.username}\nCode: ${student.accessCode || 'non défini'}\nMot de passe temporaire: ${student.temporaryPassword}`,
      type: 'MESSAGE' as const,
      link: '/student/messages',
    })),
  })
  const [email, sms] = await Promise.all([
    sendSchoolMail({ to: input.parentEmail, subject: title, text: message, html: `<p>Bonjour ${input.parentName},</p><p>Voici les accès de votre famille :</p><ul>${credentialLines.map((line) => `<li>${line}</li>`).join('')}</ul><p>Ces mots de passe doivent être changés à la première connexion.</p>` }).catch(() => ({ sent: false as const, reason: 'SMTP_SEND_FAILED' as const })),
    sendSchoolSms(input.parentPhone, `KCS Nexus — accès famille:\n${credentialLines.join('\n')}`).catch(() => ({ sent: false as const, reason: 'SMS_SEND_FAILED' as const })),
  ])
  return { email, sms, dashboard: { parent: true, students: input.studentCredentials.length } }
}

async function deliverStudentUpdate(input: {
  studentUserId?: string
  studentEmail?: string | null
  studentName: string
  parentUserIds: string[]
  parentEmails: string[]
  parentPhones: string[]
}) {
  const title = 'Dossier élève modifié'
  const message = `Le dossier de ${input.studentName} a été modifié par le superadministrateur KCS Nexus.`
  const userIds = Array.from(new Set([...(input.studentUserId ? [input.studentUserId] : []), ...input.parentUserIds]))
  if (userIds.length) {
    await prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, title, message, type: 'MESSAGE' as const, link: '/messages' })) })
  }
  const emailResults = await Promise.all(Array.from(new Set([...(input.studentEmail ? [input.studentEmail] : []), ...input.parentEmails])).map((to) =>
    sendSchoolMail({ to, subject: title, text: message, html: `<p>${message}</p>` }).catch(() => ({ sent: false as const, reason: 'SMTP_SEND_FAILED' as const })),
  ))
  const smsResults = await Promise.all(Array.from(new Set(input.parentPhones)).map((phone) =>
    sendSchoolSms(phone, `KCS Nexus: ${message}`).catch(() => ({ sent: false as const, reason: 'SMS_SEND_FAILED' as const })),
  ))
  return {
    dashboard: userIds.length > 0,
    email: emailResults.find((result) => result.sent) || emailResults[0] || { sent: false as const, reason: 'SMTP_SEND_FAILED' as const },
    sms: smsResults.find((result) => result.sent) || smsResults[0] || { sent: false as const, reason: 'PHONE_MISSING' as const },
  }
}

function normalizeCreateStudentPayload(payload: unknown) {
  const asFamily = createFamilySchema.safeParse(payload)
  if (asFamily.success) return asFamily.data

  const asSingleStudent = createStudentSchema.parse(payload)
  return {
    parent: asSingleStudent.parent,
    students: [asSingleStudent.student],
  }
}

studentsRouter.get('/', authenticate, requireRoles('admin', 'staff'), asyncHandler(async (_req, res) => {
  if (orbitRegistryIsEnabled()) {
    const directory = await getSharedDirectoryFromOrbit()
    return success(res, orbitStudentsToProfiles(directory), 'Students loaded from Orbit')
  }

  throw new ApiError(503, 'Le registre Orbit est requis pour garantir des effectifs identiques dans tout l’écosystème.')

  const students = await prisma.studentProfile.findMany({
    include: {
      user: true,
      parentLinks: { include: { parent: true } },
    },
    orderBy: { enrollmentDate: 'desc' },
  })
  return success(res, students)
}))

studentsRouter.get('/me/children', authenticate, requireRoles('parent'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, accessCode: true, orbitUserId: true },
  })
  if (!currentUser) throw new ApiError(404, 'Parent account not found')

  if (orbitRegistryIsEnabled()) {
    const directory = await getSharedDirectoryFromOrbit()
    const identityKeys = new Set(
      [currentUser.id, currentUser.email, currentUser.accessCode, currentUser.orbitUserId]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim().toLowerCase()),
    )
    const parent = directory.parents.find((candidate) =>
      [candidate.id, candidate.displayId, candidate.email, candidate.accessCode, ...(candidate.externalIds?.map((item) => item.externalId) ?? [])]
        .filter((value): value is string => Boolean(value))
        .some((value) => identityKeys.has(value.trim().toLowerCase())),
    )
    if (!parent) return success(res, [], 'No children linked to this parent')

    const linkedStudentIds = new Set(parent.studentIds ?? [])
    const familyDirectory: OrbitSharedDirectory = {
      parents: [parent],
      students: directory.students.filter((student) =>
        student.parentId === parent.id || linkedStudentIds.has(student.id) || orbitStudentKeys(student).some((key) => linkedStudentIds.has(key)),
      ),
    }
    const orbitProfiles = orbitStudentsToProfiles(familyDirectory)
    const localProfiles = await prisma.studentProfile.findMany({
      where: { studentNumber: { in: orbitProfiles.map((student) => student.studentNumber) } },
      select: { id: true, studentNumber: true, grades: { select: { percentage: true } }, attendanceRecords: { select: { status: true } }, submissions: { select: { status: true, assignment: { select: { dueDate: true } } } }, _count: { select: { enrollments: true } } },
    })
    const localByNumber = new Map(localProfiles.map((profile) => [profile.studentNumber.toLowerCase(), profile]))
    const children = orbitProfiles.map((profile) => {
      const local = localByNumber.get(profile.studentNumber.toLowerCase())
      const average = local?.grades.length ? Number((local.grades.reduce((sum, grade) => sum + grade.percentage, 0) / local.grades.length).toFixed(1)) : null
      const present = local?.attendanceRecords.filter((record) => ['PRESENT', 'LATE', 'EXCUSED'].includes(record.status)).length ?? 0
      const attendanceRate = local?.attendanceRecords.length ? Number(((present / local.attendanceRecords.length) * 100).toFixed(1)) : null
      const pendingAssignments = local?.submissions.filter((submission) => submission.status === 'PENDING').length ?? 0
      const overdueAssignments = local?.submissions.filter((submission) => submission.status === 'PENDING' && submission.assignment.dueDate < new Date()).length ?? 0
      return { ...profile, localProfileId: local?.id ?? null, gpa: null, attendanceRate: null, academicSummary: { average, attendanceRate, publishedGrades: local?.grades.length ?? 0, attendanceRecords: local?.attendanceRecords.length ?? 0, pendingAssignments, overdueAssignments, enrolledCourses: local?._count.enrollments ?? 0 } }
    })
    return success(res, children, 'Parent children loaded from Orbit')
  }

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: currentUser.id },
    include: { student: { include: { user: true, parentLinks: { include: { parent: true } } } } },
  })
  return success(res, links.map((link) => link.student), 'Parent children loaded')
}))

studentsRouter.get('/me/overview', authenticate, requireRoles('student'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const student = await prisma.studentProfile.findUnique({
    where: { userId: req.user!.sub },
    include: {
      user: true,
      grades: { include: { course: true }, orderBy: { createdAt: 'desc' } },
      submissions: { include: { assignment: { include: { course: true } } }, orderBy: { assignment: { dueDate: 'asc' } } },
      enrollments: { include: { course: { include: { schedules: true, teacher: { include: { user: true } } } } } },
      attendanceRecords: { orderBy: { date: 'desc' }, take: 120 },
      reportCards: { orderBy: { createdAt: 'desc' } },
      transcripts: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!student) {
    return success(res, { profile: null, grades: [], assignments: [], timetable: [], attendance: [], reportCards: [], transcripts: [] }, 'Academic profile synchronization pending')
  }
  const average = student.grades.length ? Number((student.grades.reduce((sum, grade) => sum + grade.percentage, 0) / student.grades.length).toFixed(1)) : null
  const present = student.attendanceRecords.filter((record) => ['PRESENT', 'LATE', 'EXCUSED'].includes(record.status)).length
  const attendanceRate = student.attendanceRecords.length ? Number(((present / student.attendanceRecords.length) * 100).toFixed(1)) : null
  const pendingAssignments = student.submissions.filter((submission) => submission.status === 'PENDING').length
  const overdueAssignments = student.submissions.filter((submission) => submission.status === 'PENDING' && submission.assignment.dueDate < new Date()).length
  const completedAssignments = student.submissions.filter((submission) => ['SUBMITTED', 'GRADED'].includes(submission.status)).length
  const assignmentCompletion = student.submissions.length ? Number(((completedAssignments / student.submissions.length) * 100).toFixed(1)) : null
  const academicSummary = { average, attendanceRate, publishedGrades: student.grades.length, attendanceRecords: student.attendanceRecords.length, pendingAssignments, overdueAssignments, assignmentCompletion, enrolledCourses: student.enrollments.length }
  const timetable = student.enrollments.flatMap(({ course }) => course.schedules.map((slot) => ({
    ...slot,
    course: { id: course.id, name: course.name, code: course.code, description: course.description },
    teacher: [course.teacher.user.firstName, course.teacher.user.lastName].filter(Boolean).join(' '),
  })))
  return success(res, {
    profile: { id: student.id, studentNumber: student.studentNumber, grade: student.grade, section: student.section, gpa: null, attendanceRate: null, status: student.status, user: student.user },
    academicSummary,
    grades: student.grades,
    assignments: student.submissions,
    timetable,
    attendance: student.attendanceRecords,
    reportCards: student.reportCards,
    transcripts: student.transcripts,
  }, 'Student dashboard loaded')
}))
studentsRouter.post('/', authenticate, requireSuperAdmin(), asyncHandler(async (req, res) => {
  const { parent, students: submittedStudents } = normalizeCreateStudentPayload(req.body)
  const generatedAt = Date.now().toString(36).toUpperCase()
  let students = submittedStudents.map((student, index) => ({
    ...student,
    studentNumber: student.studentNumber?.trim() || `KCS-STU-${generatedAt}-${String(index + 1).padStart(2, '0')}`,
  }))

  const studentNumbers = students.map((student) => student.studentNumber)
  if (new Set(studentNumbers).size !== studentNumbers.length) {
    throw new ApiError(409, 'Duplicate student numbers in request')
  }

  if (orbitRegistryIsEnabled()) {
    const directoryBeforeCreate = await getSharedDirectoryFromOrbit()
    const localSchoolEmails = await prisma.user.findMany({
      where: { email: { endsWith: '@ourkcs.org', mode: 'insensitive' } },
      select: { email: true },
    })
    const unavailableSchoolEmails = new Set([
      ...directoryBeforeCreate.students.map((student) => student.email?.trim().toLowerCase()).filter((email): email is string => Boolean(email)),
      ...localSchoolEmails.map((user) => user.email.trim().toLowerCase()),
    ])
    students = students.map((student) => ({ ...student, email: generateSchoolEmail(student, unavailableSchoolEmails) }))
    const duplicateOrbitStudents = directoryBeforeCreate.students.filter((student) => {
      const keys = orbitStudentKeys(student).map((key) => key.toLowerCase())
      return studentNumbers.some((studentNumber) => keys.includes(studentNumber.toLowerCase()))
    })
    if (duplicateOrbitStudents.length > 0) {
      throw new ApiError(409, `Student number already exists: ${duplicateOrbitStudents.map((student) => orbitExternalId(student)).join(', ')}`)
    }

    const parentTemporaryPassword = generateTemporaryPassword('PAR')
    const parentResult = await createRegistryEntityInOrbit('parent', {
      firstName: parent.firstName,
      middleName: parent.middleName,
      lastName: parent.lastName,
      email: parent.email,
      phone: parent.phone || undefined,
      physicalAddress: parent.physicalAddress || undefined,
      photoData: parent.photoData || undefined,
      mustChangePassword: true,
    })
    const parentOrbitId = parentResult.orbitId
    if (!parentOrbitId) {
      throw new ApiError(502, 'Orbit parent creation did not return an id')
    }

    const parentAccessCode = String((parentResult.entity as { accessCode?: string } | undefined)?.accessCode || await generateUniqueAccessCode(prisma, 'parent'))
    const parentPasswordHash = await bcrypt.hash(parentTemporaryPassword, 10)
    const localParentUser = await prisma.user.upsert({
      where: { email: parent.email },
      update: { accessCode: parentAccessCode, passwordHash: parentPasswordHash, firstName: parent.firstName, middleName: parent.middleName || null, lastName: parent.lastName, phone: parent.phone || null, avatar: parent.photoData || null, role: 'PARENT' },
      create: { email: parent.email, accessCode: parentAccessCode, passwordHash: parentPasswordHash, firstName: parent.firstName, middleName: parent.middleName || null, lastName: parent.lastName, phone: parent.phone || null, avatar: parent.photoData || null, role: 'PARENT' },
    })

    const temporaryCredentials: {
      parent: { displayName: string; username: string; accessCode: string; temporaryPassword: string } | null
      students: Array<{ displayName: string; studentId: string; username: string; accessCode: string; temporaryPassword: string }>
    } = {
      parent: { displayName: [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' '), username: parent.email, accessCode: parentAccessCode, temporaryPassword: parentTemporaryPassword },
      students: [],
    }
    const studentDeliveryCredentials: Array<FamilyCredential & { userId: string }> = []

    for (const student of students) {
      const studentTemporaryPassword = generateTemporaryPassword('STU')
      const studentEmail = student.email ?? `${student.studentNumber.toLowerCase()}@students.kcs.local`
      const studentResult = await createRegistryEntityInOrbit('student', {
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        gender: 'O',
        studentNumber: student.studentNumber,
        email: studentEmail,
        status: 'ACTIVE',
        dateOfBirth: student.dateOfBirth,
        mustChangePassword: true,
        className: `${student.grade} ${student.section || ''}`.trim(),
        parentOrbitId,
        photoData: student.photoData || undefined,
      })
      const studentAccessCode = String((studentResult.entity as { accessCode?: string } | undefined)?.accessCode || await generateUniqueAccessCode(prisma, 'student'))
      const studentPasswordHash = await bcrypt.hash(studentTemporaryPassword, 10)
      const localStudentUser = await prisma.user.upsert({
        where: { email: studentEmail },
        update: { accessCode: studentAccessCode, passwordHash: studentPasswordHash, firstName: student.firstName, middleName: student.middleName || null, lastName: student.lastName, avatar: student.photoData || null, role: 'STUDENT' },
        create: { email: studentEmail, accessCode: studentAccessCode, passwordHash: studentPasswordHash, firstName: student.firstName, middleName: student.middleName || null, lastName: student.lastName, avatar: student.photoData || null, role: 'STUDENT' },
      })
      const localStudentProfile = await prisma.studentProfile.upsert({
        where: { studentNumber: student.studentNumber },
        update: { userId: localStudentUser.id, grade: student.grade, section: student.section || '', dateOfBirth: student.dateOfBirth, status: 'active' },
        create: { userId: localStudentUser.id, studentNumber: student.studentNumber, grade: student.grade, section: student.section || '', dateOfBirth: student.dateOfBirth, status: 'active' },
      })
      await prisma.parentStudentLink.upsert({
        where: { parentId_studentId: { parentId: localParentUser.id, studentId: localStudentProfile.id } },
        update: { relation: parent.relationship },
        create: { parentId: localParentUser.id, studentId: localStudentProfile.id, relation: parent.relationship },
      })
      temporaryCredentials.students.push({ displayName: [student.lastName, student.middleName, student.firstName].filter(Boolean).join(' '), studentId: student.studentNumber, username: studentEmail, accessCode: studentAccessCode, temporaryPassword: studentTemporaryPassword })
      studentDeliveryCredentials.push({ userId: localStudentUser.id, displayName: [student.lastName, student.middleName, student.firstName].filter(Boolean).join(' '), studentId: student.studentNumber, username: studentEmail, accessCode: studentAccessCode, temporaryPassword: studentTemporaryPassword })
    }

    const directory = await getSharedDirectoryFromOrbit()
    const createdStudents = orbitStudentsToProfiles(directory).filter((student) => studentNumbers.includes(student.studentNumber))
    const delivery = await deliverFamilyCredentials({
      parentUserId: localParentUser.id,
      parentName: [parent.firstName, parent.middleName, parent.lastName].filter(Boolean).join(' '),
      parentEmail: parent.email,
      parentPhone: parent.phone,
      parentCredential: temporaryCredentials.parent,
      studentCredentials: studentDeliveryCredentials,
    })

    return success(res, {
      parent: parentResult.entity ?? { id: parentOrbitId, email: parent.email, firstName: parent.firstName, lastName: parent.lastName },
      students: createdStudents,
      student: createdStudents[0] ?? null,
      studentCount: createdStudents.length,
      temporaryCredentials,
      credentialDelivery: delivery,
      syncTarget: 'orbit',
    }, students.length === 1 ? 'Student created through Orbit' : 'Family registered through Orbit', 201)
  }

  const existingStudents = await prisma.studentProfile.findMany({
    where: { studentNumber: { in: studentNumbers } },
    select: { studentNumber: true },
  })
  if (existingStudents.length > 0) {
    throw new ApiError(409, `Student number already exists: ${existingStudents.map((student) => student.studentNumber).join(', ')}`)
  }

  const studentEmails = students.map((student) => student.email ?? `${student.studentNumber.toLowerCase()}@students.kcs.local`)
  if (new Set(studentEmails.map((email) => email.toLowerCase())).size !== studentEmails.length) {
    throw new ApiError(409, 'Duplicate student emails in request')
  }
  const existingStudentUsers = await prisma.user.findMany({
    where: { email: { in: studentEmails } },
    select: { email: true },
  })
  if (existingStudentUsers.length > 0) {
    throw new ApiError(409, `Student email already exists: ${existingStudentUsers.map((user) => user.email).join(', ')}`)
  }

  const temporaryCredentials: {
    parent: { username: string; temporaryPassword: string } | null
    students: Array<{ studentId: string; username: string; temporaryPassword: string }>
  } = {
    parent: null,
    students: [],
  }

  const family = await prisma.$transaction(async (tx) => {
    const existingParent = await tx.user.findUnique({ where: { email: parent.email } })
    const parentTemporaryPassword = existingParent?.passwordHash ? null : generateTemporaryPassword('PAR')
    const parentPasswordHash = parentTemporaryPassword ? await bcrypt.hash(parentTemporaryPassword, 10) : undefined
    const parentUser = await tx.user.upsert({
      where: { email: parent.email },
      update: {
        firstName: parent.firstName,
        lastName: parent.lastName,
        phone: parent.phone,
        passwordHash: parentPasswordHash,
        role: 'PARENT',
      },
      create: {
        email: parent.email,
        accessCode: await generateUniqueAccessCode(tx as typeof prisma, 'parent'),
        firstName: parent.firstName,
        lastName: parent.lastName,
        phone: parent.phone,
        passwordHash: parentPasswordHash,
        role: 'PARENT',
      },
    })

    if (parentTemporaryPassword) {
      temporaryCredentials.parent = {
        username: parentUser.email,
        temporaryPassword: parentTemporaryPassword,
      }
    }

    const createdStudents = []
    for (const [index, student] of students.entries()) {
      const studentEmail = studentEmails[index]
      const studentTemporaryPassword = generateTemporaryPassword('STU')
      const studentUser = await tx.user.create({
        data: {
          email: studentEmail,
          accessCode: await generateUniqueAccessCode(tx as typeof prisma, 'student'),
          firstName: student.firstName,
          lastName: student.lastName,
          passwordHash: await bcrypt.hash(studentTemporaryPassword, 10),
          role: 'STUDENT',
          studentProfile: {
            create: {
            studentNumber: student.studentNumber,
            grade: student.grade,
            section: student.section || '',
            dateOfBirth: student.dateOfBirth,
            status: 'active',
              gpa: null,
              attendanceRate: null,
              parentLinks: {
                create: {
                  parent: { connect: { id: parentUser.id } },
                  relation: parent.relationship,
                },
              },
            },
          },
        },
        include: {
          studentProfile: {
            include: {
              user: true,
              parentLinks: { include: { parent: true } },
            },
          },
        },
      })

      if (studentUser.studentProfile) {
        createdStudents.push(studentUser.studentProfile)
        temporaryCredentials.students.push({
          studentId: student.studentNumber,
          username: studentEmail,
          temporaryPassword: studentTemporaryPassword,
        })
      }
    }

    return {
      parent: parentUser,
      students: createdStudents,
      studentCount: createdStudents.length,
      temporaryCredentials,
    }
  })

  const localStudentUsers = await prisma.user.findMany({ where: { email: { in: temporaryCredentials.students.map((credential) => credential.username) } }, select: { id: true, email: true, accessCode: true, firstName: true, lastName: true } })
  const delivery = await deliverFamilyCredentials({
    parentUserId: family.parent.id,
    parentName: `${parent.firstName} ${parent.lastName}`.trim(),
    parentEmail: parent.email,
    parentPhone: parent.phone,
    parentCredential: temporaryCredentials.parent ? { ...temporaryCredentials.parent, accessCode: family.parent.accessCode } : null,
    studentCredentials: temporaryCredentials.students.map((credential) => {
      const user = localStudentUsers.find((candidate) => candidate.email === credential.username)!
      return { ...credential, userId: user.id, accessCode: user.accessCode || undefined, displayName: `${user.firstName} ${user.lastName}`.trim() }
    }),
  })

  return success(res, {
    ...family,
    credentialDelivery: delivery,
    student: family.students[0] ?? null,
  }, family.studentCount === 1 ? 'Student created' : 'Family registered', 201)
}))

studentsRouter.get('/me/assignments', authenticate, requireRoles('student'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const student = await prisma.studentProfile.findUnique({ where: { userId: req.user!.sub } })
  if (!student) throw new ApiError(404, 'Student profile not found')
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { studentId: student.id },
    include: { assignment: { include: { course: true } } },
    orderBy: { assignment: { dueDate: 'asc' } },
  })
  return success(res, submissions)
}))

studentsRouter.get('/me/timetable', authenticate, requireRoles('student'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const student = await prisma.studentProfile.findUnique({
    where: { userId: req.user!.sub },
    include: { enrollments: { include: { course: { include: { schedules: true, teacher: { include: { user: true } } } } } } },
  })
  if (!student) throw new ApiError(404, 'Student profile not found')
  const timetable = student.enrollments.flatMap(({ course }) => course.schedules.map((slot) => ({ ...slot, course: { id: course.id, name: course.name, code: course.code, description: course.description }, teacher: `${course.teacher.user.firstName} ${course.teacher.user.lastName}` })))
  return success(res, timetable)
}))

studentsRouter.patch('/me/assignments/:submissionId/submit', authenticate, requireRoles('student'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const submissionId = getRouteParam(req.params.submissionId)
  const payload = assignmentSubmissionSchema.parse(req.body)
  const student = await prisma.studentProfile.findUnique({ where: { userId: req.user!.sub } })
  if (!student) throw new ApiError(404, 'Student profile not found')
  const existing = await prisma.assignmentSubmission.findFirst({ where: { id: submissionId, studentId: student.id } })
  if (!existing) throw new ApiError(404, 'Assignment submission not found')
  const updated = await prisma.assignmentSubmission.update({
    where: { id: submissionId },
    data: { status: 'SUBMITTED', submittedAt: new Date(), feedback: `Student file: ${payload.fileName}` },
    include: { assignment: { include: { course: true } } },
  })
  return success(res, updated, 'Assignment submitted')
}))

async function assertStudentAccess(req: AuthenticatedRequest, studentId: string) {
  const role = req.user!.role
  if (role === 'admin' || role === 'staff' || role === 'teacher') return

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { userId: true, parentLinks: { select: { parentId: true } } },
  })
  if (!student) throw new ApiError(404, 'Student not found')
  if (role === 'student' && student.userId === req.user!.sub) return
  if (role === 'parent' && student.parentLinks.some((link) => link.parentId === req.user!.sub)) return
  throw new ApiError(403, 'You are not authorized to access this student.')
}

studentsRouter.get('/:id', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const studentId = getRouteParam(req.params.id)
  await assertStudentAccess(req, studentId)
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      parentLinks: { include: { parent: true } },
      enrollments: { include: { course: true } },
    },
  })
  if (!student) throw new ApiError(404, 'Student not found')
  return success(res, student)
}))

studentsRouter.get('/:id/grades', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const studentId = getRouteParam(req.params.id)
  await assertStudentAccess(req, studentId)
  const grades = await prisma.grade.findMany({
    where: { studentId },
    include: { course: true },
    orderBy: { createdAt: 'desc' },
  })
  return success(res, grades)
}))

studentsRouter.get('/:id/assignments', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const studentId = getRouteParam(req.params.id)
  await assertStudentAccess(req, studentId)
  const submissions = await prisma.assignmentSubmission.findMany({
    where: { studentId },
    include: { assignment: { include: { course: true } } },
    orderBy: { assignment: { dueDate: 'asc' } },
  })
  return success(res, submissions)
}))

studentsRouter.get('/:id/timetable', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const studentId = getRouteParam(req.params.id)
  await assertStudentAccess(req, studentId)
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      enrollments: {
        include: {
          course: {
            include: { schedules: true },
          },
        },
      },
    },
  })
  if (!student) throw new ApiError(404, 'Student not found')
  const timetable = student.enrollments.flatMap((enrollment) => enrollment.course.schedules)
  return success(res, timetable)
}))

studentsRouter.get('/:id/analytics', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const studentId = getRouteParam(req.params.id)
  await assertStudentAccess(req, studentId)
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { aiRecommendations: true, grades: true },
  })
  if (!student) throw new ApiError(404, 'Student not found')

  const overallPercentage = student.grades.length
    ? student.grades.reduce((sum, grade) => sum + grade.percentage, 0) / student.grades.length
    : 0

  return success(res, {
    studentId: student.id,
    overallGPA: student.gpa ?? Number((overallPercentage / 25).toFixed(2)),
    attendanceRate: student.attendanceRate ?? 0,
    assignmentCompletion: 91,
    riskLevel: overallPercentage < 70 ? 'high' : overallPercentage < 82 ? 'medium' : 'low',
    recommendations: student.aiRecommendations,
    performanceTrend: overallPercentage > 85 ? 'improving' : 'stable',
  })
}))

studentsRouter.put('/:id', authenticate, requireSuperAdmin(), asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.id)
  const payload = studentUpdateSchema.parse(req.body)

  if (orbitRegistryIsEnabled()) {
    const directory = await getSharedDirectoryFromOrbit()
    const target = directory.students.find((student) => student.id === studentId)
    if (!target) throw new ApiError(404, 'Student not found')

    const currentClass = splitClassName(target.className)
    const updated = await updateRegistryEntityInOrbit(studentId, env.KCS_ORBIT_ORGANIZATION_ID!, {
      ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
      ...(payload.middleName !== undefined ? { middleName: payload.middleName } : {}),
      ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
      ...(payload.email !== undefined ? { email: payload.email } : {}),
      ...(payload.studentNumber !== undefined ? { studentNumber: payload.studentNumber } : {}),
      ...(payload.status !== undefined ? { status: payload.status.toUpperCase() } : {}),
      ...(payload.dateOfBirth !== undefined ? { dateOfBirth: payload.dateOfBirth } : {}),
      ...(payload.grade !== undefined || payload.section !== undefined
        ? { className: `${payload.grade ?? currentClass.grade} ${payload.section ?? currentClass.section}`.trim() }
        : {}),
    })
    const parent = target.parentId ? directory.parents.find((candidate) => candidate.id === target.parentId) : undefined
    const localUsers = await prisma.user.findMany({
      where: { email: { in: [target.email, parent?.email].filter(Boolean) as string[] } },
      select: { id: true, email: true, role: true },
    })
    const notificationDelivery = await deliverStudentUpdate({
      studentUserId: localUsers.find((user) => user.role === 'STUDENT')?.id,
      studentEmail: payload.email || target.email,
      studentName: [payload.firstName ?? target.firstName, payload.middleName ?? target.middleName, payload.lastName ?? target.lastName].filter(Boolean).join(' '),
      parentUserIds: localUsers.filter((user) => user.role === 'PARENT').map((user) => user.id),
      parentEmails: parent?.email ? [parent.email] : [],
      parentPhones: parent?.phone ? [parent.phone] : [],
    })

    return success(res, { ...(updated as object), notificationDelivery }, 'Student updated through Orbit')
  }

  const currentStudent = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      user: true,
      parentLinks: { include: { parent: true } },
    },
  })
  if (!currentStudent) throw new ApiError(404, 'Student not found')

  if (payload.studentNumber) {
    const duplicateStudentNumber = await prisma.studentProfile.findFirst({
      where: {
        id: { not: studentId },
        studentNumber: payload.studentNumber,
      },
      select: { studentNumber: true },
    })
    if (duplicateStudentNumber) {
      throw new ApiError(409, `Student number already exists: ${payload.studentNumber}`)
    }
  }

  if (payload.email) {
    const duplicateStudentEmail = await prisma.user.findFirst({
      where: {
        id: { not: currentStudent.userId },
        email: payload.email,
      },
      select: { email: true },
    })
    if (duplicateStudentEmail) {
      throw new ApiError(409, `Student email already exists: ${payload.email}`)
    }
  }

  const student = await prisma.$transaction(async (tx) => {
    if (payload.firstName !== undefined || payload.middleName !== undefined || payload.lastName !== undefined || payload.email !== undefined) {
      await tx.user.update({
        where: { id: currentStudent.userId },
        data: {
          ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
          ...(payload.middleName !== undefined ? { middleName: payload.middleName || null } : {}),
          ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
          ...(payload.email !== undefined ? { email: payload.email } : {}),
        },
      })
    }

    return tx.studentProfile.update({
      where: { id: studentId },
      data: {
        ...(payload.studentNumber !== undefined ? { studentNumber: payload.studentNumber } : {}),
        ...(payload.grade !== undefined ? { grade: payload.grade } : {}),
        ...(payload.section !== undefined ? { section: payload.section } : {}),
        ...(payload.status !== undefined ? { status: payload.status.toLowerCase() } : {}),
      },
      include: {
        user: true,
        parentLinks: { include: { parent: true } },
      },
    })
  })
  const notificationDelivery = await deliverStudentUpdate({
    studentUserId: student.userId,
    studentEmail: student.user.email,
    studentName: `${student.user.firstName} ${student.user.lastName}`.trim(),
    parentUserIds: student.parentLinks.map((link) => link.parent.id),
    parentEmails: student.parentLinks.map((link) => link.parent.email).filter(Boolean),
    parentPhones: student.parentLinks.map((link) => link.parent.phone).filter(Boolean) as string[],
  })

  return success(res, { ...student, notificationDelivery }, 'Student updated successfully')
}))

studentsRouter.delete('/:id', authenticate, requireSuperAdmin(), asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.id)

  if (orbitRegistryIsEnabled()) {
    const directory = await getSharedDirectoryFromOrbit()
    const target = directory.students.find((student) => student.id === studentId)
    if (!target) throw new ApiError(404, 'Student not found')

    await deleteRegistryEntityInOrbit('student', studentId, env.KCS_ORBIT_ORGANIZATION_ID!, 'orbitId')
    await prisma.user.deleteMany({
      where: {
        role: 'STUDENT',
        OR: [
          ...(target.accessCode ? [{ accessCode: target.accessCode }] : []),
          ...(target.email ? [{ email: target.email }] : []),
        ],
      },
    })
    return success(res, { id: studentId, deleted: true }, 'Student deleted through Orbit')
  }

  const student = await prisma.studentProfile.findUnique({ where: { id: studentId } })
  if (!student) throw new ApiError(404, 'Student not found')

  await prisma.user.delete({ where: { id: student.userId } })
  return success(res, { id: studentId }, 'Student deleted')
}))
