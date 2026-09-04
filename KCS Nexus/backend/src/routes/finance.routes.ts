import { Router } from 'express'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { KCS_TEST_FAMILY_EXEMPTION_NAME } from '@ecosystem/shared-contracts'

export const financeRouter = Router()

const getEduPayServiceToken = async () => {
  if (env.EDUPAY_SERVICE_TOKEN) return env.EDUPAY_SERVICE_TOKEN
  if (!env.EDUPAY_API_URL || !env.EDUPAY_SERVICE_EMAIL || !env.EDUPAY_SERVICE_PASSWORD) {
    throw new ApiError(503, 'EduPay finance synchronization credentials are not configured.')
  }
  const response = await fetch(`${env.EDUPAY_API_URL.replace(/\/$/, '')}${env.EDUPAY_LOGIN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: env.EDUPAY_SERVICE_EMAIL, password: env.EDUPAY_SERVICE_PASSWORD }),
    signal: AbortSignal.timeout(env.EDUPAY_TIMEOUT_SECONDS * 1000),
  })
  if (!response.ok) throw new ApiError(502, 'EduPay service authentication failed.')
  const payload = await response.json() as { token?: string }
  if (!payload.token) throw new ApiError(502, 'EduPay did not return a service token.')
  return payload.token
}

type EduPayParentOption = {
  id: string
  orbitId?: string | null
  fullName?: string | null
  phone?: string | null
  email?: string | null
  students?: Array<{
    id?: string
    orbitId?: string | null
    externalStudentId?: string | null
    fullName?: string | null
  }>
}

const normalizeIdentity = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase()
const normalizePhone = (value: unknown) => String(value ?? '').replace(/\D/g, '')

const fetchEduPay = async (path: string, serviceToken: string) => {
  const response = await fetch(`${env.EDUPAY_API_URL!.replace(/\/$/, '')}${path}`, {
    headers: { Authorization: `Bearer ${serviceToken}` },
    signal: AbortSignal.timeout(env.EDUPAY_TIMEOUT_SECONDS * 1000),
  })
  return response
}

const normalizeNameTokens = (value: unknown) => String(value ?? '').toLocaleUpperCase().trim().split(' ').filter(Boolean).sort().join(' ')

type ParentAcademicClearance = {
  allowed: boolean
  exempt: boolean
  balance: number | null
  overdueInstallments: number | null
  reason: string
  source: string
  synchronizedAt: string
}
const parentAcademicClearanceCache = new Map<string, { expiresAt: number; value: ParentAcademicClearance }>()
const rememberParentAcademicClearance = (parentUserId: string, value: ParentAcademicClearance) => {
  parentAcademicClearanceCache.set(parentUserId, { expiresAt: Date.now() + 60_000, value })
  return value
}

export const getParentAcademicClearance = async (parentUserId: string) => {
  const cached = parentAcademicClearanceCache.get(parentUserId)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const parent = await prisma.user.findUnique({
    where: { id: parentUserId },
    select: {
      firstName: true, middleName: true, lastName: true, email: true, phone: true, orbitUserId: true,
      parentLinks: { select: { student: { select: { studentNumber: true, user: { select: { firstName: true, middleName: true, lastName: true, orbitUserId: true } } } } } },
    },
  })
  if (!parent) throw new ApiError(404, 'Parent account not found.')
  const parentName = [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' ')
  if (normalizeNameTokens(parentName) === normalizeNameTokens(KCS_TEST_FAMILY_EXEMPTION_NAME)) {
    return rememberParentAcademicClearance(parentUserId, { allowed: true, exempt: true, balance: 0, overdueInstallments: 0, reason: 'Permanent KCS test-family exemption.', source: 'KCS_POLICY', synchronizedAt: new Date().toISOString() })
  }
  if (!env.EDUPAY_API_URL) return rememberParentAcademicClearance(parentUserId, { allowed: false, exempt: false, balance: null, overdueInstallments: null, reason: 'EduPay finance synchronization is unavailable.', source: 'EduPay', synchronizedAt: new Date().toISOString() })

  const serviceToken = await getEduPayServiceToken()
  const directoryResponse = await fetchEduPay('/api/parents/options', serviceToken)
  if (!directoryResponse.ok) throw new ApiError(502, 'EduPay family directory synchronization failed.')
  const directoryPayload = await directoryResponse.json() as unknown
  const directory = Array.isArray(directoryPayload) ? directoryPayload as EduPayParentOption[] : []
  const parentEmail = normalizeIdentity(parent.email)
  const parentPhone = normalizePhone(parent.phone)
  const parentOrbitId = normalizeIdentity(parent.orbitUserId)
  const studentIdentifiers = new Set(parent.parentLinks.flatMap(({ student }) => [normalizeIdentity(student.studentNumber), normalizeIdentity(student.user.orbitUserId)]).filter(Boolean))
  const ranked = directory.map((candidate) => {
    let score = 0
    let strongMatches = 0
    if (parentOrbitId && normalizeIdentity(candidate.orbitId) === parentOrbitId) { score += 1000; strongMatches += 1 }
    if (parentEmail && normalizeIdentity(candidate.email) === parentEmail) { score += 400; strongMatches += 1 }
    if (parentPhone && normalizePhone(candidate.phone) === parentPhone) { score += 300; strongMatches += 1 }
    for (const student of candidate.students ?? []) {
      if ([student.orbitId, student.externalStudentId].some((value) => studentIdentifiers.has(normalizeIdentity(value)))) { score += 500; strongMatches += 1 }
    }
    return { candidate, score, strongMatches }
  }).filter((entry) => entry.strongMatches > 0).sort((left, right) => right.score - left.score)
  if (!ranked.length || (ranked.length > 1 && ranked[0].score === ranked[1].score)) {
    return rememberParentAcademicClearance(parentUserId, { allowed: false, exempt: false, balance: null, overdueInstallments: null, reason: 'No unique securely matching EduPay family account was found.', source: 'EduPay', synchronizedAt: new Date().toISOString() })
  }
  const profileResponse = await fetchEduPay('/api/finance/parents/' + encodeURIComponent(ranked[0].candidate.id) + '/profile', serviceToken)
  if (!profileResponse.ok) throw new ApiError(502, 'EduPay family finance synchronization failed.')
  const snapshot = await profileResponse.json() as { profile?: Record<string, unknown> }
  const balance = Number(snapshot.profile?.totalDebt ?? 0)
  const overdueInstallments = Number(snapshot.profile?.overdueInstallments ?? 0)
  const allowed = balance <= 0 && overdueInstallments <= 0
  return rememberParentAcademicClearance(parentUserId, {
    allowed, exempt: false, balance, overdueInstallments,
    reason: allowed ? 'Financial account is current.' : 'Academic progress is held until all school fees are settled.',
    source: 'EduPay', synchronizedAt: new Date().toISOString(),
  })
}

financeRouter.use(authenticate)

financeRouter.get('/edupay-summary', requireRoles('admin', 'staff'), asyncHandler(async (_req, res) => {
  if (!env.EDUPAY_API_URL) {
    throw new ApiError(503, 'EduPay finance synchronization is not configured. Set EDUPAY_API_URL and EDUPAY_SERVICE_TOKEN on KCS Nexus.')
  }

  const serviceToken = await getEduPayServiceToken()
  const response = await fetch(`${env.EDUPAY_API_URL.replace(/\/$/, '')}/api/finance/overview`, {
    headers: { Authorization: `Bearer ${serviceToken}` },
    signal: AbortSignal.timeout(env.EDUPAY_TIMEOUT_SECONDS * 1000),
  })

  if (!response.ok) {
    throw new ApiError(502, `EduPay finance synchronization failed with status ${response.status}.`)
  }

  const overview = await response.json() as Record<string, unknown>
  const number = (key: string) => Number(overview[key] ?? 0)
  const parentAccounts = Array.isArray(overview.parentDebtAnalytics) ? overview.parentDebtAnalytics : []

  return success(res, {
    source: 'EduPay',
    synchronizedAt: new Date().toISOString(),
    totals: {
      expectedRevenue: number('expectedRevenue'),
      collectedRevenue: number('collectedRevenue') || number('totalRevenue'),
      outstandingDebt: number('outstandingDebt') || number('totalDebt'),
      totalReduction: number('totalReduction'),
      paymentCompletionRate: number('paymentCompletionRate'),
    },
    parentAccounts: parentAccounts.slice(0, 12),
  }, 'EduPay finance overview synchronized')
}))

financeRouter.get('/parent-profile', requireRoles('parent'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!env.EDUPAY_API_URL) {
    throw new ApiError(503, 'EduPay finance synchronization is not configured.')
  }

  const parent = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: {
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      phone: true,
      orbitUserId: true,
      parentLinks: {
        select: {
          student: {
            select: {
              studentNumber: true,
              user: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  orbitUserId: true,
                },
              },
            },
          },
        },
      },
    },
  })
  if (!parent) throw new ApiError(404, 'Parent account not found.')

  const serviceToken = await getEduPayServiceToken()
  const directoryResponse = await fetchEduPay('/api/parents/options', serviceToken)
  if (!directoryResponse.ok) {
    throw new ApiError(502, `EduPay family directory synchronization failed with status ${directoryResponse.status}.`)
  }

  const directoryPayload = await directoryResponse.json() as unknown
  const directory = Array.isArray(directoryPayload) ? directoryPayload as EduPayParentOption[] : []
  const parentEmail = normalizeIdentity(parent.email)
  const parentPhone = normalizePhone(parent.phone)
  const parentOrbitId = normalizeIdentity(parent.orbitUserId)
  const studentIdentifiers = new Set(parent.parentLinks.flatMap(({ student }) => [
    normalizeIdentity(student.studentNumber),
    normalizeIdentity(student.user.orbitUserId),
  ]).filter(Boolean))
  const studentNames = new Set(parent.parentLinks.map(({ student }) => normalizeIdentity([
    student.user.lastName,
    student.user.middleName,
    student.user.firstName,
  ].filter(Boolean).join(' '))).filter(Boolean))

  const ranked = directory.map((candidate) => {
    let score = 0
    let strongMatches = 0
    if (parentOrbitId && normalizeIdentity(candidate.orbitId) === parentOrbitId) { score += 1000; strongMatches += 1 }
    if (parentEmail && normalizeIdentity(candidate.email) === parentEmail) { score += 400; strongMatches += 1 }
    if (parentPhone && normalizePhone(candidate.phone) === parentPhone) { score += 300; strongMatches += 1 }
    for (const student of candidate.students ?? []) {
      if ([student.orbitId, student.externalStudentId].some((value) => studentIdentifiers.has(normalizeIdentity(value)))) {
        score += 500
        strongMatches += 1
      } else if (studentNames.has(normalizeIdentity(student.fullName))) {
        score += 25
      }
    }
    return { candidate, score, strongMatches }
  }).filter((entry) => entry.strongMatches > 0).sort((left, right) => right.score - left.score)

  if (!ranked.length) {
    throw new ApiError(404, 'No securely matching EduPay family account was found. Please contact the finance office.')
  }
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    throw new ApiError(409, 'Several EduPay family accounts match this profile. Please contact the finance office.')
  }

  const profileResponse = await fetchEduPay(`/api/finance/parents/${encodeURIComponent(ranked[0].candidate.id)}/profile`, serviceToken)
  if (!profileResponse.ok) {
    throw new ApiError(502, `EduPay family finance synchronization failed with status ${profileResponse.status}.`)
  }

  const snapshot = await profileResponse.json() as Record<string, unknown> & { agreements?: Array<Record<string, unknown>> }
  const agreements = Array.isArray(snapshot.agreements)
    ? snapshot.agreements.map((agreement) => {
        const publicAgreement = { ...agreement }
        delete publicAgreement.privateNotes
        return publicAgreement
      })
    : []
  res.setHeader('Cache-Control', 'private, no-store')
  return success(res, {
    ...snapshot,
    agreements,
    source: 'EduPay',
    synchronizedAt: new Date().toISOString(),
    portalUrl: 'https://edupay.kinshasachristianschool.org/',
  }, 'Parent finance profile synchronized securely from EduPay')
}))

financeRouter.get('/student-clearance', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!env.EDUPAY_API_URL) {
    throw new ApiError(503, 'EduPay finance synchronization is not configured.')
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: req.user!.sub },
    include: { user: true, parentLinks: { include: { parent: true } } },
  })
  if (!student) throw new ApiError(404, 'Student profile not found')

  const serviceToken = await getEduPayServiceToken()
  const response = await fetch(`${env.EDUPAY_API_URL.replace(/\/$/, '')}/api/finance/overview`, {
    headers: { Authorization: `Bearer ${serviceToken}` },
    signal: AbortSignal.timeout(env.EDUPAY_TIMEOUT_SECONDS * 1000),
  })
  if (!response.ok) throw new ApiError(502, `EduPay finance synchronization failed with status ${response.status}.`)

  const overview = await response.json() as { parentDebtAnalytics?: Array<Record<string, unknown>> }
  const accounts = Array.isArray(overview.parentDebtAnalytics) ? overview.parentDebtAnalytics : []
  const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase()
  const parentNames = student.parentLinks.map(({ parent }) => normalize(`${parent.firstName} ${parent.lastName}`))
  const account = accounts.find((candidate) => parentNames.includes(normalize(candidate.parentName)))
  const balance = Number(account?.totalDebt ?? 0)
  const overdueInstallments = Number(account?.overdueInstallments ?? 0)
  const eligible = Boolean(account) && balance <= 0 && overdueInstallments <= 0

  return success(res, {
    source: 'EduPay',
    synchronizedAt: new Date().toISOString(),
    student: { id: student.id, name: `${student.user.firstName} ${student.user.lastName}` },
    accountMatched: Boolean(account),
    parentName: account?.parentName ?? null,
    balance,
    totalPaid: Number(account?.totalPaid ?? 0),
    overdueInstallments,
    eligible,
    reason: eligible
      ? 'Financial account is current. Report card download is authorized.'
      : !account
        ? 'No matching family account was found in EduPay.'
        : 'The report card is held until the outstanding balance and overdue installments are cleared.',
  }, 'Student financial clearance synchronized from EduPay')
}))
