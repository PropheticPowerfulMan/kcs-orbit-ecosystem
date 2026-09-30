import { DiagnosticDifficulty, DiagnosticQuestionType, type Prisma } from '@prisma/client'
import { z } from 'zod'

export type InteractiveQuestion = {
  id: string
  questionText: string
  questionType: DiagnosticQuestionType
  options: Prisma.JsonValue | null
  correctAnswer: Prisma.JsonValue | null
  points: number
  difficulty: DiagnosticDifficulty
  competencyTag: string
  explanation?: string | null
}

export type InteractiveAnswerInput = { questionId: string; answer: unknown }
export type SubjectiveGrade = { questionId: string; pointsAwarded: number; feedback: string }

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase()
const unwrap = (value: Prisma.JsonValue | null) => value && typeof value === 'object' && !Array.isArray(value) && 'value' in value
  ? (value as { value?: unknown }).value
  : value

const exactMatch = (question: InteractiveQuestion, answer: unknown) => {
  const expected = unwrap(question.correctAnswer)
  if (question.questionType === DiagnosticQuestionType.NUMERIC) {
    const left = Number(answer)
    const right = Number(expected)
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.00001
  }
  if (Array.isArray(expected)) return expected.map(normalize).includes(normalize(answer))
  return normalize(answer) === normalize(expected)
}

export function gradeInteractiveAssignment(input: {
  questions: InteractiveQuestion[]
  answers: InteractiveAnswerInput[]
  subjectiveGrades?: SubjectiveGrade[]
}) {
  const answerMap = new Map(input.answers.map((item) => [item.questionId, item.answer]))
  const subjectiveMap = new Map((input.subjectiveGrades ?? []).map((item) => [item.questionId, item]))
  const totalPossible = round(input.questions.reduce((sum, question) => sum + Number(question.points || 0), 0))
  let score = 0
  let pendingTeacherReview = false

  const gradedAnswers = input.questions.map((question) => {
    const answer = answerMap.get(question.id)
    const unanswered = answer === undefined || answer === null || normalize(answer) === ''
    const subjective = question.questionType === DiagnosticQuestionType.ESSAY_OPTIONAL
    const aiGrade = subjectiveMap.get(question.id)
    let pointsAwarded = 0
    let isCorrect: boolean | null = false
    let feedback = unanswered ? 'No answer was submitted.' : question.explanation || 'Review this competency.'

    if (!unanswered && subjective) {
      if (aiGrade) {
        pointsAwarded = Math.max(0, Math.min(question.points, round(aiGrade.pointsAwarded)))
        isCorrect = pointsAwarded >= question.points * 0.6
        feedback = aiGrade.feedback
      } else {
        isCorrect = null
        feedback = 'Teacher review is required for this open response.'
        pendingTeacherReview = true
      }
    } else if (!unanswered) {
      const correct = exactMatch(question, answer)
      isCorrect = correct
      pointsAwarded = correct ? question.points : 0
      feedback = correct ? question.explanation || 'Correct.' : question.explanation || 'Review this answer.'
    }

    score += pointsAwarded
    return { questionId: question.id, answer, isCorrect, pointsAwarded: round(pointsAwarded), feedback }
  })

  const percentage = totalPossible > 0 ? round((score / totalPossible) * 100) : 0
  return { score: round(score), totalPossible, percentage, pendingTeacherReview, gradedAnswers }
}

const generatedQuestionSchema = z.object({
  questionText: z.string().min(3).max(2000),
  questionType: z.nativeEnum(DiagnosticQuestionType),
  options: z.array(z.string().min(1).max(500)).max(8).nullable().optional(),
  correctAnswer: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  points: z.number().positive().max(100),
  difficulty: z.nativeEnum(DiagnosticDifficulty),
  competencyTag: z.string().min(2).max(160),
  explanation: z.string().min(2).max(2000),
})

const generatedAssignmentSchema = z.object({
  title: z.string().min(3).max(180),
  description: z.string().min(3).max(5000),
  questions: z.array(generatedQuestionSchema).min(1).max(50),
})

const jsonFrom = (content: string) => JSON.parse(content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim())
const openAiClient = async () => {
  const [{ default: OpenAI }, { env }] = await Promise.all([import('openai'), import('../config/env.js')])
  return { client: env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null, model: env.OPENAI_MODEL }
}

export async function generateInteractiveAssignmentDraft(input: {
  courseName: string
  grade: string
  topic: string
  objectives?: string
  questionCount: number
  difficulty: DiagnosticDifficulty
  language: 'fr' | 'en'
  questionTypes: DiagnosticQuestionType[]
}) {
  const { client, model } = await openAiClient()
  if (!client) return null
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.25,
    max_tokens: 3500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are KCS Nexus Assessment Designer for an American international school. Build rigorous, age-appropriate assessments. Return only JSON. Every objective item must have an unambiguous correct answer. Multiple-choice options must be plausible and include the correct answer exactly. Open-response rubrics must be placed in correctAnswer and explanation. Never include student personal data. A teacher must review the draft before publication.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          instruction: `Create exactly ${input.questionCount} questions in ${input.language === 'fr' ? 'French' : 'English'}.`,
          course: input.courseName,
          grade: input.grade,
          topic: input.topic,
          learningObjectives: input.objectives || 'Assess accurate understanding and application.',
          difficulty: input.difficulty,
          allowedQuestionTypes: input.questionTypes,
          outputShape: { title: 'string', description: 'string', questions: [{ questionText: 'string', questionType: 'allowed type', options: ['strings or null'], correctAnswer: 'string, number, boolean, or accepted strings', points: 'positive number', difficulty: 'EASY|MEDIUM|HARD', competencyTag: 'string', explanation: 'marking explanation or rubric' }] },
        }),
      },
    ],
  })
  const content = completion.choices[0]?.message?.content
  if (!content) return null
  const parsed = generatedAssignmentSchema.parse(jsonFrom(content))
  for (const question of parsed.questions) {
    if (question.questionType === DiagnosticQuestionType.MULTIPLE_CHOICE) {
      if (!question.options || question.options.length < 2) throw new Error('AI returned a multiple-choice question without enough options')
      if (!question.options.some((option) => normalize(option) === normalize(question.correctAnswer))) throw new Error('AI returned a multiple-choice answer outside its options')
    }
  }
  return { ...parsed, source: `openai:${model}` }
}

export async function gradeSubjectiveAssignmentAnswers(input: {
  questions: InteractiveQuestion[]
  answers: InteractiveAnswerInput[]
}) {
  const { client, model } = await openAiClient()
  if (!client || !input.questions.length) return []
  const answerMap = new Map(input.answers.map((item) => [item.questionId, item.answer]))
  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 1800,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a strict KCS grading assistant. Grade only against the supplied rubric and maximum points. Give concise, constructive feedback. Do not infer identity or add facts. Return JSON only. Scores must remain between zero and the question maximum. The teacher retains final authority.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          questions: input.questions.map((question) => ({ id: question.id, prompt: question.questionText, rubric: question.correctAnswer, explanation: question.explanation, maxPoints: question.points, studentAnswer: answerMap.get(question.id) ?? null })),
          outputShape: { grades: [{ questionId: 'string', pointsAwarded: 'number', feedback: 'string' }] },
        }),
      },
    ],
  })
  const content = completion.choices[0]?.message?.content
  if (!content) return []
  const schema = z.object({ grades: z.array(z.object({ questionId: z.string(), pointsAwarded: z.number(), feedback: z.string().min(1).max(2000) })) })
  return schema.parse(jsonFrom(content)).grades
}
