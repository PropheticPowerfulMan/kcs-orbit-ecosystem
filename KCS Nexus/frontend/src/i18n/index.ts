import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import fr from './fr'

const getStoredLanguage = () => {
  try {
    const stored = localStorage.getItem('kcs-ui')
    if (stored) {
      const language = JSON.parse(stored).state?.language
      if (language === 'fr' || language === 'en') return language
    }
  } catch {
    // Fall through to the browser language when storage is unavailable.
  }

  if (typeof navigator === 'undefined') return 'en'
  const systemLanguage = navigator.languages?.[0] || navigator.language
  return systemLanguage?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
