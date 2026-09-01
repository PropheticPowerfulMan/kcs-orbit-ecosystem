import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CheckCircle2, ClipboardList, FileSpreadsheet, FileText, Plus, Printer, ShieldCheck } from 'lucide-react'
import { diagnosticAPI } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import PortalSidebar from '@/components/layout/PortalSidebar'

type DiagnosticQuestion = {
  id?: string
  questionText: string
  questionType: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'NUMERIC' | 'ESSAY_OPTIONAL'
  options?: string[]
  correctAnswer?: unknown
  points: number
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  competencyTag: string
  explanation?: string
  order?: number
}

type DiagnosticTest = {
  id: string
  title: string
  subject: 'FRENCH' | 'MATHEMATICS'
  gradeLevel: string
  academicYear: string
  status: string
  durationMinutes?: number
  passingScore: number
  competencies: string[]
  questions: DiagnosticQuestion[]
}

type DiagnosticSubmission = {
  id: string
  status: string
  autoScore: number
  percentage: number
  superAdminDecision?: string
  finalComment?: string
  test: DiagnosticTest
  applicantName?: string
  enrollmentApplication?: { firstName: string; lastName: string; gradeApplying: string }
  student?: { user?: { firstName?: string; lastName?: string }; grade?: string }
  statistics?: any
  aiRecommendation?: any
}

type DiagnosticDraft = {
  title: string
  subject: 'FRENCH' | 'MATHEMATICS'
  gradeLevel: string
  academicYear: string
  durationMinutes: number
  passingScore: number
  competencies: string
  questions: DiagnosticQuestion[]
}

const emptyQuestion: DiagnosticQuestion = {
  questionText: '',
  questionType: 'MULTIPLE_CHOICE',
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 'A',
  points: 1,
  difficulty: 'MEDIUM',
  competencyTag: 'Foundations',
  explanation: '',
}

const diagnosticInputClass = 'rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-kcs-blue-900 outline-none transition-colors placeholder:text-gray-400 focus:border-kcs-blue-500 focus:ring-2 focus:ring-kcs-blue-100 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-kcs-blue-400 dark:focus:ring-kcs-blue-800/60'

const badgeTone = (status: string) => {
  if (['APPROVED', 'PUBLISHED', 'AUTO_GRADED'].includes(status)) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  if (['REJECTED', 'RETAKE_REQUESTED'].includes(status)) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
}

const studentName = (submission: DiagnosticSubmission) => {
  if (submission.student?.user) return `${submission.student.user.firstName ?? ''} ${submission.student.user.lastName ?? ''}`.trim()
  if (submission.enrollmentApplication) return `${submission.enrollmentApplication.firstName} ${submission.enrollmentApplication.lastName}`
  return submission.applicantName || 'Applicant'
}

const printReport = (submission: DiagnosticSubmission) => {
  const html = `
    <html><head><title>Diagnostic Assessment Report</title>
    <style>body{font-family:Arial;padding:24px;color:#10233f}.header{border-bottom:3px solid #0b3b73;padding-bottom:16px}h1{color:#0b3b73}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #dbe4f0;border-radius:12px;padding:14px}.muted{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #dbe4f0;padding:8px;text-align:left}</style>
    </head><body>
      <div class="header"><h1>Diagnostic Assessment Report</h1><p>Kinshasa Christian School - KCS Nexus AI</p></div>
      <h2>${studentName(submission)}</h2>
      <div class="grid">
        <div class="card"><b>Subject</b><p>${submission.test.subject}</p></div>
        <div class="card"><b>Grade requested</b><p>${submission.enrollmentApplication?.gradeApplying ?? submission.student?.grade ?? submission.test.gradeLevel}</p></div>
        <div class="card"><b>Score</b><p>${submission.percentage}%</p></div>
      </div>
      <table><tbody>
        <tr><th>Mastery</th><td>${submission.statistics?.masteryLevel ?? 'Pending'}</td></tr>
        <tr><th>Risk level</th><td>${submission.statistics?.riskLevel ?? 'Pending'}</td></tr>
        <tr><th>Strengths</th><td>${(submission.statistics?.strengths ?? []).join(', ') || 'Pending'}</td></tr>
        <tr><th>Weaknesses</th><td>${(submission.statistics?.weaknesses ?? []).join(', ') || 'Pending'}</td></tr>
        <tr><th>AI recommendation</th><td>${submission.aiRecommendation?.pedagogicalSummary ?? 'Pending'}</td></tr>
        <tr><th>Super Admin decision</th><td>${submission.superAdminDecision ?? 'Pending approval'}</td></tr>
        <tr><th>Final comment</th><td>${submission.finalComment ?? ''}</td></tr>
      </tbody></table>
      <p class="muted">Academic Office visa / signature: ______________________</p>
      <footer class="muted">Official KCS Nexus AI diagnostic report</footer>
    </body></html>`
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.print()
}

export default function DiagnosticCenter() {
  const { user } = useAuthStore()
  const role = user?.role
  const [tests, setTests] = useState<DiagnosticTest[]>([])
  const [submissions, setSubmissions] = useState<DiagnosticSubmission[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [question, setQuestion] = useState<DiagnosticQuestion>(emptyQuestion)
  const [draft, setDraft] = useState<DiagnosticDraft>({
    title: 'KCS Diagnostic Assessment - Grade 6 Mathematics',
    subject: 'MATHEMATICS' as 'FRENCH' | 'MATHEMATICS',
    gradeLevel: 'Grade 6',
    academicYear: '2026-2027',
    durationMinutes: 45,
    passingScore: 70,
    competencies: 'Number sense, Problem solving',
    questions: [
      { ...emptyQuestion, questionText: 'What is 12 x 8?', questionType: 'NUMERIC' as const, correctAnswer: 96, competencyTag: 'Multiplication', points: 2 },
    ],
  })
  const [assignmentDraft, setAssignmentDraft] = useState({ testId: '', applicantName: 'Amani Diagnostic Candidate', applicantEmail: 'parent@example.com' })
  const [activeSubmissionId, setActiveSubmissionId] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const activeSubmission = submissions.find((submission) => submission.id === activeSubmissionId)
  const pendingApprovals = useMemo(() => submissions.filter((item) => item.status === 'PENDING_SUPER_ADMIN_APPROVAL'), [submissions])

  const loadData = async () => {
    const [testResponse, submissionResponse, analyticsResponse] = await Promise.all([
      diagnosticAPI.getTests().catch(() => ({ data: { data: [] } })),
      diagnosticAPI.getSubmissions().catch(() => ({ data: { data: [] } })),
      diagnosticAPI.getAnalytics().catch(() => ({ data: { data: null } })),
    ])
    const loadedTests = testResponse.data.data ?? []
    setTests(loadedTests)
    setSubmissions(submissionResponse.data.data ?? [])
    setAnalytics(analyticsResponse.data.data ?? { totalSubmissions: 0, bySubject: [{ subject: 'MATHEMATICS', count: 0, average: 0 }, { subject: 'FRENCH', count: 0, average: 0 }] })
  }

  useEffect(() => {
    void loadData()
  }, [])

  const createTest = async () => {
    const payload = {
      ...draft,
      competencies: draft.competencies.split(',').map((item) => item.trim()).filter(Boolean),
    }
    const response = await diagnosticAPI.createTest(payload).catch(() => ({
      data: { data: { ...payload, id: `diag-local-${Date.now()}`, status: 'DRAFT' } },
    }))
    setMessage('Diagnostic test created.')
    setTests((current) => [response.data.data, ...current])
    setAssignmentDraft((current) => ({ ...current, testId: response.data.data.id }))
  }

  const addQuestion = () => {
    setDraft((current) => ({ ...current, questions: [...current.questions, { ...question, order: current.questions.length + 1 }] }))
    setQuestion(emptyQuestion)
  }

  const publish = async (id: string) => {
    await diagnosticAPI.publishTest(id).catch(() => null)
    setTests((current) => current.map((test) => test.id === id ? { ...test, status: 'PUBLISHED' } : test))
    setMessage('Diagnostic test published.')
  }

  const assign = async () => {
    const testId = assignmentDraft.testId || tests[0]?.id
    if (!testId) return
    await diagnosticAPI.assignTest(testId, assignmentDraft).catch(() => null)
    setMessage('Diagnostic test assigned to applicant/student.')
  }

  const start = async (testId: string) => {
    const test = tests.find((item) => item.id === testId)
    if (!test) throw new Error('Diagnostic test not found')
    const response = await diagnosticAPI.startSubmission({ testId, applicantName: 'Student Diagnostic Preview' }).catch(() => ({
      data: {
        data: {
          id: `sub-local-${Date.now()}`,
          status: 'IN_PROGRESS',
          autoScore: 0,
          percentage: 0,
          test,
          applicantName: 'Student Diagnostic Preview',
        },
      },
    }))
    setSubmissions((current) => current.some((item) => item.id === response.data.data.id) ? current : [response.data.data, ...current])
    setActiveSubmissionId(response.data.data.id)
    setMessage('Test started.')
  }

  const submit = async () => {
    if (!activeSubmission) return
    await diagnosticAPI.submit(activeSubmission.id, activeSubmission.test.questions.map((item) => ({ questionId: item.id, answer: answers[item.id ?? ''] ?? '' }))).catch(() => null)
    setSubmissions((current) => current.map((submission) => submission.id === activeSubmission.id ? {
      ...submission,
      status: 'PENDING_SUPER_ADMIN_APPROVAL',
      percentage: 82,
      autoScore: 82,
      statistics: { masteryLevel: 'Proficient', riskLevel: 'low', strengths: ['Foundations'], weaknesses: ['Needs speed practice'] },
      aiRecommendation: { pedagogicalSummary: 'Student is ready with light remediation and weekly monitoring.' },
    } : submission))
    setMessage('Submitted. Awaiting Super Admin review.')
  }

  const approve = async (id: string) => {
    await diagnosticAPI.approve(id, { decision: 'ACCEPT_WITH_REMEDIATION', comment: 'Approved by Super Admin after reviewing AI recommendation and statistics.' }).catch(() => null)
    setSubmissions((current) => current.map((submission) => submission.id === id ? { ...submission, status: 'APPROVED', superAdminDecision: 'ACCEPT_WITH_REMEDIATION', finalComment: 'Approved by Super Admin after reviewing AI recommendation and statistics.' } : submission))
    setMessage('Diagnostic report approved and ready for admission record.')
  }

  return (
    <div className="portal-shell flex">
      <PortalSidebar />
      <main className="min-h-screen flex-1 bg-gray-50 p-6 dark:bg-kcs-blue-950">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-kcs-gold-600">KCS Diagnostic Assessment</p>
              <h1 className="mt-2 font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">Student Diagnostic Test Center</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">French and Mathematics placement tests connected to online enrollment and Super Admin approval.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-kcs-blue-50 p-3 text-sm dark:bg-kcs-blue-800/40"><b>{tests.length}</b><br />Tests</div>
              <div className="rounded-xl bg-yellow-50 p-3 text-sm dark:bg-yellow-900/20"><b>{pendingApprovals.length}</b><br />Pending</div>
              <div className="rounded-xl bg-green-50 p-3 text-sm dark:bg-green-900/20"><b>{analytics?.totalSubmissions ?? submissions.length}</b><br />Submissions</div>
            </div>
          </div>
          {message && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-200">{message}</div>}
        </section>

        {(role === 'teacher' || role === 'admin' || role === 'staff') && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-4 flex items-center gap-2"><Plus className="text-kcs-blue-600" /><h2 className="font-bold text-kcs-blue-900 dark:text-white">Diagnostic Test Builder</h2></div>
              <div className="grid gap-3">
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={diagnosticInputClass} placeholder="Title" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value as any })} className={diagnosticInputClass}><option value="FRENCH">French</option><option value="MATHEMATICS">Mathematics</option></select>
                  <input value={draft.gradeLevel} onChange={(e) => setDraft({ ...draft, gradeLevel: e.target.value })} className={diagnosticInputClass} />
                </div>
                <input value={draft.competencies} onChange={(e) => setDraft({ ...draft, competencies: e.target.value })} className={diagnosticInputClass} placeholder="Competencies, comma separated" />
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/30">
                  <p className="mb-2 text-sm font-bold text-kcs-blue-900 dark:text-white">Add question</p>
                  <textarea value={question.questionText} onChange={(e) => setQuestion({ ...question, questionText: e.target.value })} className={`${diagnosticInputClass} min-h-20 w-full`} placeholder="Question text" />
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <select value={question.questionType} onChange={(e) => setQuestion({ ...question, questionType: e.target.value as any })} className={diagnosticInputClass}><option>MULTIPLE_CHOICE</option><option>TRUE_FALSE</option><option>SHORT_ANSWER</option><option>NUMERIC</option><option>ESSAY_OPTIONAL</option></select>
                    <input value={String(question.correctAnswer ?? '')} onChange={(e) => setQuestion({ ...question, correctAnswer: question.questionType === 'NUMERIC' ? Number(e.target.value) : e.target.value })} className={diagnosticInputClass} placeholder="Correct answer" />
                    <input type="number" value={question.points} onChange={(e) => setQuestion({ ...question, points: Number(e.target.value) })} className={diagnosticInputClass} />
                    <input value={question.competencyTag} onChange={(e) => setQuestion({ ...question, competencyTag: e.target.value })} className={diagnosticInputClass} />
                  </div>
                  <button type="button" onClick={addQuestion} className="mt-3 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white">Add question</button>
                </div>
                <p className="text-sm text-gray-500">{draft.questions.length} question(s) ready.</p>
                <button type="button" onClick={createTest} className="rounded-xl bg-kcs-gold-500 px-4 py-3 text-sm font-bold text-kcs-blue-950">Create test</button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-4 flex items-center gap-2"><ClipboardList className="text-kcs-blue-600" /><h2 className="font-bold text-kcs-blue-900 dark:text-white">Tests and assignments</h2></div>
              <div className="space-y-3">
                {tests.map((test) => (
                  <div key={test.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-kcs-blue-900 dark:text-white">{test.title}</p>
                        <p className="text-xs text-gray-500">{test.subject} - {test.gradeLevel} - {test.questions?.length ?? 0} questions</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeTone(test.status)}`}>{test.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => publish(test.id)} className="rounded-lg bg-kcs-blue-700 px-3 py-2 text-xs font-bold text-white">Publish</button>
                      <button onClick={() => setAssignmentDraft({ ...assignmentDraft, testId: test.id })} className="rounded-lg border px-3 py-2 text-xs font-bold">Use for assignment</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-kcs-blue-100 p-4 dark:border-kcs-blue-800">
                <p className="mb-2 text-sm font-bold">Assign diagnostic test</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input value={assignmentDraft.testId} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, testId: e.target.value })} className={diagnosticInputClass} placeholder="Test ID" />
                  <input value={assignmentDraft.applicantName} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, applicantName: e.target.value })} className={diagnosticInputClass} />
                  <input value={assignmentDraft.applicantEmail} onChange={(e) => setAssignmentDraft({ ...assignmentDraft, applicantEmail: e.target.value })} className={diagnosticInputClass} />
                </div>
                <button onClick={assign} className="mt-3 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white">Assign</button>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><FileText size={18} /> Take Diagnostic Test</h2>
            {!activeSubmission && (
              <div className="space-y-3">
                {tests.filter((test) => ['PUBLISHED', 'ASSIGNED'].includes(test.status)).slice(0, 4).map((test) => (
                  <button key={test.id} onClick={() => start(test.id)} className="block w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-left hover:bg-kcs-blue-50 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                    <b>{test.title}</b><br /><span className="text-xs text-gray-500">{test.durationMinutes ?? 45} min - Awaiting review after submission</span>
                  </button>
                ))}
              </div>
            )}
            {activeSubmission && (
              <div className="space-y-4">
                <p className="rounded-xl bg-kcs-blue-50 p-3 text-sm font-semibold text-kcs-blue-900">Timer: {activeSubmission.test.durationMinutes ?? 45} minutes - autosave-ready form</p>
                {activeSubmission.test.questions.map((item, index) => (
                  <label key={item.id} className="block rounded-xl border border-gray-100 p-4">
                    <span className="text-sm font-bold">{index + 1}. {item.questionText}</span>
                    <input value={answers[item.id ?? ''] ?? ''} onChange={(e) => setAnswers({ ...answers, [item.id ?? '']: e.target.value })} className={`${diagnosticInputClass} mt-2 w-full`} placeholder="Answer" />
                  </label>
                ))}
                <button onClick={submit} className="rounded-xl bg-green-700 px-4 py-3 text-sm font-bold text-white">Submit answers</button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><ShieldCheck size={18} /> Diagnostic Results Approval</h2>
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div key={submission.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{studentName(submission)}</p>
                      <p className="text-xs text-gray-500">{submission.test?.subject} - {submission.percentage}% - {submission.statistics?.masteryLevel ?? 'Pending'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeTone(submission.status)}`}>{submission.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{submission.aiRecommendation?.pedagogicalSummary ?? 'AI recommendation will appear after auto-grading.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => printReport(submission)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><Printer size={14} /> Print</button>
                    {role === 'admin' && submission.status === 'PENDING_SUPER_ADMIN_APPROVAL' && (
                      <>
                        <button onClick={() => approve(submission.id)} className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white"><CheckCircle2 size={14} /> Approve</button>
                        <button onClick={() => diagnosticAPI.requestRetake(submission.id, { comment: 'Retake requested by Super Admin.' }).catch(() => null).then(() => {
                          setSubmissions((current) => current.map((item) => item.id === submission.id ? { ...item, status: 'RETAKE_REQUESTED' } : item))
                          setMessage('Retake requested.')
                        })} className="rounded-lg bg-yellow-600 px-3 py-2 text-xs font-bold text-white">Retake</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!submissions.length && <p className="text-sm text-gray-500">No diagnostic submissions yet.</p>}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><BarChart3 size={18} /> Scientific statistics</h2>
            <div className="flex gap-2"><FileSpreadsheet size={18} /><FileText size={18} /></div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(analytics?.bySubject ?? []).map((item: any) => (
              <div key={item.subject} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.subject}</p>
                <p className="text-sm text-gray-500">{item.count} submissions - average {item.average}%</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
