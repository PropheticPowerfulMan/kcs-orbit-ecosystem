import { Router } from 'express'
import OpenAI from 'openai'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../config/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler, success } from '../utils/api.js'
import { getRouteParam } from '../utils/request.js'

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null

export const aiRouter = Router()

aiRouter.post('/chat', asyncHandler(async (req, res) => {
  const schema = z.object({ messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string() })), language: z.string().optional() })
  const { messages, language } = schema.parse(req.body)

  if (!openai) {
    return success(res, { response: language === 'fr' ? 'Le service AI est prêt, mais la clé OpenAI n\'est pas configurée.' : 'The AI service is ready, but the OpenAI key is not configured.' })
  }

  const completionMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: 'You are KCS Nexus Assistant, a concise and helpful school platform AI.' },
    ...messages.map((message) => ({ role: message.role, content: message.content })),
  ]

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: completionMessages,
    temperature: 0.6,
  })

  return success(res, { response: completion.choices[0]?.message?.content ?? '' })
}))

aiRouter.post('/tutor', authenticate, asyncHandler(async (req, res) => {
  const schema = z.object({ subject: z.string(), question: z.string(), studentId: z.string().optional() })
  const { subject, question, studentId } = schema.parse(req.body)

  const response = openai
    ? await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are an expert ${subject} tutor for an American international school in Kinshasa. Explain clearly and step by step.` },
          { role: 'user', content: question },
        ],
        temperature: 0.5,
      })
    : null

  if (studentId) {
    await prisma.aITutorSession.create({
      data: {
        studentId,
        subject,
        topic: question.slice(0, 80),
        messages: {
          create: [
            { role: 'user', content: question },
            { role: 'assistant', content: response?.choices[0]?.message?.content ?? 'AI key not configured. Backend scaffold ready.' },
          ],
        },
      },
    })
  }

  return success(res, { response: response?.choices[0]?.message?.content ?? `AI Tutor scaffold ready for ${subject}. Add OPENAI_API_KEY for live responses.` })
}))

aiRouter.post('/quiz', authenticate, asyncHandler(async (req, res) => {
  const schema = z.object({ subject: z.string(), topic: z.string(), difficulty: z.string() })
  const { subject, topic, difficulty } = schema.parse(req.body)

  const quiz = [
    { question: `Explain the core concept of ${topic} in ${subject}.`, difficulty },
    { question: `Apply ${topic} to a real classroom scenario.`, difficulty },
    { question: `What common mistake should a student avoid in ${topic}?`, difficulty },
  ]

  return success(res, { subject, topic, difficulty, questions: quiz })
}))

aiRouter.get('/recommendations/:studentId', authenticate, asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.studentId)
  const recommendations = await prisma.aIRecommendation.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  })
  return success(res, recommendations)
}))

aiRouter.get('/analytics/:studentId', authenticate, asyncHandler(async (req, res) => {
  const studentId = getRouteParam(req.params.studentId)
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: { grades: true, aiRecommendations: true },
  })

  return success(res, {
    studentId,
    overallGPA: student?.gpa ?? 0,
    attendanceRate: student?.attendanceRate ?? 0,
    recommendations: student?.aiRecommendations ?? [],
    trends: student?.grades ?? [],
  })
}))
