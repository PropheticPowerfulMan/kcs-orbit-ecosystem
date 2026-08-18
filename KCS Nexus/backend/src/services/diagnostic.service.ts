import {
  DiagnosticDecision,
  DiagnosticDifficulty,
  DiagnosticQuestionType,
  DiagnosticSubject,
  DiagnosticTestStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '../config/prisma.js'

type DiagnosticQuestionForGrading = {
  id: string
  questionText: string
  questionType: DiagnosticQuestionType
  correctAnswer: Prisma.JsonValue | null
  points: number
  difficulty: DiagnosticDifficulty
  competencyTag: string
  explanation?: string | null
}

type DiagnosticAnswerInput = {
  questionId: string
  answer: unknown
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const normalizeAnswer = (value: unknown) => String(value ?? '').trim().toLowerCase()

const unwrapCorrectAnswer = (value: Prisma.JsonValue | null) => {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return (value as { value?: unknown }).value
  }
  return value
}

export const getMasteryLevel = (percentage: number) => {
  if (percentage >= 90) return 'Excellent'
  if (percentage >= 80) return 'Strong'
  if (percentage >= 70) return 'Proficient'
  if (percentage >= 60) return 'Developing'
  if (percentage >= 50) return 'At Risk'
  return 'Critical'
}

export const getRiskLevel = (percentage: number) => {
  if (percentage >= 80) return 'LOW'
  if (percentage >= 60) return 'MEDIUM'
  if (percentage >= 50) return 'HIGH'
  return 'CRITICAL'
}

export const getAcademicDecisionSuggestion = (percentage: number): DiagnosticDecision => {
  if (percentage >= 75) return DiagnosticDecision.ACCEPT_REQUESTED_GRADE
  if (percentage >= 60) return DiagnosticDecision.ACCEPT_WITH_REMEDIATION
  if (percentage >= 50) return DiagnosticDecision.ACADEMIC_INTERVIEW_REQUIRED
  return DiagnosticDecision.RETAKE_TEST
}

const answerIsCorrect = (question: DiagnosticQuestionForGrading, answer: unknown) => {
  if (question.questionType === DiagnosticQuestionType.ESSAY_OPTIONAL) return false
  const expected = unwrapCorrectAnswer(question.correctAnswer)
  if (question.questionType === DiagnosticQuestionType.NUMERIC) {
    const left = Number(answer)
    const right = Number(expected)
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.00001
  }
  if (Array.isArray(expected)) {
    return expected.map(normalizeAnswer).includes(normalizeAnswer(answer))
  }
  return normalizeAnswer(answer) === normalizeAnswer(expected)
}

export function gradeDiagnosticSubmission(input: {
  questions: DiagnosticQuestionForGrading[]
  answers: DiagnosticAnswerInput[]
  startedAt?: Date | string | null
  submittedAt?: Date | string | null
  cohortPercentages?: number[]
}) {
  const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer.answer]))
  const totalPossible = round(input.questions.reduce((sum, question) => sum + Number(question.points || 0), 0))
  let score = 0
  let correctCount = 0
  let wrongCount = 0
  let unansweredCount = 0
  const byCompetency = new Map<string, { possible: number; earned: number; correct: number; total: number }>()
  const byDifficulty = new Map<string, { possible: number; earned: number; correct: number; total: number }>()

  const gradedAnswers = input.questions.map((question) => {
    const answer = answerMap.get(question.id)
    const unanswered = answer === undefined || answer === null || normalizeAnswer(answer) === ''
    const correct = unanswered ? false : answerIsCorrect(question, answer)
    const pointsAwarded = correct ? Number(question.points || 0) : 0
    score += pointsAwarded
    if (unanswered) unansweredCount += 1
    else if (correct) correctCount += 1
    else wrongCount += 1

    const competency = byCompetency.get(question.competencyTag) ?? { possible: 0, earned: 0, correct: 0, total: 0 }
    competency.possible += Number(question.points || 0)
    competency.earned += pointsAwarded
    competency.correct += correct ? 1 : 0
    competency.total += 1
    byCompetency.set(question.competencyTag, competency)

    const difficulty = byDifficulty.get(question.difficulty) ?? { possible: 0, earned: 0, correct: 0, total: 0 }
    difficulty.possible += Number(question.points || 0)
    difficulty.earned += pointsAwarded
    difficulty.correct += correct ? 1 : 0
    difficulty.total += 1
    byDifficulty.set(question.difficulty, difficulty)

    return {
      questionId: question.id,
      answer,
      isCorrect: correct,
      pointsAwarded: round(pointsAwarded),
      feedback: correct ? question.explanation ?? 'Correct.' : question.explanation ?? 'Review this competency.',
    }
  })

  const percentage = totalPossible > 0 ? round((score / totalPossible) * 100) : 0
  const started = input.startedAt ? new Date(input.startedAt).getTime() : Date.now()
  const submitted = input.submittedAt ? new Date(input.submittedAt).getTime() : Date.now()
  const timeUsedMinutes = Math.max(0, round((submitted - started) / 60000))
  const cohort = input.cohortPercentages ?? []
  const mean = cohort.length ? round(cohort.reduce((sum, value) => sum + value, 0) / cohort.length) : percentage
  const variance = cohort.length ? round(cohort.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / cohort.length) : 0
  const standardDeviation = round(Math.sqrt(variance))
  const zScore = standardDeviation > 0 ? round((percentage - mean) / standardDeviation) : 0
  const percentile = cohort.length ? round((cohort.filter((value) => value <= percentage).length / cohort.length) * 100) : 100
  const relativeRank = cohort.length ? [...cohort, percentage].sort((a, b) => b - a).indexOf(percentage) + 1 : 1

  const competencyScores = Object.fromEntries([...byCompetency.entries()].map(([key, value]) => [
    key,
    {
      ...value,
      earned: round(value.earned),
      possible: round(value.possible),
      percentage: value.possible > 0 ? round((value.earned / value.possible) * 100) : 0,
    },
  ]))
  const difficultyScores = Object.fromEntries([...byDifficulty.entries()].map(([key, value]) => [
    key,
    {
      ...value,
      earned: round(value.earned),
      possible: round(value.possible),
      percentage: value.possible > 0 ? round((value.earned / value.possible) * 100) : 0,
    },
  ]))
  const strengths = Object.entries(competencyScores).filter(([, value]) => value.percentage >= 75).map(([key]) => key)
  const weaknesses = Object.entries(competencyScores).filter(([, value]) => value.percentage < 60).map(([key]) => key)

  return {
    gradedAnswers,
    totalPossible,
    score: round(score),
    percentage,
    correctCount,
    wrongCount,
    unansweredCount,
    timeUsedMinutes,
    weightedAverage: percentage,
    masteryLevel: getMasteryLevel(percentage),
    riskLevel: getRiskLevel(percentage),
    competencyScores,
    difficultyScores,
    strengths,
    weaknesses,
    cohort: { mean, variance, standardDeviation, zScore, percentile, relativeRank, cohortSize: cohort.length + 1 },
    suggestedAcademicDecision: getAcademicDecisionSuggestion(percentage),
  }
}

export function buildDiagnosticAiRecommendation(input: {
  subject: DiagnosticSubject
  gradeLevel: string
  percentage: number
  masteryLevel: string
  strengths: string[]
  weaknesses: string[]
}) {
  const support = input.weaknesses.length ? input.weaknesses.join(', ') : 'no critical competency gap detected'
  const strengths = input.strengths.length ? input.strengths.join(', ') : 'foundational effort and test completion'
  return {
    pedagogicalSummary: `${input.subject} diagnostic for ${input.gradeLevel}: ${input.percentage}% (${input.masteryLevel}).`,
    strengths: input.strengths,
    weaknesses: input.weaknesses,
    studentRecommendation: `Keep practicing ${support}; preserve strengths in ${strengths}.`,
    parentRecommendation: 'Support short daily practice and review the official academic office decision once approved.',
    teacherRecommendation: `Use targeted remediation for ${support} before confirming long-term placement.`,
    remediationPlan: input.percentage >= 70 ? 'Light reinforcement for two weeks.' : 'Structured remediation and follow-up assessment within 2-4 weeks.',
    suggestedDecision: getAcademicDecisionSuggestion(input.percentage),
    governanceNote: 'AI recommendation only. Final decision must be approved by the Super Admin.',
  }
}

export async function buildDiagnosticReport(submissionId: string) {
  const submission = await prisma.diagnosticSubmission.findUnique({
    where: { id: submissionId },
    include: {
      test: true,
      answers: { include: { question: true }, orderBy: { createdAt: 'asc' } },
      student: { include: { user: true } },
      enrollmentApplication: true,
      approvals: { include: { actor: true }, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!submission) return null
  const studentName = submission.student
    ? `${submission.student.user.firstName} ${submission.student.user.lastName}`
    : submission.applicantName || (submission.enrollmentApplication ? `${submission.enrollmentApplication.firstName} ${submission.enrollmentApplication.lastName}` : 'Applicant')
  return {
    id: submission.id,
    title: 'Diagnostic Assessment Report',
    studentName,
    gradeRequested: submission.enrollmentApplication?.gradeApplying ?? submission.student?.grade ?? submission.test.gradeLevel,
    date: submission.submittedAt?.toISOString() ?? submission.startedAt.toISOString(),
    subject: submission.test.subject,
    score: submission.autoScore,
    percentage: submission.percentage,
    statistics: submission.statistics,
    aiRecommendation: submission.aiRecommendation,
    superAdminDecision: submission.superAdminDecision,
    finalComment: submission.finalComment,
    approval: submission.approvals[0] ?? null,
    officialFooter: 'KCS Nexus AI - Kinshasa Christian School',
  }
}
