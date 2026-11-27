import {privateSyllabusUploadStatus} from './utils/privateSyllabusUpload.js'
import {processClassroomWebhook,authorizeMedia} from './services/remoteLearning.service.js'
import {asyncHandler} from './utils/api.js'
import {juryRouter} from './jury/routes.js'
import {uploadRoot} from './utils/uploadStorage.js'
import {publishedSchoolCalendarRouter} from './routes/published-school-calendar.routes.js'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'node:path'
import { env } from './config/env.js'
import { isDatabaseReady } from './config/runtimeStatus.js'
import { router } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

export const app = express()
app.set('trust proxy', 1)
app.disable('x-powered-by')

const authAttempts = new Map<string, { count: number; resetAt: number }>()

const authRateLimit = (windowMs: number, maxFailures: number) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rateLimitedPaths = new Set(['/login', '/register', '/forgot-password', '/reset-password','/application/login','/application/change-password','/application/forgot-password','/application/reset-password'])
    if (!rateLimitedPaths.has(req.path)) return next()

    const now = Date.now()
    const identifier = String(req.body?.email || req.body?.identifier || '').trim().toLowerCase()
    const application=req.path.startsWith('/application/')&&['KCS_SENTINEL','KCS_ACADEMY','KCS_KITCHEN'].includes(req.body?.application)?req.body.application:'KCS_NEXUS'
    const key = [req.ip,application,req.path,identifier].join(':')
    const recoveryBudget=req.path.endsWith('/forgot-password')
    const current = authAttempts.get(key)
    if (current && current.resetAt > now && current.count >= maxFailures) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      const retryAfterMinutes = Math.max(1, Math.ceil(retryAfter / 60))
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({ success: false, retryAfterSeconds: retryAfter, retryAfterMinutes, message: `Trop de tentatives. Réessayez dans ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? 's' : ''}. / Too many attempts. Try again in ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? 's' : ''}.` })
    }
    if (current?.resetAt && current.resetAt <= now) authAttempts.delete(key)

    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && !recoveryBudget) {
        authAttempts.delete(key)
        return
      }
      if (![400, 401, 403, 428].includes(res.statusCode) && !(recoveryBudget&&res.statusCode===200)) return
      const previous = authAttempts.get(key)
      const active = previous && previous.resetAt > Date.now() ? previous : { count: 0, resetAt: Date.now() + windowMs }
      authAttempts.set(key, { count: active.count + 1, resetAt: active.resetAt })
      if (authAttempts.size > 5_000) {
        const cleanupNow = Date.now()
        for (const [attemptKey, attempt] of authAttempts) if (attempt.resetAt <= cleanupNow) authAttempts.delete(attemptKey)
      }
    })
    return next()
  }
}

app.use(helmet())
// Published dates are public across the school apps; private API CORS stays unchanged.
app.use('/api/published-school-calendar',cors({origin:'*',credentials:false}),publishedSchoolCalendarRouter)
const frontendOrigin = (() => { try { return new URL(env.FRONTEND_URL).origin } catch { return env.FRONTEND_URL } })()
const trustedOrigins = new Set([
  frontendOrigin,
  'https://kinshasachristianschool.org',
  'https://kcsparentelection.kinshasachristianschool.org',
])
if(process.env.JURY_ENABLED==='true'&&process.env.JURY_PUBLIC_URL)trustedOrigins.add(new URL(process.env.JURY_PUBLIC_URL).origin)
app.use(cors({
  origin(origin, callback) {
    if (!origin || trustedOrigins.has(origin)) return callback(null, true)
    return callback(new Error('Origin not allowed by KCS Nexus CORS policy'))
  },
  credentials: true,
}))
app.post('/api/learning/media-webhook',express.raw({type:'application/webhook+json',limit:'256kb'}),asyncHandler(async(req,res)=>{if(!Buffer.isBuffer(req.body))return res.status(400).end();await processClassroomWebhook(req.body.toString('utf8'),req.get('Authorization'));return res.status(204).end()}))
app.get('/api/learning/media-authorize',asyncHandler(async(req,res)=>{await authorizeMedia(req.get('X-KCS-Classroom-Token')||'');return res.status(204).end()}))
app.use(express.json({ limit: '8mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))
// Approved election profiles are rendered on the school's separate election origin.
app.use('/api/uploads/elections',(_req,res,next)=>{res.setHeader('Cross-Origin-Resource-Policy','cross-origin');next()})
app.use('/api/uploads', (req,res,next)=>{const status=privateSyllabusUploadStatus(req.path);if(status)return res.status(status).json({success:false,message:'File unavailable'});return next()})
app.use('/api/uploads', express.static(uploadRoot, { immutable: true, maxAge: '7d', fallthrough: true }), notFoundHandler)

app.get('/health', (_req, res) => {
  const databaseReady = isDatabaseReady()
  res.status(databaseReady ? 200 : 503).json({
    success: true,
    message: databaseReady ? 'KCS Nexus API healthy' : 'KCS Nexus API running in degraded mode',
    databaseReady,
  })
})

app.use('/api/auth', authRateLimit(15 * 60 * 1000, 10))
if(process.env.JURY_ENABLED==='true')app.use('/api/jury',juryRouter)
app.use('/api', router)
app.use(notFoundHandler)
app.use(errorHandler)
