import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { translateInterfaceText } from '@/i18n/interfaceText'
import { useUIStore } from '@/store/uiStore'

const textAttributes = ['aria-label', 'placeholder', 'title', 'alt']
const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE'])
const ignoredTextTags = new Set(['TEXTAREA'])

// Retain each React/source string rather than reverse-translating translated DOM text.
// WeakMaps release detached nodes and do not persist names, drafts or form values.
type SourceText = { source: string; rendered: string }
const textSources = new WeakMap<Text, SourceText>()
const attributeSources = new WeakMap<Element, Map<string, SourceText>>()
const protectedContent = '[data-site-editor],[data-site-authored],[translate="no"],[data-no-translate]'
const project = (current: string, previous: SourceText | undefined, language: string): SourceText => {
  const source = previous && current === previous.rendered ? previous.source : current
  return { source, rendered: translateInterfaceText(source, language) }
}
const translateNode = (node: Node, language: string) => {
  if (node instanceof Text) {
    const parent = node.parentElement
    if (!parent || parent.closest(protectedContent) || ignoredTags.has(parent.tagName.toUpperCase()) || ignoredTextTags.has(parent.tagName.toUpperCase()) || parent.isContentEditable) return
    const next = project(node.nodeValue ?? '', textSources.get(node), language)
    textSources.set(node, next)
    if (next.rendered !== node.nodeValue) node.nodeValue = next.rendered
    return
  }
  if (!(node instanceof Element) || node.closest(protectedContent) || ignoredTags.has(node.tagName.toUpperCase()) || (node instanceof HTMLElement && node.isContentEditable)) return
  const sources = attributeSources.get(node) ?? new Map<string, SourceText>()
  attributeSources.set(node, sources)
  textAttributes.forEach(attribute => {
    const value = node.getAttribute(attribute)
    if (value === null) { sources.delete(attribute); return }
    const next = project(value, sources.get(attribute), language)
    sources.set(attribute, next)
    if (next.rendered !== value) node.setAttribute(attribute, next.rendered)
  })
  // Never write value, checked, href, identifiers or the content of an input/textarea.
  node.childNodes.forEach(child => translateNode(child, language))
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
