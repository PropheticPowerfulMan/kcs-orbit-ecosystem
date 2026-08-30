import { Router } from 'express'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { authenticate, requireRoles, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'

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
