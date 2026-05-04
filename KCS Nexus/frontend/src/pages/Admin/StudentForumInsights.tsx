import { Brain, CheckCircle2, ClipboardList, MessageSquareWarning, ShieldAlert, TrendingUp } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'

const report = {
  summary: 'AI reviewed student forum activity and found academic stress, club participation, wellbeing, and campus safety as the strongest student voice signals.',
  sentiment: 'student support needed',
  riskLevel: 'medium',
  metrics: { totalPosts: 34, totalComments: 118, urgentThreads: 1, concernedThreads: 11 },
  keyTopics: ['Academic stress', 'Study groups', 'Student life', 'Wellbeing', 'Safety'],
  recommendations: [
    'Ask counselors to review wellbeing signals weekly and escalate urgent student safety language immediately.',
    'Create supervised study support blocks before major exam periods.',
    'Share anonymized student voice themes with the principal, counselor, and homeroom teachers.',
  ],
  actionItems: [
    'Review the urgent wellbeing thread with counseling team.',
    'Prepare a student support announcement for study planning.',
    'Assign student council to summarize club participation requests.',
  ],
}

const StudentForumInsightsPage = () => {
  return (
    <div className="portal-shell flex">
      <PortalSidebar />
      <main>
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/85 px-6 py-4 backdrop-blur-md dark:border-kcs-blue-800 dark:bg-kcs-blue-950/85">
          <h1 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">Student Forum AI Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Leadership view of student conversations, wellbeing signals, conclusions, and recommended actions.</p>
        </div>

        <div className="space-y-6 p-6">
          <section className="rounded-2xl bg-gradient-to-r from-kcs-blue-900 to-kcs-blue-700 p-7 text-white">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                <Brain size={24} />
              </div>
              <div>
                <p className="text-sm text-kcs-blue-100">Current AI conclusion</p>
                <h2 className="font-display text-2xl font-bold">{report.sentiment} · {report.riskLevel} risk</h2>
              </div>
            </div>
            <p className="max-w-4xl text-kcs-blue-100">{report.summary}</p>
          </section>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: 'Student posts', value: report.metrics.totalPosts, icon: ClipboardList },
              { label: 'Comments', value: report.metrics.totalComments, icon: MessageSquareWarning },
              { label: 'Concern signals', value: report.metrics.concernedThreads, icon: TrendingUp },
              { label: 'Urgent threads', value: report.metrics.urgentThreads, icon: ShieldAlert },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <Icon size={18} className="mb-3 text-kcs-blue-600" />
                <p className="font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Key Topics</h2>
              <div className="flex flex-wrap gap-2">
                {report.keyTopics.map((topic) => <span key={topic} className="badge-blue">{topic}</span>)}
              </div>
            </section>
            <section className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Recommendations</h2>
              <div className="space-y-3">
                {report.recommendations.map((item) => (
                  <p key={item} className="flex gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-500" /> {item}
                  </p>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Action Items</h2>
              <div className="space-y-3">
                {report.actionItems.map((item) => (
                  <p key={item} className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-kcs-blue-800/30 dark:text-gray-300">{item}</p>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

export default StudentForumInsightsPage
