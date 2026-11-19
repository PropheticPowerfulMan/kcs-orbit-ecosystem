// A provider access code is an alias, never sufficient proof of account ownership.
// Match the official matricule AND the already-linked Orbit identity, in addition
// to the verified provider email. Password verification remains in the caller.
type LocalStudent = {role: string; orbitUserId?: string | null; email: string}
type ProviderIdentity = {provider?: string; role: string; email: string; institutionalStudentNumber?: string}
type OfficialStudent = {id: string; studentNumber?: string | null; email?: string | null; status?: string | null}
const normalized = (value?: string | null) => (value || '').trim().toLowerCase()

export function isVerifiedInstitutionalStudentAlias(local: LocalStudent, studentNumber: string | null | undefined, external: ProviderIdentity, students: OfficialStudent[]): boolean {
  if (local.role !== 'STUDENT' || external.role !== 'STUDENT' || external.provider !== 'SAVANEX' || !local.orbitUserId) return false
  const matricule = normalized(external.institutionalStudentNumber)
  if (!/^kcs-stu-[a-z0-9]{6,40}$/.test(matricule) || normalized(studentNumber) !== matricule) return false
  const email = normalized(external.email)
  if (!email || normalized(local.email) !== email) return false
  const matches = students.filter(student => normalized(student.studentNumber) === matricule)
  if (matches.length !== 1) return false
  const official = matches[0]
  return official.id === local.orbitUserId && normalized(official.email) === email
    && ['active', 'enrolled'].includes(normalized(official.status))
}
