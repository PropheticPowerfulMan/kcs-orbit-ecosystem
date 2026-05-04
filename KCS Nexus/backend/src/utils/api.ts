import type { NextFunction, Request, Response } from 'express'

export class ApiError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

export const asyncHandler = <T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  handler: T
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next)
  }
}

export const success = <T>(res: Response, data: T, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  })
}
