import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { asyncHandler, success } from '../utils/api.js'
import { sendAcademicEventToSavanex } from '../utils/savanex-intelligence.js'

export const intelligenceRouter = Router()

const academicEventSchema = z.object({
  id: z.string().optional(),
  eventType: z.enum([
    'grade',
    'score',
    'assessment',
    'exam',
    'quiz',
    'assignment',
    'homework',
    'project',
    'competency',
    'pedagogy',
    'recommendation',
    'risk',
    'ai',
  ]).default('assessment'),
  studentId: z.string().optional(),
  studentExternalId: z.string().optional(),
  studentNumber: z.string().optional(),
  studentName: z.string().optional(),
  subject: z.string().min(1),
  title: z.string().optional(),
  score: z.number().optional(),
  maxScore: z.number().optional(),
  percentage: z.number().optional(),
  term: z.string().optional(),
  teacherName: z.string().optional(),
  riskLevel: z.string().optional(),
  recommendation: z.string().optional(),
  feedback: z.string().optional(),
})

intelligenceRouter.post('/academic-events', authenticate, requireRoles('admin', 'teacher'), asyncHandler(async (req, res) => {
  const payload = academicEventSchema.parse(req.body)
  const delivery = await sendAcademicEventToSavanex(payload)
  return success(res, delivery, delivery.delivered ? 'Academic signal delivered to SAVANEX Intelligence' : 'Academic signal prepared')
}))
