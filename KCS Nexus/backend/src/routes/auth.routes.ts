import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
import { ApiError, asyncHandler, success } from '../utils/api.js'
import { buildSafeUser, signAccessToken, signRefreshToken } from '../utils/tokens.js'

const registerSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'staff', 'teacher', 'student', 'parent']),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

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

  const user = await prisma.user.findUnique({ where: { email: payload.email } })
  if (!user?.passwordHash) {
    throw new ApiError(401, 'Invalid email or password')
  }

  const isValid = await bcrypt.compare(payload.password, user.passwordHash)
  if (!isValid) {
    throw new ApiError(401, 'Invalid email or password')
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
}))

authRouter.post('/google', asyncHandler(async (req, res) => {
  const tokenSchema = z.object({ token: z.string().min(1) })
  tokenSchema.parse(req.body)

  throw new ApiError(501, 'Google OAuth is scaffolded but not configured yet. Add Google credentials to enable it.')
}))

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const refreshSchema = z.object({ refreshToken: z.string().min(1) })
  const { refreshToken } = refreshSchema.parse(req.body)

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
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } })
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  return success(res, buildSafeUser(user))
}))
