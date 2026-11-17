import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 14

const forbiddenFragments = [
  'password', 'motdepasse', 'passw0rd', 'qwerty', 'azerty', '123456',
  'admin', 'welcome', 'bienvenue', 'kinshasa', 'christian', 'school',
]

const normalized = (value: string) => value.normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

export function passwordPolicyIssues(password: string, identityValues: Array<string | null | undefined> = []) {
  const issues: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) issues.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  if (!/[a-z]/.test(password)) issues.push('Add a lowercase letter.')
  if (!/[A-Z]/.test(password)) issues.push('Add an uppercase letter.')
  if (!/[0-9]/.test(password)) issues.push('Add a number.')
  if (!/[^A-Za-z0-9\s]/.test(password)) issues.push('Add a special character.')
  if (/\s/.test(password)) issues.push('Remove spaces and invisible separators.')
  if (/(.)\1\1/i.test(password)) issues.push('Avoid three identical consecutive characters.')

  const compact = normalized(password)
  if (forbiddenFragments.some((fragment) => compact.includes(normalized(fragment)))) {
    issues.push('Avoid common words, school names, keyboard patterns, and predictable sequences.')
  }
  const personalFragments = identityValues
    .flatMap((value) => String(value || '').split(/[@.\s_-]+/))
    .map(normalized)
    .filter((value) => value.length >= 4)
  if (personalFragments.some((fragment) => compact.includes(fragment))) {
    issues.push('Do not include your name, email, or access code.')
  }
  return [...new Set(issues)]
}

export const strongPasswordSchema = z.string().max(128).superRefine((password, context) => {
  passwordPolicyIssues(password).forEach((message) => context.addIssue({ code: z.ZodIssueCode.custom, message }))
})

export function assertPasswordDoesNotContainIdentity(
  password: string,
  user: { firstName?: string | null; middleName?: string | null; lastName?: string | null; email?: string | null; accessCode?: string | null },
) {
  const issues = passwordPolicyIssues(password, [user.firstName, user.middleName, user.lastName, user.email, user.accessCode])
  if (issues.length) return issues
  return []
}
