import jwt, { type SignOptions } from 'jsonwebtoken'
import type { User } from '@prisma/client'
import { env } from '../config/env.js'

const toJwtDuration = (value: string): SignOptions['expiresIn'] => value as SignOptions['expiresIn']

export const buildSafeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role.toLowerCase(),
  avatar: user.avatar,
  phone: user.phone,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

export const signAccessToken = (user: User) => {
  return jwt.sign({ sub: user.id, role: user.role.toLowerCase() }, env.JWT_SECRET, {
    expiresIn: toJwtDuration(env.JWT_EXPIRES_IN),
  })
}

export const signRefreshToken = (user: User) => {
  return jwt.sign({ sub: user.id, role: user.role.toLowerCase() }, env.JWT_REFRESH_SECRET, {
    expiresIn: toJwtDuration(env.JWT_REFRESH_EXPIRES_IN),
  })
}
