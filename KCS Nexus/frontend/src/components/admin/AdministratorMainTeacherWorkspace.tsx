import './mainTeacherWorkspace.css'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CheckSquare, Layers3, Search, Square, UserCheck, Users, LayoutGrid, ArrowRight, ChevronDown, RefreshCw } from 'lucide-react'
import { mainTeacherAPI } from '@/services/api'
import { SCHOOL_LEVELS } from '@/constants/schoolLevels'
import { useUIStore } from '@/store/uiStore'

type TeacherStatus = 'HOMEROOM_TEACHER' | 'ASSISTANT_TEACHER' | 'TEACHER'
type TeacherDraft = { status: TeacherStatus; grade: string; section: string }

const personName = (item: any) =>
  [item?.user?.lastName, item?.user?.middleName, item?.user?.firstName].filter(Boolean).join(' ')
  || [item?.lastName, item?.middleName, item?.firstName].filter(Boolean).join(' ')
  || '—'

const fieldClass = 'w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-kcs-blue-950 outline-none focus:border-kcs-blue-500 focus:ring-2 focus:ring-kcs-blue-200 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white'
const actionClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-kcs-blue-800 disabled:cursor-not-allowed disabled:opacity-45'

export default function AdministratorMainTeacherWorkspace() {
  const language = useUIStore((state) => state.language)
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const shellRef=useRef<HTMLDivElement>(null)
  const [panel,setPanel]=useState<'learners'|'leaders'|'overview'>('learners')
  const [teacherGrade,setTeacherGrade]=useState('ALL')
  useLayoutEffect(()=>{const main=shellRef.current?.closest('main'),header=main?.querySelector<HTMLElement>(':scope > .portal-dashboard-topbar');if(!header)return;const update=()=>{const sticky=getComputedStyle(header).position==='sticky';shellRef.current?.style.setProperty('--assignment-nav-top',sticky?`${header.offsetHeight+8}px`:'76px')};update();const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(update):null;observer?.observe(header);window.addEventListener('resize',update);return()=>{observer?.disconnect();window.removeEventListener('resize',update)}},[])
  const [teachers, setTeachers] = useState<any[]>([])
  const [teacherDrafts, setTeacherDrafts] = useState<Record<string, TeacherDraft>>({})
  const [students, setStudents] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({})
  const [selectedGrade, setSelectedGrade] = useState('')
  const [sectionFilter, setSectionFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [teacherQuery, setTeacherQuery] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [bulkSection, setBulkSection] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [teacherResponse, rosterResponse] = await Promise.all([
        mainTeacherAPI.list(),
        mainTeacherAPI.roster(),
      ])
      const teacherRows = teacherResponse.data?.data ?? []
      const roster = rosterResponse.data?.data ?? { students: [], classes: [] }
      const studentRows = roster.students ?? []
      setTeachers(teacherRows)
      setTeacherDrafts(Object.fromEntries(teacherRows.map((teacher: any) => [teacher.id, {
        status: teacher.status ?? 'TEACHER',
        grade: teacher.homeroomGrade ?? SCHOOL_LEVELS[0],
        section: teacher.homeroomSection ?? '',
      }])))
      setStudents(studentRows)
      setClasses(roster.classes ?? [])
      setSectionDrafts(Object.fromEntries(studentRows.map((student: any) => [student.id, student.section ?? ''])))
      setSelectedGrade((current) => current || (
        studentRows.find((student: any) => String(student.grade).toLowerCase() === 'grade 9')?.grade
        ?? studentRows[0]?.grade
        ?? SCHOOL_LEVELS[0]
      ))
    } catch (error: any) {
      setResult({ ok: false, message: error?.response?.data?.message ?? tr('Impossible de charger le registre des sections.', 'Unable to load the section roster.') })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const gradeOptions = useMemo(() =>
    Array.from(new Set([...SCHOOL_LEVELS,...students.map((student) => String(student.grade || '')),...classes.map((item)=>String(item.grade||''))].filter(Boolean)))
      .sort((left, right) => {const order=(value:string)=>{const index=(SCHOOL_LEVELS as readonly string[]).indexOf(value);return index<0?1000:index};return order(left)-order(right)||left.localeCompare(right,'en',{numeric:true})}),
  [students,classes])

  const sectionOptions = useMemo(() =>
    Array.from(new Set([
      'A', 'B', 'C', 'D',
      ...students.filter((student) => student.grade === selectedGrade).map((student) => String(student.section || '').trim()),
      ...classes.filter((item) => item.grade === selectedGrade).map((item) => String(item.section || '').trim()),
    ].filter(Boolean))).sort((left, right) => left.localeCompare(right, language === 'fr' ? 'fr' : 'en', { numeric: true })),
  [classes, language, selectedGrade, students])

  const gradeStudents = useMemo(() => students
    .filter((student) => student.grade === selectedGrade)
    .sort((left, right) => personName(left).localeCompare(personName(right), language === 'fr' ? 'fr' : 'en', { sensitivity: 'base', numeric: true })),
  [language, selectedGrade, students])

  const visibleStudents = useMemo(() => {
    const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return gradeStudents.filter((student) => {
      const section = String(student.section || '').trim()
      const matchesSection = sectionFilter === 'ALL'
        || (sectionFilter === 'UNASSIGNED' ? !section : section === sectionFilter)
      const haystack = [personName(student), student.studentNumber, student.grade, section].filter(Boolean).join(' ').toLocaleLowerCase()
      return matchesSection && tokens.every((token) => haystack.includes(token))
    })
  }, [gradeStudents, query, sectionFilter])

  const filteredTeachers = useMemo(() => {
    const tokens = teacherQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    return [...teachers]
      .filter((teacher) => {
        const haystack = [personName(teacher), teacher.user?.email, teacher.homeroomGrade, teacher.homeroomSection].filter(Boolean).join(' ').toLocaleLowerCase()
        return (teacherGrade==='ALL'||teacher.homeroomGrade===teacherGrade)&&tokens.every((token) => haystack.includes(token))
      })
      .sort((left, right) => personName(left).localeCompare(personName(right), language === 'fr' ? 'fr' : 'en', { sensitivity: 'base', numeric: true }))
  }, [language, teacherQuery, teacherGrade, teachers])

  const classGroups=useMemo(()=>[...new Set([...students.map(student=>`${student.grade}::${student.section||''}`),...classes.filter(item=>item.grade).map(item=>`${item.grade}::${item.section||''}`),...teachers.filter(teacher=>teacher.status!=='TEACHER'&&teacher.homeroomGrade).map(teacher=>`${teacher.homeroomGrade}::${teacher.homeroomSection||''}`)])].sort((a,b)=>{const order=(value:string)=>{const index=(SCHOOL_LEVELS as readonly string[]).indexOf(value);return index<0?1000:index};return order(a.split('::')[0])-order(b.split('::')[0])||a.localeCompare(b,language==='fr'?'fr':'en',{numeric:true})}),[students,classes,teachers,language])
  const selectedSet = useMemo(() => new Set(selectedStudentIds), [selectedStudentIds])
  const allVisibleSelected = visibleStudents.length > 0 && visibleStudents.every((student) => selectedSet.has(student.id))
  const wholeClassCount = gradeStudents.filter((student) => !String(student.section || '').trim()).length

  const updateTeacherDraft = (id: string, patch: Partial<TeacherDraft>) =>
    setTeacherDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? { status: 'TEACHER', grade: SCHOOL_LEVELS[0], section: '' }), ...patch },
    }))

  const saveStudentSection = async (student: any) => {
    const section = String(sectionDrafts[student.id] ?? '').trim()
    setBusyKey('student:' + student.id)
    try {
      await mainTeacherAPI.assignStudentSection(student.id, section,true)
      setResult({
        ok: true,
        message: section
          ? tr(`${personName(student)} est maintenant affecté(e) à ${student.grade} ${section}.`, `${personName(student)} is now assigned to ${student.grade} ${section}.`)
          : tr(`${personName(student)} est maintenant sans sous-classe.`, `${personName(student)} is now unassigned from a class section.`),
      })
      await load()
    } catch (error: any) {
      setResult({ ok: false, message: error?.response?.data?.message ?? tr('Affectation impossible.', 'Assignment failed.') })
    } finally {
      setBusyKey('')
    }
  }

  const assignBulkSection = async () => {
    const section = bulkSection.trim()
    if (!selectedStudentIds.length) {
      setResult({ ok: false, message: tr('Sélectionnez au moins un élève.', 'Select at least one learner.') })
      return
    }
    if (!section) {
      setResult({ ok: false, message: tr('Saisissez ou choisissez une section.', 'Enter or choose a section.') })
      return
    }
    setBusyKey('bulk')
    try {
      const completed = selectedStudentIds.length
      await mainTeacherAPI.assignStudentSections(selectedStudentIds, section,true)
      setSelectedStudentIds([])
      setBulkSection('')
      setResult({ ok: true, message: tr(`${completed} élève(s) affecté(s) à ${selectedGrade} ${section}.`, `${completed} learner(s) assigned to ${selectedGrade} ${section}.`) })
      await load()
    } catch (error: any) {
      await load()
      setResult({
        ok: false,
        message: error?.response?.data?.message ?? tr('Aucune affectation n’a été appliquée. Le registre précédent a été conservé.', 'No assignment was applied. The previous roster was preserved.'),
      })
    } finally {
      setBusyKey('')
    }
  }

  const saveTeacher = async (teacher: any) => {
    const draft = teacherDrafts[teacher.id]
    if (!draft) return
    setBusyKey('teacher:' + teacher.id)
    try {
      await mainTeacherAPI.assign(teacher.id, {
        status: draft.status,
        homeroomGrade: draft.status === 'TEACHER' ? undefined : draft.grade,
        homeroomSection: draft.status === 'TEACHER' ? undefined : draft.section.trim(),
      },true)
      setResult({
        ok: true,
        message: draft.status === 'TEACHER'
          ? tr(`La responsabilité de classe de ${personName(teacher)} a été retirée sans modifier ses cours.`, `${personName(teacher)}'s class responsibility was removed without changing assigned courses.`)
          : tr(
            `${personName(teacher)} est maintenant affecté(e) à ${draft.grade}${draft.section.trim() ? ` ${draft.section.trim()}` : ' · classe entière'}.`,
            `${personName(teacher)} is now assigned to ${draft.grade}${draft.section.trim() ? ` ${draft.section.trim()}` : ' · whole class'}.`,
          ),
      })
      await load()
    } catch (error: any) {
      setResult({ ok: false, message: error?.response?.data?.message ?? tr('Affectation impossible.', 'Assignment failed.') })
    } finally {
      setBusyKey('')
    }
  }

  return <div ref={shellRef} data-main-teacher-workspace className="space-y-5">
    {result ? <div className="fixed inset-0 z-[170] flex items-center justify-center bg-kcs-blue-950/75 p-4" role="dialog" aria-modal="true">
      <div className="assignment-result w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-kcs-blue-950">
        <div className={'mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-black text-white ' + (result.ok ? 'bg-emerald-600' : 'bg-red-600')}>{result.ok ? '✓' : '!'}</div>
        <h3 className="mt-4 text-xl font-bold text-kcs-blue-950 dark:text-white">{result.ok ? tr('Opération réussie', 'Operation successful') : tr('Opération impossible', 'Operation failed')}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{result.message}</p>
        <button type="button" onClick={() => setResult(null)} className={actionClass + ' mt-5 w-full'}>{tr('Fermer', 'Close')}</button>
      </div>
    </div> : null}

    <nav className="assignment-tabs" aria-label={tr('Organisation des classes','Class organization')}>
      {([['learners',Users,tr('Répartir les élèves','Learner sections'),students.length],['leaders',UserCheck,tr('Main Teachers et assistants','Main Teachers & assistants'),teachers.length],['overview',LayoutGrid,tr('Vue des classes','Class overview'),classGroups.length]] as const).map(([key,Icon,label,count])=><button type="button" key={key} aria-pressed={panel===key} onClick={()=>setPanel(key)}><Icon size={18}/><span>{label}</span><b>{count}</b></button>)}
    </nav>
    <details className="assignment-guide"><summary>{tr('Comment organiser une classe ou une section ?','How do I organize a class or section?')}<ChevronDown size={16}/></summary><p>{tr('1. Répartissez les élèves dans les sections de leur classe. 2. Affectez un Main Teacher et un assistant à chaque section. Pour une classe non divisée, laissez la section vide. Les cours des enseignants sont conservés. Les onglets gardent vos saisies en cours.','1. Place learners into their class sections. 2. Assign a Main Teacher and an assistant to each section. Leave the section empty for a whole class. Teachers keep their courses. Switching tabs preserves your current entries.')}</p></details>

    <div hidden={panel!=='learners'} data-assignment-panel="learners">
    <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-kcs-gold-600"><Users size={16}/>{tr('Étape 1 · Registre des élèves', 'Step 1 · Learner roster')}</p>
          <h3 className="mt-2 text-xl font-black text-kcs-blue-950 dark:text-white">{tr('Sections facultatives selon l’organisation réelle de la classe', 'Optional sections based on the actual class organization')}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{tr('Laissez la section vide pour une classe entière. Pour une classe divisée, utilisez A, B, C, Sciences 1, Groupe Bleu… Une nouvelle affectation remplace définitivement l’ancienne.', 'Leave the section empty for a whole class. For a divided class, use A, B, C, Science 1, Blue Group… A new assignment permanently replaces the previous one.')}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-sky-50 px-4 py-3 dark:bg-kcs-blue-950"><strong className="block text-xl dark:text-white">{gradeStudents.length}</strong><span className="text-xs text-slate-500">{tr('élèves', 'learners')}</span></div>
          <div className="rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30"><strong className="block text-xl text-emerald-800 dark:text-emerald-200">{wholeClassCount}</strong><span className="text-xs text-emerald-700 dark:text-emerald-300">{tr('sans section', 'without section')}</span></div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[14rem_12rem_1fr]">
        <select aria-label={tr('Classe des élèves','Learner class')} value={selectedGrade} onChange={(event) => { setSelectedGrade(event.target.value); setSectionFilter('ALL'); setSelectedStudentIds([]) }} className={fieldClass}>
          {gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
        </select>
        <select aria-label={tr('Filtrer les sections','Filter sections')} value={sectionFilter} onChange={(event) => { setSectionFilter(event.target.value); setSelectedStudentIds([]) }} className={fieldClass}>
          <option value="ALL">{tr('Toutes les sections', 'All sections')}</option>
          <option value="UNASSIGNED">{tr('Classe entière · sans section', 'Whole class · no section')}</option>
          {sectionOptions.map((section) => <option key={section} value={section}>{selectedGrade} {section}</option>)}
        </select>
        <label className="relative block"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} className={fieldClass + ' pl-10'} placeholder={tr('Rechercher par nom, matricule ou section', 'Search by name, number or section')}/></label>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-950/50 lg:flex-row lg:items-center">
        <button type="button" onClick={() => setSelectedStudentIds(allVisibleSelected ? [] : visibleStudents.map((student) => student.id))} className={actionClass + ' shrink-0'}>
          {allVisibleSelected ? <CheckSquare size={17}/> : <Square size={17}/>}
          {allVisibleSelected ? tr('Désélectionner', 'Deselect') : tr('Sélectionner les résultats', 'Select results')}
        </button>
        <span className="shrink-0 text-sm font-bold text-kcs-blue-900 dark:text-white">{selectedStudentIds.length} {tr('sélectionné(s)', 'selected')}</span>
        <input list="official-section-options" value={bulkSection} onChange={(event) => setBulkSection(event.target.value)} className={fieldClass} placeholder={tr('Section pour la sélection : A, B…', 'Section for selection: A, B…')}/>
        <button type="button" disabled={busyKey === 'bulk' || !selectedStudentIds.length} onClick={() => void assignBulkSection()} className={actionClass + ' shrink-0'}>
          <Layers3 size={17}/>{busyKey === 'bulk' ? tr('Affectation…', 'Assigning…') : tr('Affecter la sélection', 'Assign selected')}
        </button>
      </div>

      <datalist id="official-section-options">{sectionOptions.map((section) => <option key={section} value={section}/>)}</datalist>

      <div className="assignment-list mt-4 divide-y overflow-hidden rounded-2xl border border-slate-200 dark:divide-kcs-blue-800 dark:border-kcs-blue-800">
        {visibleStudents.map((student) => {
          const selected = selectedSet.has(student.id)
          const unchanged = String(sectionDrafts[student.id] ?? '').trim() === String(student.section ?? '').trim()
          return <article data-assignment-learner key={student.id} className={'grid gap-3 p-4 md:grid-cols-[auto_minmax(13rem,1.3fr)_minmax(8rem,.6fr)_minmax(12rem,1fr)_auto] md:items-center ' + (selected ? 'bg-sky-50 dark:bg-kcs-blue-800/40' : 'bg-white dark:bg-kcs-blue-950/30')}>
            <button type="button" aria-label={tr('Sélectionner cet élève', 'Select this learner')} onClick={() => setSelectedStudentIds((current) => selected ? current.filter((id) => id !== student.id) : [...current, student.id])} className="text-kcs-blue-700 dark:text-sky-200">{selected ? <CheckSquare size={21}/> : <Square size={21}/>}</button>
            <div><p className="font-bold text-kcs-blue-950 dark:text-white">{personName(student)}</p><p className="text-xs text-slate-500">{student.studentNumber} · {student.grade}</p></div>
            <span className={'w-fit rounded-full px-3 py-1 text-xs font-bold ' + (student.section ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800')}>{student.section ? `${student.grade} ${student.section}` : tr('Classe entière', 'Whole class')}</span>
            <input list="official-section-options" value={sectionDrafts[student.id] ?? ''} onChange={(event) => setSectionDrafts((current) => ({ ...current, [student.id]: event.target.value }))} className={fieldClass} placeholder={tr('Vide = classe entière', 'Empty = whole class')}/>
            <button type="button" disabled={busyKey === 'student:' + student.id || unchanged} onClick={() => void saveStudentSection(student)} className={actionClass}>{busyKey === 'student:' + student.id ? tr('Enregistrement…', 'Saving…') : tr('Enregistrer', 'Save')}</button>
          </article>
        })}
        {!loading && !visibleStudents.length ? <p className="p-8 text-center text-sm text-slate-500">{tr('Aucun élève ne correspond à ces filtres.', 'No learner matches these filters.')}</p> : null}
        {loading ? <p className="p-8 text-center text-sm font-semibold text-kcs-blue-700 dark:text-sky-200">{tr('Chargement sécurisé du registre…', 'Secure roster loading…')}</p> : null}
      </div>
    </section>

    </div>
    <div hidden={panel!=='leaders'} data-assignment-panel="leaders">
    <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-kcs-gold-600"><UserCheck size={16}/>{tr('Étape 2 · Responsables de classe', 'Step 2 · Class leadership')}</p><h3 className="mt-2 text-xl font-black text-kcs-blue-950 dark:text-white">{tr('Main Teachers et Assistants', 'Main Teachers and Assistants')}</h3></div>
        <label className="relative block w-full lg:max-w-md"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={teacherQuery} onChange={(event) => setTeacherQuery(event.target.value)} className={fieldClass + ' pl-10'} placeholder={tr('Nom, e-mail, classe ou section', 'Name, email, class or section')}/></label><label className="assignment-grade-filter">{tr('Classe des responsables','Leadership class')}<select aria-label={tr('Classe des responsables','Leadership class')} value={teacherGrade} onChange={event=>setTeacherGrade(event.target.value)} className={fieldClass}><option value="ALL">{tr('Toutes les classes','All classes')}</option>{SCHOOL_LEVELS.map(grade=><option key={grade} value={grade}>{grade}</option>)}</select></label>
      </div>

      <div className="assignment-list mt-4 divide-y overflow-hidden rounded-2xl border border-slate-200 dark:divide-kcs-blue-800 dark:border-kcs-blue-800">
        <div className="assignment-list-heading hidden grid-cols-[minmax(12rem,1.4fr)_minmax(9rem,.8fr)_minmax(9rem,.8fr)_minmax(8rem,.8fr)_minmax(8rem,.7fr)_auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-500 dark:bg-kcs-blue-950/70 dark:text-slate-300 md:grid">
          <span>{tr('Professeur', 'Teacher')}</span><span>Main Teacher</span><span>{tr('Assistant', 'Assistant')}</span><span>{tr('Classe', 'Class')}</span><span>{tr('Section', 'Section')}</span><span>{tr('Action', 'Action')}</span>
        </div>
        {filteredTeachers.map((teacher) => {
          const draft = teacherDrafts[teacher.id] ?? { status: 'TEACHER' as TeacherStatus, grade: SCHOOL_LEVELS[0], section: '' }
          return <article data-assignment-teacher key={teacher.id} className="grid gap-3 bg-white p-4 dark:bg-kcs-blue-950/30 md:grid-cols-[minmax(12rem,1.4fr)_minmax(9rem,.8fr)_minmax(9rem,.8fr)_minmax(8rem,.8fr)_minmax(8rem,.7fr)_auto] md:items-center">
            <div><p className="font-bold text-kcs-blue-950 dark:text-white">{personName(teacher)}</p><p className="text-xs text-slate-500">{teacher.user?.email} · {teacher._count?.courses ?? 0} {tr('cours', 'courses')}</p></div>
            <label className="flex items-center gap-2 text-sm font-semibold dark:text-white"><input type="checkbox" checked={draft.status === 'HOMEROOM_TEACHER'} onChange={(event) => updateTeacherDraft(teacher.id, { status: event.target.checked ? 'HOMEROOM_TEACHER' : 'TEACHER' })} className="h-5 w-5 accent-kcs-blue-700"/>Main Teacher</label>
            <label className="flex items-center gap-2 text-sm font-semibold dark:text-white"><input type="checkbox" checked={draft.status === 'ASSISTANT_TEACHER'} onChange={(event) => updateTeacherDraft(teacher.id, { status: event.target.checked ? 'ASSISTANT_TEACHER' : 'TEACHER' })} className="h-5 w-5 accent-amber-600"/>{tr('Assistant', 'Assistant')}</label>
            <select value={draft.grade} disabled={draft.status === 'TEACHER'} onChange={(event) => updateTeacherDraft(teacher.id, { grade: event.target.value })} aria-label={tr('Classe de ','Class for ')+personName(teacher)} className={fieldClass + ' disabled:opacity-40'}>{SCHOOL_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select>
            <div>
              <input list="official-section-options" value={draft.section} disabled={draft.status === 'TEACHER'} onChange={(event) => updateTeacherDraft(teacher.id, { section: event.target.value })} className={fieldClass + ' disabled:opacity-40'} placeholder={tr('Classe entière ou A, B, C…', 'Whole class or A, B, C…')}/>
              {draft.status !== 'TEACHER' && !draft.section.trim() ? <span className="mt-1 block text-xs font-bold text-emerald-700 dark:text-emerald-300">{tr('Classe entière · aucune section requise', 'Whole class · no section required')}</span> : null}
            </div>
            <button type="button" disabled={busyKey === 'teacher:' + teacher.id} onClick={() => void saveTeacher(teacher)} className={actionClass}>{busyKey === 'teacher:' + teacher.id ? tr('Enregistrement…', 'Saving…') : tr('Enregistrer', 'Save')}</button>
          </article>
        })}
      </div>
    </section>
    </div>
    <div hidden={panel!=='overview'} data-assignment-panel="overview"><div className="assignment-overview-grid">{classGroups.map(key=>{
     const[grade,section]=key.split('::'),learners=students.filter(student=>student.grade===grade&&(student.section||'')===section),leaders=teachers.filter(teacher=>teacher.homeroomGrade===grade&&(teacher.homeroomSection||'')===section),main=leaders.find(teacher=>teacher.status==='HOMEROOM_TEACHER'),assistant=leaders.find(teacher=>teacher.status==='ASSISTANT_TEACHER')
     return <article key={key}><div className="assignment-class-title"><span><LayoutGrid size={18}/>{grade}{section?' · '+section:''}</span><b>{learners.length} {tr('élèves','learners')}</b></div><dl><div><dt>Main Teacher</dt><dd>{main?personName(main):tr('À affecter','Not assigned')}</dd></div><div><dt>{tr('Assistant','Assistant')}</dt><dd>{assistant?personName(assistant):tr('À affecter','Not assigned')}</dd></div></dl><div className="assignment-class-actions"><button type="button" onClick={()=>{setSelectedGrade(grade);setSectionFilter(section||'UNASSIGNED');setSelectedStudentIds([]);setPanel('learners')}}><Users size={15}/>{tr('Élèves','Learners')}</button><button type="button" onClick={()=>{setTeacherGrade(grade);setTeacherQuery('');setPanel('leaders')}}><UserCheck size={15}/>{tr('Responsables','Leadership')}<ArrowRight size={14}/></button></div></article>
    })}</div>{!students.length&&!loading&&<p className="assignment-empty">{tr('Aucune classe dans le registre.','No class in the registry.')}</p>}</div>
  </div>
}
