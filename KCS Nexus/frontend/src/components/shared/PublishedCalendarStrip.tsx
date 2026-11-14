import { CalendarDays, ChevronDown } from 'lucide-react'
import { usePublishedAcademicCalendar } from '@/hooks/usePublishedAcademicCalendar'
import { useUIStore } from '@/store/uiStore'
import { academicPeriodLabel } from '@/constants/academicPeriods'
export default function PublishedCalendarStrip() {
  const { calendar, error, loading, refresh } = usePublishedAcademicCalendar()
  const fr = useUIStore(state => state.language) === 'fr'
  const date = (value: string) => new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
  if (!calendar) return <div className="published-calendar-status" role="status">{loading ? (fr ? 'Chargement du calendrier publié…' : 'Loading published calendar…') : (fr ? 'Calendrier publié momentanément indisponible.' : 'Published calendar temporarily unavailable.')} {!loading && <button type="button" onClick={() => void refresh()}>{fr ? 'Réessayer' : 'Retry'}</button>}</div>
  return <details className="published-calendar-strip" data-published-calendar={calendar.name}>
    <summary><CalendarDays size={17}/><span>{fr ? 'Année scolaire officielle' : 'Official academic year'} <strong>{calendar.name}</strong></span><span className="published-calendar-dates">{date(calendar.startDate)} – {date(calendar.endDate)}</span><ChevronDown className="published-calendar-chevron" size={16}/></summary>
    <div className="published-calendar-content"><p>{fr ? 'Calendrier central publié par la direction. Les dates ne clôturent pas automatiquement les notes.' : 'Central calendar published by school leadership. Dates never close grade entry automatically.'}</p>{error && <p role="status">{fr ? 'Connexion indisponible : dernière version chargée.' : 'Connection unavailable: showing the last loaded version.'}</p>}<div>{calendar.periods.map(period => <article key={period.code}><strong>{academicPeriodLabel((period.type === 'SEMESTER' ? 'Semester ' : 'Quarter ') + period.sequence, fr ? 'fr' : 'en')}</strong><span>{date(period.startDate)} – {date(period.endDate)}</span></article>)}</div></div>
  </details>
}
