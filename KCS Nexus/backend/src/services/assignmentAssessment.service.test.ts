import test from 'node:test'
import assert from 'node:assert/strict'
import { DiagnosticDifficulty, DiagnosticQuestionType } from '@prisma/client'
import { gradeInteractiveAssignment } from './assignmentAssessment.service.js'

const questions = [
  { id: 'q1', questionText: '2 + 2', questionType: DiagnosticQuestionType.NUMERIC, options: null, correctAnswer: 4, points: 2, difficulty: DiagnosticDifficulty.EASY, competencyTag: 'Addition', explanation: '2 + 2 = 4.' },
  { id: 'q2', questionText: 'Select blue', questionType: DiagnosticQuestionType.MULTIPLE_CHOICE, options: ['red', 'blue'], correctAnswer: 'blue', points: 3, difficulty: DiagnosticDifficulty.EASY, competencyTag: 'Colors', explanation: 'Blue is correct.' },
]

test('grades objective answers deterministically', () => {
  const result = gradeInteractiveAssignment({ questions, answers: [{ questionId: 'q1', answer: '4' }, { questionId: 'q2', answer: 'blue' }] })
  assert.equal(result.score, 5)
  assert.equal(result.percentage, 100)
  assert.equal(result.pendingTeacherReview, false)
})

test('never awards points for an incorrect objective answer', () => {
  const result = gradeInteractiveAssignment({ questions, answers: [{ questionId: 'q1', answer: '5' }] })
  assert.equal(result.score, 0)
  assert.equal(result.percentage, 0)
})

test('holds an essay for teacher review when AI is unavailable', () => {
  const result = gradeInteractiveAssignment({ questions: [{ ...questions[0], id: 'essay', questionType: DiagnosticQuestionType.ESSAY_OPTIONAL, correctAnswer: 'Evidence-based rubric' }], answers: [{ questionId: 'essay', answer: 'My response' }] })
  assert.equal(result.pendingTeacherReview, true)
  assert.equal(result.gradedAnswers[0].isCorrect, null)
})
