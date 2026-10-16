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

export function buildLocalInteractiveAssignmentDraft(input: {
  courseName: string
  grade: string
  topic: string
  objectives?: string
  questionCount: number
  difficulty: DiagnosticDifficulty
  language: 'fr' | 'en'
  questionTypes: DiagnosticQuestionType[]
}) {
  const fr = input.language === 'fr'
  const objective = input.objectives?.trim() || (fr ? `Comprendre et appliquer ${input.topic}.` : `Understand and apply ${input.topic}.`)
  const types = input.questionTypes.length ? input.questionTypes : [DiagnosticQuestionType.SHORT_ANSWER]
  const questions = Array.from({ length: input.questionCount }, (_, index) => {
    const questionType = types[index % types.length]
    const number = index + 1
    const base = {
      difficulty: input.difficulty,
      competencyTag: input.topic.slice(0, 150),
      points: 10,
      explanation: fr ? `Réponse à vérifier selon l’objectif : ${objective}` : `Review against this objective: ${objective}`,
    }
    if (questionType === DiagnosticQuestionType.MULTIPLE_CHOICE) {
      const correctAnswer = fr ? 'Une réponse démontrant une compréhension correcte' : 'An answer demonstrating correct understanding'
      return { ...base, questionType, questionText: fr ? `${number}. Quelle proposition décrit le mieux ${input.topic} ?` : `${number}. Which statement best describes ${input.topic}?`, options: [correctAnswer, fr ? 'Une affirmation sans rapport' : 'An unrelated statement', fr ? 'Une généralisation incorrecte' : 'An incorrect generalization', fr ? 'Une réponse sans justification' : 'An unsupported answer'], correctAnswer }
    }
    if (questionType === DiagnosticQuestionType.TRUE_FALSE) return { ...base, questionType, questionText: fr ? `${number}. Vrai ou faux : expliquez si l’affirmation principale sur ${input.topic} est correcte.` : `${number}. True or false: decide whether the central statement about ${input.topic} is correct.`, options: null, correctAnswer: true }
    if (questionType === DiagnosticQuestionType.NUMERIC) return { ...base, questionType, questionText: fr ? `${number}. Donnez le nombre d’étapes minimales attendues dans votre démonstration de ${input.topic}.` : `${number}. Give the minimum number of steps expected in your demonstration of ${input.topic}.`, options: null, correctAnswer: 3 }
    const essay = questionType === DiagnosticQuestionType.ESSAY_OPTIONAL
    return { ...base, questionType, questionText: essay ? (fr ? `${number}. Analysez ${input.topic} avec un exemple, des preuves et une conclusion.` : `${number}. Analyze ${input.topic} with an example, evidence, and a conclusion.`) : (fr ? `${number}. Expliquez avec vos propres mots un principe essentiel de ${input.topic}.` : `${number}. Explain one essential principle of ${input.topic} in your own words.`), options: null, correctAnswer: essay ? objective : input.topic }
  })
  return {
    title: fr ? `${input.courseName} · Évaluation : ${input.topic}` : `${input.courseName} · Assessment: ${input.topic}`,
    description: fr ? `Questionnaire préparé pour ${input.grade}. Objectif : ${objective} Le professeur doit relire et adapter chaque question avant publication.` : `Assessment prepared for ${input.grade}. Objective: ${objective} The teacher must review and adapt every question before publishing.`,
    questions,
    source: 'kcs-nexus:local-assessment-engine',
  }
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
  if (!client) return buildLocalInteractiveAssignmentDraft(input)
  try {
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
    if (!content) return buildLocalInteractiveAssignmentDraft(input)
    const parsed = generatedAssignmentSchema.parse(jsonFrom(content))
    for (const question of parsed.questions) {
      if (question.questionType === DiagnosticQuestionType.MULTIPLE_CHOICE) {
        if (!question.options || question.options.length < 2) throw new Error('AI returned a multiple-choice question without enough options')
        if (!question.options.some((option) => normalize(option) === normalize(question.correctAnswer))) throw new Error('AI returned a multiple-choice answer outside its options')
      }
    }
    return { ...parsed, source: `openai:${model}` }
  } catch (error) {
    console.warn('[assignment-ai] OpenAI draft unavailable; using the local KCS assessment engine.', error)
    return buildLocalInteractiveAssignmentDraft(input)
  }
}

export async function gradeSubjectiveAssignmentAnswers(input: {
  questions: InteractiveQuestion[]
  answers: InteractiveAnswerInput[]
}) {
  const localGrades = () => {
    const answerMap = new Map(input.answers.map((item) => [item.questionId, item.answer]))
    const meaningfulTokens = (value: unknown) => normalize(value).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 4)
    return input.questions.map((question) => {
      const answer = String(answerMap.get(question.id) ?? '').trim()
      if (!answer) return { questionId: question.id, pointsAwarded: 0, feedback: 'No response was submitted. Teacher review remains available.' }
      const words = answer.split(/\s+/).filter(Boolean)
      const rubricTokens = [...new Set(meaningfulTokens(unwrap(question.correctAnswer)))]
      const answerTokens = new Set(meaningfulTokens(answer))
      const coverage = rubricTokens.length ? rubricTokens.filter((token) => answerTokens.has(token)).length / rubricTokens.length : 0.5
      const effort = Math.min(1, words.length / 90)
      const structured = /(?:because|therefore|for example|evidence|conclusion|parce que|donc|par exemple|preuve|conclusion)/i.test(answer) ? 1 : 0.45
      const ratio = Math.min(1, Math.max(0.1, effort * 0.35 + coverage * 0.45 + structured * 0.2))
      const pointsAwarded = round(question.points * ratio)
      return {
        questionId: question.id,
        pointsAwarded,
        feedback: `KCS provisional rubric score: effort ${Math.round(effort * 100)}%, rubric coverage ${Math.round(coverage * 100)}%, structure ${Math.round(structured * 100)}%. The teacher may revise this score before Gradebook transfer.`,
      }
    })
  }
  const { client, model } = await openAiClient()
  if (!input.questions.length) return []
  if (!client) return localGrades()
  const answerMap = new Map(input.answers.map((item) => [item.questionId, item.answer]))
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a strict KCS grading assistant. Grade only against the supplied rubric and maximum points. Reward demonstrated reasoning and effort without inventing knowledge. Give concise, constructive feedback. Do not infer identity or add facts. Return JSON only. Scores must remain between zero and the question maximum. The teacher retains final authority.',
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
    if (!content) return localGrades()
    const schema = z.object({ grades: z.array(z.object({ questionId: z.string(), pointsAwarded: z.number(), feedback: z.string().min(1).max(2000) })) })
    return schema.parse(jsonFrom(content)).grades
  } catch (error) {
    console.warn('[assignment-ai] Subjective grading unavailable; using the auditable local rubric engine.', error)
    return localGrades()
  }
}
