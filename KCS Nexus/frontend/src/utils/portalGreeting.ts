import type { Language, User } from '@/types'

export function getUserDisplayName(user: User | null | undefined) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'KCS'
}

export function getLocalizedGreeting(language: Language, date = new Date()) {
  const hour = date.getHours()

  if (language === 'fr') {
    if (hour < 12) return 'Bonjour'
    if (hour < 18) return 'Bon apres-midi'
    return 'Bonsoir'
  }

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function getLocalizedPortalDate(language: Language, date = new Date()) {
  return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
