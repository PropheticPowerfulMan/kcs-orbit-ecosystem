import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { isDatabaseReady } from './config/runtimeStatus.js'
import { router } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

export const app = express()

const authAttempts = new Map<string, { count: number; resetAt: number }>()

const authRateLimit = (windowMs: number, max: number) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Session maintenance is not an authentication attempt. Counting refresh
    // and profile requests eventually locks out an otherwise valid session.
    const rateLimitedPaths = new Set(['/login', '/register', '/forgot-password', '/reset-password'])
    if (!rateLimitedPaths.has(req.path)) return next()

    const now = Date.now()
    const key = `${req.ip}:${req.path}:${String(req.body?.email || req.body?.identifier || '').toLowerCase()}`
    const current = authAttempts.get(key)

    if (!current || current.resetAt <= now) {
      authAttempts.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (current.count >= max) {
      return res.status(429).json({
        success: false,
        message: 'Too many authentication attempts. Please wait and try again.',
      })
    }

    current.count += 1
    authAttempts.set(key, current)
    return next()
  }
}

app.use(helmet())
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '8mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.get('/health', (_req, res) => {
  const databaseReady = isDatabaseReady()
  res.status(databaseReady ? 200 : 503).json({
    success: true,
    message: databaseReady ? 'KCS Nexus API healthy' : 'KCS Nexus API running in degraded mode',
    databaseReady,
  })
})

app.use('/api/auth', authRateLimit(15 * 60 * 1000, 20))
app.use('/api', router)
app.use(notFoundHandler)
app.use(errorHandler)
