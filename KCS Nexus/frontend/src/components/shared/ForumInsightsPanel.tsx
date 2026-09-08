import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { forumAPI, studentForumAPI } from '@/services/api'
import { useUIStore } from '@/store/uiStore'

type Kind = 'parent' | 'student'

export default function ForumInsightsPanel({ kind }: { kind: Kind }) {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await (kind === 'parent' ? forumAPI.getAIReport() : studentForumAPI.getAIReport())
      setReport(response.data.data)
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? tr('Impossible de charger le rapport.', 'Unable to load the report.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [kind])

  const title = kind === 'parent'
    ? tr('Rapport IA du forum des parents', 'Parent Forum AI Report')
    : tr('Rapport IA du forum des élèves', 'Student Forum AI Report')
  const metrics = report?.metrics
  const cards = [
    [tr('Discussions', 'Discussions'), metrics?.totalPosts],
    [tr('Réponses', 'Replies'), metrics?.totalComments],
    [tr('Préoccupations', 'Concern signals'), metrics?.concernedThreads],
    [tr('Urgences', 'Urgent threads'), metrics?.urgentThreads],
  ]

  return (
    <section className="space-y-5 rounded-2xl border border-kcs-blue-100 bg-white p-5 shadow-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-cyan-700 dark:text-cyan-300">{tr('Analyse des données réelles', 'Verified live-data analysis')}</p>
          <h2 className="mt-1 text-2xl font-bold text-kcs-blue-950 dark:text-white">{title}</h2>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{tr('Actualiser', 'Refresh')}
        </button>
      </div>
      {loading && <p className="rounded-xl bg-cyan-50 p-4 text-cyan-900 dark:bg-kcs-blue-950 dark:text-cyan-200">{tr('Analyse en cours…', 'Analysis in progress…')}</p>}
      {error && <p className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
      {report && (
        <>
          <p className="rounded-xl bg-kcs-blue-50 p-4 text-gray-700 dark:bg-kcs-blue-950 dark:text-gray-200">{report.summary}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-800">
                <b className="block text-2xl text-kcs-blue-950 dark:text-white">{value ?? 0}</b>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-950">
              <h3 className="font-bold text-kcs-blue-950 dark:text-white">{tr('Sujets principaux', 'Top topics')}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{report.keyTopics?.join(' · ') || tr('Aucun sujet enregistré.', 'No topic recorded yet.')}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-950">
              <h3 className="font-bold text-kcs-blue-950 dark:text-white">{tr('Niveau de risque', 'Risk level')}</h3>
              <p className="mt-2 font-bold uppercase text-cyan-700 dark:text-cyan-300">{report.riskLevel} · {report.sentiment}</p>
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-950">
            <h3 className="font-bold text-kcs-blue-950 dark:text-white">{tr('Recommandations', 'Recommendations')}</h3>
            <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200">{report.recommendations?.map((item: string) => <li key={item}>• {item}</li>)}</ul>
          </div>
        </>
      )}
    </section>
  )
}
