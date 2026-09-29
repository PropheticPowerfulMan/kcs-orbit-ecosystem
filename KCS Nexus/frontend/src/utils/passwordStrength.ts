export const PASSWORD_MIN_LENGTH = 14

export type PasswordCheck = {
  key: string
  passed: boolean
  fr: string
  en: string
}

const normalize = (value: string) => value.normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
const forbidden = ['password', 'motdepasse', 'passw0rd', 'qwerty', 'azerty', '123456', 'admin', 'welcome', 'bienvenue', 'kinshasa', 'christian', 'school']

export function evaluatePassword(password: string, identityValues: Array<string | null | undefined> = []) {
  const compact = normalize(password)
  const personalFragments = identityValues
    .flatMap((value) => String(value || '').split(/[@.\s_-]+/))
    .map(normalize)
    .filter((value) => value.length >= 4)
  const checks: PasswordCheck[] = [
    { key: 'length', passed: password.length >= PASSWORD_MIN_LENGTH, fr: `${PASSWORD_MIN_LENGTH} caractères minimum`, en: `At least ${PASSWORD_MIN_LENGTH} characters` },
    { key: 'lower', passed: /[a-z]/.test(password), fr: 'Une lettre minuscule', en: 'One lowercase letter' },
    { key: 'upper', passed: /[A-Z]/.test(password), fr: 'Une lettre majuscule', en: 'One uppercase letter' },
    { key: 'number', passed: /[0-9]/.test(password), fr: 'Un chiffre', en: 'One number' },
    { key: 'symbol', passed: /[^A-Za-z0-9\s]/.test(password), fr: 'Un caractère spécial', en: 'One special character' },
    { key: 'spaces', passed: !/\s/.test(password), fr: 'Aucun espace', en: 'No spaces' },
    { key: 'repeat', passed: !/(.)\1\1/i.test(password), fr: 'Pas de triple répétition', en: 'No triple repeated character' },
    { key: 'common', passed: !forbidden.some((value) => compact.includes(normalize(value))), fr: 'Aucun mot ou motif prévisible', en: 'No common word or predictable pattern' },
    { key: 'identity', passed: !personalFragments.some((value) => compact.includes(value)), fr: 'Aucune donnée personnelle', en: 'No personal identity data' },
  ]
  const passed = checks.filter((check) => check.passed).length
  const score = password ? Math.round((passed / checks.length) * 100) : 0
  return { checks, score, strong: Boolean(password) && checks.every((check) => check.passed) }
}
