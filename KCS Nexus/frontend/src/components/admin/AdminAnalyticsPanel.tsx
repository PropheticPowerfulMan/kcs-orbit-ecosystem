import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, BookOpen, Mail, RefreshCw, Users } from 'lucide-react'
import { adminAPI } from '@/services/api'
import { useUIStore } from '@/store/uiStore'

const card = 'rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-900'
const periods = ['7d', '30d', '90d', '365d'] as const

export default function AdminAnalyticsPanel() {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [period, setPeriod] = useState<(typeof periods)[number]>('30d')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await adminAPI.getAnalytics(period)
      setData(response.data?.data ?? null)
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? tr('Impossible de charger les analyses.', 'Unable to load analytics.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [period])

  const metrics = data ? [
    [tr('Élèves', 'Students'), data.population.students, Users],
    [tr('Parents', 'Parents'), data.population.parents, Users],
    [tr('Enseignants', 'Teachers'), data.population.teachers, BookOpen],
    [tr('Moyenne académique', 'Academic average'), data.academics.averagePercentage == null ? '—' : data.academics.averagePercentage + '%', BarChart3],
    [tr('Taux de présence', 'Attendance rate'), data.attendance.rate == null ? '—' : data.attendance.rate + '%', Activity],
    [tr('E-mails envoyés', 'Emails sent'), data.communications.emailSent, Mail],
  ] : []

  return <section className="space-y-5">
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">{tr('Données vérifiées de production', 'Verified production data')}</p>
          <h2 className="mt-1 text-2xl font-bold text-kcs-blue-950 dark:text-white">{tr('Analyses IA institutionnelles', 'Institutional AI Analytics')}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{tr('Indicateurs calculés uniquement à partir des enregistrements Nexus.', 'Indicators calculated only from Nexus records.')}</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>{tr('Actualiser','Refresh')}</button>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">{periods.map((item) => <button key={item} onClick={() => setPeriod(item)} className={period === item ? 'rounded-full bg-cyan-600 px-4 py-2 text-sm font-bold text-white' : 'rounded-full border border-cyan-200 px-4 py-2 text-sm font-bold text-kcs-blue-800 dark:border-kcs-blue-700 dark:text-cyan-200'}>{item === '365d' ? tr('Annuel','Annual') : item}</button>)}</div>
    </div>

    {error && <p className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
    {loading && !data && <p className={card}>{tr('Calcul des indicateurs réels…','Calculating verified indicators…')}</p>}

    {data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label,value,Icon]: any) => <article key={label} className={card}><Icon size={20} className="text-cyan-600 dark:text-cyan-300"/><b className="mt-3 block text-3xl text-kcs-blue-950 dark:text-white">{value}</b><span className="text-sm text-gray-500 dark:text-gray-300">{label}</span></article>)}</div>
      <div className="grid gap-5 xl:grid-cols-2">
        <article className={card}>
          <h3 className="font-bold text-kcs-blue-950 dark:text-white">{tr('Présence détaillée','Attendance evidence')}</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><span>{tr('Présents','Present')}: <b>{data.attendance.present}</b></span><span>{tr('Absents','Absent')}: <b>{data.attendance.absent}</b></span><span>{tr('Retards','Late')}: <b>{data.attendance.late}</b></span><span>{tr('Excusés','Excused')}: <b>{data.attendance.excused}</b></span></div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{data.attendance.total} {tr('enregistrements analysés','records analyzed')}</p>
        </article>
        <article className={card}>
          <h3 className="font-bold text-kcs-blue-950 dark:text-white">{tr('Communications','Communications')}</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><span>{tr('En file','Queued')}: <b>{data.communications.emailQueued}</b></span><span>{tr('Échecs','Failures')}: <b>{data.communications.emailFailed}</b></span><span>{tr('Messages internes','Internal messages')}: <b>{data.engagement.internalMessages}</b></span><span>{tr('Capacité horaire','Hourly capacity')}: <b>{data.communications.workerCapacityPerHour}</b></span></div>
        </article>
        <article className={card}>
          <h3 className="font-bold text-kcs-blue-950 dark:text-white">{tr('Engagement des forums','Forum engagement')}</h3>
          <div className="mt-4 space-y-2 text-sm"><p>{tr('Discussions parents','Parent discussions')}: <b>{data.engagement.parentForumPosts}</b></p><p>{tr('Réponses parents','Parent replies')}: <b>{data.engagement.parentForumComments}</b></p><p>{tr('Discussions élèves','Student discussions')}: <b>{data.engagement.studentForumPosts}</b></p></div>
        </article>
        <article className={card}>
          <h3 className="flex items-center gap-2 font-bold text-kcs-blue-950 dark:text-white"><AlertTriangle size={18}/>{tr('Signaux prioritaires','Priority signals')}</h3>
          <div className="mt-4 space-y-3">{data.risks.length ? data.risks.map((risk: any, index: number) => <div key={index} className="rounded-xl bg-amber-50 p-3 dark:bg-kcs-blue-950"><b className="text-sm text-kcs-blue-950 dark:text-white">{risk.title}</b><p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{risk.detail}</p></div>) : <p className="text-sm text-emerald-700 dark:text-emerald-300">{tr('Aucun signal prioritaire pour cette période.','No priority signal for this period.')}</p>}</div>
        </article>
      </div>
      <p className="text-right text-xs text-gray-400">{tr('Généré le','Generated')} {new Date(data.generatedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</p>
    </>}
  </section>
}
