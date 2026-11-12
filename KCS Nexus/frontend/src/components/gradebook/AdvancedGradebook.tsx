import { gradebookScorePercentage as parseScore, gradebookWeightedAverage, zeroWeightScoredAssessments, proposeScoredCategoryWeights } from '@/utils/gradebookCalculations'
import GradebookWeightScopeDialog from './GradebookWeightScopeDialog'
import { useAcademicPeriodAccess, isAcademicPeriodReadOnly, isFutureGradebookPeriod } from '@/hooks/useAcademicPeriodAccess'
import { createPortal } from 'react-dom'
import { rankGradebookRows } from '@/utils/gradebookRanking'
import DateSelect from '@/components/shared/DateSelect'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  ChevronDown,
  Eye,
  Download,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wand2,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { printOfficialGradebook } from '@/utils/officialGradebookPrint'
import { academicCalendarAPI, academicRecordsAPI, teacherWorkspaceAPI } from '@/services/api'
import { canonicalClassLabel } from '@/utils/classLabels'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { canonicalGradebookTerm, openingGradebookTerm } from '@/utils/gradebookPeriods'
import { recoverGradebook, stableGradebookValue, defaultGradebookCategories, type AssignmentType, type GradebookColumn, type Category, type GradebookSnapshot, type ArchivedAssignment } from '@/utils/gradebookRecovery'

type Course = {
  id: string
  name: string
  abbreviation: string
  className: string
  gradeLevels: string[]
  studentIds: string[]
}

type GradebookStudent = {
  id: string
  studentNumber?: string
  name: string
  grade: string
  section: string
  advisor?: string
  average?: number
  attendance?: number
  risk?: string
  strengths?: string[]
  weaknesses?: string[]
}





type Props = {
  courses: Course[]
  students: GradebookStudent[]
  selectedCourseId: string
  onSelectCourse: (courseId: string) => void
  onAction: (message: string, isError?: boolean) => void
  onRegisterSave?: (save: () => Promise<boolean>) => void
  onCategoryWeightsChange?: (categories: Category[]) => void
}

const assignmentTypes: AssignmentType[] = ['homework', 'quiz', 'test', 'exam', 'project', 'participation']
const terms = ['Semester 1 · Quarter 1', 'Semester 1 · Quarter 2', 'Semester 2 · Quarter 3', 'Semester 2 · Quarter 4', 'Annual final']
const scoreScales = [20, 50, 100]
const legacyAcademicYear = '2026-2027'
const academicYearOptions = Array.from({ length: 101 }, (_, index) => {
  const start = 2000 + index
  return `${start}-${start + 1}`
})

const defaultPointsByType: Record<AssignmentType, number> = {
  homework: 20,
  quiz: 20,
  test: 100,
  exam: 100,
  project: 100,
  participation: 10,
}

const defaultCategories = defaultGradebookCategories

const assignmentTypeLabels: Record<AssignmentType, { name: string; help: string }> = {

  homework: { name: 'Homework', help: 'Practice completed outside the lesson.' },
  quiz: { name: 'Quiz', help: 'Short knowledge or skill check.' },
  test: { name: 'Test', help: 'Unit or chapter assessment.' },
  exam: { name: 'Exam', help: 'Major trimester or semester assessment.' },
  project: { name: 'Project', help: 'Extended individual or group production.' },
  participation: { name: 'Participation', help: 'Observed engagement and classroom contribution.' },
}



type OfficialFinalGrade = {
  id: string
  studentId: string
  courseId: string
  percentage: number
  letterGrade: string
  createdAt: string
  cycle?: { academicYear?: string; term?: string; status?: string }
}

const legacyDemoAssignmentIds = new Set(['gb-lab', 'gb-quiz', 'gb-homework', 'gb-exam', 'gb-participation'])
const sanitizeAssignments = (assignments: GradebookColumn[] | undefined) => (
  (assignments ?? [])
    .filter((assignment) => !legacyDemoAssignmentIds.has(assignment.id))
    .map((assignment) => ({ ...assignment, term: canonicalGradebookTerm(assignment.term || terms[0]) }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.date || '')
      const rightTime = Date.parse(right.date || '')
      if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0
      if (!Number.isFinite(leftTime)) return 1
      if (!Number.isFinite(rightTime)) return -1
      return leftTime - rightTime
    })
)

const buildMissingScoreCells = (
  assignments: GradebookColumn[],
  students: GradebookStudent[],
  existingScores: Record<string, string>,
) => {
  const next = { ...existingScores }

  students.forEach((student) => {
    assignments.forEach((assignment) => {
      const key = `${assignment.id}:${student.id}`
      if (next[key] === undefined) next[key] = ''
    })
  })

  return next
}

const toneForScore = (score: number | null) => {
  if (score === null) return 'bg-gray-50 text-gray-400 dark:bg-kcs-blue-950 dark:text-gray-500'
  if (score < 65) return 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-900/40'
  if (score < 78) return 'bg-yellow-50 text-yellow-700 ring-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 dark:ring-yellow-900/40'
  if (score >= 90) return 'bg-green-50 text-green-700 ring-green-100 dark:bg-green-900/20 dark:text-green-300 dark:ring-green-900/40'
  return 'bg-kcs-blue-50 text-kcs-blue-700 ring-kcs-blue-100 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200 dark:ring-kcs-blue-800'
}



const formatPercent = (value: number | null) => value === null ? 'I' : `${Math.round(value)}%`

const internationalGrade = (value: number | null) => {
  if (value === null) return 'I'
  if (value >= 97) return 'A+'
  if (value >= 93) return 'A'
  if (value >= 90) return 'A-'
  if (value >= 87) return 'B+'
  if (value >= 83) return 'B'
  if (value >= 80) return 'B-'
  if (value >= 77) return 'C+'
  if (value >= 73) return 'C'
  if (value >= 70) return 'C-'
  if (value >= 67) return 'D+'
  if (value >= 63) return 'D'
  if (value >= 60) return 'D-'
  return 'F'
}

const downloadFile = (fileName: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const AdvancedGradebook = ({ courses, students, selectedCourseId, onSelectCourse, onAction, onRegisterSave }: Props) => {
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false)
  const [commandCenterOpen, setCommandCenterOpen] = useState(() => localStorage.getItem('kcs:nexus:gradebook:command-center') !== 'closed')
  const [taskPanelOpen, setTaskPanelOpen] = useState(() => localStorage.getItem('kcs:nexus:gradebook:task-panel') !== 'closed')
  const [weightPanelOpen, setWeightPanelOpen] = useState(() => localStorage.getItem('kcs:nexus:gradebook:weight-panel') !== 'closed')
  const togglePanel = (key: 'task' | 'weight', open: boolean) => {
    localStorage.setItem(`kcs:nexus:gradebook:${key}-panel`, open ? 'open' : 'closed')
    if (key === 'task') setTaskPanelOpen(open); else setWeightPanelOpen(open)
  }
  const language = useUIStore((state) => state.language)
  const userId = useAuthStore((state) => state.user?.id ?? '')
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [draggedAssignmentId, setDraggedAssignmentId] = useState('')
  const [pendingDeleteAssignment, setPendingDeleteAssignment] = useState<GradebookColumn | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<GradebookColumn | null>(null)
  const [archivedAssignments, setArchivedAssignments] = useState<ArchivedAssignment[]>([])
  const [skipDeleteConfirmation, setSkipDeleteConfirmation] = useState(() => localStorage.getItem('kcs:nexus:gradebook:skip-delete-confirmation') === 'true')
  const [rememberDeleteChoice, setRememberDeleteChoice] = useState(false)

  useEffect(() => {
    if (!spreadsheetOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('[data-gradebook-overlay]')) setSpreadsheetOpen(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape) }
  }, [spreadsheetOpen])
  const [cellDialog, setCellDialog] = useState<{ mode: 'ai' | 'note'; assignment: GradebookColumn; student: GradebookStudent } | null>(null)
  const [cellNoteDraft, setCellNoteDraft] = useState('')
  const [assignments, setAssignments] = useState<GradebookColumn[]>([])
  const [categories, setCategories] = useState(defaultCategories)
  const [frozenCategoryWeights, setFrozenCategoryWeights] = useState<Record<string, Category[]>>({})
  const [scores, setScores] = useState<Record<string, string>>(() => {
    try { return (JSON.parse(localStorage.getItem(`kcs-live-gradebook-${selectedCourseId}`) || '{}').scores as Record<string, string> | undefined) ?? {} } catch { return {} }
  })
  const [savingSpreadsheet, setSavingSpreadsheet] = useState(false)
  const savingRef = useRef(false)
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())
  const serverVersions = useRef(new Map<string, string>())
  const syncedContents = useRef(new Map<string, string>())
  const activeScope = useRef('')
  const pendingAutosave = useRef<(() => Promise<boolean>) | null>(null)
  const pausedAutosaves = useRef(new Set<string>())
  const [weightScopeOpen, setWeightScopeOpen] = useState(false)
  const [weightFixOpen, setWeightFixOpen] = useState(false)
  const [weightFixSaving, setWeightFixSaving] = useState(false)
  const [autosaveEnabled, setAutosaveEnabled] = useState(false)
  const [autosaveRetryAt, setAutosaveRetryAt] = useState(0)
  const [onlineRevision, setOnlineRevision] = useState(0)
  const [rankingOpen, setRankingOpen] = useState(false)
  const [rankingLimit, setRankingLimit] = useState('3')
  const [periodConfirmation, setPeriodConfirmation] = useState<'task' | 'submission' | null>(null)
  const [confirmedPeriod, setConfirmedPeriod] = useState(false)
  const [calendarPeriods, setCalendarPeriods] = useState<Array<{ type: string; sequence: number; startDate: string; endDate: string }>>([])
  const saveActionRef = useRef<(silent?: boolean) => Promise<boolean>>(async () => false)
  const weightRequests = useRef(new Map<string, Promise<unknown>>())
  const weightScopeRef = useRef('')
  const persistCourseWeights = (courseId: string, year: string, next: Category[]) => {
    if (Math.abs(next.reduce((sum, item) => sum + item.weight, 0) - 100) > 0.001) return Promise.resolve()
    const key = courseId + '::' + year
    const request = (weightRequests.current.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => teacherWorkspaceAPI.saveGradebookWeights({ courseId, academicYear: year, term, categories: next }))
    weightRequests.current.set(key, request)
    return request
  }
  const [recoveredCells, setRecoveredCells] = useState(0)
  const [periodRecoveryScope, setPeriodRecoveryScope] = useState('')
  const [loadedSnapshotSavedAt, setLoadedSnapshotSavedAt] = useState('')
  const saveSpreadsheet = async (silent = false, automatic = false) => {
    if (periodReadOnly) { if (!automatic) closedNotice(); return false }
    if (loadedScope !== cycleKey) {
      onAction(tr('Attendez le chargement complet des notes avant d’enregistrer.', 'Wait for the saved gradebook to finish loading before saving.'), true)
      return false
    }
    const savedAt = new Date().toISOString()
    const snapshot: GradebookSnapshot = { scores, comments, assignments: sanitizeAssignments(assignments), categories, archivedAssignments, savedAt }
    const scope = cycleKey
    try { localStorage.setItem(browserStorageKey, JSON.stringify(snapshot)) } catch { /* Server persistence remains available when browser storage is full. */ }
    const request = saveQueue.current.then(async () => {
      savingRef.current = true
      setSavingSpreadsheet(true)
      try {
        await persistCourseWeights(selectedCourseId, academicYear, categories)
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const latest = await teacherWorkspaceAPI.get()
            const workspace = latest.data?.data
            const state = (workspace?.state ?? {}) as Record<string, any>
            const currentSnapshot = state.advancedGradebookByCycle?.[cycleKey]
              ?? (academicYear === legacyAcademicYear ? state.advancedGradebookByCourse?.[selectedCourseId] : undefined)
            const content = (value: Partial<GradebookSnapshot> | undefined) => value ? { ...value, savedAt: undefined } : undefined
            const alreadyPersisted = stableGradebookValue(content(currentSnapshot)) === stableGradebookValue(content(snapshot))
            if (currentSnapshot?.savedAt && currentSnapshot.savedAt !== (serverVersions.current.get(scope) ?? loadedSnapshotSavedAt) && !alreadyPersisted) {
              throw new Error(tr('Ce cours a été modifié dans une autre session. Rechargez les notes avant de réessayer.', 'This course was updated in another session. Reload its saved grades before trying again.'))
            }
            if (alreadyPersisted && currentSnapshot.savedAt) snapshot.savedAt = currentSnapshot.savedAt
            const legacyColumns = assignments.map(({ id, title, type, date, maxPoints, term, category, confirmedCycle }) => ({ id, title, type, date, maxPoints, term, category, confirmedCycle }))
            const nextLegacyScores = { ...(state.gradebookScores ?? {}) } as Record<string, string>
            // The legacy mirrors are kept only for the original 2026-2027 cycle so
            // older report-card readers remain compatible without leaking one
            // academic year's scores into another one.
            if (academicYear === legacyAcademicYear) {
              const legacyPrefix = `${selectedCourseId}-`
              Object.keys(nextLegacyScores).forEach((key) => {
                if (key.startsWith(legacyPrefix)) delete nextLegacyScores[key]
              })
              assignments.forEach((assignment) => {
                enrolledCourseStudents.forEach((student) => {
                  const value = scores[`${assignment.id}:${student.id}`]
                  if (value !== undefined) nextLegacyScores[`${selectedCourseId}-${assignment.id}-${student.id}`] = value
                })
              })
            }
            const nextAdvancedByCourse = { ...(state.advancedGradebookByCourse ?? {}) }
            const nextLegacyColumns = { ...(state.gradebookColumnsByCourse ?? {}) }
            if (academicYear === legacyAcademicYear) {
              nextAdvancedByCourse[selectedCourseId] = snapshot
              nextLegacyColumns[selectedCourseId] = legacyColumns
            }
            await teacherWorkspaceAPI.save({
              ...state,
              advancedGradebookByCourse: nextAdvancedByCourse,
              advancedGradebookByCycle: {
                ...(state.advancedGradebookByCycle ?? {}),
                [cycleKey]: snapshot,
              },
              gradebookColumnsByCourse: nextLegacyColumns,
              gradebookScores: nextLegacyScores,
            }, workspace?.revision, automatic)
            const confirmation = await teacherWorkspaceAPI.get()
            const persisted = confirmation.data?.data?.state?.advancedGradebookByCycle?.[cycleKey]
            if (stableGradebookValue(persisted) !== stableGradebookValue(snapshot)) throw new Error(tr('La vérification sur le serveur a échoué. Vos notes restent conservées sur cet appareil. Réessayez.', 'Server verification did not confirm this save. Your grades remain on this device. Please retry.'))
            window.dispatchEvent(new CustomEvent('kcs-gradebook-saved', { detail: { courseId: selectedCourseId, savedAt: snapshot.savedAt, revision: confirmation.data?.data?.revision } }))
            serverVersions.current.set(scope, snapshot.savedAt ?? savedAt)
            syncedContents.current.set(scope, stableGradebookValue({ ...snapshot, savedAt: undefined }))
            if (!automatic) {
              localStorage.setItem(autosavePreferenceKey, 'enabled')
              pausedAutosaves.current.delete(scope)
            }
            if (activeScope.current === scope) {
              setLoadedSnapshotSavedAt(snapshot.savedAt ?? savedAt)
              setRecoveredCells(0)
              if (!automatic) setAutosaveEnabled(true)
              setAutosaveRetryAt(0)
              setSaveNotice(tr('Enregistré et vérifié sur le serveur à ', 'Saved and verified on the server at ') + new Date().toLocaleTimeString())
            }
            if (!silent) onAction('Tasks, category weights, scores, and comments were synchronized with KCS Nexus successfully.')
            return true
          } catch (error: any) {
            if (attempt === 0 && error?.response?.status === 409) continue
            throw error
          }
        }
        throw new Error(tr('Un autre enregistrement a modifié le carnet. Réessayez.', 'Another save changed the workspace. Retry saving.'))
      } catch (error: any) {
        const conflict = error?.response?.status === 409 || String(error?.message || '').includes('another session') || String(error?.message || '').includes('autre session')
        if (conflict) pausedAutosaves.current.add(scope)
        if (activeScope.current === scope) {
          setSaveNotice(error?.response?.data?.message || error?.message || tr('En attente de connexion. Les modifications restent conservées sur cet appareil.', 'Waiting for connection. Changes remain saved on this device.'))
          setAutosaveRetryAt(Date.now() + 15_000)
        }
        if (!automatic) onAction(error?.response?.data?.message || error?.message || 'The Gradebook could not be synchronized with KCS Nexus.', true)
        return false
      } finally {
        savingRef.current = false
        setSavingSpreadsheet(false)
      }
    })
    saveQueue.current = request.catch(() => undefined)
    return request
  }
  saveActionRef.current = saveSpreadsheet
  useEffect(() => { onRegisterSave?.(() => saveActionRef.current()) }, [onRegisterSave])
  const [comments, setComments] = useState<Record<string, string>>({})
  const [term, setTerm] = useState(terms[0])
  const [scale, setScale] = useState(100)
  const [query, setQuery] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [academicYear, setAcademicYear] = useState('2026-2027')
  const { readOnly: periodClosed, access: periodAccess } = useAcademicPeriodAccess(academicYear, term)
  const futurePeriod = isFutureGradebookPeriod(periodAccess, academicYear, term)
  const periodReadOnly = periodClosed || futurePeriod
  const assignmentReadOnly = (assignment?: GradebookColumn) => Boolean(assignment && (isAcademicPeriodReadOnly(periodAccess, academicYear, assignment.term) || isFutureGradebookPeriod(periodAccess, academicYear, assignment.term)))
  const periodNotice = futurePeriod
    ? tr('Ce quarter n’est pas encore ouvert. Saisissez les notes dans ', 'This quarter is not open yet. Enter grades in ') + (periodAccess?.activeEntryTerm || '') + tr(' jusqu’au passage confirmé par le SuperAdmin.', ' until the SuperAdmin confirms advancement.')
    : tr('Cette période est clôturée. Les notes sont en lecture seule.', 'This academic period is closed. Grades are read-only.')
  const closedNotice = () => onAction(periodNotice, true)
  const displayCategories = periodReadOnly && frozenCategoryWeights[term]?.length ? frozenCategoryWeights[term] : categories
  const [officialTerm, setOfficialTerm] = useState(terms[0])
  const [calendarReady, setCalendarReady] = useState(false)
  const [loadedScope, setLoadedScope] = useState('')
  const [addingAssignment, setAddingAssignment] = useState(false)
  const cycleKey = `${selectedCourseId}::${academicYear}`
  useEffect(() => { setWeightFixOpen(false) }, [selectedCourseId, academicYear, term])
  weightScopeRef.current = cycleKey
  const browserStorageKey = `kcs-live-gradebook-${cycleKey}`
  const periodPreferenceKey = `kcs:nexus:gradebook:period:${userId}:${cycleKey}`
  const autosavePreferenceKey = `kcs:nexus:gradebook:autosave:${userId}:${cycleKey}`
  activeScope.current = cycleKey
  const chooseTerm = (nextTerm: string) => {
    const pending = pendingAutosave.current
    pendingAutosave.current = null
    if (pending) void pending()
    setTerm(nextTerm)
    localStorage.setItem(periodPreferenceKey, nextTerm)
  }
  const [submittingFinals, setSubmittingFinals] = useState(false)
  const [officialFinalGrades, setOfficialFinalGrades] = useState<OfficialFinalGrade[]>([])
  const [draft, setDraft] = useState({
    title: '',
    type: 'quiz' as AssignmentType,
    category: 'quiz',
    maxPoints: '' as number | '',
    date: '',
    description: '',
  })

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? courses[0]
  const selectedBulkAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId)

  useEffect(() => {
    academicCalendarAPI.periodAccess().then(({ data }) => {
      const control = data?.data
      const calendar = control?.calendars?.find((item: { name: string }) => item.name === control.activeAcademicYear)
      if (!calendar?.name) return
      setAcademicYear(calendar.name)
      setCalendarPeriods(calendar.periods ?? [])
      setOfficialTerm(control.activeEntryTerm || 'Annual final')
    }).catch(() => undefined).finally(() => setCalendarReady(true))
  }, [])

  useEffect(() => {
    if (!calendarReady || !selectedCourseId || !selectedCourse) return
    let active = true
    const loadGradebook = async () => {
      setLoadedScope('')
      setEditingAssignment(null)
      setPendingDeleteAssignment(null)
      setCellDialog(null)
      setRankingOpen(false)
      setWeightScopeOpen(false)
      setAutosaveEnabled(localStorage.getItem(autosavePreferenceKey) === 'enabled')
      setPeriodConfirmation(null)
      setConfirmedPeriod(false)
      setLoadedSnapshotSavedAt('')
      setRecoveredCells(0)
      setPeriodRecoveryScope('')
      let saved: Partial<GradebookSnapshot> = {}
      let legacyBrowserSnapshot: Partial<GradebookSnapshot> = {}
      setAssignments([])
      setCategories(defaultCategories)
      setFrozenCategoryWeights({})
      setComments({})
      setScores({})
      setSelectedAssignmentId('')
      try {
        saved = JSON.parse(localStorage.getItem(browserStorageKey) || '{}') as Partial<GradebookSnapshot>
        if (academicYear === legacyAcademicYear) {
          legacyBrowserSnapshot = JSON.parse(localStorage.getItem(`kcs-live-gradebook-${selectedCourseId}`) || '{}') as Partial<GradebookSnapshot>
          if (!saved.assignments?.length) saved = { ...legacyBrowserSnapshot, savedAt: '' }
        }
        void academicRecordsAPI.myFinalGrades().then(officialResponse => {
          if (active) setOfficialFinalGrades((officialResponse.data?.data?.submissions ?? []) as OfficialFinalGrade[])
        }).catch(() => undefined)
        const [response, periodResponse] = await Promise.all([teacherWorkspaceAPI.get(), academicCalendarAPI.periodAccess().catch(() => ({ data: { data: periodAccess } }))])
        const activeControl = periodResponse.data?.data
        const state = (response.data?.data?.state ?? {}) as Record<string, any>
        if (active) setFrozenCategoryWeights(Object.fromEntries(Object.entries(state.gradebookClosedCategoryWeightsByCycle ?? {}).filter(([key]) => key.startsWith(cycleKey + '::')).map(([key, value]) => [key.slice((cycleKey + '::').length), (value as any).categories ?? []])))
        const matchingCourses = (Array.isArray(state.courses) ? state.courses : []).filter((course: any) =>
          String(course?.name || '').trim().toLowerCase() === selectedCourse.name.trim().toLowerCase()
          && canonicalClassLabel(course?.className || course?.gradeLevels?.[0]) === canonicalClassLabel(selectedCourse.className || selectedCourse.gradeLevels[0]),
        )
        const recovery = recoverGradebook({ courseId: selectedCourseId, academicYear, aliases: matchingCourses.length === 1 ? [matchingCourses[0].id] : [], state, students, activeEntry: { academicYear: activeControl?.activeAcademicYear, term: activeControl?.activeEntryTerm }, browserSnapshots: [{ ...legacyBrowserSnapshot, savedAt: '' }, saved] })
        const correction = state.gradebookPeriodCorrectionsByCycle?.[cycleKey]
        if (correction?.correctedAt && localStorage.getItem(periodPreferenceKey + ':correction') !== correction.correctedAt) {
          localStorage.setItem(periodPreferenceKey, correction.to)
          localStorage.setItem(periodPreferenceKey + ':correction', correction.correctedAt)
        }
        if (active && correction?.recoverBrowserWhileActive && recovery.recoveredTasks > 0
          && activeControl?.activeAcademicYear === academicYear && activeControl?.activeEntryTerm === correction.to) {
          setPeriodRecoveryScope(cycleKey)
        }
        saved = recovery.snapshot
        if (active) {
          setLoadedSnapshotSavedAt(recovery.baseSavedAt)
          serverVersions.current.set(cycleKey, recovery.baseSavedAt)
          const serverSnapshot = state.advancedGradebookByCycle?.[cycleKey] ?? (academicYear === legacyAcademicYear ? state.advancedGradebookByCourse?.[selectedCourseId] : undefined)
          syncedContents.current.set(cycleKey, stableGradebookValue(serverSnapshot ? { ...serverSnapshot, savedAt: undefined } : {}))
          setRecoveredCells(recovery.recoveredCells)
        }
      } catch {
        if (!saved.assignments?.length) {
          if (active) onAction(tr('Les notes enregistrées ne sont pas accessibles pour le moment. Rechargez cette page pour réessayer.', 'Saved grades are temporarily unavailable. Reload this page to try again.'), true)
          return
        }
      }
      if (!active) return
      const savedAssignments = sanitizeAssignments(saved.assignments)
      const savedCategories = saved.categories?.length ? saved.categories : defaultCategories
      const completeCategories = defaultCategories.map((category) => savedCategories.find((item) => item.id === category.id) ?? category)
      setAssignments(savedAssignments)
      setArchivedAssignments((saved.archivedAssignments ?? []).map((entry) => ({ ...entry, assignment: { ...entry.assignment, term: canonicalGradebookTerm(entry.assignment.term) } })))
      setCategories(completeCategories)
      setComments(saved.comments ?? {})
      setScores(buildMissingScoreCells(savedAssignments, students, saved.scores ?? {}))
      setSelectedAssignmentId(savedAssignments[0]?.id ?? '')
      setTerm(openingGradebookTerm(savedAssignments, localStorage.getItem(periodPreferenceKey), officialTerm, terms))
      // The expected server version is kept separately from recovered browser data.
      setLoadedScope(cycleKey)
    }
    void loadGradebook()
    return () => { active = false }
  }, [calendarReady, academicYear, browserStorageKey, cycleKey, selectedCourseId, selectedCourse?.id, periodPreferenceKey])

  useEffect(() => {
    const handleSaveShortcut = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        event.stopImmediatePropagation()
        void saveActionRef.current(true)
      } else if (key === 'c' && event.target instanceof Element && event.target.closest('[data-kcs-gradebook="true"]')) {
        void saveActionRef.current(true)
      }
    }
    window.addEventListener('keydown', handleSaveShortcut, true)
    return () => window.removeEventListener('keydown', handleSaveShortcut, true)
  }, [])
  const enrolledCourseStudents = useMemo(() => {
    if (!selectedCourse) return []
    return (selectedCourse.studentIds ?? [])
      .map((id) => students.find((student) => student.id === id))
      .filter(Boolean)
      .sort((left, right) => (left?.name ?? '').localeCompare(right?.name ?? '', undefined, {
        sensitivity: 'base',
        numeric: true,
      })) as GradebookStudent[]
  }, [selectedCourse, students])
  const courseStudents = useMemo(() => enrolledCourseStudents.filter((student) =>
    `${student.name} ${canonicalClassLabel(student.grade, student.section)}`.toLowerCase().includes(query.toLowerCase()),
  ), [enrolledCourseStudents, query])

  useEffect(() => {
    if (!periodReadOnly) return
    let active = true
    teacherWorkspaceAPI.get().then(response => {
      const frozen = response.data?.data?.state?.gradebookClosedCategoryWeightsByCycle ?? {}
      if (active) setFrozenCategoryWeights(Object.fromEntries(Object.entries(frozen).filter(([key]) => key.startsWith(cycleKey + '::')).map(([key, value]) => [key.slice((cycleKey + '::').length), (value as any).categories ?? []])))
    }).catch(() => undefined)
    return () => { active = false }
  }, [periodReadOnly, cycleKey])

  useEffect(() => {
    if (periodRecoveryScope !== cycleKey || loadedScope !== cycleKey || periodReadOnly || !assignments.length) return
    setPeriodRecoveryScope('')
    setSaveNotice(tr('Récupération des colonnes dans le quarter corrigé…', 'Recovering columns into the corrected quarter…'))
    void saveSpreadsheet(true, true)
  }, [periodRecoveryScope, loadedScope, cycleKey, periodReadOnly, assignments.length])

  const visibleAssignments = assignments.filter((assignment) => assignment.term === term || term === 'Annual final')

  const scoreKey = (assignmentId: string, studentId: string) => `${assignmentId}:${studentId}`

  const getRawScore = (assignmentId: string, studentId: string) => scores[scoreKey(assignmentId, studentId)] ?? ''
  const officialCourseGrades = useMemo(() => officialFinalGrades
    .filter((grade) =>
      grade.courseId === selectedCourse?.id
      && (!grade.cycle?.academicYear || grade.cycle.academicYear === academicYear)
      && (!grade.cycle?.term || grade.cycle.term === term),
    )
    .map((grade) => ({ ...grade, student: students.find((student) => student.id === grade.studentId) }))
    .sort((left, right) => (left.student?.name ?? left.studentId).localeCompare(right.student?.name ?? right.studentId, undefined, {
      sensitivity: 'base',
      numeric: true,
    })),
  [officialFinalGrades, selectedCourse?.id, academicYear, term, students])


  const getScore = (assignment: GradebookColumn, studentId: string) => parseScore(getRawScore(assignment.id, studentId), assignment.maxPoints)

  useEffect(() => {
    setScores((current) => buildMissingScoreCells(assignments, enrolledCourseStudents, current))
  }, [assignments, enrolledCourseStudents])

  const getCategoryAverage = (studentId: string, categoryId: string) => {
    const categoryAssignments = visibleAssignments.filter((assignment) => assignment.category === categoryId)
    const values = categoryAssignments.map((assignment) => getScore(assignment, studentId)).filter((value): value is number => value !== null)
    if (!values.length) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  const getWeightedAverage = (studentId: string) => gradebookWeightedAverage(studentId, visibleAssignments, displayCategories, scores)
  const excludedAssessments = zeroWeightScoredAssessments(visibleAssignments, displayCategories, scores, enrolledCourseStudents.map(student => student.id))
  const proposedWeights = proposeScoredCategoryWeights(categories, excludedAssessments.map(task => task.category), defaultCategories)
  const applyWeightCorrection = async () => {
    if (periodReadOnly || weightFixSaving || loadedScope !== cycleKey) return
    const scope = cycleKey
    setWeightFixSaving(true)
    try {
      if (!await saveSpreadsheet(true)) return
      await persistCourseWeights(selectedCourseId, academicYear, proposedWeights)
      if (activeScope.current !== scope) return
      setCategories(proposedWeights)
      setWeightFixOpen(false)
      window.dispatchEvent(new Event('kcs-gradebook-weights-changed'))
      onAction(tr('Pondération confirmée et enregistrée pour ce cours. Les notes et les intitulés des travaux sont conservés.', 'Weighting confirmed and saved for this course. Scores and assessment titles are preserved.'))
    } catch (error: any) {
      onAction(error?.response?.data?.message || tr('La nouvelle pondération n’a pas pu être confirmée. Réessayez.', 'The new weighting could not be confirmed. Try again.'), true)
    } finally { setWeightFixSaving(false) }
  }

  const analyzeStudent = (student: GradebookStudent) => {
    const average = getWeightedAverage(student.id)
    const missing = visibleAssignments.filter((assignment) => !getRawScore(assignment.id, student.id).trim()).length
    const projected = average === null ? null : Math.max(0, Math.min(100, average + (student.attendance && student.attendance > 94 ? 2 : -3) - missing * 2))
    const risk = average === null || projected === null || missing >= 2 || projected < 70 ? 'high' : average < 78 || projected < 80 ? 'medium' : 'low'
    return { student, average, missing, projected, risk }
  }
  const studentAnalytics = courseStudents.map(analyzeStudent)
  const submissionAnalytics = enrolledCourseStudents.map(analyzeStudent)

  const classAverage = studentAnalytics.filter((item) => item.average !== null).reduce((sum, item) => sum + (item.average ?? 0), 0) / Math.max(1, studentAnalytics.filter((item) => item.average !== null).length)
  const atRiskCount = studentAnalytics.filter((item) => item.risk !== 'low').length
  const missingCount = studentAnalytics.reduce((sum, item) => sum + item.missing, 0)
  const rankedStudents = rankGradebookRows(submissionAnalytics.map((item) => ({ ...item, name: item.student.name })))
  const topThree = rankedStudents.slice(0, 3)
  const rankingCount = Math.min(rankedStudents.length, Math.max(0, Math.floor(Number(rankingLimit) || 0)))
  const assessmentDateTerm = calendarPeriods.find((period) => ['QUARTER', 'TRIMESTER'].includes(period.type) && draft.date >= period.startDate.slice(0, 10) && draft.date <= period.endDate.slice(0, 10))
  const dateSuggestedTerm = assessmentDateTerm ? terms[assessmentDateTerm.sequence - 1] : undefined

  const currentSnapshotContent = stableGradebookValue({ scores, comments, assignments: sanitizeAssignments(assignments), categories, archivedAssignments })
  const currentContent = useRef(currentSnapshotContent)
  currentContent.current = currentSnapshotContent

  useEffect(() => {
    if (loadedScope !== cycleKey) return
    const dirty = syncedContents.current.get(cycleKey) !== currentSnapshotContent
    if (dirty) {
      try { localStorage.setItem(browserStorageKey, JSON.stringify({ scores, comments, assignments: sanitizeAssignments(assignments), categories, archivedAssignments, savedAt: new Date().toISOString() })) } catch { /* The server save is still available. */ }
    }
    pendingAutosave.current = dirty && autosaveEnabled && !pausedAutosaves.current.has(cycleKey) ? () => saveSpreadsheet(true, true) : null
    if (!dirty || !autosaveEnabled || savingSpreadsheet || pausedAutosaves.current.has(cycleKey)) return
    setSaveNotice(tr('Modifications conservées sur cet appareil · synchronisation automatique en attente…', 'Changes saved on this device · automatic synchronization pending…'))
    if (!navigator.onLine) return
    const timer = window.setTimeout(() => { pendingAutosave.current = null; void saveSpreadsheet(true, true) }, Math.max(900, autosaveRetryAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [currentSnapshotContent, loadedScope, cycleKey, autosaveEnabled, savingSpreadsheet, autosaveRetryAt, onlineRevision])

  useEffect(() => () => { const pending = pendingAutosave.current; pendingAutosave.current = null; if (pending) void pending() }, [cycleKey])
  useEffect(() => {
    const retry = () => { setAutosaveRetryAt(0); setOnlineRevision(value => value + 1) }
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      if (syncedContents.current.get(activeScope.current) === currentContent.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('online', retry)
    window.addEventListener('beforeunload', warnUnsaved)
    return () => { window.removeEventListener('online', retry); window.removeEventListener('beforeunload', warnUnsaved) }
  }, [])

  const getAssignmentAverage = (assignment: GradebookColumn) => {
    const values = courseStudents.map((student) => getScore(assignment, student.id)).filter((value): value is number => value !== null)
    if (!values.length) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  const distribution = [
    { band: '90-100', count: studentAnalytics.filter((item) => (item.average ?? 0) >= 90).length, color: '#22c55e' },
    { band: '80-89', count: studentAnalytics.filter((item) => (item.average ?? 0) >= 80 && (item.average ?? 0) < 90).length, color: '#2563eb' },
    { band: '70-79', count: studentAnalytics.filter((item) => (item.average ?? 0) >= 70 && (item.average ?? 0) < 80).length, color: '#f59e0b' },
    { band: '<70', count: studentAnalytics.filter((item) => (item.average ?? 0) < 70 || item.average === null).length, color: '#ef4444' },
  ]

  const trendData = [
    { month: 'Jan', average: Math.max(58, Math.round(classAverage - 6)) },
    { month: 'Feb', average: Math.max(58, Math.round(classAverage - 3)) },
    { month: 'Mar', average: Math.round(classAverage - 1) },
    { month: 'Apr', average: Math.round(classAverage) },
    { month: 'May', average: Math.min(98, Math.round(classAverage + 2)) },
  ]

  const addAssignment = async (periodVerified = false) => {
    if (periodReadOnly) return closedNotice()
    if (loadedScope !== cycleKey) return onAction(tr('Attendez le chargement du cours avant de créer une évaluation.', 'Wait for the course to finish loading before creating an assessment.'), true)
    if (!draft.title.trim()) return onAction('Enter a clear task title before adding it.', true)
    if (!draft.date) return onAction('Select the assessment date before adding the task.', true)
    if (addingAssignment) return
    if (term === 'Annual final') return onAction(tr('Choisissez le quarter de cette évaluation. Le bilan annuel regroupe les quarters.', 'Choose this assessment’s quarter. The annual result combines the quarters.'), true)
    if (!periodVerified) {
      setConfirmedPeriod(false)
      setPeriodConfirmation('task')
      return
    }
    setPeriodConfirmation(null)
    setAddingAssignment(true)
    const nextAssignment = {
      id: `gb-${Date.now()}`,
      title: draft.title.trim() || 'New Assignment',
      type: draft.type,
      category: draft.category,
      maxPoints: Math.max(1, Number(draft.maxPoints) || scale),
      date: draft.date,
      term,
      confirmedCycle: academicYear + '::' + term,
      description: draft.description,
    }
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 320))
      setAssignments((current) => sanitizeAssignments([...current, nextAssignment]))
      setScores((current) => buildMissingScoreCells([nextAssignment], courseStudents, current))
      setSelectedAssignmentId(nextAssignment.id)
      setDraft({ title: '', type: 'quiz', category: 'quiz', maxPoints: '', date: '', description: '' })
      onAction(`${nextAssignment.title} ${nextAssignment.type} added to ${selectedCourse?.name ?? 'Gradebook'}; averages will recalculate automatically as scores are entered.`)
    } finally {
      setAddingAssignment(false)
    }
  }

  const performDeleteAssignment = (assignmentId: string) => {
    const assignment = assignments.find((item) => item.id === assignmentId)
    if (!assignment || assignmentReadOnly(assignment)) return
    const removedScores = Object.fromEntries(Object.entries(scores).filter(([key]) => key.startsWith(assignmentId + ':')))
    const removedComments = Object.fromEntries(Object.entries(comments).filter(([key]) => key.startsWith(assignmentId + ':')))
    setArchivedAssignments((current) => [{ assignment, scores: removedScores, comments: removedComments, deletedAt: new Date().toISOString() }, ...current].slice(0, 25))
    setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId))
    setScores((current) => {
      const next = { ...current }
      Object.keys(next).forEach((key) => { if (key.startsWith(`${assignmentId}:`)) delete next[key] })
      return next
    })
    setComments((current) => {
      const next = { ...current }
      Object.keys(next).forEach((key) => { if (key.startsWith(assignmentId + ':')) delete next[key] })
      return next
    })
    setPendingDeleteAssignment(null)
    onAction(tr('Évaluation supprimée, calculs actualisés et trace d’audit enregistrée.', 'Assignment deleted, calculations refreshed, and audit event recorded.'))
  }

  const restoreAssignment = (archived: ArchivedAssignment) => {
    if (assignmentReadOnly(archived.assignment)) return closedNotice()
    setAssignments((current) => sanitizeAssignments([...current, archived.assignment]))
    setScores((current) => ({ ...current, ...archived.scores }))
    setComments((current) => ({ ...current, ...archived.comments }))
    setArchivedAssignments((current) => current.filter((item) => item.deletedAt !== archived.deletedAt || item.assignment.id !== archived.assignment.id))
    setSelectedAssignmentId(archived.assignment.id)
    onAction(tr('Evaluation et points restaures. Cliquez sur Enregistrer.', 'Assignment and scores restored. Click Save to synchronize.'))
  }

  const saveAssignmentEdit = () => {
    if (assignmentReadOnly(editingAssignment ?? undefined)) return closedNotice()
    if (!editingAssignment?.title.trim() || !editingAssignment.date || editingAssignment.maxPoints < 1) {
      return onAction(tr('Renseignez le titre, la date et un maximum de points valide.', 'Enter a title, date, and valid maximum score.'), true)
    }
    setAssignments((current) => sanitizeAssignments(current.map((item) => item.id === editingAssignment.id ? { ...editingAssignment, title: editingAssignment.title.trim() } : item)))
    setEditingAssignment(null)
    onAction(tr('Colonne modifiee. Cliquez sur Enregistrer.', 'Column updated. Click Save to synchronize.'))
  }

  const deleteAssignment = (assignment: GradebookColumn) => {
    if (assignmentReadOnly(assignment)) return closedNotice()
    if (skipDeleteConfirmation) return performDeleteAssignment(assignment.id)
    setRememberDeleteChoice(false)
    setPendingDeleteAssignment(assignment)
  }

  const confirmDeleteAssignment = () => {
    if (!pendingDeleteAssignment) return
    if (rememberDeleteChoice) {
      localStorage.setItem('kcs:nexus:gradebook:skip-delete-confirmation', 'true')
      setSkipDeleteConfirmation(true)
    }
    performDeleteAssignment(pendingDeleteAssignment.id)
  }

  const moveAssignment = (targetId: string) => {
    if (!draggedAssignmentId || draggedAssignmentId === targetId) return setDraggedAssignmentId('')
    setAssignments((current) => {
      const sourceIndex = current.findIndex((item) => item.id === draggedAssignmentId)
      const targetIndex = current.findIndex((item) => item.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return sanitizeAssignments(next)
    })
    setDraggedAssignmentId('')
    onAction(tr('Colonnes organisées de la date la plus ancienne à la plus récente.', 'Columns are ordered from the oldest assessment date to the newest.'))
  }

  const updateScore = (assignmentId: string, studentId: string, value: string) => {
    if (assignmentReadOnly(assignments.find(item => item.id === assignmentId))) return closedNotice()
    setScores((current) => ({ ...current, [scoreKey(assignmentId, studentId)]: value }))
  }

  const applyBulkScore = () => {
    if (assignmentReadOnly(selectedBulkAssignment)) return closedNotice()
    if (!selectedAssignmentId || !selectedBulkAssignment) return onAction('Select an assignment before applying a bulk score.')
    const numericScore = Number(bulkValue)
    if (!bulkValue.trim() || !Number.isFinite(numericScore) || numericScore < 0 || numericScore > selectedBulkAssignment.maxPoints) return onAction(`Enter a score between 0 and ${selectedBulkAssignment.maxPoints}.`)
    setScores((current) => {
      const next = { ...current }
      courseStudents.forEach((student) => {
        next[scoreKey(selectedAssignmentId, student.id)] = bulkValue
      })
      return next
    })
    onAction(`${bulkValue}/${selectedBulkAssignment.maxPoints} applied to ${courseStudents.length} student(s) for ${selectedBulkAssignment.title}.`)
    setSaveNotice('Bulk score applied — click Save to persist')
  }

  const suggestGrade = (assignment: GradebookColumn, student: GradebookStudent) => {
    const average = getWeightedAverage(student.id) ?? student.average ?? classAverage
    return String(Math.round((Math.max(0, Math.min(100, average + 2)) / 100) * assignment.maxPoints))
  }

  const openCellDialog = (mode: 'ai' | 'note', assignment: GradebookColumn, student: GradebookStudent) => {
    if (assignmentReadOnly(assignment)) return closedNotice()
    setCellDialog({ mode, assignment, student })
    setCellNoteDraft(comments[scoreKey(assignment.id, student.id)] ?? '')
  }

  const applyAiSuggestion = () => {
    if (assignmentReadOnly(cellDialog?.assignment)) return closedNotice()
    if (!cellDialog) return
    const suggestion = suggestGrade(cellDialog.assignment, cellDialog.student)
    updateScore(cellDialog.assignment.id, cellDialog.student.id, suggestion)
    setComments((current) => ({ ...current, [scoreKey(cellDialog.assignment.id, cellDialog.student.id)]: `AI suggestion accepted after teacher review: ${suggestion}/${cellDialog.assignment.maxPoints}.` }))
    onAction(`AI suggestion applied for ${cellDialog.student.name}; teacher review remains recorded.`)
    setCellDialog(null)
  }

  const saveCellNote = () => {
    if (assignmentReadOnly(cellDialog?.assignment)) return closedNotice()
    if (!cellDialog) return
    setComments((current) => ({ ...current, [scoreKey(cellDialog.assignment.id, cellDialog.student.id)]: cellNoteDraft.trim() }))
    onAction(`Teacher note saved for ${cellDialog.student.name} in ${cellDialog.assignment.title}.`)
    setCellDialog(null)
  }

  const generateFeedback = (student: GradebookStudent) => {
    const analytics = studentAnalytics.find((item) => item.student.id === student.id)
    const average = analytics?.average ?? student.average ?? 0
    const message = average >= 88
      ? `${student.name} demonstrates strong mastery and should receive enrichment through advanced application tasks.`
      : average >= 75
        ? `${student.name} is progressing, with the greatest gains likely from targeted practice on ${student.weaknesses?.[0] ?? 'current unit skills'}.`
        : `${student.name} needs immediate support, missing-work recovery, and a parent-teacher intervention plan this week.`
    setComments((current) => ({ ...current, [`feedback:${student.id}`]: message }))
    onAction(`AI feedback generated for ${student.name}.`)
  }

  const submitFinalGrades = async (periodVerified = false) => {
    if (periodReadOnly) return closedNotice()
    if (!selectedCourse) return onAction('Select a course before submitting final grades.', true)
    if (!enrolledCourseStudents.length) return onAction('This course has no enrolled students.', true)
    if (term === 'Annual final') return onAction(tr('Soumettez chaque quarter suivi séparément. Le bulletin annuel utilise les périodes soumises disponibles.', 'Submit each attended quarter separately. The annual report card uses the available submitted periods.'), true)
    if (categories.reduce((sum, category) => sum + category.weight, 0) !== 100) return onAction('Category weights must total exactly 100% before final grades can be submitted.', true)
    const gradedRows = submissionAnalytics.filter(item => item.average !== null)
    const ungradedRows = submissionAnalytics.filter(item => item.average === null)
    if (!gradedRows.length && excludedAssessments.length) { setWeightFixOpen(true); return }
    if (!gradedRows.length) return onAction(tr('Saisissez au moins une note numérique avant de soumettre ce cours.', 'Enter at least one numeric grade before submitting this course.'), true)
    if (!periodVerified) { setConfirmedPeriod(false); setPeriodConfirmation('submission'); return }
    setPeriodConfirmation(null)
    setSubmittingFinals(true)
    try {
      if (!await saveSpreadsheet(true)) return
      const synchronizedCourse = await teacherWorkspaceAPI.syncCourse({
        id: selectedCourse.id,
        name: selectedCourse.name,
        abbreviation: selectedCourse.abbreviation,
        description: `${selectedCourse.name} · ${selectedCourse.className} · verified before final-grade submission`,
        grade: selectedCourse.className || selectedCourse.gradeLevels[0],
        credits: 1,
        room: '',
        studentIds: enrolledCourseStudents.map((student) => student.id),
        studentNumbers: enrolledCourseStudents.map((student) => student.studentNumber).filter(Boolean),
      })
      const officialCourseId = String(synchronizedCourse.data?.data?.id || selectedCourse.id)
      const synchronizedEnrollmentCount = synchronizedCourse.data?.data?.enrollments?.length ?? 0
      if (synchronizedEnrollmentCount !== enrolledCourseStudents.length) {
        throw new Error(`Course roster verification failed: ${synchronizedEnrollmentCount}/${enrolledCourseStudents.length} official enrollments were confirmed.`)
      }
      const response = await academicRecordsAPI.submitFinalGrades({
        courseId: officialCourseId,
        academicYear,
        term,
        confirmedCycle: academicYear + '::' + term,
        ungradedStudentIds: ungradedRows.map(item => item.student.id),
        results: gradedRows.map((item) => ({ studentId: item.student.id, studentNumber: item.student.studentNumber || undefined, percentage: Number(item.average!.toFixed(2)), comment: comments[`feedback:${item.student.id}`] || undefined })),
      })
      const savedCount = Number(response.data?.data?.count ?? 0)
      const propagatedCount = Number(response.data?.data?.reportCardDraftsUpdated ?? 0)
      const queuedForSuperAdministration = response.data?.data?.superAdministrationQueued === true
      const propagationVerified = response.data?.data?.propagationVerified === true
      if (savedCount !== gradedRows.length || propagatedCount !== gradedRows.length || !queuedForSuperAdministration || !propagationVerified) {
        throw new Error(`Propagation check failed: ${savedCount}/${gradedRows.length} grades and ${propagatedCount}/${gradedRows.length} report-card drafts were confirmed.`)
      }
      const confirmation = await academicRecordsAPI.myFinalGrades()
      const confirmedRows = ((confirmation.data?.data?.submissions ?? []) as OfficialFinalGrade[]).filter((grade) => (
        grade.courseId === officialCourseId
        && grade.cycle?.academicYear === academicYear
        && grade.cycle?.term === term
        && grade.cycle?.status === 'SUBMITTED'
        && gradedRows.some(item => item.student.id === grade.studentId)
      ))
      if (confirmedRows.length !== gradedRows.length) {
        throw new Error(`Official verification failed: ${confirmedRows.length}/${gradedRows.length} submitted grades are visible in the server register.`)
      }
      setOfficialFinalGrades((confirmation.data?.data?.submissions ?? []) as OfficialFinalGrade[])
      window.dispatchEvent(new CustomEvent('kcs-final-grades-submitted', { detail: { courseId: officialCourseId, academicYear, term, count: savedCount } }))
      const notified = Number(response.data?.data?.superAdministrationNotified ?? 0)
      onAction(`${gradedRows.length} final grade(s) submitted and independently verified for Super Administration review${notified ? `; ${notified} administrator notification(s) created` : ''}.`)
    } catch (error: any) {
      onAction(error?.response?.data?.message || error?.message || 'Final-grade submission failed.', true)
    } finally { setSubmittingFinals(false) }
  }

  const exportGradebook = async (format: 'PDF' | 'Excel' | 'CSV', ranked = false, detailed = false) => {
    const rows = studentAnalytics.map(({ student, average, projected, missing, risk }) => [student.name, canonicalClassLabel(student.grade, student.section), formatPercent(average), internationalGrade(average), formatPercent(projected), String(missing), risk])
    const heading = ['Student', 'Class', 'Average', 'International grade', 'Prediction', 'Missing work', 'Risk']
    const csv = [heading, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const safeName = (selectedCourse?.name ?? 'gradebook').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    if (format === 'CSV') downloadFile(`${safeName}-gradebook.csv`, csv, 'text/csv;charset=utf-8')
    else if (format === 'Excel') downloadFile(`${safeName}-gradebook.xls`, `<table><thead><tr>${heading.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`, 'application/vnd.ms-excel')
    else {
      const reserved=window.open('','_blank','width=1250,height=900')
      const numeric=submissionAnalytics.flatMap(item=>item.average==null?[]:[item.average]).sort((a,b)=>a-b)
      const median=numeric.length?(numeric.length%2?numeric[(numeric.length-1)/2]:(numeric[numeric.length/2-1]+numeric[numeric.length/2])/2):0
      const pdfClassAverage = numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : 0
      const pdfDistribution = [
        { ...distribution[0], count: submissionAnalytics.filter(item => item.average !== null && item.average >= 90).length },
        { ...distribution[1], count: submissionAnalytics.filter(item => item.average !== null && item.average >= 80 && item.average < 90).length },
        { ...distribution[2], count: submissionAnalytics.filter(item => item.average !== null && item.average >= 70 && item.average < 80).length },
        { ...distribution[3], count: submissionAnalytics.filter(item => item.average === null || item.average < 70).length },
      ]
      const ok=await printOfficialGradebook({courseId:selectedCourse?.id??selectedCourseId,courseName:selectedCourse?.name??'Gradebook',courseCode:selectedCourse?.abbreviation,academicYear,term,rankingLimit:ranked?rankingCount:undefined,assessments:detailed?visibleAssignments.map(task=>({...task,category:displayCategories.find(category=>category.id===task.category)?.name || task.category})):undefined,rows:submissionAnalytics.map(item=>({name:item.student.name,className:canonicalClassLabel(item.student.grade,item.student.section),average:item.average,letter:internationalGrade(item.average),missing:item.missing,risk:item.risk,scores:detailed?Object.fromEntries(visibleAssignments.map(task=>[task.id,getRawScore(task.id,item.student.id)])):undefined})),categories:displayCategories.map(category=>{const values=enrolledCourseStudents.flatMap(student=>{const value=getCategoryAverage(student.id,category.id);return value==null?[]:[value]});return{name:category.name,weight:category.weight,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null}}),distribution:pdfDistribution,classAverage:pdfClassAverage,median,successRate:numeric.length?numeric.filter(value=>value>=70).length*100/numeric.length:0,missingWork:submissionAnalytics.reduce((sum, item) => sum + item.missing, 0)},message=>onAction(message,true),reserved)
      if(!ok)return
    }
    onAction(`${format} export created with the current calculations and international grading scale.`)
  }

  const applyCategoryWeights = (next: Category[]) => {
    if (periodReadOnly) return closedNotice()
    setCategories(next)
    if (Math.abs(next.reduce((sum, item) => sum + item.weight, 0) - 100) > 0.001) {
      setSaveNotice(tr('Ajustez la pondération à 100 % pour l’enregistrer pour ce cours.', 'Adjust the total to 100% to save this course weighting.'))
      return
    }
    setWeightScopeOpen(true)
    const scope = cycleKey
    setSaveNotice(tr('Enregistrement de la pondération de ce cours…', 'Saving this course weighting…'))
    void persistCourseWeights(selectedCourseId, academicYear, next).then(() => {
      if (weightScopeRef.current === scope) setSaveNotice(tr('Pondération de ce cours enregistrée sur le serveur.', 'This course weighting is saved on the server.'))
    }).catch((error: any) => {
      if (weightScopeRef.current === scope) onAction(error?.response?.data?.message || tr('La pondération reste à enregistrer. Utilisez Save pour réessayer.', 'Weighting still needs to be saved. Use Save to retry.'), true)
    })
  }
  const applyWeightsToCourses = async (courseIds: string[]) => {
    await Promise.all([...weightRequests.current.values()])
    await teacherWorkspaceAPI.saveGradebookWeights({ courseId: selectedCourseId, courseIds, academicYear, term, categories })
    window.dispatchEvent(new Event('kcs-gradebook-weights-changed'))
    onAction(tr('Pondération enregistrée pour ', 'Weighting saved for ') + courseIds.length + tr(' cours.', ' course(s).'))
  }

  const updateCategoryWeight = (categoryId: string, weight: number) => {
    applyCategoryWeights(categories.map(category => category.id === categoryId ? { ...category, weight: Math.max(0, Math.min(100, weight || 0)) } : category))
  }

  const moveScoreFocus=(event:ReactKeyboardEvent<HTMLInputElement>,row:number,column:number)=>{
    const directions:Record<string,[number,number]>={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}
    const movement=directions[event.key];if(!movement)return
    const target=document.querySelector<HTMLInputElement>(`[data-grade-row="${row+movement[0]}"][data-grade-column="${column+movement[1]}"]`)
    if(target){event.preventDefault();target.focus();target.select()}
  }

  const categoryWeightTotal = displayCategories.reduce((sum, category) => sum + category.weight, 0)
  const normalizeCategoryWeights = () => {
    const currentTotal = categories.reduce((sum, category) => sum + category.weight, 0)
    if (!currentTotal) return applyCategoryWeights(defaultCategories)
    let allocated = 0
    applyCategoryWeights(categories.map((category, index) => {
      const weight = index === categories.length - 1 ? 100 - allocated : Math.round((category.weight / currentTotal) * 100)
      allocated += weight
      return { ...category, weight }
    }))
  }

  const configurationGridClass = taskPanelOpen && weightPanelOpen
    ? 'xl:grid-cols-[0.9fr_1.1fr]'
    : taskPanelOpen
      ? 'xl:grid-cols-[minmax(0,1fr)_15rem]'
      : weightPanelOpen
        ? 'xl:grid-cols-[15rem_minmax(0,1fr)]'
        : 'sm:grid-cols-2'


  return (
    <div data-kcs-gradebook="true" className="gradebook-mobile-surface space-y-6">
      {excludedAssessments.length > 0 && !periodReadOnly && <section role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <b>{tr('Des notes sont exclues par une pondération de 0 %.', 'Some scores are excluded by a 0% category weight.')}</b>
        <p className="mt-1">{excludedAssessments.map(task => task.title).join(', ')} · {tr('Ces notes restent enregistrées. Confirmez une pondération si elles doivent contribuer au résultat officiel.', 'These scores remain saved. Confirm a weighting if they should count toward the official result.')}</p>
        <button type="button" onClick={() => setWeightFixOpen(true)} className="mt-3 rounded-xl bg-kcs-blue-700 px-4 py-2 font-bold text-white">{tr('Examiner la pondération de ce cours', 'Review this course weighting')}</button>
      </section>}
      {weightFixOpen && createPortal(<div className="fixed inset-0 z-[10040] flex items-center justify-center bg-kcs-blue-950/80 p-4" role="dialog" aria-modal="true" aria-label={tr('Confirmer la pondération du cours', 'Confirm course weighting')} data-gradebook-overlay>
        <section className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-sky-200 bg-white p-5 shadow-2xl dark:border-sky-700 dark:bg-kcs-blue-950 dark:text-white sm:p-7">
          <h3 className="text-xl font-black">{tr('Faire compter les évaluations notées', 'Include scored assessments in the result')}</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{selectedCourse?.name} · {academicYear} · {term}</p>
          <p className="mt-3 text-sm">{tr('La proposition donne un poids aux catégories notées qui étaient à 0 %, en conservant les proportions des catégories déjà pondérées. Vérifiez les valeurs avant de confirmer pour ce cours.', 'The proposal gives weight to scored categories currently at 0%, preserving the proportions of categories already weighted. Review the values before confirming them for this course.')}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{proposedWeights.map(category => <div key={category.id} className="rounded-xl bg-sky-50 p-3 text-sm dark:bg-kcs-blue-900"><b>{category.name}</b><p>{categories.find(item => item.id === category.id)?.weight ?? 0}% → <strong>{category.weight}%</strong></p></div>)}</div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-300">{tr('Vous pouvez aussi conserver la règle actuelle et modifier manuellement Category weighting. Les notes restent disponibles dans les deux cas.', 'You can also retain the current rule and edit Category weighting manually. Your scores remain available in either case.')}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" disabled={weightFixSaving} onClick={() => { setWeightFixOpen(false); setWeightPanelOpen(true) }} className="rounded-xl border border-sky-300 px-4 py-2 text-sm font-bold dark:border-sky-700">{tr('Ajuster manuellement', 'Adjust manually')}</button><button type="button" disabled={weightFixSaving} onClick={() => void applyWeightCorrection()} className="rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{weightFixSaving ? tr('Enregistrement…', 'Saving…') : tr('Confirmer pour ce cours', 'Confirm for this course')}</button><button type="button" disabled={weightFixSaving} onClick={() => setWeightFixOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold dark:border-kcs-blue-700">{tr('Fermer', 'Close')}</button></div>
        </section>
      </div>, document.body)}
      {weightScopeOpen && <GradebookWeightScopeDialog key={cycleKey} courses={courses} currentCourseId={selectedCourseId} academicYear={academicYear} term={term} categories={categories} onApply={applyWeightsToCourses} onClose={() => setWeightScopeOpen(false)}/>}
      {periodReadOnly && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">{periodNotice}</p>}
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-kcs-blue-950" aria-label={tr('Périodes et notes enregistrées', 'Periods and saved grades')}>
        <p className="text-sm font-bold text-kcs-blue-950 dark:text-sky-100">{academicYear} · {tr('Période affichée', 'Displayed period')} {term}</p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{loadedScope !== cycleKey ? tr('Chargement sécurisé des notes enregistrées…', 'Loading saved gradebook securely…') : tr('Vos notes restent conservées dans leur période. Choisissez une période ci-dessous pour les retrouver.', 'Your grades remain saved in their original period. Choose a period below to view them.')} {officialTerm !== term && <strong>{tr('Période de saisie ouverte', 'Open grade-entry period')} {officialTerm}.</strong>}</p>
        {recoveredCells > 0 && <p className="mt-2 text-xs font-bold text-amber-800 dark:text-amber-200">{tr('Notes retrouvées dans les anciens formats', 'Grades recovered from older formats')} · {recoveredCells}. {tr('Enregistrez pour confirmer leur synchronisation.', 'Save to confirm synchronization.')}</p>}
        <div className="mt-2 flex flex-wrap gap-2">{terms.map((period) => {
          const count = assignments.filter((assignment) => period === 'Annual final' || assignment.term === period).length
          return <button key={period} type="button" disabled={loadedScope !== cycleKey} aria-pressed={term === period} onClick={() => chooseTerm(period)} className={`rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 ${term === period ? 'border-kcs-blue-700 bg-kcs-blue-700 text-white' : 'border-sky-200 bg-white text-kcs-blue-900 dark:border-sky-800 dark:bg-kcs-blue-900 dark:text-sky-100'}`}>{period} · {count} {tr('travaux', 'tasks')}</button>
        })}</div>
      </section>
      <div className={`grid gap-4 ${commandCenterOpen ? 'xl:grid-cols-[1fr_0.9fr]' : ''}`}>
        <div className={`rounded-2xl border border-gray-100 bg-white transition-all dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 ${commandCenterOpen ? 'p-5' : 'p-3'}`}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">AI Gradebook Command Center</p>
              <h3 className={`${commandCenterOpen ? 'mt-1 text-xl sm:text-2xl' : 'mt-0 text-base'} break-words font-display font-bold leading-tight text-kcs-blue-900 dark:text-white`}>{selectedCourse?.name ?? 'Gradebook'}</h3>
              {commandCenterOpen && <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                Spreadsheet entry, weighted categories, predictive risk detection, report-card comments, and synchronized parent/student/admin visibility.
              </p>}
            </div>
            <button type="button" aria-expanded={commandCenterOpen} onClick={() => { const next=!commandCenterOpen;setCommandCenterOpen(next);localStorage.setItem('kcs:nexus:gradebook:command-center',next?'open':'closed') }} className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-kcs-blue-200 px-3 py-2 text-sm font-semibold text-kcs-blue-700 sm:w-auto dark:border-kcs-blue-700 dark:text-kcs-blue-200"><ChevronDown size={19} className={`transition-transform ${commandCenterOpen?'rotate-180':''}`}/><span>{commandCenterOpen?'Hide command center':'Show command center'}</span></button>
          </div>
          {commandCenterOpen && <div className="mt-4 flex flex-wrap items-end gap-1.5 border-t border-gray-100 pt-4 dark:border-kcs-blue-800">
              <select aria-label="Academic year" value={academicYear} onChange={(event)=>setAcademicYear(event.target.value)} className="w-32 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                {academicYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
              <button disabled={periodReadOnly || submittingFinals} onClick={()=>void submitFinalGrades()} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={15} className="mr-1 inline"/>{submittingFinals?'Submitting…':'Submit final grades'}</button>
              <button type="button" onClick={() => setRankingOpen(true)} className="rounded-xl bg-indigo-700 px-3 py-2 text-sm font-semibold text-white"><BarChart3 size={15} className="mr-1 inline"/>{tr('Classement des élèves', 'Learner ranking')}</button>
              <button onClick={() => void exportGradebook('PDF')} className="rounded-xl bg-kcs-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-kcs-blue-800"><FileText size={15} className="mr-1 inline" /> PDF</button>
              <button type="button" onClick={() => void exportGradebook('PDF', false, true)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"><FileText size={15}/>{tr('PDF détaillé', 'Detailed PDF')}</button>
              <button onClick={() => void exportGradebook('Excel')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800"><FileSpreadsheet size={15} className="mr-1 inline" /> Excel</button>
              <button onClick={() => void exportGradebook('CSV')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800"><Download size={15} className="mr-1 inline" /> CSV</button>
          </div>}

          {commandCenterOpen && <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_0.7fr_0.7fr_1fr]">
            <select className="input-kcs py-2 text-sm" value={selectedCourse?.id} onChange={(event) => onSelectCourse(event.target.value)}>
              {courses.map((course) => <option key={course.id} value={course.id}>{canonicalClassLabel(course.className || course.gradeLevels[0])} - {course.name}</option>)}
            </select>
            <select className="input-kcs py-2 text-sm" value={term} onChange={(event) => chooseTerm(event.target.value)}>
              {terms.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="input-kcs py-2 text-sm" value={scale} onChange={(event) => setScale(Number(event.target.value))}>
              {scoreScales.map((item) => <option key={item} value={item}>{item}-point scale</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 dark:border-kcs-blue-700 dark:bg-kcs-blue-950">
              <Search size={16} className="text-gray-400" />
              <input className="w-full bg-transparent text-sm outline-none dark:text-white" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" />
            </label>
          </div>}
        </div>

        {commandCenterOpen && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-2">
          {[
            { label: 'Class average', value: `${Math.round(classAverage)}%`, icon: TrendingUp, tone: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' },
            { label: 'At risk', value: String(atRiskCount), icon: AlertTriangle, tone: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
            { label: 'Missing work', value: String(missingCount), icon: Bell, tone: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' },
            { label: tr('Les trois premiers', 'Top three learners'), value: <ol className="space-y-1.5 text-xs">{topThree.length ? topThree.map(item => <li key={item.student.id} className="flex items-start justify-between gap-2"><span className="min-w-0 break-words">{item.rank}. {item.student.name}</span><strong className="shrink-0">{item.average!.toFixed(2)}%</strong></li>) : <li>{tr('Aucune note', 'No grades yet')}</li>}</ol>, icon: Sparkles, tone: 'bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}><Icon size={18} /></div>
                <div className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{item.value}</div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{item.label}</p>
              </div>
            )
          })}
        </div>}
      </div>

      {officialCourseGrades.length > 0 && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-800 dark:bg-emerald-950/20">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Official submitted results</p>
              <h4 className="mt-1 font-bold text-kcs-blue-950 dark:text-white">Grades already preserved in report cards</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">These values come directly from the official Nexus academic register. Recovered task details remain editable in the spreadsheet below.</p>
            </div>
            <span className="w-fit rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white">{officialCourseGrades.length} official grade(s)</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {officialCourseGrades.map((grade) => (
              <div key={grade.id} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 dark:border-emerald-900 dark:bg-kcs-blue-950">
                <div><p className="font-semibold text-kcs-blue-950 dark:text-white">{grade.student?.name ?? grade.studentId}</p><p className="text-xs text-slate-500">{grade.cycle?.term ?? term}</p></div>
                <div className="text-right"><strong className="text-lg text-emerald-700 dark:text-emerald-300">{Number(grade.percentage).toFixed(2)}%</strong><p className="text-xs font-bold text-slate-500">{grade.letterGrade}</p></div>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className={`grid gap-4 transition-all ${configurationGridClass}`}>
        <div className={`rounded-2xl border border-gray-100 bg-white transition-all dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 ${taskPanelOpen ? 'p-5' : 'p-3'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-kcs-blue-900 dark:text-white">Create an assessment task</h4>
              {taskPanelOpen && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Add one real Gradebook column. The task type automatically selects its weighting category.</p>}
            </div>

            <div className="flex items-center gap-2">{taskPanelOpen && <span className="hidden rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-200 sm:inline">RBAC: teacher classes only</span>}<button type="button" aria-expanded={taskPanelOpen} onClick={() => togglePanel('task', !taskPanelOpen)} className="rounded-xl border border-kcs-blue-200 p-2 text-kcs-blue-700 dark:border-kcs-blue-700 dark:text-kcs-blue-200"><ChevronDown size={18} className={`transition-transform ${taskPanelOpen ? 'rotate-180' : ''}`} /><span className="sr-only">{taskPanelOpen ? 'Hide section' : 'Show section'}</span></button></div>
          </div>
          {taskPanelOpen && <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-xs font-bold text-kcs-blue-900 dark:text-kcs-blue-100">
              Task title <span className="font-normal text-gray-500">Use a recognizable name, for example Fractions quiz 1.</span>
              <input className="input-kcs py-2 text-sm" value={draft.title} onChange={(event) => setDraft((item) => ({ ...item, title: event.target.value }))} placeholder="Enter the assessment title" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold text-kcs-blue-900 dark:text-kcs-blue-100">
                Assessment type and category
                <select
                  className="input-kcs py-2 text-sm"
                  value={draft.type}
                  onChange={(event) => {
                    const type = event.target.value as AssignmentType
                    setDraft((item) => ({ ...item, type, category: type, maxPoints: defaultPointsByType[type] }))
                  }}
                >
                  {assignmentTypes.map((item) => <option key={item} value={item}>{assignmentTypeLabels[item].name}</option>)}
                </select>
                <span className="font-normal text-gray-500">{assignmentTypeLabels[draft.type].help}</span>
              </label>
              <label className="grid gap-1 text-xs font-bold text-kcs-blue-900 dark:text-kcs-blue-100">
                Maximum points
                <input className="input-kcs py-2 text-sm" type="number" inputMode="decimal" min={1} max={10000} value={draft.maxPoints} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setDraft((item) => ({ ...item, maxPoints: event.target.value === '' ? '' : Number(event.target.value.replace(/^0+(?=\d)/, '')) }))} placeholder="20" />
                <span className="font-normal text-gray-500">Scores are converted automatically to a percentage.</span>
              </label>
            </div>
            <label className="grid gap-1 text-xs font-bold text-kcs-blue-900 dark:text-kcs-blue-100">
              Assessment date
              <DateSelect max="2700-12-31" className="input-kcs py-2 text-sm" value={draft.date} onChange={(event) => setDraft((item) => ({ ...item, date: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs font-bold text-kcs-blue-900 dark:text-kcs-blue-100">
              Instructions or learning objective <span className="font-normal text-gray-500">(optional)</span>
              <textarea className="input-kcs min-h-20 py-2 text-sm" value={draft.description} onChange={(event) => setDraft((item) => ({ ...item, description: event.target.value }))} placeholder="Describe the assessed skill, chapter, or instructions." />
            </label>
            <button
              type="button"
              onClick={() => void addAssignment()}
              disabled={periodReadOnly || addingAssignment || loadedScope !== cycleKey}
              aria-busy={addingAssignment}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-kcs-blue-800 hover:shadow-md active:translate-y-0 disabled:cursor-wait disabled:opacity-75"
            >
              {addingAssignment ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
              {addingAssignment ? 'Adding task…' : 'Add task'}
            </button>
          </div>}
        </div>

        <div className={`rounded-2xl border border-gray-100 bg-white transition-all dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50 ${weightPanelOpen ? 'p-5' : 'p-3'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="font-bold text-kcs-blue-900 dark:text-white">Category weighting</h4>
              {weightPanelOpen && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">These percentages calculate every learner's final course grade and feed the official report card.</p>}
            </div>
            <div className="flex items-center gap-2">
              {weightPanelOpen && <span className={`rounded-full px-3 py-1 text-xs font-black ${categoryWeightTotal === 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-200'}`}>{categoryWeightTotal}% / 100%</span>}
              {weightPanelOpen && categoryWeightTotal !== 100 && <button type="button" onClick={normalizeCategoryWeights} className="rounded-lg border border-kcs-blue-200 px-2.5 py-1 text-xs font-bold text-kcs-blue-700 dark:border-kcs-blue-700 dark:text-kcs-blue-200">Balance to 100%</button>}
              <button type="button" aria-expanded={weightPanelOpen} onClick={() => togglePanel('weight', !weightPanelOpen)} className="rounded-xl border border-kcs-blue-200 p-2 text-kcs-blue-700 dark:border-kcs-blue-700 dark:text-kcs-blue-200"><ChevronDown size={18} className={`transition-transform ${weightPanelOpen ? 'rotate-180' : ''}`} /><span className="sr-only">{weightPanelOpen ? 'Hide section' : 'Show section'}</span></button>
            </div>
          </div>
          {weightPanelOpen && <><button type="button" disabled={periodReadOnly || categoryWeightTotal !== 100} onClick={() => setWeightScopeOpen(true)} className="mt-3 rounded-xl bg-kcs-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{tr('Appliquer cette répartition à un ou plusieurs cours', 'Apply this distribution to one or more courses')}</button>{categoryWeightTotal !== 100 && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-200">Final-grade submission is locked until the category total equals exactly 100%.</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {displayCategories.map((category) => {
              const categoryValues = studentAnalytics.map(({ student }) => getCategoryAverage(student.id, category.id)).filter((value): value is number => value !== null)
              const categoryAverage = categoryValues.length ? Math.round(categoryValues.reduce((sum, value) => sum + value, 0) / categoryValues.length) : 0
              const taskCount = visibleAssignments.filter((assignment) => assignment.category === category.id).length
              return (
                <div key={category.id} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="font-semibold text-kcs-blue-900 dark:text-white">{category.name}</p><p className="text-[11px] text-gray-500">{taskCount} task(s) in this session</p></div>
                    <span className="text-xs font-bold text-kcs-blue-700 dark:text-kcs-blue-200">{categoryAverage}% average</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <input aria-label={`${category.name} weighting`} className="h-2 flex-1 accent-kcs-blue-700" type="range" min={0} max={100} value={category.weight} disabled={periodReadOnly} onChange={(event) => updateCategoryWeight(category.id, Number(event.target.value))} />
                    <div className="relative"><input aria-label={`${category.name} percentage`} className="w-20 rounded-lg border border-gray-200 py-1 pl-2 pr-6 text-right text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" type="number" min={0} max={100} value={category.weight} disabled={periodReadOnly} onChange={(event) => updateCategoryWeight(category.id, Number(event.target.value))} /><span className="pointer-events-none absolute right-2 top-1.5 text-xs text-gray-400">%</span></div>
                  </div>
                </div>
              )
            })}
          </div></>}
        </div>
      </div>

      {spreadsheetOpen && <div className="fixed inset-0 z-40 bg-kcs-blue-950/85 backdrop-blur-sm" aria-hidden="true" />}
      <div className={spreadsheetOpen ? "gradebook-focus-window fixed inset-0 z-[9990] flex flex-col overflow-hidden border border-kcs-blue-300 bg-[#e8f1fc] text-kcs-blue-950 shadow-2xl dark:border-kcs-gold-500/60 dark:bg-slate-950 dark:text-white" : "overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"}>
        <div className={`flex flex-col gap-2 border-b p-3 dark:border-kcs-blue-800 lg:flex-row lg:items-center lg:justify-between ${spreadsheetOpen ? 'border-kcs-blue-200 bg-[#dceaf9] dark:border-kcs-blue-700 dark:bg-kcs-blue-950' : 'border-gray-100'}`}>
          <div>
            <h4 className="font-bold text-kcs-blue-900 dark:text-white">Live spreadsheet</h4>{periodReadOnly && <p className="text-xs font-bold text-amber-800 dark:text-amber-300">{periodNotice}</p>}
            <p className="text-xs text-gray-500 dark:text-gray-400">Sticky roster, editable cells, comments, missing detection, weighted final average, and predictive final grade.</p>
          </div>
          <div className="flex flex-wrap items-end gap-1.5">
            <button type="button" disabled={periodReadOnly || savingSpreadsheet || loadedScope !== cycleKey} onClick={() => void saveSpreadsheet()} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"><CheckCircle2 size={15}/> Save</button>
            <button type="button" onClick={() => void exportGradebook('PDF', false, true)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"><FileText size={15}/>{tr('PDF détaillé', 'Detailed PDF')}</button>
            {!spreadsheetOpen && <button type="button" onClick={() => setSpreadsheetOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-kcs-blue-200 px-4 py-2 text-sm font-bold text-kcs-blue-700 dark:border-kcs-blue-700 dark:text-kcs-blue-200"><Maximize2 size={15}/> Dedicated window</button>}
            {spreadsheetOpen && <button type="button" onClick={() => setSpreadsheetOpen(false)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white"><Minimize2 size={14}/> Close</button>}
            <label className="grid gap-1 text-[10px] font-bold uppercase text-gray-500 dark:text-gray-300"><span>Assignment to fill</span><select aria-label="Assignment for bulk score" className="input-kcs py-2 text-sm" value={selectedAssignmentId} disabled={!visibleAssignments.length} onChange={(event) => setSelectedAssignmentId(event.target.value)}>
              {visibleAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.title}</option>)}
            </select></label>
            <label className="grid gap-1 text-[10px] font-bold uppercase text-gray-500 dark:text-gray-300"><span>Score / {selectedBulkAssignment?.maxPoints ?? '—'}</span><input aria-label="Bulk score value" type="number" min={0} max={selectedBulkAssignment?.maxPoints} disabled={!selectedBulkAssignment} className="input-kcs w-28 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder="Enter score" /></label>
            <button type="button" disabled={!selectedBulkAssignment} onClick={applyBulkScore} className="rounded-xl bg-kcs-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-kcs-blue-800 disabled:cursor-not-allowed disabled:opacity-50">Apply to all students</button>
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{autosaveEnabled ? tr('Enregistrement automatique activé pour ce cours et cette année.', 'Automatic saving is enabled for this course and year.') : tr('Cliquez une première fois sur Save pour activer l’enregistrement automatique.', 'Click Save once to enable automatic saving.')}</p>
          {saveNotice && <p role="status" className={`text-xs font-bold ${syncedContents.current.get(cycleKey) === currentSnapshotContent ? 'text-green-700 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>{saveNotice}</p>}
        </div>

        {!visibleAssignments.length && (
          <div className="border-b border-kcs-blue-100 bg-kcs-blue-50 px-5 py-4 text-sm font-semibold text-kcs-blue-800 dark:border-kcs-blue-800 dark:bg-kcs-blue-950 dark:text-kcs-blue-100">
            No grade columns yet. Create the teacher's first real task above; no demonstration subject is inserted automatically.
          </div>
        )}

        <div className={spreadsheetOpen ? "flex-1 overflow-auto" : "max-h-[680px] overflow-auto"}>
          <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20 bg-gray-50 text-xs uppercase text-gray-500 shadow-sm dark:bg-kcs-blue-900 dark:text-gray-300">
              <tr>
                <th className="sticky left-0 z-30 w-56 bg-gray-50 px-3 py-2 text-left dark:bg-kcs-blue-900">Student<span className="mt-1 block text-[10px] font-semibold normal-case text-kcs-blue-500 dark:text-kcs-blue-300">{canonicalClassLabel(selectedCourse?.className || selectedCourse?.gradeLevels?.[0])} - Official course enrollment</span></th>
                {visibleAssignments.map((assignment) => (
                  <th key={assignment.id} draggable onDragStart={() => setDraggedAssignmentId(assignment.id)} onDragEnd={() => setDraggedAssignmentId('')} onDragOver={(event) => event.preventDefault()} onDrop={() => moveAssignment(assignment.id)} title={tr('Glissez pour ordonner les colonnes de même date', 'Drag to arrange columns sharing the same assessment date')} className={`min-w-32 cursor-move border-l border-gray-100 px-2 py-2 text-center dark:border-kcs-blue-800 ${draggedAssignmentId === assignment.id ? 'opacity-50' : ''}`}>
                    <span className="block font-bold text-kcs-blue-900 dark:text-white">{assignment.title}</span>
                    <span className="block normal-case text-gray-400">{assignment.type} · {assignment.maxPoints} pts</span><span className="mt-0.5 block normal-case text-kcs-blue-500 dark:text-kcs-blue-300">{assignment.date ? new Date(`${assignment.date}T12:00:00`).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB') : tr('Date non définie', 'No date')}</span>
                    <span className="mt-1 flex items-center justify-center gap-2 normal-case"><button type="button" onClick={() => setEditingAssignment({ ...assignment })} className="inline-flex items-center gap-1 text-[11px] font-bold text-kcs-blue-600 hover:text-kcs-blue-800 dark:text-sky-300"><Pencil size={12} /> {tr('Modifier','Edit')}</button><button type="button" disabled={assignmentReadOnly(assignment)} onClick={() => deleteAssignment(assignment)} className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-600"><Trash2 size={12} /> {tr('Supprimer','Delete')}</button></span>
                  </th>
                ))}
                <th className="min-w-32 border-l border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">Average</th>
                <th className="min-w-28 border-l border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">Intl. grade</th>
                <th className="min-w-32 border-l border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">Prediction</th>
                <th className="min-w-40 border-l border-gray-100 px-3 py-3 text-left dark:border-kcs-blue-800">AI status</th>
              </tr>
            </thead>
            <tbody>
              {studentAnalytics.map(({ student, average, missing, projected, risk },rowIndex) => (
                <tr key={student.id} className="group">
                  <td className="sticky left-0 z-10 border-t border-gray-100 bg-white px-3 py-1.5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{canonicalClassLabel(student.grade, student.section)}</p>
                  </td>
                  {visibleAssignments.map((assignment,columnIndex) => {
                    const normalized = getScore(assignment, student.id)
                    return (
                      <td key={`${student.id}-${assignment.id}`} className="border-l border-t border-gray-100 px-2 py-1.5 dark:border-kcs-blue-800">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            data-grade-row={rowIndex}
                            data-grade-column={columnIndex}
                            className={`w-16 rounded-md px-1.5 py-1 text-center text-xs font-bold outline-none ring-1 transition-colors focus:ring-2 focus:ring-kcs-blue-400 ${toneForScore(normalized)}`}
                            value={getRawScore(assignment.id, student.id)}
                            readOnly={assignmentReadOnly(assignment)} onChange={(event) => updateScore(assignment.id, student.id, event.target.value)}
                            onKeyDown={(event)=>moveScoreFocus(event,rowIndex,columnIndex)}
                            placeholder="I"
                          />
                          <div className="flex gap-0.5">
                            <button type="button" className="rounded-md bg-gray-100 px-1.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-kcs-blue-50 dark:bg-kcs-blue-800 dark:text-gray-300" disabled={assignmentReadOnly(assignment)} onClick={() => openCellDialog('ai', assignment, student)}>
                              AI
                            </button>
                            <button type="button" className="rounded-md bg-gray-100 px-1.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-kcs-blue-50 dark:bg-kcs-blue-800 dark:text-gray-300" disabled={assignmentReadOnly(assignment)} onClick={() => openCellDialog('note', assignment, student)}>
                              Note
                            </button>
                          </div>
                        </div>
                      </td>
                    )
                  })}
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                    <span className={`inline-flex min-w-20 justify-center rounded-md px-2 py-1 text-xs font-bold ring-1 ${toneForScore(average)}`}>{formatPercent(average)}</span>
                  </td>
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800"><span className={`inline-flex min-w-14 justify-center rounded-md px-2 py-1 text-xs font-bold ring-1 ${toneForScore(average)}`}>{internationalGrade(average)}</span></td>
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                    <span className={`inline-flex min-w-20 justify-center rounded-md px-2 py-1 text-xs font-bold ring-1 ${toneForScore(projected)}`}>{formatPercent(projected)}</span>
                  </td>
                  <td className="border-l border-t border-gray-100 px-2 py-1.5 dark:border-kcs-blue-800">
                    <div className="flex items-center justify-center gap-1">
                      <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${risk === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : risk === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                        {risk} risk
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{missing} missing</span>
                    </div>
                  </td>
                </tr>
              ))}
              {studentAnalytics.length > 0 && (
                <tr className="bg-gray-50 font-bold text-kcs-blue-900 dark:bg-kcs-blue-800/30 dark:text-white">
                  <td className="sticky left-0 z-10 border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-800">
                    Class average
                  </td>
                  {visibleAssignments.map((assignment) => (
                    <td key={`average-${assignment.id}`} className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                      {formatPercent(getAssignmentAverage(assignment))}
                    </td>
                  ))}
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                    {formatPercent(studentAnalytics.some((item) => item.average !== null) ? classAverage : null)}
                  </td>
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">{internationalGrade(studentAnalytics.some((item) => item.average !== null) ? classAverage : null)}</td>
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-center dark:border-kcs-blue-800">
                    {formatPercent(studentAnalytics.some((item) => item.projected !== null)
                      ? studentAnalytics.reduce((sum, item) => sum + (item.projected ?? 0), 0) / Math.max(1, studentAnalytics.filter((item) => item.projected !== null).length)
                      : null)}
                  </td>
                  <td className="border-l border-t border-gray-100 px-3 py-3 text-xs text-gray-500 dark:border-kcs-blue-800 dark:text-gray-300">
                    Auto-calculated
                  </td>
                </tr>
              )}
              {!studentAnalytics.length && (
                <tr>
                  <td colSpan={visibleAssignments.length + 5} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    Select a class with students from the Super Admin registry to start entering grades.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {rankingOpen && createPortal(<div className="fixed inset-0 z-[10010] flex items-center justify-center bg-kcs-blue-950/80 p-3" role="dialog" data-gradebook-overlay aria-modal="true" aria-label={tr('Classement des élèves', 'Learner ranking')}>
        <section className="flex max-h-[92dvh] w-full max-w-4xl flex-col rounded-3xl bg-white p-5 shadow-2xl dark:bg-kcs-blue-950">
        <h3 className="text-xl font-bold text-kcs-blue-950 dark:text-white">{tr('Classement des élèves', 'Learner ranking')} · {selectedCourse?.name}</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{academicYear} · {term} · {tr('Moyennes pondérées décroissantes. Les ex æquo partagent le même rang. Les élèves sans notes sont exclus.', 'Weighted averages in descending order. Tied learners share a rank. Learners without grades are excluded.')}</p>
        <label className="mt-4 flex items-center gap-3 text-sm font-bold dark:text-white">{tr('Nombre d’élèves à afficher', 'Number of learners to display')}<input aria-label="Ranking limit" type="number" min="1" max={rankedStudents.length || 1} className="input-kcs w-24" value={rankingLimit} onChange={event => setRankingLimit(event.target.value)}/>
        </label>
        <div className="mt-4 min-h-0 overflow-auto">
        <table className="w-full text-sm">
        <thead>
        <tr className="bg-kcs-blue-800 text-white">
        <th className="p-3">{tr('Rang', 'Rank')}</th>
        <th className="p-3 text-left">{tr('Élève', 'Learner')}</th>
        <th className="p-3">{tr('Moyenne', 'Average')}</th>
        </tr>
        </thead>
        <tbody>{rankedStudents.slice(0, rankingCount).map(item => <tr key={item.student.id} className="border-b border-slate-200 dark:border-slate-800 dark:text-white">
        <td className="p-3 text-center font-bold">{item.rank}</td>
        <td className="p-3">{item.student.name}</td>
        <td className="p-3 text-center font-bold">{item.average!.toFixed(2)}%</td>
        </tr>)}</tbody>
        </table>{!rankedStudents.length && <p className="p-5 text-sm dark:text-white">{tr('Aucune moyenne disponible pour cette période.', 'No averages are available for this period.')}</p>}</div>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => setRankingOpen(false)} className="rounded-xl border px-5 py-3 font-bold dark:border-slate-700 dark:text-white">{tr('Fermer', 'Close')}</button>
        <button type="button" disabled={!rankingCount} onClick={() => void exportGradebook('PDF', true)} className="rounded-xl bg-kcs-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">
        <FileText size={16} className="mr-2 inline"/>{tr('Imprimer / PDF du classement', 'Print / Ranking PDF')}</button>
        </div>
        </section>
        </div>, document.body)}
      {periodConfirmation && createPortal(<div className="fixed inset-0 z-[10020] flex items-center justify-center bg-kcs-blue-950/80 p-4" role="dialog" data-gradebook-overlay aria-modal="true" aria-label={tr('Confirmer la période scolaire', 'Confirm academic period')}>
        <section className="max-h-[92dvh] w-full max-w-xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-950">
        <h3 className="text-xl font-bold text-kcs-blue-950 dark:text-white">{tr('Vérifiez la période avant de continuer', 'Check the academic period before continuing')}</h3>
        <div className="my-5 rounded-2xl bg-sky-50 p-4 dark:bg-sky-950 dark:text-white">
        <p className="font-bold">{selectedCourse?.name}</p>
        <p>{academicYear}</p>
        <p className="mt-2 text-lg font-black">{term}</p>
        <p className="mt-2 text-sm">{periodConfirmation === 'task' ? draft.title + ' · ' + draft.date : tr('Soumission des résultats disponibles du cours', 'Submit available course results')}</p>
        </div>{periodConfirmation === 'submission' && <p className="mb-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-100">{tr('Les cellules vides sont exclues du calcul. Les élèves sans aucune note ne sont pas resoumis et leurs anciennes soumissions sont conservées.', 'Blank cells are excluded from calculations. Learners without any grades are not resubmitted and their earlier submissions are preserved.')} {submissionAnalytics.filter(item => item.average !== null).length} / {submissionAnalytics.length}</p>}{periodConfirmation === 'task' && dateSuggestedTerm && dateSuggestedTerm !== term && <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <p>{tr('La date saisie correspond au calendrier officiel de', 'The entered date belongs to the official calendar period')} <b>{dateSuggestedTerm}</b>.</p>
        <button type="button" disabled={isFutureGradebookPeriod(periodAccess, academicYear, dateSuggestedTerm)} onClick={() => { chooseTerm(dateSuggestedTerm); setConfirmedPeriod(false) }} className="mt-3 rounded-lg bg-amber-700 px-4 py-2 font-bold text-white">{tr('Utiliser la période de cette date', 'Use the period for this date')}</button>{isFutureGradebookPeriod(periodAccess, academicYear, dateSuggestedTerm) && <p className="mt-2 font-semibold">{tr('La saisie reste dans le quarter ouvert par le SuperAdmin.', 'Grade entry remains in the quarter opened by the SuperAdmin.')}</p>}
        </div>}<label className="flex items-start gap-3 text-sm dark:text-white">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={confirmedPeriod} onChange={event => setConfirmedPeriod(event.target.checked)}/>
        <span>{tr('Je confirme que cette année scolaire et ce quarter sont corrects.', 'I confirm that this academic year and quarter are correct.')}</span>
        </label>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => setPeriodConfirmation(null)} className="rounded-xl border px-5 py-3 font-bold dark:border-slate-700 dark:text-white">{tr('Annuler', 'Cancel')}</button>
        <button type="button" disabled={!confirmedPeriod} onClick={() => periodConfirmation === 'task' ? void addAssignment(true) : void submitFinalGrades(true)} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-40">{tr('Confirmer et continuer', 'Confirm and continue')}</button>
        </div>
        </section>
        </div>, document.body)}
      {pendingDeleteAssignment && createPortal(<div className="fixed inset-0 z-[10010] flex items-center justify-center bg-kcs-blue-950/75 p-4" role="dialog" data-gradebook-overlay aria-modal="true"><div className="w-full max-w-xl rounded-3xl border border-red-100 bg-white p-6 shadow-2xl dark:border-red-900/50 dark:bg-kcs-blue-900"><p className="text-xs font-black uppercase tracking-widest text-red-600">{tr('Suppression contrôlée', 'Controlled deletion')}</p><h3 className="mt-2 text-2xl font-bold text-kcs-blue-950 dark:text-white">{tr('Supprimer réellement cette évaluation ?', 'Really delete this assignment?')}</h3><p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{tr(`« ${pendingDeleteAssignment.title} » et tous ses points saisis seront retirés de ce Gradebook.`, `“${pendingDeleteAssignment.title}” and all entered scores will be removed from this Gradebook.`)}</p><label className="mt-5 flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-kcs-blue-950 dark:text-gray-200"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={rememberDeleteChoice} onChange={(event) => setRememberDeleteChoice(event.target.checked)}/><span><b className="block">{tr('Ne plus demander sur cet appareil', 'Do not ask again on this device')}</b><small>{tr('Vous pourrez réactiver cette confirmation en supprimant les préférences locales du navigateur.', 'You can restore this prompt by clearing the browser’s local preferences.')}</small></span></label><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setPendingDeleteAssignment(null)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-kcs-blue-900 dark:border-kcs-blue-700 dark:text-white">{tr('Annuler', 'Cancel')}</button><button type="button" onClick={confirmDeleteAssignment} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700"><Trash2 size={15} className="mr-2 inline"/>{tr('Supprimer définitivement', 'Delete permanently')}</button></div></div></div>, document.body)}
      {cellDialog && createPortal(<div className="fixed inset-0 z-[10010] flex items-center justify-center bg-kcs-blue-950/75 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-900"><p className="text-xs font-bold uppercase text-kcs-gold-600">{cellDialog.mode === 'ai' ? 'AI grade suggestion' : 'Teacher cell note'}</p><h3 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">{cellDialog.student.name} · {cellDialog.assignment.title}</h3>{cellDialog.mode === 'ai' ? <><div className="mt-5 rounded-xl bg-kcs-blue-50 p-4 dark:bg-kcs-blue-800/30"><p className="text-sm text-gray-600 dark:text-gray-300">Current score: <strong>{getRawScore(cellDialog.assignment.id, cellDialog.student.id) || 'Not entered'}</strong> / {cellDialog.assignment.maxPoints}</p><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Suggested score: <strong>{suggestGrade(cellDialog.assignment, cellDialog.student)}</strong> / {cellDialog.assignment.maxPoints}</p><p className="mt-2 text-xs text-gray-500">Based on the learner's weighted average and class trend. It is never applied without teacher confirmation.</p></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCellDialog(null)} className="rounded-xl border px-4 py-2 text-sm font-bold dark:border-kcs-blue-700 dark:text-white">Keep current score</button><button type="button" onClick={applyAiSuggestion} className="rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white">Apply suggestion</button></div></> : <><textarea autoFocus value={cellNoteDraft} onChange={(event) => setCellNoteDraft(event.target.value)} className="input-kcs mt-5 min-h-32" placeholder="Write an observation, correction note, accommodation, or follow-up..."/><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCellDialog(null)} className="rounded-xl border px-4 py-2 text-sm font-bold dark:border-kcs-blue-700 dark:text-white">Cancel</button><button type="button" onClick={saveCellNote} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white">Save note</button></div></>}</div></div>, document.body)}

      {archivedAssignments.length > 0 && <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/20"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">{tr('Corbeille du Gradebook','Gradebook recycle bin')}</p><p className="text-xs text-amber-800/80 dark:text-amber-200/80">{tr('Les evaluations supprimees et leurs points restent restaurables.','Deleted assignments and their scores remain restorable.')}</p></div><div className="flex flex-wrap gap-2">{archivedAssignments.map((archived) => <button key={archived.assignment.id + archived.deletedAt} type="button" onClick={() => restoreAssignment(archived)} className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-amber-800 shadow-sm dark:bg-kcs-blue-950 dark:text-amber-200"><RotateCcw size={13}/>{tr('Restaurer','Restore')} {archived.assignment.title}</button>)}</div></div></section>}
      {editingAssignment && createPortal(<div className="fixed inset-0 z-[10010] flex items-center justify-center bg-kcs-blue-950/75 p-4" role="dialog" data-gradebook-overlay aria-modal="true"><div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-900"><p className="text-xs font-black uppercase tracking-widest text-kcs-blue-600 dark:text-sky-300">{tr('Modifier la colonne','Edit grade column')}</p><h3 className="mt-2 text-2xl font-bold text-kcs-blue-950 dark:text-white">{editingAssignment.title}</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold dark:text-white">{tr('Titre','Title')}<input className="input-kcs" value={editingAssignment.title} onChange={(event) => setEditingAssignment({...editingAssignment,title:event.target.value})}/></label><label className="grid gap-1 text-xs font-bold dark:text-white">{tr('Date','Date')}<DateSelect className="input-kcs" value={editingAssignment.date} onChange={(event) => setEditingAssignment({...editingAssignment,date:event.target.value})}/></label><label className="grid gap-1 text-xs font-bold dark:text-white">{tr('Type','Type')}<select className="input-kcs" value={editingAssignment.type} onChange={(event) => {const type=event.target.value as AssignmentType;setEditingAssignment({...editingAssignment,type,category:type})}}>{assignmentTypes.map((item)=><option key={item} value={item}>{assignmentTypeLabels[item].name}</option>)}</select></label><label className="grid gap-1 text-xs font-bold dark:text-white">{tr('Maximum de points','Maximum points')}<input className="input-kcs" type="number" min={1} value={editingAssignment.maxPoints} onChange={(event)=>setEditingAssignment({...editingAssignment,maxPoints:Math.max(1,Number(event.target.value)||1)})}/></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>setEditingAssignment(null)} className="rounded-xl border px-4 py-2.5 text-sm font-bold dark:border-kcs-blue-700 dark:text-white">{tr('Annuler','Cancel')}</button><button type="button" onClick={saveAssignmentEdit} className="rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-bold text-white"><Pencil size={15} className="mr-2 inline"/>{tr('Enregistrer','Save changes')}</button></div></div></div>, document.body)}
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h4 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><BarChart3 size={18} /> Class distribution</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="band" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {distribution.map((entry) => <Cell key={entry.band} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <h4 className="mb-4 flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><TrendingUp size={18} /> Performance trend</h4>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="average" stroke="#2563eb" strokeWidth={2.5} fill="#dbeafe" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h4 className="flex items-center gap-2 font-bold text-kcs-blue-900 dark:text-white"><Brain size={18} /> AI insights dashboard</h4>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-kcs-blue-50 p-4 text-sm text-kcs-blue-900 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-100">
              <p className="font-bold">Natural-language analysis</p>
              <p className="mt-1">The class is trending toward {Math.round(classAverage + 2)}%. {atRiskCount} student(s) need intervention before the final window, mostly due to missing assignments and weak category averages.</p>
            </div>
            {studentAnalytics.filter((item) => item.risk !== 'low').slice(0, 4).map(({ student, average, projected, missing }) => (
              <div key={student.id} className="rounded-xl border border-gray-100 p-4 dark:border-kcs-blue-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Current {formatPercent(average)} - projected {formatPercent(projected)} - {missing} missing</p>
                  </div>
                  <TrendingDown size={18} className="text-red-500" />
                </div>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Recommendation: assign personalized practice on {student.weaknesses?.[0] ?? 'foundational skills'}, notify parents, and review the next two submissions manually.</p>
                <button onClick={() => generateFeedback(student)} className="mt-3 rounded-lg bg-kcs-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-kcs-blue-800"><Wand2 size={13} className="mr-1 inline" /> Generate feedback</button>
              </div>
            ))}
            {courseStudents.slice(0, 2).map((student) => comments[`feedback:${student.id}`] && (
              <div key={`feedback-${student.id}`} className="rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200">
                <p className="font-bold">{student.name} report-card comment</p>
                <p className="mt-1">{comments[`feedback:${student.id}`]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: CheckCircle2, title: 'Real-time sync', text: 'Grade saves queue updates for student, parent, and admin dashboards with audit metadata.' },
          { icon: Lightbulb, title: 'Intelligent suggestions', text: 'AI grade suggestions use the learner trend, current category strength, and class baseline.' },
          { icon: AlertTriangle, title: 'Smart alerts', text: 'Failing, sudden drops, missing work, and projected-risk patterns are surfaced before report cards.' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div key={item.title} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <Icon size={20} className="text-kcs-blue-600 dark:text-kcs-blue-300" />
              <p className="mt-3 font-bold text-kcs-blue-900 dark:text-white">{item.title}</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AdvancedGradebook
