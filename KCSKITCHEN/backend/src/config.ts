import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5100),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().default('http://localhost:5174'),
  JWT_SECRET: z.string().min(16),
  NEXUS_API_URL: z.string().url(),
  ORBIT_API_URL: z.string().url(),
  ORBIT_API_KEY: z.string().min(16),
  ORBIT_ORGANIZATION_ID: z.string().min(1),
  QR_SIGNING_SECRET: z.string().min(16),
  DIRECTORY_CACHE_SECONDS: z.coerce.number().int().positive().default(60)
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && value.JWT_SECRET.length < 32) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'A strong JWT secret is required' })
  }
})

export const env = schema.parse(process.env)
