import { useMemo, useState } from 'react'
import { CalendarDays, Clock3, MapPin, UserRound, UsersRound } from 'lucide-react'

export type WeeklyTimetableEntry = {
  id?: string
  day?: string
  startTime?: string
  endTime?: string
  title?: string
  courseName?: string
  courseCode?: string
  room?: string
  teacher?: string
  className?: string
  studentCount?: number
  description?: string
}

type Props = {
  entries: WeeklyTimetableEntry[]
  language?: string
  audience: 'student' | 'teacher'
}

const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const aliases: Record<string, string> = {
  lundi: 'monday', mardi: 'tuesday', mercredi: 'wednesday', jeudi: 'thursday',
  vendredi: 'friday', samedi: 'saturday', dimanche: 'sunday',
}
const labels = {
  fr: { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' },
  en: { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' },
} as const
const cleanDay = (value?: string) => {
  const key = String(value ?? '').trim().toLowerCase()
  return aliases[key] ?? key
}
const timeValue = (value?: string) => String(value ?? '').slice(0, 5)
const titleOf = (entry: WeeklyTimetableEntry) => entry.courseName || entry.title || entry.courseCode || 'Course'
const codeOf = (entry: WeeklyTimetableEntry) => entry.courseCode || ''
const tone = (index: number) => [
  'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-950/45 dark:text-blue-50',
  'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-50',
  'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/35 dark:text-violet-50',
  'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/35 dark:text-amber-50',
][index % 4]

export default function WeeklyTimetable({ entries, language = 'en', audience }: Props) {
  const fr = language === 'fr'
  const normalized = useMemo(() => entries.map((entry, index) => ({
    ...entry,
    id: entry.id || String(index),
    dayKey: cleanDay(entry.day),
    start: timeValue(entry.startTime),
    end: timeValue(entry.endTime),
  })).sort((left, right) => {
    const dayDifference = dayOrder.indexOf(left.dayKey) - dayOrder.indexOf(right.dayKey)
    return dayDifference || left.start.localeCompare(right.start)
  }), [entries])
  const days = useMemo(() => [...new Set(normalized.map((entry) => entry.dayKey))].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)), [normalized])
  const [selectedDay, setSelectedDay] = useState('')
  const activeDay = days.includes(selectedDay) ? selectedDay : days[0]
  const slots = useMemo(() => [...new Set(normalized.map((entry) => entry.start + '-' + entry.end))].sort(), [normalized])
  const dayLabel = (day: string) => (fr ? labels.fr : labels.en)[day as keyof typeof labels.fr] || day
  const empty = fr ? "Aucun cours officiel n'a encore ete publie dans cet horaire." : 'No official class has been published in this timetable yet.'
  if (!normalized.length) return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-kcs-blue-700 dark:bg-kcs-blue-900/50 dark:text-slate-300">{empty}</div>

  const Details = ({ entry, index, compact = false }: { entry: typeof normalized[number]; index: number; compact?: boolean }) => <article className={'rounded-2xl border p-4 shadow-sm antialiased [text-rendering:optimizeLegibility] ' + tone(index)}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0"><p className="break-words text-[15px] font-extrabold leading-snug tracking-normal sm:text-base">{titleOf(entry)}</p>{codeOf(entry) && <p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-80">{codeOf(entry)}</p>}</div>
      {!compact && <CalendarDays size={17} className="shrink-0 opacity-60"/>}
    </div>
    <p className="mt-3 flex items-center gap-1.5 text-sm font-extrabold"><Clock3 size={14}/>{entry.start}-{entry.end}</p>
    <div className="mt-2 space-y-1.5 text-[13px] font-medium leading-relaxed opacity-95">
      {entry.room && <p className="flex items-center gap-1.5"><MapPin size={13}/>{entry.room}</p>}
      {entry.teacher && <p className="flex items-center gap-1.5"><UserRound size={13}/>{entry.teacher}</p>}
      {entry.className && <p className="flex items-center gap-1.5"><UsersRound size={13}/>{entry.className}</p>}
      {audience === 'teacher' && entry.studentCount != null && <p className="flex items-center gap-1.5"><UsersRound size={13}/>{entry.studentCount} {fr ? 'eleves' : 'students'}</p>}
    </div>
    {entry.description && !compact && <p className="mt-3 border-t border-current/15 pt-3 text-[13px] font-medium leading-relaxed opacity-90">{entry.description}</p>}
  </article>

  return <section className="space-y-5 antialiased [text-rendering:optimizeLegibility]">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl bg-kcs-blue-950 p-4 text-white"><p className="text-xs uppercase text-blue-200">{fr ? 'Cours programmes' : 'Scheduled classes'}</p><b className="mt-1 block text-2xl">{normalized.length}</b></div>
      <div className="rounded-2xl bg-kcs-blue-700 p-4 text-white"><p className="text-xs uppercase text-blue-100">{fr ? 'Jours de cours' : 'School days'}</p><b className="mt-1 block text-2xl">{days.length}</b></div>
      <div className="rounded-2xl bg-kcs-gold-400 p-4 text-kcs-blue-950"><p className="text-xs uppercase opacity-70">{fr ? 'Plage horaire' : 'Time range'}</p><b className="mt-1 block text-lg">{normalized[0]?.start} - {normalized[normalized.length - 1]?.end}</b></div>
    </div>

    <div className="lg:hidden">
      <div className="flex snap-x gap-2 overflow-x-auto pb-3">
        {days.map((day) => <button type="button" key={day} onClick={() => setSelectedDay(day)} className={'shrink-0 snap-start rounded-full px-4 py-2 text-sm font-bold ' + (activeDay === day ? 'bg-kcs-blue-700 text-white' : 'border bg-white text-kcs-blue-900 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-white')}>{dayLabel(day)}</button>)}
      </div>
      <div className="space-y-3">{normalized.filter((entry) => entry.dayKey === activeDay).map((entry, index) => <Details key={entry.id} entry={entry} index={index}/>)}</div>
    </div>

    <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-900 lg:block">
      <table className="w-full min-w-[980px] table-fixed text-[15px]">
        <thead><tr className="bg-kcs-blue-950 text-left text-sm text-white"><th className="w-32 p-4">{fr ? 'Heure' : 'Time'}</th>{days.map((day) => <th key={day} className="p-4">{dayLabel(day)}</th>)}</tr></thead>
        <tbody>{slots.map((slot, rowIndex) => {
          const [start, end] = slot.split('-')
          return <tr key={slot} className="border-t border-slate-100 align-top dark:border-kcs-blue-800"><th className="bg-slate-50 p-4 text-left text-sm text-kcs-blue-950 dark:bg-kcs-blue-950 dark:text-white"><Clock3 className="mb-1" size={16}/>{start}<span className="block text-xs font-normal text-slate-500">{end}</span></th>{days.map((day, dayIndex) => <td key={day} className="p-2">{normalized.filter((entry) => entry.dayKey === day && entry.start === start && entry.end === end).map((entry) => <Details key={entry.id} entry={entry} index={rowIndex + dayIndex} compact/>)}</td>)}</tr>
        })}</tbody>
      </table>
    </div>
  </section>
}
