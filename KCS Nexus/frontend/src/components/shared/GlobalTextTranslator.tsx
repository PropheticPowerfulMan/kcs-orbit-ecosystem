import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { globalFrenchText } from '@/i18n/globalText'
import { useUIStore } from '@/store/uiStore'

const textAttributes = ['aria-label', 'placeholder', 'title']
const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE'])
const ignoredTextTags = new Set(['TEXTAREA'])
const englishByFrench = Object.fromEntries(Object.entries(globalFrenchText).map(([english, french]) => [french, english]))
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
const frenchByNormalizedEnglish = Object.fromEntries(Object.entries(globalFrenchText).map(([english, french]) => [normalize(english), french]))
const englishByNormalizedFrench = Object.fromEntries(Object.entries(globalFrenchText).map(([english, french]) => [normalize(french), english]))

const translateText = (value: string, language: string) => {
  const trimmed = value.trim()
  if (!trimmed) return value

  if (language === 'fr') {
    if (/^\d+\s+years?\s+experience$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+years?\s+experience/i, ' ans d’expérience'))
    }
    if (/^Step\s+\d+$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/^Step/i, 'Étape'))
    }
    if (/^\d+\s+students$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+students$/i, ' élèves'))
    }
    if (/^\d+\s+spots remaining$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+spots remaining$/i, ' places restantes'))
    }
  } else {
    if (/^\d+\s+ans d/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+ans d.*$/i, ' years experience'))
    }
    if (/^Étape\s+\d+$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/^Étape/i, 'Step'))
    }
    if (/^\d+\s+élèves$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+élèves$/i, ' students'))
    }
    if (/^\d+\s+places restantes$/i.test(trimmed)) {
      return value.replace(trimmed, trimmed.replace(/\s+places restantes$/i, ' spots remaining'))
    }
  }

  const normalized = normalize(trimmed)
  const translated =
    language === 'fr'
      ? globalFrenchText[trimmed] ?? frenchByNormalizedEnglish[normalized]
      : englishByFrench[trimmed] ?? englishByNormalizedFrench[normalized]
  if (!translated) return value

  return value.replace(trimmed, translated)
}

const translateNode = (node: Node, language: string) => {
  if (node instanceof Text) {
    const parent = node.parentElement
    if (!parent || ignoredTags.has(parent.tagName) || ignoredTextTags.has(parent.tagName) || parent.isContentEditable) return

    const next = translateText(node.nodeValue ?? '', language)
    if (next !== node.nodeValue) {
      node.nodeValue = next
    }
    return
  }

  if (!(node instanceof HTMLElement) || ignoredTags.has(node.tagName) || node.isContentEditable) {
    return
  }

  textAttributes.forEach((attribute) => {
    const value = node.getAttribute(attribute)
    if (value) {
      const next = translateText(value, language)
      if (next !== value) {
        node.setAttribute(attribute, next)
      }
    }
  })

  node.childNodes.forEach((child) => translateNode(child, language))
}

const GlobalTextTranslator = () => {
  const { i18n } = useTranslation()
  const language = useUIStore((state) => state.language)
  const setLanguage = useUIStore((state) => state.setLanguage)

  useEffect(() => {
    const normalizedLanguage = language === 'fr' ? 'fr' : 'en'
    const activeLanguage = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('fr') ? 'fr' : 'en'

    document.documentElement.lang = normalizedLanguage

    if (activeLanguage !== normalizedLanguage) {
      void i18n.changeLanguage(normalizedLanguage)
    }
  }, [i18n, language])

  useEffect(() => {
    let scheduled = 0

    const run = () => {
      scheduled = 0
      translateNode(document.body, useUIStore.getState().language === 'fr' ? 'fr' : 'en')
    }

    const schedule = () => {
      if (scheduled) return
      scheduled = window.requestAnimationFrame(run)
    }

    const syncStoreAndSchedule = (nextLanguage: string) => {
      const normalizedLanguage = nextLanguage.startsWith('fr') ? 'fr' : 'en'
      if (useUIStore.getState().language !== normalizedLanguage) {
        setLanguage(normalizedLanguage)
      }
      document.documentElement.lang = normalizedLanguage
      schedule()
    }

    schedule()

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: textAttributes,
    })

    const onStoreLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<{ language?: string }>).detail?.language ?? useUIStore.getState().language
      syncStoreAndSchedule(nextLanguage)
    }

    i18n.on('languageChanged', syncStoreAndSchedule)
    window.addEventListener('kcs-language-change', onStoreLanguageChange)

    return () => {
      if (scheduled) window.cancelAnimationFrame(scheduled)
      observer.disconnect()
      i18n.off('languageChanged', syncStoreAndSchedule)
      window.removeEventListener('kcs-language-change', onStoreLanguageChange)
    }
  }, [i18n, language, setLanguage])

  return null
}

export default GlobalTextTranslator
