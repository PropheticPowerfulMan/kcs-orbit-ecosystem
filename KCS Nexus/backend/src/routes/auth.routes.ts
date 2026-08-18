import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { env } from '../config/env.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { sendSchoolMail } from '../utils/mail.js'
import { buildSafeUser, signAccessToken, signRefreshToken } from '../utils/tokens.js'
import { ensureUserAccessCodeColumn, isMissingAccessCodeColumnError } from '../utils/userAccessCode.js'
import { generateTotpSecret, verifyTotp } from '../utils/totp.js'

const RESET_TOKEN_TTL_MINUTES = 30
const RESET_TOKEN_BYTES = 32
const PASSWORD_RESET_RESPONSE = 'If an account exists, a reset link will be sent.'

function generateAccessCode(role: string) {
  return `ACC-${role.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function normalizeAccessCode(value: string | undefined) {
  return (value || '').trim().toUpperCase()
}

function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function buildPasswordResetUrl(token: string) {
  const baseUrl = env.FRONTEND_URL.replace(/\/$/, '')
  return `${baseUrl}/login?resetToken=${encodeURIComponent(token)}`
}

function buildPasswordResetEmail(firstName: string, resetUrl: string) {
  const text = [
    `Hello ${firstName},`,
    '',
    'A password reset was requested for your KCS Nexus account.',
    `Use this secure link within ${RESET_TOKEN_TTL_MINUTES} minutes: ${resetUrl}`,
    '',
    'If you did not request this, ignore this message and contact the school administration.',
  ].join('\n')

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <p>Hello ${firstName},</p>
      <p>A password reset was requested for your KCS Nexus account.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Reset password</a></p>
      <p>This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p>
      <p>If you did not request this, ignore this message and contact the school administration.</p>
    </div>
  `

  return { text, html }
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
  twoFactorCode: z.string().regex(/^\d{6}$/).optional(),
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
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.KCS_ORBIT_API_KEY! },
      body: JSON.stringify({ identifier, password }),
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
      if (user.twoFactorEnabled) {
        if (!user.twoFactorSecret || !payload.twoFactorCode || !verifyTotp(user.twoFactorSecret, payload.twoFactorCode)) {
          throw new ApiError(428, payload.twoFactorCode ? 'Invalid two-factor authentication code' : 'Two-factor authentication code required')
        }
      }
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

  const localAuthOnly = req.header('x-kcs-local-auth-only') === 'true'
  const externalUser = localAuthOnly ? null : await authenticateWithSharedProviders(identifier, payload.password)
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
  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

  if (user?.passwordHash && !isConfiguredSuperAdminUser(user.id)) {
    const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('base64url')
    const tokenHash = hashResetToken(rawToken)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000)

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: { tokenHash, userId: user.id, expiresAt },
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'auth.password_reset_requested',
          targetType: 'User',
          targetId: user.id,
          metadata: { email: normalizedEmail, expiresAt: expiresAt.toISOString() },
        },
      }),
    ])

    const resetUrl = buildPasswordResetUrl(rawToken)
    const emailContent = buildPasswordResetEmail(user.firstName, resetUrl)
    const result = await sendSchoolMail({
      to: user.email,
      subject: 'KCS Nexus password reset',
      text: emailContent.text,
      html: emailContent.html,
    })

    if (!result.sent) {
      console.warn(`[auth] Password reset link for ${user.email}: ${resetUrl}`)
    }
  }

  return success(res, null, PASSWORD_RESET_RESPONSE)
}))

authRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const schema = z.object({ token: z.string().min(1), password: z.string().min(8) })
  const { token, password } = schema.parse(req.body)
  const tokenHash = hashResetToken(token)
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date() || !resetToken.user.passwordHash) {
    throw new ApiError(400, 'Password reset link is invalid or expired')
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } }),
    prisma.auditLog.create({
      data: {
        actorId: resetToken.userId,
        action: 'auth.password_reset_completed',
        targetType: 'User',
        targetId: resetToken.userId,
        metadata: { email: resetToken.user.email },
      },
    }),
  ])

  return success(res, null, 'Password reset completed')
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

authRouter.put('/profile', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const profileSchema = z.object({
    firstName: z.string().min(1).optional(),
    middleName: z.string().nullable().optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().optional(),
    avatar: z.string().optional(),
    bio: z.string().optional(),
  })
  const data = profileSchema.parse(req.body)

  if (isConfiguredSuperAdminUser(req.user!.sub)) {
    const adminUser = buildConfiguredSuperAdminUser()
    const updated = { ...adminUser, ...data }
    return success(res, updated, 'Profile updated successfully')
  }

  const updated = await prisma.user.update({
    where: { id: req.user!.sub },
    data: {
      ...(data.firstName ? { firstName: data.firstName.trim() } : {}),
      ...(data.middleName !== undefined ? { middleName: data.middleName?.trim() || null } : {}),
      ...(data.lastName ? { lastName: data.lastName.trim() } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
      ...(data.avatar !== undefined ? { avatar: data.avatar } : {}),
    },
  })

  if (data.bio && updated.role === 'TEACHER') {
    await prisma.teacherProfile.updateMany({
      where: { userId: updated.id },
      data: { bio: data.bio.trim() },
    })
  }

  return success(res, buildSafeUser(updated), 'Profile updated successfully')
}))

authRouter.put('/email', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    newEmail: z.string().email(),
    currentPassword: z.string().min(1).optional(),
  })
  const { newEmail, currentPassword } = schema.parse(req.body)

  if (isConfiguredSuperAdminUser(req.user!.sub)) {
    throw new ApiError(403, 'Configured super admin email cannot be modified from the API')
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } })
  if (!user) throw new ApiError(404, 'User not found')

  if (user.passwordHash) {
    if (!currentPassword) throw new ApiError(400, 'Current password is required to change the email address')
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) throw new ApiError(400, 'Invalid current password')
  }

  const duplicate = await prisma.user.findFirst({
    where: { email: newEmail.toLowerCase().trim(), NOT: { id: user.id } },
  })
  if (duplicate) throw new ApiError(409, 'This email address is already registered')

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { email: newEmail.toLowerCase().trim() },
  })

  return success(res, buildSafeUser(updated), 'Email address updated successfully')
}))

authRouter.post('/2fa/setup', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (isConfiguredSuperAdminUser(req.user!.sub)) throw new ApiError(403, 'Configured super admin 2FA is managed through deployment settings')
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } })
  if (!user) throw new ApiError(404, 'User not found')
  const secret = generateTotpSecret()
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false, twoFactorVerifiedAt: null } })
  const label = encodeURIComponent(`KCS Nexus:${user.email}`)
  const issuer = encodeURIComponent('KCS Nexus')
  return success(res, { secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}` }, 'Two-factor authentication setup created')
}))

authRouter.post('/2fa/toggle', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ enabled: z.boolean() })
  const { enabled } = schema.parse(req.body)
  if (enabled) throw new ApiError(400, 'Use the 2FA setup and verification flow before enabling protection')
  if (isConfiguredSuperAdminUser(req.user!.sub)) throw new ApiError(403, 'Configured super admin 2FA is managed through deployment settings')
  await prisma.user.update({ where: { id: req.user!.sub }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorVerifiedAt: null } })
  return success(res, { enabled: false, status: 'DISABLED' }, 'Two-factor authentication disabled')
}))

authRouter.post('/2fa/verify', authenticate, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ code: z.string().min(6).max(6) })
  const { code } = schema.parse(req.body)
  if (isConfiguredSuperAdminUser(req.user!.sub)) throw new ApiError(403, 'Configured super admin 2FA is managed through deployment settings')
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } })
  if (!user?.twoFactorSecret) throw new ApiError(400, 'Start two-factor authentication setup first')
  if (!verifyTotp(user.twoFactorSecret, code)) throw new ApiError(400, 'Invalid or expired two-factor authentication code')
  const updated = await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorVerifiedAt: new Date() } })
  return success(res, { verified: true, enabled: updated.twoFactorEnabled }, 'Two-factor authentication enabled successfully')
}))
