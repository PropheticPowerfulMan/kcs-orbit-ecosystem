import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { ApiError } from '../utils/api.js'

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, 'Resource not found'))
}

export const errorHandler = (error: Error | ApiError, _req: Request, res: Response, _next: NextFunction) => {
  const isUploadError = error instanceof multer.MulterError
  const statusCode = error instanceof ApiError
    ? error.statusCode
    : isUploadError && error.code === 'LIMIT_FILE_SIZE'
      ? 413
      : isUploadError
        ? 400
        : 500
  const message = isUploadError
    ? error.code === 'LIMIT_FILE_SIZE'
      ? 'Media file exceeds the 10 MB limit'
      : 'Invalid media upload'
    : error.message || 'Internal server error'

  res.status(statusCode).json({ success: false, message })
}
