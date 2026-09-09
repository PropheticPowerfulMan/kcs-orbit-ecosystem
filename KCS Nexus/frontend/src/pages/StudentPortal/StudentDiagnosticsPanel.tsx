import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, Clock, PlayCircle, RefreshCw } from 'lucide-react'
import { diagnosticAPI } from '@/services/api'

type Question = { id: string; questionText: string; questionType: string; options?: unknown; points: number; competencyTag: string; order: number }
type Submission = { id: string; status: string; percentage: number; submittedAt?: string | null; approvedAt?: string | null; finalComment?: string | null }
type Assignment = { id: string; status: string; dueAt?: string | null; assignedAt: string; test: { id: string; title: string; subject: string; gradeLevel: string; durationMinutes?: number | null; passingScore: number; questions: Question[] }; submission?: Submission | null }

const card = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'
const button = 'rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-kcs-blue-800 disabled:cursor-not-allowed disabled:opacity-50'
const optionsOf = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : []
const answerValue = (question: Question, choice: string, index: number) => question.questionType === 'MULTIPLE_CHOICE' ? choice : index

export default function StudentDiagnosticsPanel() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [active, setActive] = useState<Assignment | null>(null)
  const [submissionId, setSubmissionId] = useState('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true); setMessage('')
    try {
      const response = await diagnosticAPI.getMyAssignments()
      setAssignments(Array.isArray(response.data?.data) ? response.data.data : [])
    } catch (reason: any) {
      setMessage(reason?.response?.data?.message ?? 'Unable to synchronize official diagnostic assignments.')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const start = async (assignment: Assignment) => {
    setBusy(true); setMessage('')
    try {
      const response = await diagnosticAPI.startSubmission({ testId: assignment.test.id, assignmentId: assignment.id })
      setSubmissionId(String(response.data.data.id)); setActive(assignment); setAnswers({})
    } catch (reason: any) { setMessage(reason?.response?.data?.message ?? 'The diagnostic could not be started.') }
    finally { setBusy(false) }
  }

  const submit = async () => {
    if (!active || !submissionId) return
    setBusy(true); setMessage('')
    try {
      await diagnosticAPI.submit(submissionId, active.test.questions.map((question) => ({ questionId: question.id, answer: answers[question.id] })))
      setActive(null); setSubmissionId(''); setAnswers({}); setMessage('Diagnostic submitted and securely saved for school review.')
      await load()
    } catch (reason: any) { setMessage(reason?.response?.data?.message ?? 'The diagnostic could not be submitted.') }
    finally { setBusy(false) }
  }

  if (loading) return <div className={card}><Clock className="mr-2 inline animate-spin"/>Synchronizing official diagnostics…</div>
  if (active) {
    const complete = active.test.questions.every((question) => answers[question.id] !== undefined && answers[question.id] !== '')
    return <div className="space-y-4">
      <div className={card}><p className="text-xs font-bold uppercase text-kcs-gold-600">Official assigned diagnostic</p><h2 className="mt-2 text-xl font-bold dark:text-white">{active.test.title}</h2><p className="mt-1 text-sm text-gray-500">{active.test.subject} · {active.test.questions.length} questions · answers are stored in Nexus</p></div>
      {active.test.questions.map((question, index) => {
        const choices = optionsOf(question.options)
        return <div className={card} key={question.id}><p className="text-xs font-bold text-kcs-gold-600">Question {index + 1} of {active.test.questions.length}</p><h3 className="mt-2 font-bold dark:text-white">{question.questionText}</h3>{choices.length > 0 ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{choices.map((choice, choiceIndex) => <button key={choiceIndex} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: answerValue(question, choice, choiceIndex) }))} className={`rounded-xl border p-3 text-left text-sm ${answers[question.id] === answerValue(question, choice, choiceIndex) ? 'border-kcs-blue-600 bg-kcs-blue-50 dark:bg-kcs-blue-900' : 'border-gray-200 dark:border-kcs-blue-700'}`}>{choice}</button>)}</div> : <textarea className="mt-4 min-h-28 w-full rounded-xl border border-gray-200 p-3 dark:border-kcs-blue-700 dark:bg-kcs-blue-950" value={String(answers[question.id] ?? '')} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}/>}</div>
      })}
      <button className={`${button} w-full`} disabled={busy || !complete} onClick={() => void submit()}>{busy ? 'Submitting securely…' : 'Submit official diagnostic'}</button>
    </div>
  }
  return <div className="space-y-5">
    <div className={card}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">Institutional records</p><h2 className="mt-2 text-xl font-bold dark:text-white">Official diagnostic assignments</h2><p className="mt-2 text-sm text-gray-500">Only diagnostics assigned to your verified student profile appear here. Every submission and result is persisted.</p></div><button className="text-kcs-blue-600" onClick={() => void load()} aria-label="Refresh diagnostics"><RefreshCw size={20}/></button></div>{message && <p className="mt-4 rounded-xl bg-kcs-blue-50 p-3 text-sm text-kcs-blue-800">{message}</p>}</div>
    {assignments.length === 0 ? <div className={card}><ClipboardCheck className="text-kcs-blue-600"/><h3 className="mt-3 font-bold dark:text-white">No diagnostic currently assigned</h3><p className="mt-2 text-sm text-gray-500">An authorized teacher or administrator must assign a published diagnostic. No demo test is displayed.</p></div> : <div className="grid gap-4 md:grid-cols-2">{assignments.map((assignment) => <div className={card} key={assignment.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-kcs-gold-600">{assignment.test.subject}</p><h3 className="mt-1 text-lg font-bold dark:text-white">{assignment.test.title}</h3></div>{assignment.submission && <CheckCircle2 className="text-emerald-500"/>}</div><p className="mt-2 text-sm text-gray-500">{assignment.test.gradeLevel} · {assignment.test.questions.length} questions{assignment.dueAt ? ` · due ${new Date(assignment.dueAt).toLocaleDateString()}` : ''}</p>{assignment.submission ? <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm dark:bg-kcs-blue-800/30"><strong className="dark:text-white">Status: {assignment.submission.status.replace(/_/g, ' ')}</strong>{assignment.submission.submittedAt && <p className="mt-1 text-gray-500">Submitted {new Date(assignment.submission.submittedAt).toLocaleString()}</p>}{assignment.submission.status === 'APPROVED' && <p className="mt-2 text-2xl font-bold text-kcs-blue-700">{assignment.submission.percentage.toFixed(1)}%</p>}{assignment.submission.finalComment && <p className="mt-2 text-gray-600">{assignment.submission.finalComment}</p>}</div> : <button className={`${button} mt-4 inline-flex items-center gap-2`} disabled={busy} onClick={() => void start(assignment)}><PlayCircle size={17}/>Start assigned diagnostic</button>}</div>)}</div>}
  </div>
}
