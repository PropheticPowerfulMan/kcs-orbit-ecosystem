export const evaluatePassword = (password, identityValues = []) => {
  const normalize = (value) => String(value || '').normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const compact = normalize(password)
  const forbidden = ['password', 'motdepasse', 'passw0rd', 'qwerty', 'azerty', '123456', 'admin', 'welcome', 'bienvenue', 'kinshasa', 'christian', 'school']
  const personal = identityValues.flatMap((value) => String(value || '').split(/[@.\s_-]+/)).map(normalize).filter((value) => value.length >= 4)
  const checks = [
    ['14 caractères minimum', password.length >= 14],
    ['Une minuscule', /[a-z]/.test(password)],
    ['Une majuscule', /[A-Z]/.test(password)],
    ['Un chiffre', /[0-9]/.test(password)],
    ['Un caractère spécial', /[^A-Za-z0-9\s]/.test(password)],
    ['Aucun espace', !/\s/.test(password)],
    ['Pas de triple répétition', !/(.)\1\1/i.test(password)],
    ['Aucun motif prévisible', !forbidden.some((value) => compact.includes(normalize(value)))],
    ['Aucune donnée personnelle', !personal.some((value) => compact.includes(value))],
  ]
  const score = password ? Math.round(checks.filter(([, passed]) => passed).length * 100 / checks.length) : 0
  return { checks, score, strong: Boolean(password) && checks.every(([, passed]) => passed) }
}
