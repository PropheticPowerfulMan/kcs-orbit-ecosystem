import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Eye, Search, Send, ShieldAlert, Users, X } from 'lucide-react'
import { disciplineAPI } from '@/services/api'
import { canonicalClassLabel } from '@/utils/classLabels'

type TeacherDisciplinePanelProps = {
  students: any[]
}

const fieldClass = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-kcs-blue-800 disabled:cursor-not-allowed disabled:opacity-45'
const cardClass = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'

const severityTone = (severity: string) => {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-200'
  if (severity === 'MEDIUM') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-100'
  return 'bg-green-100 text-green-700 dark:bg-green-900/35 dark:text-green-200'
}

const statusTone = (status: string) => {
  if (status === 'RESOLVED') return 'bg-green-100 text-green-700 dark:bg-green-900/35 dark:text-green-200'
  if (status === 'ESCALATED') return 'bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-200'
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-100'
}

const studentName = (student: any) =>
  [student?.user?.lastName, student?.user?.middleName, student?.user?.firstName].filter(Boolean).join(' ')
  || student?.name
  || 'Student'

const reporterName = (reporter: any) =>
  [reporter?.lastName, reporter?.middleName, reporter?.firstName].filter(Boolean).join(' ')
  || 'Teacher'

const formatDate = (value: string) => new Date(value).toLocaleString()

export default function TeacherDisciplinePanel({ students }: TeacherDisciplinePanelProps) {
  const [allCases, setAllCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [selectedCase, setSelectedCase] = useState<any | null>(null)
  const [followUpStatus, setFollowUpStatus] = useState('OPEN')
  const [followUpResolution, setFollowUpResolution] = useState('')
  const [followUpAction, setFollowUpAction] = useState('')
  const [draft, setDraft] = useState({
    studentId: '',
    incidentDate: new Date().toISOString().slice(0, 16),
    category: 'Classroom conduct',
    severity: 'MEDIUM',
    incident: '',
    actionTaken: '',
    gradeImpact: '',
    resolution: '',
    notifyParent: true,
    notifyStudent: true,
  })

  const load = async () => {
    setLoading(true)
    try {
      const response = await disciplineAPI.list()
      setAllCases(Array.isArray(response.data?.data) ? response.data.data : [])
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'Unable to load official discipline reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!draft.studentId && students[0]?.id) {
      setDraft((current) => ({ ...current, studentId: students[0].id }))
    }
  }, [draft.studentId, students])

  const studentIds = useMemo(() => new Set(students.map((student) => student.id)), [students])
  const visibleCases = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return allCases.filter((disciplineCase) => {
      if (!studentIds.has(disciplineCase.studentId)) return false
      const haystack = [
        disciplineCase.id,
        studentName(disciplineCase.student),
        disciplineCase.category,
        disciplineCase.incident,
        disciplineCase.actionTaken,
        disciplineCase.resolution,
      ].filter(Boolean).join(' ').toLowerCase()
      return (!normalizedQuery || haystack.includes(normalizedQuery))
        && (statusFilter === 'ALL' || disciplineCase.status === statusFilter)
        && (severityFilter === 'ALL' || disciplineCase.severity === severityFilter)
    })
  }, [allCases, query, severityFilter, statusFilter, studentIds])

  const counts = useMemo(() => ({
    total: allCases.filter((item) => studentIds.has(item.studentId)).length,
    open: allCases.filter((item) => studentIds.has(item.studentId) && item.status !== 'RESOLVED').length,
    urgent: allCases.filter((item) => studentIds.has(item.studentId) && ['HIGH', 'CRITICAL'].includes(item.severity) && item.status !== 'RESOLVED').length,
    resolved: allCases.filter((item) => studentIds.has(item.studentId) && item.status === 'RESOLVED').length,
  }), [allCases, studentIds])

  const openCase = (disciplineCase: any) => {
    setSelectedCase(disciplineCase)
    setFollowUpStatus(disciplineCase.status)
    setFollowUpResolution(disciplineCase.resolution || '')
    setFollowUpAction(disciplineCase.actionTaken || '')
  }

  const createReport = async () => {
    if (!draft.studentId) return setNotice('Select a student.')
    if (draft.category.trim().length < 2) return setNotice('Enter a valid category.')
    if (draft.incident.trim().length < 3) return setNotice('Describe the incident with enough detail.')
    setSaving(true)
    setNotice('')
    try {
      const response = await disciplineAPI.create({
        ...draft,
        incidentDate: draft.incidentDate ? new Date(draft.incidentDate).toISOString() : undefined,
        status: 'OPEN',
        parentMessage: draft.incident,
        studentMessage: draft.incident,
      })
      const created = response.data?.data?.disciplineCase
      if (created) setAllCases((current) => [created, ...current])
      setDraft((current) => ({
        ...current,
        incidentDate: new Date().toISOString().slice(0, 16),
        incident: '',
        actionTaken: '',
        gradeImpact: '',
        resolution: '',
      }))
      setNotice('Official discipline report submitted to the administration and saved in the student record.')
      await load()
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'The discipline report could not be submitted.')
    } finally {
      setSaving(false)
    }
  }

  const saveFollowUp = async () => {
    if (!selectedCase || saving) return
    setSaving(true)
    setNotice('')
    try {
      const response = await disciplineAPI.updateResolution(selectedCase.id, {
        status: followUpStatus,
        resolution: followUpResolution || undefined,
        actionTaken: followUpAction || undefined,
      })
      const updated = response.data?.data
      setAllCases((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
      setSelectedCase((current: any) => ({ ...current, ...updated }))
      setNotice('Discipline follow-up saved in the official record.')
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'Unable to save the discipline follow-up.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {notice ? <div className="rounded-2xl border border-kcs-blue-200 bg-kcs-blue-50 p-4 text-sm font-semibold text-kcs-blue-800 dark:border-kcs-blue-700 dark:bg-kcs-blue-900/70 dark:text-kcs-blue-100">{notice}</div> : null}

      <section className="rounded-3xl bg-gradient-to-r from-kcs-blue-950 via-kcs-blue-900 to-kcs-blue-700 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="rounded-2xl bg-white/10 p-3 text-kcs-gold-300"><ShieldAlert size={30} /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-kcs-gold-300">Official student record</p>
              <h2 className="mt-1 font-display text-2xl font-bold">Discipline Report Center</h2>
              <p className="mt-2 max-w-3xl text-sm text-blue-100">Document facts, immediate actions, family notification and follow-up in one auditable workflow shared with the Super Administrator.</p>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">{students.length} assigned student(s)</span>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [Users, 'Official reports', counts.total],
          [Clock3, 'Open follow-ups', counts.open],
          [AlertTriangle, 'High priority', counts.urgent],
          [CheckCircle2, 'Resolved', counts.resolved],
        ].map(([Icon, label, value]: any) => (
          <div key={label} className={cardClass}>
            <Icon size={20} className="text-kcs-gold-600" />
            <p className="mt-3 text-xs font-bold uppercase text-gray-400">{label}</p>
            <p className="mt-1 text-3xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className={cardClass}>
          <div className="mb-5">
            <p className="text-xs font-bold uppercase text-kcs-gold-600">New official report</p>
            <h3 className="text-xl font-bold text-kcs-blue-900 dark:text-white">Record a disciplinary incident</h3>
          </div>
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-kcs-blue-900 dark:text-white">Student
              <select className={fieldClass + ' mt-1'} value={draft.studentId} onChange={(event) => setDraft((current) => ({ ...current, studentId: event.target.value }))}>
                <option value="">Select a student...</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name} - {canonicalClassLabel(student.grade, student.section)}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-kcs-blue-900 dark:text-white">Incident date and time
                <input type="datetime-local" className={fieldClass + ' mt-1'} value={draft.incidentDate} onChange={(event) => setDraft((current) => ({ ...current, incidentDate: event.target.value }))} />
              </label>
              <label className="text-sm font-semibold text-kcs-blue-900 dark:text-white">Severity
                <select className={fieldClass + ' mt-1'} value={draft.severity} onChange={(event) => setDraft((current) => ({ ...current, severity: event.target.value }))}>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                </select>
              </label>
            </div>
            <label className="text-sm font-semibold text-kcs-blue-900 dark:text-white">Category
              <select className={fieldClass + ' mt-1'} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
                <option>Classroom conduct</option><option>Respect and behavior</option><option>Academic integrity</option><option>Safety concern</option><option>Attendance or punctuality</option><option>Other</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-kcs-blue-900 dark:text-white">Objective incident description
              <textarea className={fieldClass + ' mt-1 min-h-32 resize-y'} value={draft.incident} onChange={(event) => setDraft((current) => ({ ...current, incident: event.target.value }))} placeholder="What happened, where, when, witnesses and relevant context..." />
            </label>
            <label className="text-sm font-semibold text-kcs-blue-900 dark:text-white">Immediate action taken
              <textarea className={fieldClass + ' mt-1 resize-y'} rows={3} value={draft.actionTaken} onChange={(event) => setDraft((current) => ({ ...current, actionTaken: event.target.value }))} placeholder="Support, safety action, conversation or classroom measure..." />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-kcs-blue-900 dark:text-white">Academic impact
                <input className={fieldClass + ' mt-1'} value={draft.gradeImpact} onChange={(event) => setDraft((current) => ({ ...current, gradeImpact: event.target.value }))} placeholder="None, assignment review, pending..." />
              </label>
              <label className="text-sm font-semibold text-kcs-blue-900 dark:text-white">Proposed follow-up
                <input className={fieldClass + ' mt-1'} value={draft.resolution} onChange={(event) => setDraft((current) => ({ ...current, resolution: event.target.value }))} placeholder="Meeting, observation, counselor..." />
              </label>
            </div>
            <div className="grid gap-2 rounded-xl bg-gray-50 p-4 text-sm dark:bg-kcs-blue-800/40 dark:text-white">
              <label className="flex items-center gap-3"><input type="checkbox" checked={draft.notifyParent} onChange={(event) => setDraft((current) => ({ ...current, notifyParent: event.target.checked }))} /> Notify linked parent(s) in Nexus</label>
              <label className="flex items-center gap-3"><input type="checkbox" checked={draft.notifyStudent} onChange={(event) => setDraft((current) => ({ ...current, notifyStudent: event.target.checked }))} /> Notify the student in Nexus</label>
            </div>
            <button type="button" className={primaryButton} disabled={saving || !students.length} onClick={() => void createReport()}><Send size={18} />{saving ? 'Submitting...' : 'Submit official report'}</button>
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-kcs-gold-600">Follow-up register</p>
              <h3 className="text-xl font-bold text-kcs-blue-900 dark:text-white">Discipline reports for my students</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="relative sm:col-span-3"><Search size={17} className="absolute left-3 top-3.5 text-gray-400" /><input className={fieldClass + ' pl-10'} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, category, facts or reference..." /></label>
              <select className={fieldClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="INVESTIGATING">Investigating</option><option value="PARENT_CONTACTED">Parent contacted</option><option value="ESCALATED">Escalated</option><option value="RESOLVED">Resolved</option>
              </select>
              <select className={fieldClass} value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
                <option value="ALL">All severity levels</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
              </select>
              <button type="button" className={primaryButton} onClick={() => void load()}>Refresh register</button>
            </div>
          </div>
          <div className="mt-5 max-h-[820px] space-y-3 overflow-y-auto pr-1">
            {loading ? <p className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500 dark:bg-kcs-blue-800/30 dark:text-gray-300">Loading official reports...</p> : null}
            {!loading && visibleCases.length === 0 ? <p className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500 dark:bg-kcs-blue-800/30 dark:text-gray-300">No discipline report matches the current filters.</p> : null}
            {visibleCases.map((disciplineCase) => (
              <button type="button" key={disciplineCase.id} onClick={() => openCase(disciplineCase)} className="w-full rounded-2xl border border-gray-100 bg-gray-50 p-4 text-left transition hover:border-kcs-blue-300 hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30 dark:hover:bg-kcs-blue-800/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase text-kcs-blue-500">{disciplineCase.id.slice(-8)} - {formatDate(disciplineCase.incidentDate)}</p>
                    <h4 className="mt-1 font-bold text-kcs-blue-900 dark:text-white">{studentName(disciplineCase.student)}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-300">{disciplineCase.category}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={'rounded-full px-3 py-1 text-xs font-bold ' + severityTone(disciplineCase.severity)}>{disciplineCase.severity}</span>
                    <span className={'rounded-full px-3 py-1 text-xs font-bold ' + statusTone(disciplineCase.status)}>{disciplineCase.status}</span>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{disciplineCase.incident}</p>
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-kcs-blue-700 dark:text-kcs-blue-200"><Eye size={15} /> Open complete record</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {selectedCase ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-kcs-blue-950/75 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Discipline report details">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-kcs-blue-950">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-950">
              <div>
                <p className="text-xs font-bold uppercase text-kcs-gold-600">Official reference {selectedCase.id}</p>
                <h3 className="mt-1 text-2xl font-bold text-kcs-blue-900 dark:text-white">{studentName(selectedCase.student)}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-300">{selectedCase.category} - {formatDate(selectedCase.incidentDate)}</p>
              </div>
              <button type="button" onClick={() => setSelectedCase(null)} aria-label="Close" className="rounded-full bg-kcs-blue-900 p-3 text-white hover:bg-kcs-blue-700 dark:bg-kcs-gold-400 dark:text-kcs-blue-950"><X size={21} /></button>
            </header>
            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Severity', selectedCase.severity],
                  ['Status', selectedCase.status],
                  ['Reported by', reporterName(selectedCase.reportedBy)],
                  ['Parent notification', selectedCase.parentNotifiedAt ? formatDate(selectedCase.parentNotifiedAt) : 'Not requested'],
                ].map(([label, value]) => <div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-900/60"><p className="text-xs font-bold uppercase text-gray-400">{label}</p><p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{value}</p></div>)}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  ['Incident facts', selectedCase.incident],
                  ['Immediate action', selectedCase.actionTaken || 'No action recorded'],
                  ['Academic impact', selectedCase.gradeImpact || 'No academic impact recorded'],
                  ['Current resolution', selectedCase.resolution || 'Follow-up pending'],
                ].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-100 p-4 dark:border-kcs-blue-800"><p className="text-xs font-bold uppercase text-kcs-gold-600">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">{value}</p></div>)}
              </div>
              <section className="rounded-2xl bg-kcs-blue-50 p-5 dark:bg-kcs-blue-900/60">
                <h4 className="font-bold text-kcs-blue-900 dark:text-white">Update follow-up</h4>
                <div className="mt-3 grid gap-3">
                  <select className={fieldClass} value={followUpStatus} onChange={(event) => setFollowUpStatus(event.target.value)}>
                    <option value="OPEN">Open</option><option value="INVESTIGATING">Investigating</option><option value="PARENT_CONTACTED">Parent contacted</option><option value="ESCALATED">Escalated</option><option value="RESOLVED">Resolved</option>
                  </select>
                  <textarea className={fieldClass} rows={3} value={followUpAction} onChange={(event) => setFollowUpAction(event.target.value)} placeholder="Updated action taken..." />
                  <textarea className={fieldClass} rows={3} value={followUpResolution} onChange={(event) => setFollowUpResolution(event.target.value)} placeholder="Resolution, commitments and next review date..." />
                  <button type="button" className={primaryButton} disabled={saving} onClick={() => void saveFollowUp()}><CheckCircle2 size={18} />{saving ? 'Saving...' : 'Save official follow-up'}</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
