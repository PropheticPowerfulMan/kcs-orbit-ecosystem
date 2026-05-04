import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { ApiError } from '../utils/api.js'

type AuthPayload = {
  sub: string
  role: 'admin' | 'staff' | 'teacher' | 'student' | 'parent'
}

export type AuthenticatedRequest = Request & {
  user?: AuthPayload
}

export const authenticate = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication required'))
  }

  try {
    const token = header.replace('Bearer ', '')
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload
    req.user = payload
    next()
  } catch {
    next(new ApiError(401, 'Invalid or expired token'))
  }
}

export const requireRoles = (...roles: AuthPayload['role'][]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(403, 'Insufficient permissions'))
    }

    if (req.user.role === 'admin' || roles.includes(req.user.role)) {
      return next()
    }

    return next(new ApiError(403, 'Insufficient permissions'))
  }
}

export const requireAdmin = () => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== 'admin') {
      return next(new ApiError(403, 'Administrator permissions required'))
    }

    next()
  }
}
