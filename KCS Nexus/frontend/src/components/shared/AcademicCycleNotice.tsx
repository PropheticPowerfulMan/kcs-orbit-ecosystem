import {useUIStore} from '@/store/uiStore'
export default function AcademicCycleNotice({official,onFollow}:{official:{academicYear:string;term:string}|null;onFollow:()=>void}){
 const fr=useUIStore(s=>s.language)==='fr'
 if(!official)return null
 return <aside data-official-academic-cycle className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-xs text-sky-950 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100"><div><b>{fr?'Période active de l’école : ':'Current school period: '}{official.academicYear} · {official.term}</b><p className="mt-1">{fr?'Après clôture, la période suivante s’ouvre par défaut. Les anciens résultats restent conservés et consultables dans les sélecteurs, selon vos droits.':'After closure, the next period opens by default. Earlier results remain saved and accessible through the selectors, subject to your permissions.'}</p></div><button type="button" onClick={onFollow} className="shrink-0 rounded-lg border border-sky-400 bg-sky-100 px-3 py-2 font-bold text-sky-950 dark:border-sky-600 dark:bg-sky-900 dark:text-white">{fr?'Revenir à la période active':'Return to current period'}</button></aside>
}
