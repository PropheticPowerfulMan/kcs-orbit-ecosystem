import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_REFRESH_SECRET: z.string().min(8, 'JWT_REFRESH_SECRET must be at least 8 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SCHOOL_EMAIL: z.string().email().default('kinshasachristianschool@gmail.com'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMS_API_URL: z.string().url().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_USERNAME: z.string().optional(),
  SMS_SENDER: z.string().optional(),
  AFRICASTALKING_API_URL: z.string().url().default('https://api.africastalking.com/version1/messaging'),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
  AFRICASTALKING_SENDER: z.string().optional(),
  KCS_ORBIT_API_URL: z.string().optional(),
  KCS_ORBIT_API_KEY: z.string().optional(),
  KCS_ORBIT_ORGANIZATION_ID: z.string().optional(),
  ACADEMIC_CALENDAR_ORBIT_API_URL: z.string().optional(),
  ACADEMIC_CALENDAR_ORBIT_API_KEY: z.string().optional(),
  ACADEMIC_CALENDAR_ORBIT_ORGANIZATION_ID: z.string().optional(),
  ACADEMY_PUBLIC_URL: z.string().url().optional(),
  ACADEMY_INTEGRATION_KEY: z.string().min(32).optional(),
  EDUPAY_API_URL: z.string().optional(),
  EDUPAY_SERVICE_TOKEN: z.string().optional(),
  EDUPAY_SERVICE_EMAIL: z.string().email().optional(),
  EDUPAY_SERVICE_PASSWORD: z.string().optional(),
  EDUPAY_LOGIN_PATH: z.string().default('/api/auth/login'),
  EDUPAY_TIMEOUT_SECONDS: z.coerce.number().default(15),
  SAVANEX_API_URL: z.string().optional(),
  SAVANEX_LOGIN_PATH: z.string().default('/api/integration/authenticate/'),
  SAVANEX_TIMEOUT_SECONDS: z.coerce.number().default(10),
  SAVANEX_AUTH_API_KEY: z.string().optional(),
  SAVANEX_INTELLIGENCE_API_KEY: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== 'production') return
  const weak = (secret: string) => secret.length < 32 || /change-me|dev-secret|CHANGE_ME/i.test(secret)
  if (weak(value.JWT_SECRET)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'Strong production JWT_SECRET required' })
  }
  if (weak(value.JWT_REFRESH_SECRET)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_REFRESH_SECRET'], message: 'Strong production JWT_REFRESH_SECRET required' })
  }
  if (!value.DATABASE_URL.startsWith('postgresql://') && !value.DATABASE_URL.startsWith('postgres://')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'Production PostgreSQL DATABASE_URL required' })
  }
  if (/localhost|127\.0\.0\.1/.test(value.FRONTEND_URL)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['FRONTEND_URL'], message: 'Production FRONTEND_URL cannot use localhost' })
  }
})

export const env = envSchema.parse(process.env)
