import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { buildSafeUser, signAccessToken, signRefreshToken } from '../utils/tokens.js'
import { ensureUserAccessCodeColumn, isMissingAccessCodeColumnError } from '../utils/userAccessCode.js'

function generateAccessCode(role: string) {
  return `ACC-${role.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function normalizeAccessCode(value: string | undefined) {
  return (value || '').trim().toUpperCase()
}

function splitFullName(fullName: string) {
  const normalized = fullName.trim()
  const [firstName, ...lastNameParts] = normalized.split(/\s+/).filter(Boolean)
  return {
    firstName: firstName || 'Shared',
    lastName: lastNameParts.join(' ') || 'User',
  }
}

function mapSavanexRole(role: string | undefined) {
  const normalized = (role || '').trim().toLowerCase()
  if (normalized === 'admin') return 'ADMIN' as const
  if (normalized === 'employee') return 'STAFF' as const
  if (normalized === 'teacher') return 'TEACHER' as const
  if (normalized === 'student') return 'STUDENT' as const
  if (normalized === 'parent') return 'PARENT' as const
  return null
}

function mapEduPayRole(role: string | undefined) {
  const normalized = (role || '').trim().toUpperCase()
  if (!normalized) return null
  if (['SUPER_ADMIN', 'OWNER', 'ADMIN'].includes(normalized)) return 'ADMIN' as const
  if (['FINANCIAL_MANAGER', 'ACCOUNTANT', 'CASHIER', 'HR_MANAGER', 'AUDITOR'].includes(normalized)) return 'STAFF' as const
  if (normalized === 'PARENT') return 'PARENT' as const
  return null
}

function mapEduPayStaffFunction(role: string | undefined) {
  const normalized = (role || '').trim().toUpperCase()
  if (normalized === 'ACCOUNTANT') return 'accountant'
  if (normalized === 'HR_MANAGER') return 'office'
  if (normalized === 'FINANCIAL_MANAGER') return 'principal'
  if (normalized === 'CASHIER') return 'office'
  if (normalized === 'AUDITOR') return 'discipline'
  return null
}

function savanexAuthIsEnabled() {
  return Boolean(env.SAVANEX_API_URL)
}

function edupayAuthIsEnabled() {
  return Boolean(env.EDUPAY_API_URL)
}

async function generateUniqueAccessCode(role: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const accessCode = generateAccessCode(role)
    const existing = await prisma.user.findUnique({ where: { accessCode } })
    if (!existing) {
      return accessCode
    }
  }

  return `ACC-${role.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
}

type ExternalUserProfile = {
  email: string
  accessCode: string
  role: 'ADMIN' | 'STAFF' | 'TEACHER' | 'STUDENT' | 'PARENT'
  firstName: string
  lastName: string
  permissions?: string[]
  staffFunction?: string | null
}

const registerSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'staff', 'teacher', 'student', 'parent']),
})

const loginSchema = z.object({
  identifier: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  password: z.string().min(6),
}).refine((value) => Boolean(value.identifier?.trim() || value.email?.trim()), {
  message: 'Email or access code is required',
  path: ['identifier'],
})

const configuredSuperAdmin = {
  id: 'configured-superadmin',
  email: process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com',
  password: process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!',
  firstName: process.env.SUPERADMIN_FIRSTNAME || 'Super',
  lastName: process.env.SUPERADMIN_LASTNAME || 'Admin',
  role: 'admin' as const,
}

function loginConfiguredSuperAdmin(payload: z.infer<typeof loginSchema>) {
  const identifier = (payload.identifier ?? payload.email ?? '').trim().toLowerCase()
  if (
    identifier !== configuredSuperAdmin.email.toLowerCase() ||
    payload.password !== configuredSuperAdmin.password
  ) {
    return null
  }

  const user = {
    id: configuredSuperAdmin.id,
    email: configuredSuperAdmin.email,
    accessCode: 'ACC-ADM-SUPER1',
    firstName: configuredSuperAdmin.firstName,
    lastName: configuredSuperAdmin.lastName,
    role: configuredSuperAdmin.role,
    avatar: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return {
    user,
    token: jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] }),
    refreshToken: jwt.sign({ sub: user.id, role: user.role }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] }),
  }
}

function isConfiguredSuperAdminUser(userId?: string) {
  return userId === configuredSuperAdmin.id
}

function buildConfiguredSuperAdminUser() {
  return {
    id: configuredSuperAdmin.id,
    email: configuredSuperAdmin.email,
    accessCode: 'ACC-ADM-SUPER1',
    firstName: configuredSuperAdmin.firstName,
    lastName: configuredSuperAdmin.lastName,
    role: configuredSuperAdmin.role,
    avatar: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

async function authenticateWithSavanex(identifier: string, password: string) {
  if (!savanexAuthIsEnabled()) {
    return null
  }

  const loginUrl = `${env.SAVANEX_API_URL!.replace(/\/$/, '')}${env.SAVANEX_LOGIN_PATH}`
  let response: Response
  try {
    response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: identifier, password }),
      signal: AbortSignal.timeout(env.SAVANEX_TIMEOUT_SECONDS * 1000),
    })
  } catch (error) {
    throw new ApiError(503, 'Shared authentication is temporarily unavailable')
  }

  if ([400, 401, 403, 404].includes(response.status)) {
    return null
  }

  if (!response.ok) {
    throw new ApiError(503, 'Shared authentication is temporarily unavailable')
  }

  const payload = await response.json().catch(() => ({} as Record<string, unknown>))
  const externalUser = (payload as { user?: Record<string, unknown> }).user || {}
  const mappedRole = mapSavanexRole(typeof externalUser.role === 'string' ? externalUser.role : undefined)
  if (!mappedRole) {
    return null
  }

  const fullName = typeof externalUser.full_name === 'string' && externalUser.full_name.trim()
    ? externalUser.full_name.trim()
    : 'Shared User'
  const name = splitFullName(fullName)
  const accessCode = normalizeAccessCode(
    typeof externalUser.access_code === 'string' ? externalUser.access_code : identifier,
  )
  const email = typeof externalUser.email === 'string' && externalUser.email.trim()
    ? externalUser.email.trim().toLowerCase()
    : `${accessCode.toLowerCase()}@savanex.local`

  return {
    email,
    accessCode,
    role: mappedRole,
    firstName: name.firstName,
    lastName: name.lastName,
    permissions: ['ecosystem:savanex', `savanex:${mappedRole.toLowerCase()}`],
    staffFunction: mappedRole === 'STAFF' ? 'office' : null,
  }
}

async function authenticateWithEduPay(identifier: string, password: string): Promise<ExternalUserProfile | null> {
  if (!edupayAuthIsEnabled()) {
    return null
  }

  const loginUrl = `${env.EDUPAY_API_URL!.replace(/\/$/, '')}${env.EDUPAY_LOGIN_PATH}`
  let response: Response
  try {
    response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
      signal: AbortSignal.timeout(env.EDUPAY_TIMEOUT_SECONDS * 1000),
    })
  } catch {
    throw new ApiError(503, 'EduPay shared authentication is temporarily unavailable')
  }

  if ([400, 401, 403, 404].includes(response.status)) {
    return null
  }

  if (!response.ok) {
    throw new ApiError(503, 'EduPay shared authentication is temporarily unavailable')
  }

  const payload = await response.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>
  const mappedRole = mapEduPayRole(typeof payload.role === 'string' ? payload.role : undefined)
  if (!mappedRole) {
    return null
  }

  const fullName = typeof payload.fullName === 'string' && payload.fullName.trim()
    ? payload.fullName.trim()
    : 'EduPay User'
  const name = splitFullName(fullName)
  const accessCode = normalizeAccessCode(typeof payload.accessCode === 'string' ? payload.accessCode : identifier)
  const email = identifier.includes('@')
    ? identifier.trim().toLowerCase()
    : `${accessCode.toLowerCase()}@edupay.local`
  const sourceRole = typeof payload.role === 'string' ? payload.role.trim().toUpperCase() : mappedRole

  return {
    email,
    accessCode,
    role: mappedRole,
    firstName: name.firstName,
    lastName: name.lastName,
    permissions: ['ecosystem:edupay', `edupay:${sourceRole.toLowerCase()}`],
    staffFunction: mappedRole === 'STAFF' ? mapEduPayStaffFunction(sourceRole) : null,
  }
}

async function authenticateWithSharedProviders(identifier: string, password: string) {
  try {
    const edupayUser = await authenticateWithEduPay(identifier, password)
    if (edupayUser) {
      return edupayUser
    }
  } catch (error) {
    console.warn('[auth] EduPay shared authentication unavailable; trying other ecosystem providers.', error)
  }

  try {
    return await authenticateWithSavanex(identifier, password)
  } catch (error) {
    console.warn('[auth] SAVANEX shared authentication unavailable.', error)
    throw new ApiError(503, 'Shared ecosystem authentication is temporarily unavailable. Verify KCS Nexus, EduPay, SAVANEX, and KCS Orbit services.')
  }
}

async function upsertExternalUser(externalUser: ExternalUserProfile | null, password: string) {
  if (!externalUser) {
    return null
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: externalUser.email },
        { accessCode: externalUser.accessCode },
      ],
    },
  })

  if (user) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        email: externalUser.email,
        accessCode: externalUser.accessCode,
        role: externalUser.role,
        firstName: externalUser.firstName,
        lastName: externalUser.lastName,
        permissions: externalUser.permissions ?? [],
        staffFunction: externalUser.staffFunction ?? null,
        passwordHash,
      },
    })
  }

  return prisma.user.create({
    data: {
      email: externalUser.email,
      accessCode: externalUser.accessCode,
      role: externalUser.role,
      firstName: externalUser.firstName,
      lastName: externalUser.lastName,
      permissions: externalUser.permissions ?? [],
      staffFunction: externalUser.staffFunction ?? null,
      passwordHash,
    },
  })
}

async function findLocalUserByIdentifier(identifier: string) {
  const normalizedIdentifier = identifier.toLowerCase()
  const query = () => prisma.user.findFirst({
    where: {
      OR: [
        { email: normalizedIdentifier },
        { accessCode: identifier.toUpperCase() },
      ],
    },
  })

  try {
    return await query()
  } catch (error) {
    if (!isMissingAccessCodeColumnError(error)) {
      throw error
    }

    await ensureUserAccessCodeColumn(prisma, true)

    try {
      return await query()
    } catch (retryError) {
      if (!isMissingAccessCodeColumnError(retryError)) {
        throw retryError
      }

      return prisma.user.findFirst({ where: { email: normalizedIdentifier } })
    }
  }
}

export const authRouter = Router()

authRouter.post('/register', asyncHandler(async (req, res) => {
  const payload = registerSchema.parse(req.body)

  const existingUser = await prisma.user.findUnique({ where: { email: payload.email } })
  if (existingUser) {
    throw new ApiError(409, 'A user with this email already exists')
  }

  const passwordHash = await bcrypt.hash(payload.password, 10)
  const user = await prisma.user.create({
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      accessCode: await generateUniqueAccessCode(payload.role),
      passwordHash,
      role: payload.role.toUpperCase() as never,
    },
  })

  const token = signAccessToken(user)
  const refreshToken = signRefreshToken(user)

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return success(res, { user: buildSafeUser(user), token, refreshToken }, 'User registered', 201)
}))

authRouter.post('/login', asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body)
  const configuredLogin = loginConfiguredSuperAdmin(payload)
  if (configuredLogin) {
    return success(res, configuredLogin, 'Login successful')
  }

  const identifier = (payload.identifier ?? payload.email ?? '').trim()
  const user = await findLocalUserByIdentifier(identifier)
  if (user?.passwordHash) {
    const isValid = await bcrypt.compare(payload.password, user.passwordHash)
    if (isValid) {
      const token = signAccessToken(user)
      const refreshToken = signRefreshToken(user)

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      return success(res, { user: buildSafeUser(user), token, refreshToken }, 'Login successful')
    }
  }

  const externalUser = await authenticateWithSharedProviders(identifier, payload.password)
  if (!externalUser) {
    throw new ApiError(401, 'Invalid email or password')
  }

  const resolvedUser = await upsertExternalUser(externalUser, payload.password)
  if (!resolvedUser) {
    throw new ApiError(401, 'Invalid email or password')
  }

  const token = signAccessToken(resolvedUser)
  const refreshToken = signRefreshToken(resolvedUser)

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: resolvedUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return success(res, { user: buildSafeUser(resolvedUser), token, refreshToken }, 'Login successful')
}))

authRouter.post('/google', asyncHandler(async (req, res) => {
  const tokenSchema = z.object({ token: z.string().min(1) })
  tokenSchema.parse(req.body)

  throw new ApiError(501, 'Google OAuth is scaffolded but not configured yet. Add Google credentials to enable it.')
}))

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const refreshSchema = z.object({ refreshToken: z.string().min(1) })
  const { refreshToken } = refreshSchema.parse(req.body)

  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub?: string; role?: string }
    if (isConfiguredSuperAdminUser(payload.sub)) {
      const user = buildConfiguredSuperAdminUser()
      const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] })
      return success(res, { token, user }, 'Token refreshed')
    }
  } catch {
    // Database-backed refresh tokens are handled below.
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  })

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new ApiError(401, 'Refresh token invalid or expired')
  }

  const token = signAccessToken(storedToken.user)
  return success(res, { token, user: buildSafeUser(storedToken.user) }, 'Token refreshed')
}))

authRouter.post('/forgot-password', asyncHandler(async (req, res) => {
  const schema = z.object({ email: z.string().email() })
  const { email } = schema.parse(req.body)
  return success(res, { email }, 'Password reset workflow initiated')
}))

authRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const schema = z.object({ token: z.string().min(1), password: z.string().min(8) })
  schema.parse(req.body)
  return success(res, null, 'Password reset scaffold ready')
}))

authRouter.get('/me', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (isConfiguredSuperAdminUser(req.user!.sub)) {
    return success(res, buildConfiguredSuperAdminUser())
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } })
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  return success(res, buildSafeUser(user))
}))

authRouter.put('/access-code', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (isConfiguredSuperAdminUser(req.user!.sub)) {
    throw new ApiError(403, 'Configured super admin access code cannot be modified from the API')
  }

  const schema = z.object({ accessCode: z.string().min(6).max(24) })
  const { accessCode } = schema.parse(req.body)
  const normalizedAccessCode = accessCode.trim().toUpperCase()

  const duplicate = await prisma.user.findFirst({
    where: {
      accessCode: normalizedAccessCode,
      NOT: { id: req.user!.sub },
    } as any,
    select: { id: true },
  })

  if (duplicate) {
    throw new ApiError(409, 'This access code is already in use')
  }

  const updated = await prisma.user.update({
    where: { id: req.user!.sub },
    data: { accessCode: normalizedAccessCode } as any,
  })

  return success(res, buildSafeUser(updated), 'Access code updated')
}))
