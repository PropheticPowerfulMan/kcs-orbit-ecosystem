import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileCheck2, FilterX, Printer, RefreshCw, Search, ShieldCheck, X } from 'lucide-react'
import { academicRecordsAPI } from '@/services/api'
import { printOfficialTranscript } from '@/utils/officialTranscriptPrint'
import { printOfficialReportCard, type PrintableReportCard } from '@/utils/officialReportCardPrint'

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
const inputClass = 'w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 focus:ring-2 focus:ring-sky-200 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white dark:placeholder:text-slate-400'

export default function AcademicRecordsControlCenterV2() {
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const [term, setTerm] = useState('Semester 1 · Trimester 1')
  const [grades, setGrades] = useState<Grade[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [registry, setRegistry] = useState<RegistryStudent[]>([])
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState('ALL')
  const [sectionFilter, setSectionFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [cardQuery, setCardQuery] = useState('')

  const load = async () => {
    setBusy(true)
    try {
      const [gradeResult, cardResult, registryResult] = await Promise.allSettled([
        academicRecordsAPI.review({ academicYear }),
        academicRecordsAPI.reportCards(),
        academicRecordsAPI.studentRegistry(),
      ])
      if (gradeResult.status === 'fulfilled') setGrades(gradeResult.value.data.data ?? [])
      if (cardResult.status === 'fulfilled') setCards(cardResult.value.data.data ?? [])
      if (registryResult.status === 'fulfilled' && Array.isArray(registryResult.value.data.data)) setRegistry(registryResult.value.data.data)
      const failures = [gradeResult, cardResult, registryResult].filter((result) => result.status === 'rejected')
      if (registryResult.status === 'rejected') {
        const error: any = registryResult.reason
        setNotice(error?.response?.data?.message ?? 'The official student registry is temporarily unavailable. The last visible list has been preserved.')
      } else if (failures.length) {
        setNotice('The student registry is available. Some academic indicators are still synchronizing; use Refresh to retry.')
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

  const gradeOptions = useMemo(() => Array.from(new Set(registry.map((student) => student.grade).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), [registry])
  const sectionOptions = useMemo(() => Array.from(new Set(registry.filter((student) => gradeFilter === 'ALL' || student.grade === gradeFilter).map((student) => student.section).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), [gradeFilter, registry])
  const statusOptions = useMemo(() => Array.from(new Set(registry.map((student) => student.status).filter(Boolean) as string[])).sort(), [registry])

  const visibleRegistry = useMemo(() => {
    const tokens = normalize(studentQuery).split(/\s+/).filter(Boolean)
    return registry.filter((student) => {
      if (gradeFilter !== 'ALL' && student.grade !== gradeFilter) return false
      if (sectionFilter !== 'ALL' && (student.section || '') !== sectionFilter) return false
      if (statusFilter !== 'ALL' && normalize(student.status) !== normalize(statusFilter)) return false
      const haystack = normalize([studentName(student), student.studentNumber, student.grade, student.section, student.status].filter(Boolean).join(' '))
      return tokens.every((token) => haystack.includes(token))
    }).sort((left, right) => [left.grade, left.section, studentName(left)].filter(Boolean).join(' ').localeCompare([right.grade, right.section, studentName(right)].filter(Boolean).join(' '), 'en', { numeric: true, sensitivity: 'base' }))
  }, [gradeFilter, registry, sectionFilter, statusFilter, studentQuery])

  const visibleCards = useMemo(() => {
    const tokens = normalize(cardQuery).split(/\s+/).filter(Boolean)
    return cards.filter((card) => {
      const haystack = normalize([cardStudentName(card), card.student.studentNumber, card.student.grade, card.student.section, card.term, card.publicationStatus].filter(Boolean).join(' '))
      return tokens.every((token) => haystack.includes(token))
    })
  }, [cardQuery, cards])

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
      setNotice('No submitted final grade matches this academic year and term. Ask teachers to submit grades first, then refresh.')
      return
    }
    setBusy(true)
    try {
      const response = await academicRecordsAPI.generateReportCards({ academicYear, term })
      setNotice(`${response.data.data.count} report card(s) generated for controlled review.`)
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? 'Report-card generation failed.')
    } finally {
      setBusy(false)
    }
  }

  const approve = async (id: string) => {
    setBusy(true)
    try {
      await academicRecordsAPI.approveReportCard(id)
      setNotice('Report card approved; official grades were frozen for the transcript.')
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? 'Approval failed.')
    } finally {
      setBusy(false)
    }
  }

  const publish = async (id: string) => {
    setBusy(true)
    try {
      await academicRecordsAPI.publishReportCard(id)
      setNotice('Approved report card published to the student and parent portals.')
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? 'Publication failed.')
    } finally {
      setBusy(false)
    }
  }

  const viewTranscript = async (studentId: string) => {
    setBusy(true)
    try {
      const response = await academicRecordsAPI.transcript(studentId)
      setTranscript(response.data.data)
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? 'Transcript unavailable.')
    } finally {
      setBusy(false)
    }
  }

  const setTranscriptVisibility = async (studentId: string, visible: boolean) => {
    setBusy(true)
    try {
      await academicRecordsAPI.setTranscriptVisibility(studentId, visible)
      setNotice(visible ? 'Accès au relevé accordé à l’élève et à ses parents.' : 'Accès au relevé retiré à l’élève et à ses parents.')
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message ?? 'Transcript access could not be changed.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="space-y-5 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:p-5">
    {transcript ? <div className="fixed inset-0 z-[190] flex items-center justify-center bg-kcs-blue-950/80 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Official transcript preview" onClick={() => setTranscript(null)}>
      <section className="relative flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-2xl dark:border-kcs-blue-700 dark:bg-kcs-blue-950" onClick={(event) => event.stopPropagation()}>
        <img src="/images/kcs-logo.png" alt="" className="pointer-events-none absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 opacity-[0.035] grayscale"/>
        <header className="relative z-10 flex flex-col gap-3 border-b border-sky-100 bg-white/95 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/95 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">{transcript.student.photoUrl ? <img src={transcript.student.photoUrl} alt={transcript.student.name} className="h-16 w-14 rounded-lg border-2 border-kcs-gold-400 object-cover"/> : <div className="flex h-16 w-14 items-center justify-center rounded-lg border border-dashed border-sky-300 text-xs font-black text-kcs-blue-700 dark:text-sky-200">KCS</div>}<div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.16em] text-kcs-gold-600">Official transcript</p><h3 className="truncate text-xl font-black text-kcs-blue-950 dark:text-white">{transcript.student.name}</h3><p className="text-sm text-slate-500 dark:text-slate-300">{transcript.student.studentNumber} · {transcript.student.grade}</p></div></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => printOfficialTranscript(transcript, setNotice)} className="inline-flex items-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-kcs-blue-800"><Printer size={17}/>Print / Save PDF</button><button type="button" onClick={() => setTranscript(null)} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 px-4 py-2.5 text-sm font-bold text-kcs-blue-800 dark:border-kcs-blue-700 dark:text-white"><X size={17}/>Close</button></div>
        </header>
        <div className="relative z-10 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">{[['Official records', transcript.summary.officialRecords], ['Credits', transcript.summary.credits], ['GPA', transcript.summary.cumulativeGpa ?? '—']].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-sky-100 bg-sky-50/90 p-4 text-center dark:border-kcs-blue-700 dark:bg-kcs-blue-900"><p className="text-xs font-black uppercase text-slate-500 dark:text-slate-300">{label}</p><b className="mt-1 block text-2xl text-kcs-blue-950 dark:text-white">{value}</b></div>)}</div>
          {transcript.rows.length ? <div className="mt-5 overflow-x-auto rounded-xl border border-sky-100 dark:border-kcs-blue-800"><table className="min-w-[700px] w-full text-sm"><thead className="bg-kcs-blue-800 text-white"><tr className="text-left"><th className="p-3">Academic year</th><th>Term</th><th>Course</th><th>Credit</th><th>Average</th><th>Letter</th></tr></thead><tbody>{transcript.rows.map((row) => <tr key={row.id} className="border-b border-sky-100 bg-white text-kcs-blue-950 dark:border-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-white"><td className="p-3">{row.cycle.academicYear}</td><td>{row.cycle.term}</td><td>{row.course.code} · {row.course.name}</td><td>{row.credits}</td><td>{row.percentage.toFixed(2)}%</td><td className="font-black">{row.letterGrade}</td></tr>)}</tbody></table></div> : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:bg-amber-200 dark:text-amber-950">No approved academic record exists yet. The official document will clearly show this status.</p>}
        </div>
      </section>
    </div> : null}

    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-300"><ShieldCheck size={17}/>Official Academic Records</p><h2 className="mt-1 font-display text-2xl font-black text-kcs-blue-950 dark:text-white">Grade validation, report cards and transcripts</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Search the complete register, review report cards and generate official documents without leaving this workspace.</p></div><button disabled={busy} onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-800 dark:border-emerald-700 dark:text-emerald-200"><RefreshCw size={16} className={busy ? 'animate-spin' : ''}/>Refresh</button></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className={inputClass}/><select value={term} onChange={(event) => setTerm(event.target.value)} className={inputClass}><option>Semester 1 · Trimester 1</option><option>Semester 1 · Trimester 2</option><option>Semester 2 · Trimester 3</option><option>Annual final</option></select><div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-kcs-blue-950 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white"><b>{matching.length}</b> final grades · <b>{finalStudentCount}</b> students · <b>{courseCount}</b> courses</div><button disabled={busy} onClick={() => void generate()} className="rounded-xl bg-kcs-blue-700 px-4 py-3 font-black text-white hover:bg-kcs-blue-800 disabled:opacity-50"><FileCheck2 size={17} className="mr-2 inline"/>Generate report cards</button></div>
    {notice ? <p className="rounded-xl border border-sky-100 bg-white p-3 text-sm font-semibold text-kcs-blue-900 dark:border-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-white">{notice}</p> : null}

    <div className="flex flex-col gap-3 rounded-2xl border border-kcs-gold-300 bg-kcs-gold-50 p-4 dark:border-kcs-gold-700 dark:bg-kcs-blue-900 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-kcs-gold-700 dark:text-kcs-gold-300">Official report cards</p><p className="mt-1 text-sm font-semibold text-kcs-blue-950 dark:text-white">Open the report-card register to review, approve and print the official PDF.</p></div><button type="button" onClick={() => document.getElementById('official-report-cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-kcs-gold-400 px-4 py-2.5 text-sm font-black text-kcs-blue-950"><Printer size={17}/>Open report cards and print</button></div>

    <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-950 sm:p-5">
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-kcs-gold-600">Precise transcript finder</p><h3 className="mt-1 text-xl font-black text-kcs-blue-950 dark:text-white">Find a learner and generate the transcript immediately</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{visibleRegistry.length} result(s) displayed from {registry.length} official learner records.</p></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1.5fr)_11rem_11rem_11rem_auto]">
        <label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} className={inputClass + ' pl-10'} placeholder="Exact name, student ID, class, section…"/></label>
        <select value={gradeFilter} onChange={(event) => { setGradeFilter(event.target.value); setSectionFilter('ALL') }} className={inputClass}><option value="ALL">All grades</option>{gradeOptions.map((grade) => <option key={grade}>{grade}</option>)}</select>
        <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className={inputClass}><option value="ALL">All sections</option>{sectionOptions.map((section) => <option key={section}>{section}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="ALL">All statuses</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select>
        <button type="button" onClick={resetSearch} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 px-3 py-2 text-sm font-bold text-kcs-blue-800 dark:border-kcs-blue-700 dark:text-white"><FilterX size={17}/>Reset</button>
      </div>
      <div className="mt-4 max-h-[31rem] overflow-y-auto pr-1"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleRegistry.map((student) => <article key={student.id} className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-900"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-kcs-blue-950 dark:text-white">{studentName(student)}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">{student.studentNumber || 'No student ID'} · {[student.grade, student.section].filter(Boolean).join(' ') || 'Class pending'}</p></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-800 dark:bg-emerald-200 dark:text-emerald-950">{student.status || 'active'}</span></div><button type="button" disabled={busy} onClick={() => void viewTranscript(student.id)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-kcs-blue-700 px-3 py-2.5 text-sm font-black text-white hover:bg-kcs-blue-800 disabled:opacity-50"><Printer size={16}/>{busy ? 'Loading…' : 'View and print official transcript'}</button></article>)}</div>{!busy && !visibleRegistry.length ? <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:bg-amber-200 dark:text-amber-950">No learner matches these precise filters.</p> : null}{busy && !registry.length ? <p className="p-6 text-center text-sm font-bold text-kcs-blue-700 dark:text-sky-200">Secure loading of the official student registry…</p> : null}</div>
    </section>

    <section id="official-report-cards" className="scroll-mt-24 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-950 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-kcs-gold-600">Official report cards</p><h3 className="mt-1 text-xl font-black text-kcs-blue-950 dark:text-white">Review, approve, publish and print</h3></div><label className="relative w-full sm:max-w-md"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} className={inputClass + ' pl-10'} placeholder="Search report card by learner, ID, class or status"/></label></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{visibleCards.map((card) => <article key={card.id} className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 shadow-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-900"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-black text-kcs-blue-950 dark:text-white">{cardStudentName(card)}</p><p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-200">{card.student.studentNumber} · {[card.student.grade, card.student.section].filter(Boolean).join(' ')} · {card.term}</p><p className="mt-3 text-sm font-bold text-kcs-blue-900 dark:text-sky-100">Average: <strong className="text-lg text-emerald-700 dark:text-emerald-300">{card.average.toFixed(2)}%</strong></p>{card.attendanceSummary ? <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-200">Présences: <strong>{card.attendanceSummary.present}</strong> · Absences: <strong>{card.attendanceSummary.absent}</strong> · Retards: <strong>{card.attendanceSummary.late}</strong> · Taux: <strong>{card.attendanceSummary.attendanceRate ?? '—'}%</strong></p> : null}</div><span className="shrink-0 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-black text-kcs-blue-900 dark:border-sky-300 dark:bg-sky-200 dark:text-kcs-blue-950">{card.publicationStatus.replace(/_/g, ' ')}</span></div>
        <div className="mt-4 flex flex-wrap gap-2">{card.publicationStatus === 'READY_FOR_REVIEW' ? <button disabled={busy} onClick={() => void approve(card.id)} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white"><CheckCircle2 size={16} className="mr-1 inline"/>Approve and freeze</button> : null}{card.publicationStatus === 'APPROVED' ? <button disabled={busy} onClick={() => void publish(card.id)} className="rounded-xl bg-kcs-gold-400 px-3 py-2 text-sm font-black text-kcs-blue-950">Publish to portals</button> : null}<button disabled={busy} onClick={() => void setTranscriptVisibility(card.student.id, !card.student.transcriptVisible)} className={card.student.transcriptVisible ? 'rounded-xl bg-rose-100 px-3 py-2 text-sm font-black text-rose-800 dark:bg-rose-200 dark:text-rose-950' : 'rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black text-white'}>{card.student.transcriptVisible ? 'Masquer le relevé' : 'Autoriser le relevé à l’élève'}</button><button disabled={busy} onClick={() => void viewTranscript(card.student.id)} className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-black text-kcs-blue-800 dark:bg-kcs-blue-950 dark:text-sky-100">View transcript</button><button type="button" onClick={() => printOfficialReportCard(card, setNotice)} className="inline-flex items-center gap-2 rounded-xl bg-kcs-gold-400 px-3 py-2 text-sm font-black text-kcs-blue-950"><Printer size={16}/>Print / Save report card PDF</button></div>
      </article>)}</div>
      {!visibleCards.length ? <p className="mt-4 rounded-xl bg-sky-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-900 dark:text-sky-100">No report card matches this search.</p> : null}
    </section>
  </section>
}
