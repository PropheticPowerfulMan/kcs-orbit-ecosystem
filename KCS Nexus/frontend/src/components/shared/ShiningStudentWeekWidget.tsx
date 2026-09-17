import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { shiningStudentsAPI } from '@/services/api'
import { useUIStore } from '@/store/uiStore'

type Row = { id: string; date: string; division: 'LOWER' | 'MIDDLE_UPPER'; topic?: string | null; status: string; student: { grade: string; section: string; user: { firstName: string; middleName?: string | null; lastName: string } } }
const day = (value: Date) => value.toISOString().slice(0, 10)

export default function ShiningStudentWeekWidget() {
  const language = useUIStore((state) => state.language)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const now = new Date()
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() === 0 ? 6 : monday.getUTCDay() - 1))
    const sunday = new Date(monday); sunday.setUTCDate(sunday.getUTCDate() + 6)
    shiningStudentsAPI.list({ from: day(monday), to: day(sunday) })
      .then((response) => setRows(response.data?.data || []))
      .catch((reason) => setError(reason?.response?.data?.message || 'Shining Student schedule unavailable.'))
  }, [])
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  return <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/20">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.17em] text-amber-700 dark:text-amber-300"><CalendarDays size={17}/> Shining Student</p><h2 className="mt-1 text-xl font-bold text-kcs-blue-950 dark:text-white">{tr('Liste officielle de cette semaine', 'This week’s official list')}</h2></div><Link to="/shining-students" className="rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-center text-sm font-bold text-white">{tr('Ouvrir le planning', 'Open schedule')}</Link></div>
    {error ? <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : rows.length === 0 ? <p className="mt-4 rounded-xl bg-white/70 p-4 text-sm text-slate-500 dark:bg-kcs-blue-950/40 dark:text-slate-300">{tr('Aucun passage programmé cette semaine.', 'No presentation scheduled this week.')}</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-[680px] w-full text-sm"><thead><tr className="border-b border-amber-200 text-left text-xs uppercase text-slate-500 dark:border-amber-800"><th className="py-3">Date</th><th>{tr('Division', 'Division')}</th><th>{tr('Élève', 'Student')}</th><th>{tr('Classe', 'Class')}</th><th>{tr('Sujet', 'Topic')}</th><th>{tr('Statut', 'Status')}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-amber-100 last:border-0 dark:border-amber-900/50"><td className="py-3 font-semibold dark:text-white">{new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(row.date))}</td><td>{row.division === 'LOWER' ? 'Lower School' : 'Middle/Upper School'}</td><td className="font-semibold dark:text-white">{[row.student.user.lastName, row.student.user.middleName, row.student.user.firstName].filter(Boolean).join(' ')}</td><td>{row.student.grade}{row.student.section ? ' ' + row.student.section : ''}</td><td>{row.topic || tr('À choisir', 'To be chosen')}</td><td>{row.status.replace(/_/g, ' ')}</td></tr>)}</tbody></table></div>}
  </section>
}
