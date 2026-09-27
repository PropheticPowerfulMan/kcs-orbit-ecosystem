import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, FileCheck2, FilterX, History, Loader2, Printer, RefreshCw, Search, ShieldCheck, Upload, X } from 'lucide-react'
import { academicRecordsAPI } from '@/services/api'
import { printOfficialTranscript } from '@/utils/officialTranscriptPrint'
import { printOfficialReportCard, type PrintableReportCard } from '@/utils/officialReportCardPrint'
import { SCHOOL_LEVELS, normalizeSchoolLevel } from '@/constants/schoolLevels'
import { compareClassLabels } from '@/utils/classLabels'
import { useUIStore } from '@/store/uiStore'

type Grade = {
  id: string
  percentage: number
  letterGrade: string
  cycle: { academicYear: string; term: string; status: string }
  student: { user: { firstName: string; lastName: string }; studentNumber: string }
  course: { name: string; code: string; teacher: { user: { firstName: string; lastName: string } } }
}

type Card = PrintableReportCard & {
  approvedAt?: string
  student: PrintableReportCard['student'] & { id: string; transcriptVisible: boolean }
}

type Transcript = {
  student: { name: string; studentNumber: string; grade: string; photoUrl?: string | null }
  rows: Array<{ id: string; percentage: number; letterGrade: string; credits: number; cycle: { academicYear: string; term: string }; course: { name: string; code: string } }>
  summary: { credits: number; cumulativeGpa: number | null; officialRecords: number }
  generatedAt?: string
  dataPolicy: string
}

type RegistryStudent = {
  id: string
  studentNumber?: string
  grade?: string
  section?: string
  status?: string
  officialAvatar?: string | null
  user?: { firstName?: string; middleName?: string | null; lastName?: string; avatar?: string | null }
}

const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const studentName = (student: RegistryStudent) => [student.user?.lastName, student.user?.middleName, student.user?.firstName].filter(Boolean).join(' ') || student.studentNumber || 'Unnamed student'
const cardStudentName = (card: Card) => [card.student.user.lastName, card.student.user.middleName, card.student.user.firstName].filter(Boolean).join(' ')
const validSection = (value: unknown) => {
  const section = String(value ?? '').trim().replace(/\s+/g, ' ')
  return section && !normalizeSchoolLevel(section) ? section : ''
}
const inputClass = 'w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 focus:ring-2 focus:ring-sky-200 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white dark:placeholder:text-slate-400'

const RECORD_CACHE_KEY = 'kcs-academic-records-cache-v2'
const transcriptCacheKey = (studentId: string) => 'kcs-transcript-cache-v2:' + studentId
const readRecordCache = () => {
  try { return JSON.parse(sessionStorage.getItem(RECORD_CACHE_KEY) || '{}') as { grades?: Grade[]; cards?: Card[]; registry?: RegistryStudent[]; savedAt?: string } }
  catch { return {} }
}

export default function AcademicRecordsControlCenterV2() {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [academicYear, setAcademicYear] = useState('2026-2027')

  const [term, setTerm] = useState('Semester 1 · Trimester 1')
  const [grades, setGrades] = useState<Grade[]>(() => readRecordCache().grades ?? [])
  const [cards, setCards] = useState<Card[]>(() => readRecordCache().cards ?? [])
  const [registry, setRegistry] = useState<RegistryStudent[]>(() => readRecordCache().registry ?? [])
  const [cacheSavedAt, setCacheSavedAt] = useState(() => readRecordCache().savedAt ?? '')
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState('ALL')
  const [sectionFilter, setSectionFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [cardQuery, setCardQuery] = useState('')
  const [cardGradeFilter, setCardGradeFilter] = useState('ALL')
  const [transcriptLoadingId, setTranscriptLoadingId] = useState('')
  const [transcriptPrinting, setTranscriptPrinting] = useState(false)
  const [reportPrintingId, setReportPrintingId] = useState('')
  const [legacyFile, setLegacyFile] = useState<File | null>(null)
  const [legacyBusy, setLegacyBusy] = useState(false)
  const [legacyConfirmation, setLegacyConfirmation] = useState('')

  const load = async () => {
    setBusy(true)
    try {
      const [gradeResult, cardResult, registryResult] = await Promise.allSettled([
        academicRecordsAPI.review({ academicYear }),
        academicRecordsAPI.reportCards(),
        academicRecordsAPI.studentRegistry(),
      ])
      const nextGrades = gradeResult.status === 'fulfilled' ? (gradeResult.value.data.data ?? []) : grades
      const nextCards = cardResult.status === 'fulfilled' ? (cardResult.value.data.data ?? []) : cards
      const nextRegistry = registryResult.status === 'fulfilled' && Array.isArray(registryResult.value.data.data) ? registryResult.value.data.data : registry
      setGrades(nextGrades); setCards(nextCards); setRegistry(nextRegistry)
      const failures = [gradeResult, cardResult, registryResult].filter((result) => result.status === 'rejected')
      if (failures.length < 3) {
        const savedAt = new Date().toISOString()
        sessionStorage.setItem(RECORD_CACHE_KEY, JSON.stringify({ grades: nextGrades, cards: nextCards, registry: nextRegistry, savedAt }))
        setCacheSavedAt(savedAt)
      }
      if (registryResult.status === 'rejected') {
        const error: any = registryResult.reason
        const detail = error?.response?.data?.message ?? tr('Le registre officiel des élèves est temporairement indisponible.', 'The official student registry is temporarily unavailable.')
        setNotice(detail + (nextRegistry.length ? tr(' Une copie sécurisée en cache est affichée', ' A secure cached copy is displayed') + (cacheSavedAt ? tr(' depuis ', ' from ') + new Date(cacheSavedAt).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US') : '') + '.' : ''))
      } else if (failures.length) {
        setNotice(tr('Le registre des élèves est disponible. Les indicateurs académiques en cache complètent les sections indisponibles ; Actualiser tentera une nouvelle synchronisation.', 'The student registry is available. Cached academic indicators are filling the unavailable sections; Refresh will synchronize them again.'))
      } else setNotice('')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void load() }, [])

  const matching = useMemo(() => {
    const selected = normalize(term)
    return grades.filter((item) => {
      const recorded = normalize(item.cycle.term)
      return item.cycle.academicYear === academicYear && (recorded === selected || selected.includes(recorded) || recorded.includes(selected))
    })
  }, [academicYear, grades, term])

  const gradeOptions = SCHOOL_LEVELS
  const sectionOptions = useMemo(() => Array.from(new Set(['A', 'B', 'C', ...registry.filter((student) => gradeFilter === 'ALL' || normalizeSchoolLevel(student.grade) === gradeFilter).map((student) => validSection(student.section)).filter(Boolean)])).sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })), [gradeFilter, registry])
  const statusOptions = useMemo(() => Array.from(new Set(registry.map((student) => student.status).filter(Boolean) as string[])).sort(), [registry])

  const visibleRegistry = useMemo(() => {
    const tokens = normalize(studentQuery).split(/\s+/).filter(Boolean)
    return registry.filter((student) => {
      if (gradeFilter !== 'ALL' && normalizeSchoolLevel(student.grade) !== gradeFilter) return false
      if (sectionFilter !== 'ALL' && validSection(student.section) !== sectionFilter) return false
      if (statusFilter !== 'ALL' && normalize(student.status) !== normalize(statusFilter)) return false
      const haystack = normalize([studentName(student), student.studentNumber, student.grade, student.section, student.status].filter(Boolean).join(' '))
      return tokens.every((token) => haystack.includes(token))
    }).sort((left, right) => compareClassLabels(String(left.grade ?? ''), String(right.grade ?? '')) || validSection(left.section).localeCompare(validSection(right.section), 'en', { numeric: true, sensitivity: 'base' }) || studentName(left).localeCompare(studentName(right), 'en', { sensitivity: 'base' }))
  }, [gradeFilter, registry, sectionFilter, statusFilter, studentQuery])

  const visibleCards = useMemo(() => {
    const tokens = normalize(cardQuery).split(/\s+/).filter(Boolean)
    return cards.filter((card) => {
      if (cardGradeFilter !== 'ALL' && normalizeSchoolLevel(card.student.grade) !== cardGradeFilter) return false
      const haystack = normalize([cardStudentName(card), card.student.studentNumber, card.student.grade, card.student.section, card.term, card.publicationStatus].filter(Boolean).join(' '))
      return tokens.every((token) => haystack.includes(token))
    })
  }, [cardGradeFilter, cardQuery, cards])

  const finalStudentCount = new Set(matching.map((item) => item.student.studentNumber)).size
  const courseCount = new Set(matching.map((item) => item.course.code)).size

  const resetSearch = () => {
    setStudentQuery('')
    setGradeFilter('ALL')
    setSectionFilter('ALL')
    setStatusFilter('ALL')
  }

  const generate = async () => {
    if (!matching.length) {
      setNotice(tr('Aucune note finale soumise ne correspond à cette année scolaire et à cette période. Demandez d’abord aux enseignants de soumettre les notes, puis actualisez.', 'No submitted final grade matches this academic year and term. Ask teachers to submit grades first, then refresh.'))
      return
    }
    setBusy(true)
    try {
      const response = await academicRecordsAPI.generateReportCards({ academicYear, term })
      setNotice(language === 'fr' ? `${response.data.data.count} bulletin(s) généré(s) pour examen contrôlé.` : `${response.data.data.count} report card(s) generated for controlled review.`)
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? tr('La génération des bulletins a échoué.', 'Report-card generation failed.'))
    } finally {
      setBusy(false)
    }
  }

  const approve = async (id: string) => {
    setBusy(true)
    try {
      await academicRecordsAPI.approveReportCard(id)
      setNotice(tr('Bulletin approuvé ; les notes officielles ont été figées pour le relevé.', 'Report card approved; official grades were frozen for the transcript.'))
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? tr('L’approbation a échoué.', 'Approval failed.'))
    } finally {
      setBusy(false)
    }
  }

  const publish = async (id: string) => {
    setBusy(true)
    try {
      await academicRecordsAPI.publishReportCard(id)
      setNotice(tr('Le bulletin approuvé a été publié dans les portails de l’élève et du parent.', 'Approved report card published to the student and parent portals.'))
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? tr('La publication a échoué.', 'Publication failed.'))
    } finally {
      setBusy(false)
    }
  }

  const viewTranscript = async (studentId: string) => {
    setTranscriptLoadingId(studentId)
    try {
      const response = await academicRecordsAPI.transcript(studentId)
      const data = response.data.data as Transcript
      setTranscript(data)
      sessionStorage.setItem(transcriptCacheKey(studentId), JSON.stringify({ data, savedAt: new Date().toISOString() }))
    } catch (error: any) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(transcriptCacheKey(studentId)) || '{}')
        if (!cached.data) throw new Error('no cache')
        setTranscript(cached.data)
        setNotice(tr('La synchronisation en direct du relevé est indisponible. Une copie sécurisée en lecture seule du ', 'Live transcript synchronization is unavailable. A secure read-only copy from ') + new Date(cached.savedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US') + tr(' est affichée ; les approbations et publications restent désactivées jusqu’à la reconnexion.', ' is displayed; approvals and publications remain disabled until reconnection.'))
      } catch {
        setNotice(error?.response?.data?.message ?? tr('Relevé indisponible.', 'Transcript unavailable.'))
      }
    } finally {
      setTranscriptLoadingId('')
    }
  }

  const printTranscript = () => {
    if (!transcript || transcriptPrinting) return
    setTranscriptPrinting(true)
    printOfficialTranscript(transcript, setNotice)
    window.setTimeout(() => setTranscriptPrinting(false), 900)
  }

  const printReportCard = (card: Card) => {
    if (reportPrintingId) return
    setReportPrintingId(card.id)
    printOfficialReportCard(card, setNotice)
    window.setTimeout(() => setReportPrintingId(''), 900)
  }

  const downloadLegacyTemplate = async (format: 'csv' | 'xlsx') => {
    setLegacyBusy(true)
    try {
      const response = await academicRecordsAPI.legacyTemplate(format)
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'kcs-legacy-transcript-template.' + format; anchor.click()
      URL.revokeObjectURL(url)
    } catch (error: any) { setNotice(error?.response?.data?.message ?? tr('Le téléchargement du modèle a échoué.', 'Template download failed.')) }
    finally { setLegacyBusy(false) }
  }

  const importLegacyRecords = async () => {
    if (!legacyFile || legacyConfirmation !== 'IMPORT VERIFIED LEGACY RECORDS') {
      setNotice(tr('Choisissez un export QuickSchools vérifié et saisissez exactement la phrase de confirmation.', 'Choose a verified QuickSchools export and type the exact confirmation phrase.'))
      return
    }
    setLegacyBusy(true)
    try {
      const data = new FormData(); data.append('file', legacyFile); data.append('confirmation', legacyConfirmation)
      const response = await academicRecordsAPI.importLegacyRecords(data)
      setNotice(response.data.message + ' · ' + response.data.data.imported + tr(' ligne(s), ', ' row(s), ') + response.data.data.students + tr(' élève(s).', ' learner(s).'))
      setLegacyFile(null); setLegacyConfirmation(''); await load()
    } catch (error: any) { setNotice(error?.response?.data?.message ?? tr('L’importation vérifiée de l’historique a échoué sans modification partielle.', 'Verified legacy import failed without partial changes.')) }
    finally { setLegacyBusy(false) }
  }

  const setTranscriptVisibility = async (studentId: string, visible: boolean) => {
    setBusy(true)
    try {
      await academicRecordsAPI.setTranscriptVisibility(studentId, visible)
      setNotice(visible ? tr('Accès au relevé accordé à l’élève et à ses parents.', 'Transcript access granted to the learner and parents.') : tr('Accès au relevé retiré à l’élève et à ses parents.', 'Transcript access removed from the learner and parents.'))
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? tr('L’accès au relevé n’a pas pu être modifié.', 'Transcript access could not be changed.'))
    } finally {
      setBusy(false)
    }
  }

  return <section className="space-y-5 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:p-5">
    {transcript ? <div className="fixed inset-0 z-[190] flex items-center justify-center bg-kcs-blue-950/80 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={tr('Aperçu du relevé officiel', 'Official transcript preview')} onClick={() => setTranscript(null)}>
      <section className="relative flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-2xl dark:border-kcs-blue-700 dark:bg-kcs-blue-950" onClick={(event) => event.stopPropagation()}>
        <img src="/images/kcs-logo.png" alt="" className="pointer-events-none absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 opacity-[0.035] grayscale"/>
        <header className="relative z-10 flex flex-col gap-3 border-b border-sky-100 bg-white/95 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/95 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">{transcript.student.photoUrl ? <img src={transcript.student.photoUrl} alt={transcript.student.name} className="h-16 w-14 rounded-lg border-2 border-kcs-gold-400 object-cover"/> : <div className="flex h-16 w-14 items-center justify-center rounded-lg border border-dashed border-sky-300 text-xs font-black text-kcs-blue-700 dark:text-sky-200">KCS</div>}<div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.16em] text-kcs-gold-600">{tr('Relevé officiel', 'Official transcript')}</p><h3 className="truncate text-xl font-black text-kcs-blue-950 dark:text-white">{transcript.student.name}</h3><p className="text-sm text-slate-500 dark:text-slate-300">{transcript.student.studentNumber} · {transcript.student.grade}</p></div></div>
          <div className="flex flex-wrap gap-2"><button type="button" aria-busy={transcriptPrinting} disabled={transcriptPrinting} onClick={printTranscript} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-kcs-blue-800 disabled:opacity-60">{transcriptPrinting ? <Loader2 size={17} className="animate-spin"/> : <Printer size={17}/>} {transcriptPrinting ? tr('Préparation du PDF…', 'Preparing PDF…') : tr('Imprimer / Enregistrer le PDF', 'Print / Save PDF')}</button><button type="button" onClick={() => setTranscript(null)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 px-4 py-2.5 text-sm font-bold text-kcs-blue-800 dark:border-kcs-blue-700 dark:text-white"><X size={17}/>{tr('Fermer', 'Close')}</button></div>
        </header>
        <div className="relative z-10 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">{[[tr('Dossiers officiels', 'Official records'), transcript.summary.officialRecords], [tr('Crédits', 'Credits'), transcript.summary.credits], [tr('Moyenne générale', 'GPA'), transcript.summary.cumulativeGpa ?? '—']].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-sky-100 bg-sky-50/90 p-4 text-center dark:border-kcs-blue-700 dark:bg-kcs-blue-900"><p className="text-xs font-black uppercase text-slate-500 dark:text-slate-300">{label}</p><b className="mt-1 block text-2xl text-kcs-blue-950 dark:text-white">{value}</b></div>)}</div>
          {transcript.rows.length ? <div className="mt-5 overflow-x-auto rounded-xl border border-sky-100 dark:border-kcs-blue-800"><table className="min-w-[700px] w-full text-sm"><thead className="bg-kcs-blue-800 text-white"><tr className="text-left"><th className="p-3">{tr('Année scolaire', 'Academic year')}</th><th>{tr('Période', 'Term')}</th><th>{tr('Cours', 'Course')}</th><th>{tr('Crédit', 'Credit')}</th><th>{tr('Moyenne', 'Average')}</th><th>{tr('Note', 'Letter')}</th></tr></thead><tbody>{transcript.rows.map((row) => <tr key={row.id} className="border-b border-sky-100 bg-white text-kcs-blue-950 dark:border-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-white"><td className="p-3">{row.cycle.academicYear}</td><td>{row.cycle.term}</td><td>{row.course.code} · {row.course.name}</td><td>{row.credits}</td><td>{row.percentage.toFixed(2)}%</td><td className="font-black">{row.letterGrade}</td></tr>)}</tbody></table></div> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:bg-amber-200 dark:text-amber-950">{tr('Aucun dossier académique approuvé n’existe encore. Le document officiel indiquera clairement ce statut.', 'No approved academic record exists yet. The official document will clearly show this status.')}</p>}
        </div>
      </section>
    </div> : null}

    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-300"><ShieldCheck size={17}/>{tr('Dossiers académiques officiels', 'Official Academic Records')}</p><h2 className="mt-1 font-display text-2xl font-black text-kcs-blue-950 dark:text-white">{tr('Validation des notes, bulletins et relevés', 'Grade validation, report cards and transcripts')}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{tr('Recherchez dans le registre complet, examinez les bulletins et générez les documents officiels sans quitter cet espace.', 'Search the complete register, review report cards and generate official documents without leaving this workspace.')}</p></div><button disabled={busy} onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-800 dark:border-emerald-700 dark:text-emerald-200"><RefreshCw size={16} className={busy ? 'animate-spin' : ''}/>{tr('Actualiser', 'Refresh')}</button></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className={inputClass} aria-label={tr('Année scolaire', 'Academic year')}/><select value={term} onChange={(event) => setTerm(event.target.value)} className={inputClass} aria-label={tr('Période scolaire', 'Academic term')}><option>Semester 1 · Trimester 1</option><option>Semester 1 · Trimester 2</option><option>Semester 2 · Trimester 3</option><option>Annual final</option></select><div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-kcs-blue-950 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white"><b>{matching.length}</b> {tr('notes finales', 'final grades')} · <b>{finalStudentCount}</b> {tr('élèves', 'students')} · <b>{courseCount}</b> {tr('cours', 'courses')}</div><button disabled={busy} onClick={() => void generate()} className="inline-flex items-center justify-center rounded-xl bg-kcs-blue-700 px-4 py-3 font-black text-white hover:bg-kcs-blue-800 disabled:opacity-50"><FileCheck2 size={17} className="mr-2"/>{tr('Générer les bulletins', 'Generate report cards')}</button></div>
    {notice ? <p className="rounded-xl border border-sky-100 bg-white p-3 text-sm font-semibold text-kcs-blue-900 dark:border-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-white">{notice}</p> : null}

    <div className="flex flex-col gap-3 rounded-2xl border border-kcs-gold-300 bg-kcs-gold-50 p-4 dark:border-kcs-gold-700 dark:bg-kcs-blue-900 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-kcs-gold-700 dark:text-kcs-gold-300">{tr('Bulletins officiels', 'Official report cards')}</p><p className="mt-1 text-sm font-semibold text-kcs-blue-950 dark:text-white">{tr('Ouvrez le registre des bulletins pour examiner, approuver et imprimer le PDF officiel.', 'Open the report-card register to review, approve and print the official PDF.')}</p></div><button type="button" onClick={() => document.getElementById('official-report-cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-gold-400 px-4 py-2.5 text-sm font-black text-kcs-blue-950"><Printer size={17}/>{tr('Ouvrir les bulletins et imprimer', 'Open report cards and print')}</button></div>

    <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-950 sm:p-5">
    <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm dark:border-violet-800 dark:bg-violet-950/20 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="max-w-3xl"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-violet-700 dark:text-violet-300"><History size={17}/>{tr('Dossiers historiques vérifiés · Transition QuickSchools', 'Verified historical records · QuickSchools transition')}</p><h3 className="mt-2 text-xl font-black text-kcs-blue-950 dark:text-white">{tr('Importer l’historique de Grade 9 à 12 sans inventer de résultats', 'Import Grade 9–12 history without inventing results')}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{tr('Utilisez uniquement les exports officiels QuickSchools ou les dossiers scolaires signés. L’importation est atomique, liée au matricule, empreintée, auditable et fusionnée avec les notes Nexus approuvées dans le relevé officiel.', 'Use only official QuickSchools exports or signed school records. The import is all-or-nothing, matched by student ID, fingerprinted, auditable and merged with approved Nexus grades in the official transcript.')}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={legacyBusy} onClick={() => void downloadLegacyTemplate('xlsx')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300 bg-white px-3 py-2 text-sm font-black text-violet-800 dark:bg-kcs-blue-950 dark:text-violet-200"><Download size={16}/>{tr('Modèle Excel', 'Excel template')}</button><button type="button" disabled={legacyBusy} onClick={() => void downloadLegacyTemplate('csv')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300 bg-white px-3 py-2 text-sm font-black text-violet-800 dark:bg-kcs-blue-950 dark:text-violet-200"><Download size={16}/>{tr('Modèle CSV', 'CSV template')}</button></div></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_minmax(18rem,1fr)_auto]"><label className="rounded-xl border border-dashed border-violet-300 bg-white p-3 text-sm font-bold text-kcs-blue-950 dark:bg-kcs-blue-950 dark:text-white"><span className="mb-2 flex items-center gap-2"><Upload size={16}/>{tr('Fichier officiel CSV/XLS/XLSX', 'Official CSV/XLS/XLSX')}</span><input type="file" accept=".csv,.xls,.xlsx" onChange={(event) => setLegacyFile(event.target.files?.[0] ?? null)} className="block w-full text-xs"/></label><label className="text-xs font-bold text-slate-600 dark:text-slate-300">{tr('Confirmation contrôlée', 'Controlled confirmation')}<input value={legacyConfirmation} onChange={(event) => setLegacyConfirmation(event.target.value)} className={inputClass + ' mt-2'} placeholder="IMPORT VERIFIED LEGACY RECORDS"/></label><button type="button" disabled={legacyBusy || !legacyFile || legacyConfirmation !== 'IMPORT VERIFIED LEGACY RECORDS'} onClick={() => void importLegacyRecords()} className="inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{legacyBusy ? <Loader2 size={17} className="animate-spin"/> : <Upload size={17}/>} {tr('Importer l’historique vérifié', 'Import verified history')}</button></div>
    </section>
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-kcs-gold-600">{tr('Recherche précise de relevé', 'Precise transcript finder')}</p><h3 className="mt-1 text-xl font-black text-kcs-blue-950 dark:text-white">{tr('Rechercher un élève et générer immédiatement son relevé', 'Find a learner and generate the transcript immediately')}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{language === 'fr' ? `${visibleRegistry.length} résultat(s) affiché(s) sur ${registry.length} dossiers officiels d’élèves.` : `${visibleRegistry.length} result(s) displayed from ${registry.length} official learner records.`}</p></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1.5fr)_11rem_11rem_11rem_auto]">
        <label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} className={inputClass + ' pl-10'} placeholder={tr('Nom exact, matricule, classe, section…', 'Exact name, student ID, class, section…')}/></label>
        <select value={gradeFilter} onChange={(event) => { setGradeFilter(event.target.value); setSectionFilter('ALL') }} className={inputClass}><option value="ALL">{tr('Toutes les classes', 'All grades')}</option>{gradeOptions.map((grade) => <option key={grade}>{grade}</option>)}</select>
        <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className={inputClass}><option value="ALL">{tr('Toutes les sections', 'All sections')}</option>{sectionOptions.map((section) => <option key={section}>{section}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="ALL">{tr('Tous les statuts', 'All statuses')}</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select>
        <button type="button" onClick={resetSearch} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 px-3 py-2 text-sm font-bold text-kcs-blue-800 dark:border-kcs-blue-700 dark:text-white"><FilterX size={17}/>{tr('Réinitialiser', 'Reset')}</button>
      </div>
      <div className="mt-4 max-h-[31rem] overflow-y-auto pr-1"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleRegistry.map((student) => <article key={student.id} className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-900"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-kcs-blue-950 dark:text-white">{studentName(student)}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">{student.studentNumber || tr('Sans matricule', 'No student ID')} · {[normalizeSchoolLevel(student.grade) || student.grade, validSection(student.section)].filter(Boolean).join(' ') || tr('Classe en attente', 'Class pending')}</p></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-800 dark:bg-emerald-200 dark:text-emerald-950">{student.status || tr('actif', 'active')}</span></div><button type="button" aria-busy={transcriptLoadingId === student.id} disabled={Boolean(transcriptLoadingId)} onClick={() => void viewTranscript(student.id)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-kcs-blue-700 px-3 py-2.5 text-sm font-black text-white hover:bg-kcs-blue-800 disabled:opacity-50">{transcriptLoadingId === student.id ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>} {transcriptLoadingId === student.id ? tr('Chargement de ce relevé…', 'Loading this transcript…') : tr('Voir et imprimer le relevé officiel', 'View and print official transcript')}</button></article>)}</div>{!busy && !visibleRegistry.length ? <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:bg-amber-200 dark:text-amber-950">{tr('Aucun élève ne correspond à ces filtres précis.', 'No learner matches these precise filters.')}</p> : null}{busy && !registry.length ? <p className="p-6 text-center text-sm font-bold text-kcs-blue-700 dark:text-sky-200">{tr('Chargement sécurisé du registre officiel des élèves…', 'Secure loading of the official student registry…')}</p> : null}</div>
    </section>

    <section id="official-report-cards" className="scroll-mt-24 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-950 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-kcs-gold-600">{tr('Bulletins officiels', 'Official report cards')}</p><h3 className="mt-1 text-xl font-black text-kcs-blue-950 dark:text-white">{tr('Examiner, approuver, publier et imprimer', 'Review, approve, publish and print')}</h3></div><div className="grid w-full gap-2 sm:grid-cols-[11rem_minmax(16rem,1fr)] lg:max-w-2xl"><select value={cardGradeFilter} onChange={(event) => setCardGradeFilter(event.target.value)} className={inputClass}><option value="ALL">{tr('Toutes les classes', 'All grades')}</option>{SCHOOL_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}</select><label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} className={inputClass + ' pl-10'} placeholder={tr('Élève, matricule, classe, section ou statut', 'Learner, ID, class, section or status')}/></label></div></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{visibleCards.map((card) => <article key={card.id} className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 shadow-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-900"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-black text-kcs-blue-950 dark:text-white">{cardStudentName(card)}</p><p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-200">{card.student.studentNumber} · {[card.student.grade, card.student.section].filter(Boolean).join(' ')} · {card.term}</p><p className="mt-3 text-sm font-bold text-kcs-blue-900 dark:text-sky-100">{tr('Moyenne :', 'Average:')} <strong className="text-lg text-emerald-700 dark:text-emerald-300">{card.average.toFixed(2)}%</strong></p>{card.attendanceSummary ? <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-200">{tr('Présences', 'Present')}: <strong>{card.attendanceSummary.present}</strong> · {tr('Absences', 'Absences')}: <strong>{card.attendanceSummary.absent}</strong> · {tr('Retards', 'Late')}: <strong>{card.attendanceSummary.late}</strong> · {tr('Taux', 'Rate')}: <strong>{card.attendanceSummary.attendanceRate ?? '—'}%</strong></p> : null}</div><span className="shrink-0 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-black text-kcs-blue-900 dark:border-sky-300 dark:bg-sky-200 dark:text-kcs-blue-950">{card.publicationStatus.replace(/_/g, ' ')}</span></div>
        <div className="mt-4 flex flex-wrap gap-2">{card.publicationStatus === 'READY_FOR_REVIEW' ? <button disabled={busy} onClick={() => void approve(card.id)} className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white"><CheckCircle2 size={16} className="mr-1"/>{tr('Approuver et figer', 'Approve and freeze')}</button> : null}{card.publicationStatus === 'APPROVED' ? <button disabled={busy} onClick={() => void publish(card.id)} className="inline-flex items-center justify-center rounded-xl bg-kcs-gold-400 px-3 py-2 text-sm font-black text-kcs-blue-950">{tr('Publier dans les portails', 'Publish to portals')}</button> : null}<button disabled={busy} onClick={() => void setTranscriptVisibility(card.student.id, !card.student.transcriptVisible)} className={card.student.transcriptVisible ? 'rounded-xl bg-rose-100 px-3 py-2 text-sm font-black text-rose-800 dark:bg-rose-200 dark:text-rose-950' : 'rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white'}>{card.student.transcriptVisible ? tr('Masquer le relevé', 'Hide transcript') : tr('Autoriser le relevé à l’élève', 'Allow learner transcript')}</button><button disabled={Boolean(transcriptLoadingId)} onClick={() => void viewTranscript(card.student.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-black text-kcs-blue-800 dark:bg-kcs-blue-950 dark:text-sky-100">{transcriptLoadingId === card.student.id ? <Loader2 size={16} className="animate-spin"/> : null}{transcriptLoadingId === card.student.id ? tr('Chargement…', 'Loading…') : tr('Voir le relevé', 'View transcript')}</button><button type="button" aria-busy={reportPrintingId === card.id} disabled={Boolean(reportPrintingId)} onClick={() => printReportCard(card)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-gold-400 px-3 py-2 text-sm font-black text-kcs-blue-950 disabled:opacity-60">{reportPrintingId === card.id ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>} {reportPrintingId === card.id ? tr('Préparation du PDF…', 'Preparing PDF…') : tr('Imprimer / Enregistrer le bulletin PDF', 'Print / Save report card PDF')}</button></div>
      </article>)}</div>
      {!visibleCards.length ? <p className="mt-4 rounded-xl bg-sky-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-sky-100">{tr('Aucun bulletin ne correspond à cette recherche.', 'No report card matches this search.')}</p> : null}
    </section>
  </section>
}
