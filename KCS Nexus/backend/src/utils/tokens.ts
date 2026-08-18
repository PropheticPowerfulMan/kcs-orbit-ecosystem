import jwt, { type SignOptions } from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import type { User } from '@prisma/client'
import { env } from '../config/env.js'

const toJwtDuration = (value: string): SignOptions['expiresIn'] => value as SignOptions['expiresIn']

export const buildSafeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  accessCode: user.accessCode,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role.toLowerCase(),
  avatar: user.avatar,
  phone: user.phone,
  twoFactorEnabled: user.twoFactorEnabled,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

export const signAccessToken = (user: User) => {
  return jwt.sign({ sub: user.id, role: user.role.toLowerCase() }, env.JWT_SECRET, {
    expiresIn: toJwtDuration(env.JWT_EXPIRES_IN),
  })
}

export const signRefreshToken = (user: User) => {
  return jwt.sign({ sub: user.id, role: user.role.toLowerCase(), jti: randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: toJwtDuration(env.JWT_REFRESH_EXPIRES_IN),
  })
}
