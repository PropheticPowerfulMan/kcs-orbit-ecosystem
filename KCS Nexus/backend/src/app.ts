import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { router } from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

export const app = express()

app.use(helmet())
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'KCS Nexus API healthy' })
})

app.use('/api', router)
app.use(notFoundHandler)
app.use(errorHandler)
