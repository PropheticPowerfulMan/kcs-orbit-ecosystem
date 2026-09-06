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
    const dynamicRules: Array<[RegExp, string]> = [
      [/^To (.+)$/, 'A $1'], [/^From (.+)$/, 'De $1'], [/^(\d+) unread$/, '$1 non lu(s)'],
      [/^Due (.+)$/, 'Echeance : $1'], [/^Max (.+) points$/, 'Maximum : $1 points'],
      [/^(\d+) student\(s\)$/, '$1 eleve(s)'],
      [/^(\d+) enrolled$/, '$1 inscrit(s)'],
      [/^(\d+) active students in the school$/, '$1 élève(s) actif(s) dans l’école'],
      [/^(\d+)\/(\d+) selected$/, '$1/$2 sélectionné(s)'],
      [/^Save (\d+) enrolled$/, 'Enregistrer $1 inscrit(s)'],
      [/^Comment applied to (\d+) visible learner\(s\)\. Save the draft to persist it\.$/, 'Commentaire appliqué à $1 élève(s) visible(s). Enregistrez le brouillon pour le conserver.'],
      [/^Submission blocked: (\d+) learner\(s\) have no calculated grade or approved override\.$/, 'Soumission bloquée : $1 élève(s) n’ont ni note calculée ni dérogation approuvée.'],
      [/^Submission blocked: explain every manual override before submission \((\d+) learner\(s\)\)\.$/, 'Soumission bloquée : justifiez chaque dérogation manuelle avant la soumission ($1 élève(s)).'],
      [/^(\d+) final grade\(s\) submitted\. The session is now read-only pending administrative review\.$/, '$1 note(s) finale(s) soumise(s). La session est maintenant en lecture seule dans l’attente de l’examen administratif.'],
      [/^Final grade for (.+)$/, 'Note finale de $1'],
      [/^Override reason for (.+)$/, 'Justification de la dérogation pour $1'],
      [/^Teacher comment for (.+)$/, 'Commentaire de l’enseignant pour $1'],
      [/^(\d+) visible of (\d+) enrolled learners$/, '$1 visibles sur $2 élèves inscrits'],
      [/^Apply to (\d+)$/, 'Appliquer à $1'],
      [/^(\d+) enrolled - (\d+) available$/, '$1 inscrits - $2 disponibles'],
      [/^(\d+) credit hour\(s\) - (\d+) enrolled$/, '$1 heure(s) de crédit - $2 inscrits'],
      [/^Verified indicators: (\d+) graded item\(s\), (\d+) attendance record\(s\), and (\d+) overdue assignment\(s\)\.$/, 'Indicateurs vérifiés : $1 élément(s) noté(s), $2 présence(s) enregistrée(s) et $3 devoir(s) en retard.'],
      [/^(.+) updated for (.+); (\d+) official student\(s\) enrolled\.$/, '$1 mis à jour pour $2 ; $3 élève(s) officiel(s) inscrit(s).'],
      [/^(.+) created for (.+); (\d+) official student\(s\) enrolled\.$/, '$1 créé pour $2 ; $3 élève(s) officiel(s) inscrit(s).'],
      [/^(.+) column added and saved\. Final grades recalculated\.$/, 'Colonne $1 ajoutée et enregistrée. Notes finales recalculées.'],
    ]
    for (const [pattern, replacement] of dynamicRules) {
      if (pattern.test(trimmed)) return value.replace(trimmed, trimmed.replace(pattern, replacement))
    }
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
    const reverseDynamicRules: Array<[RegExp, string]> = [
      [/^Commentaire appliqué à (\d+) élève\(s\) visible\(s\)\. Enregistrez le brouillon pour le conserver\.$/, 'Comment applied to $1 visible learner(s). Save the draft to persist it.'],
      [/^Soumission bloquée : (\d+) élève\(s\) n’ont ni note calculée ni dérogation approuvée\.$/, 'Submission blocked: $1 learner(s) have no calculated grade or approved override.'],
      [/^Soumission bloquée : justifiez chaque dérogation manuelle avant la soumission \((\d+) élève\(s\)\)\.$/, 'Submission blocked: explain every manual override before submission ($1 learner(s)).'],
      [/^(\d+) note\(s\) finale\(s\) soumise\(s\)\. La session est maintenant en lecture seule dans l’attente de l’examen administratif\.$/, '$1 final grade(s) submitted. The session is now read-only pending administrative review.'],
      [/^(\d+) inscrit\(s\)$/, '$1 enrolled'],
      [/^(\d+) élève\(s\) actif\(s\) dans l’école$/, '$1 active students in the school'],
      [/^(\d+)\/(\d+) sélectionné\(s\)$/, '$1/$2 selected'],
      [/^Enregistrer (\d+) inscrit\(s\)$/, 'Save $1 enrolled'],
      [/^Note finale de (.+)$/, 'Final grade for $1'],
      [/^Justification de la dérogation pour (.+)$/, 'Override reason for $1'],
      [/^Commentaire de l’enseignant pour (.+)$/, 'Teacher comment for $1'],
      [/^(\d+) visibles sur (\d+) élèves inscrits$/, '$1 visible of $2 enrolled learners'],
      [/^Appliquer à (\d+)$/, 'Apply to $1'],
      [/^(\d+) inscrits - (\d+) disponibles$/, '$1 enrolled - $2 available'],
      [/^(\d+) heure\(s\) de crédit - (\d+) inscrits$/, '$1 credit hour(s) - $2 enrolled'],
      [/^Indicateurs vérifiés : (\d+) élément\(s\) noté\(s\), (\d+) présence\(s\) enregistrée\(s\) et (\d+) devoir\(s\) en retard\.$/, 'Verified indicators: $1 graded item(s), $2 attendance record(s), and $3 overdue assignment(s).'],
      [/^(.+) mis à jour pour (.+) ; (\d+) élève\(s\) officiel\(s\) inscrit\(s\)\.$/, '$1 updated for $2; $3 official student(s) enrolled.'],
      [/^(.+) créé pour (.+) ; (\d+) élève\(s\) officiel\(s\) inscrit\(s\)\.$/, '$1 created for $2; $3 official student(s) enrolled.'],
      [/^Colonne (.+) ajoutée et enregistrée\. Notes finales recalculées\.$/, '$1 column added and saved. Final grades recalculated.'],
    ]
    for (const [pattern, replacement] of reverseDynamicRules) {
      if (pattern.test(trimmed)) return value.replace(trimmed, trimmed.replace(pattern, replacement))
    }
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
