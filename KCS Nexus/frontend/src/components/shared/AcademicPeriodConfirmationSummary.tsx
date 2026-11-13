import {useAcademicPeriodAccess} from '@/hooks/useAcademicPeriodAccess'
import {useUIStore} from '@/store/uiStore'
export default function AcademicPeriodConfirmationSummary({academicYear,term}:{academicYear:string;term:string}){
 const language=useUIStore(s=>s.language),tr=(fr:string,en:string)=>language==='fr'?fr:en
 const{access}=useAcademicPeriodAccess(academicYear,term)
 const quarter=/Quarter (\d)/.exec(term),semester=!quarter&&/Semester (\d)/.exec(term)
 const calendar=access?.calendars?.find(c=>c.name===academicYear)
 const period=calendar?.periods?.find(p=>quarter?['QUARTER','TRIMESTER'].includes(p.type)&&p.sequence===Number(quarter[1]):semester?p.type==='SEMESTER'&&p.sequence===Number(semester[1]):false)
 const date=(v:string)=>new Date(v).toLocaleDateString(language==='fr'?'fr-FR':'en-GB',{timeZone:'UTC'})
 return <div className="mb-4 space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100" data-official-period-confirmation><p><b>{tr('Période officiellement ouverte','Officially open period')} :</b> {access?.activeAcademicYear||'—'} · {access?.activeEntryTerm||tr('Vérification en cours','Checking current period')}</p>{period&&<p><b>{tr('Dates de la période sélectionnée','Selected period dates')} :</b> {date(period.startDate)} – {date(period.endDate)}</p>}<p className="text-xs">{tr('Ce contrôle suit le calendrier et les passages confirmés par le SuperAdmin pour chaque année, semestre et quarter.','This check follows the calendar and SuperAdmin-confirmed transitions for every school year, semester and quarter.')}</p></div>
}
