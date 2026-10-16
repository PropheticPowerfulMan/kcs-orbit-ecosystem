export type FinalGradePropagationSnapshot = {
  expected: number
  savedGrades: number
  officialEnrollments: number
  reportCardDrafts: number
}

export function verifyFinalGradePropagation(snapshot: FinalGradePropagationSnapshot) {
  const issues: string[] = []
  if (snapshot.expected < 1) issues.push('EMPTY_SUBMISSION')
  if (snapshot.savedGrades !== snapshot.expected) issues.push('GRADE_COUNT_MISMATCH')
  if (snapshot.officialEnrollments !== snapshot.expected) issues.push('ENROLLMENT_COUNT_MISMATCH')
  if (snapshot.reportCardDrafts !== snapshot.expected) issues.push('REPORT_CARD_COUNT_MISMATCH')
  return { ok: issues.length === 0, issues }
}

export function isVisibleInSuperAdministrationQueue(publicationStatus: string, principalStatus: string) {
  return publicationStatus === 'READY_FOR_REVIEW' && principalStatus === 'READY_FOR_REVIEW'
}
