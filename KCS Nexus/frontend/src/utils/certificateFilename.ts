type CertificateKind = 'completion' | 'attendance'
type CertificateFilenameInput = { documentType: CertificateKind; grade: string; academicYear: string; studentName: string }
const clean = (value: string) => value.normalize('NFC').replace(/[\u0000-\u001f\u007f/\\<>:"|?*]/g, '-').replace(/\s+/g, ' ').trim()
const filename = (parts: string[]) => parts.map(clean).filter(Boolean).join(' - ').slice(0, 200) + '.pdf'

/** Same class/year/learner order and filename safety as official report cards. */
export function certificateFilename(input: CertificateFilenameInput) {
  return filename([input.documentType === 'attendance' ? 'ATT' : 'CERT', input.grade, input.academicYear, input.studentName])
}
export function attendanceBatchFilename(learners: Array<{ grade: string; studentName: string }>, academicYear: string, language: 'fr' | 'en') {
  if (learners.length === 1) return certificateFilename({ ...learners[0], academicYear, documentType: 'attendance' })
  const grades = [...new Set(learners.map(student => clean(student.grade)).filter(Boolean))]
  return filename(['ATT', grades.length === 1 ? grades[0] : language === 'fr' ? 'Classes multiples' : 'Multiple classes', academicYear, learners.length + (language === 'fr' ? ' élèves' : ' learners')])
}
