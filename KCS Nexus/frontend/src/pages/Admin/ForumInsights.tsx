import { Brain, CheckCircle2, ClipboardList, MessageSquareWarning, TrendingUp } from 'lucide-react'
import PortalSidebar from '@/components/layout/PortalSidebar'

const report = {
  summary: 'AI reviewed parent forum activity and found transport coordination, communication speed, and academic support as the strongest decision signals.',
  sentiment: 'mixed but stable',
  riskLevel: 'medium',
  metrics: { totalPosts: 28, totalComments: 94, urgentThreads: 2, concernedThreads: 9 },
  keyTopics: ['Transport', 'Communication', 'Math support', 'Campus safety', 'Events'],
  recommendations: [
    'Create a weekly parent communication digest owned by administration.',
    'Run a two-week pilot for staggered morning drop-off windows.',
    'Ask homeroom teachers to identify families needing math support resources.',
  ],
  actionItems: [
    'Assign operations lead to respond to transport threads.',
    'Prepare leadership note on safety supervision before Friday.',
    'Publish a parent-facing update after decisions are made.',
  ],
}

const ForumInsightsPage = () => {
  return (
    <div className="portal-shell flex">
      <PortalSidebar />
      <main>
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/85 px-6 py-4 backdrop-blur-md dark:border-kcs-blue-800 dark:bg-kcs-blue-950/85">
          <h1 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">Parent Forum AI Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Leadership view of parent conversations, conclusions, and recommended decisions.</p>
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
              { label: 'Forum posts', value: report.metrics.totalPosts, icon: ClipboardList },
              { label: 'Comments', value: report.metrics.totalComments, icon: MessageSquareWarning },
              { label: 'Concern signals', value: report.metrics.concernedThreads, icon: TrendingUp },
              { label: 'Urgent threads', value: report.metrics.urgentThreads, icon: Brain },
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

export default ForumInsightsPage
