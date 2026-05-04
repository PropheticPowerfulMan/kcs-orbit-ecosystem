import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { globalFrenchText } from '@/i18n/globalText'

const textAttributes = ['aria-label', 'placeholder', 'title']
const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA'])
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
  if (!(node instanceof HTMLElement) || ignoredTags.has(node.tagName) || node.isContentEditable) {
    return
  }

  // Keep React-owned text nodes untouched. Mutating them outside React can crash
  // route changes with DOM reconciliation errors after logout/login role swaps.
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

  useEffect(() => {
    let scheduled = 0

    const run = () => {
      scheduled = 0
      translateNode(document.body, i18n.resolvedLanguage?.startsWith('fr') ? 'fr' : 'en')
    }

    const schedule = () => {
      if (scheduled) return
      scheduled = window.requestAnimationFrame(run)
    }

    schedule()

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: textAttributes,
    })

    i18n.on('languageChanged', schedule)

    return () => {
      if (scheduled) window.cancelAnimationFrame(scheduled)
      observer.disconnect()
      i18n.off('languageChanged', schedule)
    }
  }, [i18n])

  return null
}

export default GlobalTextTranslator
