import fs from 'node:fs'
import path from 'node:path'

type Subject = 'FRENCH' | 'MATHEMATICS'
type Question = {
  id: string
  subject: Subject
  grade: string
  competency: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  points: number
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const masteryLevel = (percentage: number) => {
  if (percentage >= 90) return 'Excellent'
  if (percentage >= 80) return 'Strong'
  if (percentage >= 70) return 'Proficient'
  if (percentage >= 60) return 'Developing'
  if (percentage >= 50) return 'At Risk'
  return 'Critical'
}
const decision = (percentage: number) => {
  if (percentage >= 75) return 'accepted at requested grade'
  if (percentage >= 60) return 'accepted with support/remediation'
  if (percentage >= 50) return 'academic interview necessary'
  return 'test retake requested'
}

const grades = ['Grade 4', 'Grade 6', 'Grade 9']
const subjects: Subject[] = ['FRENCH', 'MATHEMATICS']
const questions: Question[] = grades.flatMap((grade) => subjects.flatMap((subject) => [
  { id: `${grade}-${subject}-1`, subject, grade, competency: subject === 'FRENCH' ? 'Reading comprehension' : 'Number sense', difficulty: 'EASY', points: 2 },
  { id: `${grade}-${subject}-2`, subject, grade, competency: subject === 'FRENCH' ? 'Grammar' : 'Problem solving', difficulty: 'MEDIUM', points: 3 },
  { id: `${grade}-${subject}-3`, subject, grade, competency: subject === 'FRENCH' ? 'Written expression' : 'Reasoning', difficulty: 'HARD', points: 5 },
]))

const candidates = Array.from({ length: 10 }, (_, index) => ({
  id: `candidate-${String(index + 1).padStart(2, '0')}`,
  name: ['Amani', 'Naomi', 'David', 'Sarah', 'Joel', 'Grace', 'Nathan', 'Elise', 'Samuel', 'Rachel'][index],
  grade: grades[index % grades.length],
  ability: [0.96, 0.88, 0.77, 0.69, 0.61, 0.54, 0.47, 0.82, 0.73, 0.58][index],
}))

const submissions = candidates.flatMap((candidate) => subjects.map((subject) => {
  const testQuestions = questions.filter((question) => question.grade === candidate.grade && question.subject === subject)
  const totalPossible = testQuestions.reduce((sum, question) => sum + question.points, 0)
  const score = testQuestions.reduce((sum, question, questionIndex) => {
    const difficultyPenalty = question.difficulty === 'HARD' ? 0.15 : question.difficulty === 'MEDIUM' ? 0.07 : 0
    const subjectAdjustment = subject === 'FRENCH' && candidate.id.endsWith('6') ? -0.08 : subject === 'MATHEMATICS' && candidate.id.endsWith('2') ? 0.04 : 0
    const passes = candidate.ability + subjectAdjustment - difficultyPenalty > 0.5 + questionIndex * 0.04
    return sum + (passes ? question.points : 0)
  }, 0)
  const percentage = round((score / totalPossible) * 100)
  return {
    id: `${candidate.id}-${subject}`,
    candidate,
    subject,
    grade: candidate.grade,
    score,
    totalPossible,
    percentage,
    masteryLevel: masteryLevel(percentage),
    riskLevel: percentage >= 80 ? 'LOW' : percentage >= 60 ? 'MEDIUM' : percentage >= 50 ? 'HIGH' : 'CRITICAL',
    decisionSuggestion: decision(percentage),
    strengths: testQuestions.filter((question) => question.difficulty !== 'HARD' || percentage >= 80).map((question) => question.competency),
    weaknesses: testQuestions.filter((question) => percentage < (question.difficulty === 'HARD' ? 90 : 70)).map((question) => question.competency),
    approvedBySuperAdmin: percentage >= 55,
  }
}))

const percentages = submissions.map((submission) => submission.percentage)
const mean = round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length)
const variance = round(percentages.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / percentages.length)
const standardDeviation = round(Math.sqrt(variance))
const enriched = submissions.map((submission) => ({
  ...submission,
  zScore: standardDeviation > 0 ? round((submission.percentage - mean) / standardDeviation) : 0,
  percentile: round((percentages.filter((value) => value <= submission.percentage).length / percentages.length) * 100),
  relativeRank: [...percentages].sort((a, b) => b - a).indexOf(submission.percentage) + 1,
  aiRecommendation: {
    summary: `${submission.candidate.name} scored ${submission.percentage}% in ${submission.subject}.`,
    parentRecommendation: submission.percentage >= 70 ? 'Maintain steady study habits.' : 'Plan guided practice and review with the academic office.',
    teacherRecommendation: submission.weaknesses.length ? `Target ${submission.weaknesses.join(', ')}.` : 'Proceed with enrichment tasks.',
    governance: 'AI does not make final decisions; Super Admin approval is required.',
  },
}))

const report = {
  generatedAt: new Date().toISOString(),
  grades,
  subjects,
  totals: {
    candidates: candidates.length,
    submissions: enriched.length,
    approved: enriched.filter((submission) => submission.approvedBySuperAdmin).length,
    retakeRequested: enriched.filter((submission) => !submission.approvedBySuperAdmin).length,
    mean,
    variance,
    standardDeviation,
  },
  bySubject: subjects.map((subject) => {
    const rows = enriched.filter((submission) => submission.subject === subject)
    return { subject, count: rows.length, average: round(rows.reduce((sum, row) => sum + row.percentage, 0) / rows.length) }
  }),
  submissions: enriched,
}

const reportsDir = path.resolve('reports')
fs.mkdirSync(reportsDir, { recursive: true })
fs.writeFileSync(path.join(reportsDir, 'kcs-nexus-diagnostic-test-report.json'), JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(reportsDir, 'kcs-nexus-diagnostic-test-report.md'), [
  '# KCS Nexus Diagnostic Test Simulation',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  `- Candidates: ${report.totals.candidates}`,
  `- Submissions: ${report.totals.submissions}`,
  `- Cohort mean: ${report.totals.mean}%`,
  `- Standard deviation: ${report.totals.standardDeviation}`,
  `- Approved by Super Admin simulation: ${report.totals.approved}`,
  `- Retake requested: ${report.totals.retakeRequested}`,
  '',
  '## Subject Averages',
  ...report.bySubject.map((row) => `- ${row.subject}: ${row.average}% (${row.count} submissions)`),
  '',
  '## Candidate Decisions',
  ...report.submissions.map((row) => `- ${row.candidate.name} / ${row.grade} / ${row.subject}: ${row.percentage}% (${row.masteryLevel}) - ${row.decisionSuggestion} - z=${row.zScore}`),
  '',
].join('\n'))

console.log(`Diagnostic simulation complete: ${report.totals.submissions} submissions`)
