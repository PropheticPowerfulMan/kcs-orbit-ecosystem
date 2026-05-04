import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/api.js'

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, 'Resource not found'))
}

export const errorHandler = (error: Error | ApiError, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = error instanceof ApiError ? error.statusCode : 500

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal server error',
  })
}
