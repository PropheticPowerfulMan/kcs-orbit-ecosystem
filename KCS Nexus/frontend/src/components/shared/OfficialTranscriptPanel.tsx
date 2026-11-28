import '@/pages/StudentPortal/studentRecords.css'
import { printOfficialTranscript } from '@/utils/officialTranscriptPrint'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileCheck2, Printer, RefreshCw, ShieldCheck, Search, GraduationCap } from 'lucide-react'
import { academicRecordsAPI } from '@/services/api'
import { useUIStore } from '@/store/uiStore'

type Row = { id: string; percentage: number; letterGrade: string; credits: number; qualityPoints?: number; cycle?: { academicYear?: string; term?: string }; course?: { name?: string; code?: string } }
type Transcript = { student: { studentNumber: string; name: string; grade: string; photoUrl?: string | null }; rows: Row[]; summary: { credits: number; cumulativeGpa: number | null; officialRecords: number }; generatedAt: string; dataPolicy: string }
const panel = 'nexus-workspace-card min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50'

export default function OfficialTranscriptPanel({ studentId }: { studentId?: string | null }) {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [data, setData] = useState<Transcript | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query,setQuery]=useState(''),[year,setYear]=useState('ALL'),[limit,setLimit]=useState(12),generation=useRef(0)
  const load = async () => {
    const current=++generation.current
    if (!studentId){setData(null);return}
    setLoading(true); setError('')
    try { const response = await academicRecordsAPI.transcript(studentId); if(current===generation.current)setData(response.data.data) }
    catch (reason: any) { if(current!==generation.current)return;setData(null); const status = reason?.response?.status; setError(status === 403 ? tr('Le relevé de notes n’est pas encore autorisé par la Super Administration.','The transcript has not yet been authorized by the Super Administration.') : status === 402 ? (reason?.response?.data?.message ?? tr('La situation financière doit être régularisée.','Financial clearance is required.')) : tr('Le relevé de notes officiel est temporairement indisponible.','The official transcript is temporarily unavailable.')) }
    finally { if(current===generation.current)setLoading(false) }
  }
  useEffect(() => { setData(null);setYear('ALL');setQuery('');setLimit(12);void load();return()=>{generation.current++} }, [studentId])
  const years = useMemo(() => data ? new Set(data.rows.map((row) => row.cycle?.academicYear).filter(Boolean)).size : 0, [data])
  const printTranscript = () => {
    if (!data?.rows.length || !studentId) return
    void printOfficialTranscript({...data, student: {...data.student, id: studentId}}, setError)
  }

  const yearOptions=[...new Set(data?.rows.map(row=>row.cycle?.academicYear).filter(Boolean)||[])].sort().reverse()
  const filtered=(data?.rows||[]).filter(row=>(year==='ALL'||row.cycle?.academicYear===year)&&[row.course?.name,row.course?.code,row.cycle?.term].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return <section className="student-records-panel" data-official-transcript><header className="sr-hero"><span className="sr-emblem"><GraduationCap size={25}/></span><div><small>KCS · {tr('PARCOURS ACADÉMIQUE VÉRIFIÉ','VERIFIED ACADEMIC JOURNEY')}</small><h2>{tr('Relevé académique officiel','Official academic transcript')}</h2><p>{tr('La synthèse officielle du parcours de Grade 9 à Grade 12. Seuls les résultats approuvés et les anciens dossiers vérifiés sont retenus.','The official Grade 9–12 academic journey. Only approved results and verified historical records are included.')}</p></div><button className="sr-primary" onClick={()=>void load()} disabled={loading||!studentId}><RefreshCw size={16} className={loading?'animate-spin':''}/>{tr('Actualiser','Refresh')}</button></header>
  {error?<p className="sr-error" role="alert">{error}</p>:loading?<p className="sr-empty" role="status">{tr('Vérification des relevés approuvés…','Verifying approved records…')}</p>:!data||data.dataPolicy==='NO_OFFICIAL_DATA'?<div className="sr-empty"><FileCheck2 size={34}/><h3>{tr('Aucun relevé officiel publié pour le moment.','No official record published yet.')}</h3><p>{tr('Les notes provisoires, projetées ou non approuvées sont exclues.','Draft, projected and unapproved grades are excluded.')}</p></div>:<>
  <div className="sr-transcript-identity"><span>{data.student.photoUrl?<img src={data.student.photoUrl} alt=""/>:<GraduationCap size={28}/>}</span><div><h3>{data.student.name}</h3><p>{data.student.studentNumber} · {data.student.grade}</p><small>{tr('Préparé le','Prepared')} {new Date(data.generatedAt).toLocaleString(language==='fr'?'fr-FR':'en-GB',{timeZone:'Africa/Kinshasa'})}</small></div><ShieldCheck size={24}/></div>
  <div className="sr-metrics sr-attendance-summary">{[[tr('Résultats officiels','Official results'),data.summary.officialRecords],[tr('Crédits','Credits'),data.summary.credits],['GPA / 4.00',data.summary.cumulativeGpa==null?'—':data.summary.cumulativeGpa.toFixed(2)],[tr('Années scolaires','Academic years'),years]].map(([label,value])=><div key={String(label)}><span>{label}</span><b>{value}</b></div>)}</div>
  <div className="sr-toolbar"><label><Search size={16}/><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setLimit(12)}} aria-label={tr('Rechercher dans le transcript','Search transcript')} placeholder={tr('Cours, code ou période…','Course, code or term…')}/></label><select value={year} aria-label={tr('Année du transcript','Transcript year')} onChange={e=>{setYear(e.target.value);setLimit(12)}}><option value="ALL">{tr('Toutes les années','All years')}</option>{yearOptions.map(y=><option key={y} value={y}>{y}</option>)}</select><span>{filtered.length} {tr('résultat(s)','result(s)')}</span></div>
  <div className="sr-transcript-results">{filtered.slice(0,limit).map(row=><article key={row.id}><div><h4>{row.course?.name??tr('Cours','Course')}</h4><small>{row.course?.code} · {row.cycle?.academicYear} · {row.cycle?.term}</small></div><strong>{row.percentage.toFixed(2)}%<small>{row.letterGrade} · {row.credits} {tr('crédit(s)','credit(s)')}</small></strong></article>)}{!filtered.length&&<p className="sr-empty">{tr('Aucun résultat pour ces critères.','No results match these filters.')}</p>}</div>
  <div className="sr-transcript-footer">{filtered.length>limit&&<button className="sr-primary" onClick={()=>setLimit(n=>n+12)}>{tr('Afficher 12 résultats supplémentaires','Show 12 more results')}</button>}<button onClick={printTranscript} className="sr-primary" disabled={!data.rows.length}><Printer size={17}/>{tr('Ouvrir / Télécharger le transcript officiel','Open / Download official transcript')}</button><p className="sr-footnote">{tr('Le PDF complet contient toutes les années disponibles et conserve le modèle officiel, le QR et les identifiants d’authenticité. Les filtres ci-dessus ne changent pas le document.','The complete PDF includes every available year and retains the official template, QR and authenticity identifiers. The filters above do not change the document.')}</p></div></>}
  </section>
}
