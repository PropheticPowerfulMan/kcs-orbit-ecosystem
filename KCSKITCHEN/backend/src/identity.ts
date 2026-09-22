type EmployeeDescriptor = {
  employeeType?: string | null
  jobTitle?: string | null
  subject?: string | null
}

export function classifyDirectoryEmployee(person: EmployeeDescriptor) {
  const descriptor = [person.employeeType, person.jobTitle].filter(Boolean).join(' ').toUpperCase()
  if (/(TEACHER|ENSEIGNANT|PROFESSOR|PROFESSEUR)/.test(descriptor)) return 'TEACHER' as const
  if (/(STAFF|EMPLOYEE|ADMIN|DRIVER|GUARD|NURSE|ASSISTANT|CASHIER|ACCOUNTANT|WORKER)/.test(descriptor)) return 'STAFF' as const
  if (person.subject?.trim()) return 'TEACHER' as const
  return person.employeeType?.trim() || person.jobTitle?.trim() ? 'STAFF' as const : 'TEACHER' as const
}
