import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { isDatabaseReady } from './config/runtimeStatus.js'
import { router } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

export const app = express()
app.set('trust proxy', 1)

const authAttempts = new Map<string, { count: number; resetAt: number }>()

const authRateLimit = (windowMs: number, maxFailures: number) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rateLimitedPaths = new Set(['/login', '/register', '/forgot-password', '/reset-password'])
    if (!rateLimitedPaths.has(req.path)) return next()

    const now = Date.now()
    const identifier = String(req.body?.email || req.body?.identifier || '').trim().toLowerCase()
    const key = `${req.ip}:${req.path}:${identifier}`
    const current = authAttempts.get(key)
    if (current && current.resetAt > now && current.count >= maxFailures) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({ success: false, message: 'Too many failed authentication attempts. Please wait and try again.' })
    }
    if (current?.resetAt && current.resetAt <= now) authAttempts.delete(key)

    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        authAttempts.delete(key)
        return
      }
      if (![400, 401, 403, 428].includes(res.statusCode)) return
      const previous = authAttempts.get(key)
      const active = previous && previous.resetAt > Date.now() ? previous : { count: 0, resetAt: Date.now() + windowMs }
      authAttempts.set(key, { count: active.count + 1, resetAt: active.resetAt })
    })
    return next()
  }
}

app.use(helmet())
const frontendOrigin = (() => { try { return new URL(env.FRONTEND_URL).origin } catch { return env.FRONTEND_URL } })()
app.use(cors({ origin: frontendOrigin, credentials: true }))
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

app.use('/api/auth', authRateLimit(15 * 60 * 1000, 10))
app.use('/api', router)
app.use(notFoundHandler)
app.use(errorHandler)
