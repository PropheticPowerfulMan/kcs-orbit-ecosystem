import { useEffect, useMemo, useState } from 'react'
import { Award, FilterX, Loader2, Printer, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { academicRecordsAPI } from '@/services/api'
import { normalizeSchoolLevel } from '@/constants/schoolLevels'
import { useUIStore } from '@/store/uiStore'
import { printOfficialCertificate, type CertificateStudent } from '@/utils/officialCertificatePrint'

const eligibleGrades = ['K4', 'Grade 4', 'Grade 8']
const inputClass = 'w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 focus:ring-2 focus:ring-sky-200 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const fullName = (student: CertificateStudent) => [student.user?.lastName, student.user?.middleName, student.user?.firstName].filter(Boolean).join(' ')

export default function CertificateControlCenter() {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [students, setStudents] = useState<CertificateStudent[]>([])
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const [grade, setGrade] = useState('ALL')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [printingId, setPrintingId] = useState('')
  const [notice, setNotice] = useState('')
  const load = async () => { setBusy(true); try { const response = await academicRecordsAPI.studentRegistry(); setStudents(response.data.data ?? []); setNotice('') } catch (error: any) { setNotice(error?.response?.data?.message ?? tr('Le registre des élèves est indisponible.', 'The learner registry is unavailable.')) } finally { setBusy(false) } }
  useEffect(() => { void load() }, [])
  const visible = useMemo(() => {
    const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
    return students.filter((student) => {
      const normalizedGrade = normalizeSchoolLevel(student.grade) ?? ''
      if (!eligibleGrades.includes(normalizedGrade)) return false
      if (grade !== 'ALL' && normalizedGrade !== grade) return false
      const haystack = [fullName(student), student.studentNumber, normalizedGrade, student.section].join(' ').toLowerCase()
      return tokens.every((token) => haystack.includes(token))
    }).sort((a, b) => eligibleGrades.indexOf(normalizeSchoolLevel(a.grade) ?? '') - eligibleGrades.indexOf(normalizeSchoolLevel(b.grade) ?? '') || fullName(a).localeCompare(fullName(b), 'fr', { sensitivity: 'base' }))
  }, [grade, query, students])
  const print = async (student: CertificateStudent) => { setPrintingId(student.id); try { await printOfficialCertificate(student, academicYear, setNotice) } finally { window.setTimeout(() => setPrintingId(''), 700) } }
  return <section className="space-y-5">
    <header className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-5 shadow-sm dark:border-amber-800 dark:from-kcs-blue-900 dark:via-kcs-blue-950 dark:to-kcs-blue-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-amber-700 dark:text-amber-300"><ShieldCheck size={17}/>{tr('Documents officiels vérifiables', 'Verifiable official documents')}</p><h2 className="mt-2 font-display text-2xl font-black text-kcs-blue-950 dark:text-white">{tr('Centre des certificats KCS', 'KCS Certificate Center')}</h2><p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{tr('Émettez exclusivement les certificats de fin de cycle pour K4, Grade 4 et Grade 8. Chaque document comporte un numéro unique, un filigrane et un QR de vérification en direct.', 'Issue completion certificates exclusively for K4, Grade 4 and Grade 8. Every document carries a unique number, watermark and live verification QR code.')}</p></div><button type="button" disabled={busy} onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-black text-kcs-blue-800 shadow-sm transition hover:border-kcs-blue-400 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kcs-gold-400 disabled:cursor-wait disabled:opacity-60 dark:border-kcs-gold-300 dark:bg-kcs-gold-400 dark:text-kcs-blue-950 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)] dark:hover:bg-kcs-gold-300"><RefreshCw size={17} className={busy ? 'animate-spin' : ''}/>{tr('Actualiser', 'Refresh')}</button></div>
    </header>
    {notice ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:bg-amber-200 dark:text-amber-950">{notice}</p> : null}
    <section className="rounded-2xl border border-sky-200 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950 sm:p-5">
      <div className="grid gap-3 md:grid-cols-[12rem_12rem_minmax(16rem,1fr)_auto]"><label className="text-xs font-bold text-slate-600 dark:text-slate-300">{tr('Année scolaire', 'Academic year')}<input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className={inputClass + ' mt-1'}/></label><label className="text-xs font-bold text-slate-600 dark:text-slate-300">{tr('Cycle admissible', 'Eligible level')}<select value={grade} onChange={(event) => setGrade(event.target.value)} className={inputClass + ' mt-1'}><option value="ALL">{tr('Tous les cycles', 'All levels')}</option>{eligibleGrades.map((item) => <option key={item}>{item}</option>)}</select></label><label className="relative self-end"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass + ' pl-10'} placeholder={tr('Nom, matricule, classe ou section…', 'Name, student ID, grade or section…')}/></label><button type="button" onClick={() => { setGrade('ALL'); setQuery('') }} className="inline-flex items-center justify-center gap-2 self-end rounded-xl border border-sky-200 px-3 py-2.5 text-sm font-bold text-kcs-blue-800 dark:border-kcs-blue-700 dark:text-white"><FilterX size={17}/>{tr('Réinitialiser', 'Reset')}</button></div>
      <p className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-300">{visible.length} {tr('élève(s) admissible(s)', 'eligible learner(s)')} · 45 {tr('jours par quarter', 'days per quarter')} · 180 {tr('jours ouvrables par année', 'instructional days per year')}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((student) => <article key={student.id} className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-900"><div className="flex items-center gap-3"><span className="rounded-xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-300 dark:text-kcs-blue-950"><Award size={22}/></span><div className="min-w-0"><p className="truncate font-black text-kcs-blue-950 dark:text-white">{fullName(student)}</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-300">{student.studentNumber} · {[normalizeSchoolLevel(student.grade), student.section].filter(Boolean).join(' ')}</p></div></div><button type="button" disabled={Boolean(printingId)} onClick={() => void print(student)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-kcs-blue-800 disabled:opacity-50">{printingId === student.id ? <Loader2 size={17} className="animate-spin"/> : <Printer size={17}/>} {printingId === student.id ? tr('Préparation…', 'Preparing…') : tr('Générer le certificat officiel', 'Generate official certificate')}</button></article>)}</div>
      {!busy && !visible.length ? <p className="mt-4 rounded-xl bg-sky-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-sky-100">{tr('Aucun élève admissible ne correspond à cette recherche.', 'No eligible learner matches this search.')}</p> : null}
    </section>
  </section>
}
