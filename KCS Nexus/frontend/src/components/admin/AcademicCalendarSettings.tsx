import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Save } from 'lucide-react'
import { academicCalendarAPI } from '@/services/api'

type Period = { type: 'SEMESTER' | 'TRIMESTER'; sequence: number; code: string; name: string; startDate: string; endDate: string }
type Calendar = { name: string; startDate: string; endDate: string; isCurrent: boolean; status: string; periods: Period[] }

const iso = (year: number, month: number, day: number, end = false) =>
  new Date(Date.UTC(year, month, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0)).toISOString()

function template(startYear: number) {
  const period = (type: Period['type'], sequence: number, code: string, name: string, startDate: string, endDate: string): Period =>
    ({ type, sequence, code, name, startDate, endDate })

  if (startYear === 2026) {
    return {
      name: '2026-2027',
      startDate: iso(2026, 8, 7),
      endDate: iso(2027, 5, 11, true),
      status: 'ACTIVE',
      isCurrent: true,
      periods: [
        period('SEMESTER', 1, 'S1', 'Semestre 1', iso(2026, 8, 7), iso(2027, 0, 29, true)),
        period('SEMESTER', 2, 'S2', 'Semestre 2', iso(2027, 1, 1), iso(2027, 5, 11, true)),
        period('TRIMESTER', 1, 'T1', 'Trimestre 1', iso(2026, 8, 7), iso(2026, 11, 18, true)),
        period('TRIMESTER', 2, 'T2', 'Trimestre 2', iso(2027, 0, 5), iso(2027, 2, 19, true)),
        period('TRIMESTER', 3, 'T3', 'Trimestre 3', iso(2027, 3, 5), iso(2027, 5, 11, true)),
      ],
    }
  }

  return {
    name: `${startYear}-${startYear + 1}`,
    startDate: iso(startYear, 8, 1),
    endDate: iso(startYear + 1, 5, 30, true),
    status: 'ACTIVE',
    isCurrent: true,
    periods: [
      period('SEMESTER', 1, 'S1', 'Semestre 1', iso(startYear, 8, 1), iso(startYear + 1, 0, 31, true)),
      period('SEMESTER', 2, 'S2', 'Semestre 2', iso(startYear + 1, 1, 1), iso(startYear + 1, 5, 30, true)),
      period('TRIMESTER', 1, 'T1', 'Trimestre 1', iso(startYear, 8, 1), iso(startYear, 11, 31, true)),
      period('TRIMESTER', 2, 'T2', 'Trimestre 2', iso(startYear + 1, 0, 1), iso(startYear + 1, 2, 31, true)),
      period('TRIMESTER', 3, 'T3', 'Trimestre 3', iso(startYear + 1, 3, 1), iso(startYear + 1, 5, 30, true)),
    ],
  }
}

const fmt = (value: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))

export default function AcademicCalendarSettings() {
  const [calendar, setCalendar] = useState<Calendar | null>(null)
  const [startYear, setStartYear] = useState(2026)
  const [status, setStatus] = useState('Chargement du calendrier central…')
  const [proposed, setProposed] = useState(() => template(2026))

  useEffect(() => {
    academicCalendarAPI.current().then(({ data }) => {
      setCalendar(data.calendar)
      setStartYear(Number(data.calendar.name.slice(0, 4)))
      setProposed({ ...data.calendar, periods: data.calendar.periods ?? [] })
      setStatus('')
    }).catch(() => setStatus('Calendrier central indisponible. Vérifiez la configuration Orbit.'))
  }, [])

  const save = async () => {
    setStatus('Activation en cours…')
    try {
      const { data } = await academicCalendarAPI.save(proposed)
      setCalendar(data.calendar)
      setStatus('Année scolaire activée et synchronisée pour tout l’écosystème.')
    } catch (error: any) {
      setStatus(error?.response?.data?.message || 'La mise à jour a échoué.')
    }
  }

  const chooseStartYear = (value: number) => {
    setStartYear(value)
    setProposed(template(value))
  }
  const dateValue = (value: string) => value?.slice(0, 10) ?? ''
  const toIsoDate = (value: string, end = false) => value ? new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString() : ''
  const updatePeriod = (code: string, patch: Partial<Period>) => setProposed((current) => ({ ...current, periods: current.periods.map((item) => item.code === code ? { ...item, ...patch } : item) }))

  return (
    <section className="rounded-2xl border border-kcs-blue-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><CalendarDays className="text-kcs-blue-600" size={22}/><h2 className="font-bold text-kcs-blue-900 dark:text-white">Calendrier scolaire central</h2></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Source unique Orbit pour Nexus, Savanex, EduPay, EduSync et Academy. Juillet et août restent hors année scolaire.</p>
        </div>
        {calendar?.isCurrent && <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"><CheckCircle2 size={14}/> Actif : {calendar.name}</span>}
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-kcs-blue-900 dark:text-white">Année de rentrée
          <input type="number" min="2020" max="2100" value={startYear} onChange={(event) => chooseStartYear(Number(event.target.value))} className="mt-1 block rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none focus:border-kcs-gold-500 focus:ring-4 focus:ring-kcs-gold-100/60 dark:border-kcs-blue-600 dark:bg-kcs-blue-950 dark:text-white dark:[color-scheme:dark]"/>
        </label>
        <div className="rounded-xl border border-kcs-blue-100 bg-kcs-blue-50 px-4 py-2 text-sm font-bold text-kcs-blue-800 dark:border-kcs-blue-600 dark:bg-kcs-blue-800/70 dark:text-kcs-blue-100">{proposed.name} · {fmt(proposed.startDate)} — {fmt(proposed.endDate)}</div>
        <button type="button" onClick={save} className="btn-primary flex items-center gap-2 py-2"><Save size={16}/> Enregistrer et activer</button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold uppercase text-gray-500">Début officiel de l’année<input type="date" value={dateValue(proposed.startDate)} onChange={(event) => setProposed((current) => ({ ...current, startDate: toIsoDate(event.target.value) }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 normal-case text-gray-900 dark:border-kcs-blue-600 dark:bg-kcs-blue-950 dark:text-white dark:[color-scheme:dark]"/></label>
        <label className="text-xs font-bold uppercase text-gray-500">Fin officielle de l’année<input type="date" value={dateValue(proposed.endDate)} onChange={(event) => setProposed((current) => ({ ...current, endDate: toIsoDate(event.target.value, true) }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 normal-case text-gray-900 dark:border-kcs-blue-600 dark:bg-kcs-blue-950 dark:text-white dark:[color-scheme:dark]"/></label>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {(['SEMESTER', 'TRIMESTER'] as const).map((type) => <div key={type} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
          <h3 className="text-sm font-bold text-kcs-blue-900 dark:text-white">{type === 'SEMESTER' ? 'Semestres' : 'Trimestres'}</h3>
          <div className="mt-3 space-y-2">{proposed.periods.filter((item) => item.type === type).map((item) =>
            <div key={item.code} className="rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-600 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-gray-300"><strong>{item.code} · {item.name}</strong><div className="mt-2 grid grid-cols-2 gap-2"><label>Début<input type="date" value={dateValue(item.startDate)} onChange={(event) => updatePeriod(item.code, { startDate: toIsoDate(event.target.value) })} className="mt-1 w-full rounded-lg border px-2 py-2 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:[color-scheme:dark]"/></label><label>Fin<input type="date" value={dateValue(item.endDate)} onChange={(event) => updatePeriod(item.code, { endDate: toIsoDate(event.target.value, true) })} className="mt-1 w-full rounded-lg border px-2 py-2 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:[color-scheme:dark]"/></label></div></div>)}</div>
        </div>)}
      </div>
      <p className="mt-4 text-xs text-amber-700">L’activation change les valeurs par défaut des nouveaux dossiers. Elle ne promeut aucun élève et ne modifie ni notes, ni paiements, ni dettes historiques.</p>
      {status && <p className="mt-3 text-sm font-semibold text-kcs-blue-700 dark:text-kcs-blue-200">{status}</p>}
    </section>
  )
}
