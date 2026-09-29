import { useEffect, useMemo, useState } from 'react'
import { GraduationCap, Search, UserRound, UsersRound, X } from 'lucide-react'
import { api } from './api'
import type { Person } from './types'

type Lang = 'fr' | 'en'
type DirectoryResponse = { people: Person[]; total: number; facets: { classes: string[]; counts: Record<string, number> } }

export default function PersonSelector({ value, onChange, lang }: { value: Person | null; onChange: (person: Person | null) => void; lang: Lang }) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [className, setClassName] = useState('')
  const [result, setResult] = useState<DirectoryResponse>({ people: [], total: 0, facets: { classes: [], counts: {} } })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (kind) params.set('kind', kind)
      if (className) params.set('className', className)
      try { setResult(await api<DirectoryResponse>('/directory?' + params.toString(), { signal: controller.signal })) }
      catch (error) { if ((error as Error).name !== 'AbortError') setResult(current => ({ ...current, people: [], total: 0 })) }
      finally { setLoading(false) }
    }, 280)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, kind, className])

  const labels = useMemo(() => lang === 'fr' ? {
    all: 'Toutes les entités', student: 'Élèves', teacher: 'Enseignants', staff: 'Personnel', allClasses: 'Toutes les classes',
    placeholder: 'Nom, code, e-mail, téléphone, classe, fonction…', found: 'résultat(s)', select: 'Sélectionner', clear: 'Changer de personne'
  } : {
    all: 'All entities', student: 'Students', teacher: 'Teachers', staff: 'Staff', allClasses: 'All classes',
    placeholder: 'Name, code, email, phone, class, job title…', found: 'result(s)', select: 'Select', clear: 'Change person'
  }, [lang])

  if (value) return <div className="selected-person detailed"><div className="avatar">{value.fullName.slice(0, 2).toUpperCase()}</div><div><b>{value.fullName}</b><small>{value.kind} · {value.displayId || value.className || 'KCS Orbit'}</small><em>{[value.className, value.email, value.phone].filter(Boolean).join(' · ')}</em></div><button onClick={() => onChange(null)} title={labels.clear}><X /></button></div>

  return <div className="entity-finder">
    <div className="entity-filters">
      <div className="search-box"><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={labels.placeholder} /></div>
      <select value={kind} onChange={event => { setKind(event.target.value); if (event.target.value !== 'STUDENT') setClassName('') }}>
        <option value="">{labels.all}</option><option value="STUDENT">{labels.student} ({result.facets.counts.STUDENT || 0})</option><option value="TEACHER">{labels.teacher} ({result.facets.counts.TEACHER || 0})</option><option value="STAFF">{labels.staff} ({result.facets.counts.STAFF || 0})</option>
      </select>
      <select value={className} onChange={event => setClassName(event.target.value)} disabled={Boolean(kind && kind !== 'STUDENT')}><option value="">{labels.allClasses}</option>{result.facets.classes.map(item => <option value={item} key={item}>{item}</option>)}</select>
    </div>
    <div className="finder-summary"><span>{loading ? '…' : result.total} {labels.found}</span><div><GraduationCap /> {result.facets.counts.STUDENT || 0}<UserRound /> {result.facets.counts.TEACHER || 0}<UsersRound /> {result.facets.counts.STAFF || 0}</div></div>
    <div className="entity-results">{result.people.slice(0, 60).map(person => <button key={person.id} onClick={() => onChange(person)}><span className="avatar">{person.fullName.slice(0, 2).toUpperCase()}</span><span><b>{person.fullName}</b><small>{person.kind} · {person.displayId || person.className || 'KCS Orbit'}</small><em>{[person.className, person.email, person.phone].filter(Boolean).join(' · ')}</em></span><strong>{labels.select}</strong></button>)}</div>
  </div>
}
