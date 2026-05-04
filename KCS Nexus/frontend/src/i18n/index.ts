import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import fr from './fr'

const getStoredLanguage = () => {
  try {
    const stored = localStorage.getItem('kcs-ui')
    if (!stored) return 'en'
    const language = JSON.parse(stored).state?.language
    return language === 'fr' ? 'fr' : 'en'
  } catch {
    return 'en'
  }
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
