import InternationalPhoneInput from "../../components/InternationalPhoneInput";
import ParentCommunicationPanel from './ParentCommunicationPanel'
import EmployeesPanel from './EmployeesPanel'
import DateSelect from '@/components/shared/DateSelect'
import PhotoCaptureField from '@/components/shared/PhotoCaptureField'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowUpRight, BookOpen, Brain,
  AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock3, Download, FileSpreadsheet, FileText, GraduationCap, Mail, Megaphone, MessageSquare, Phone, Radio, Search, Shield, Trash2, UserPlus, Users, Video, X
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts'
import PortalSidebar from '@/components/layout/PortalSidebar'
import PortalSectionPanel from '@/components/shared/PortalSectionPanel'
import AccountSettingsPanel from '@/components/shared/AccountSettingsPanel'
import AcademicCalendarSettings from '@/components/admin/AcademicCalendarSettings'
import AcademicRecordsControlCenter from '@/components/admin/AcademicRecordsControlCenter'
import AttendanceManagementPanel from '@/components/admin/AttendanceManagementPanel'
import { useAuthStore } from '@/store/authStore'
import SuggestionBox from '@/components/shared/SuggestionBox'
import { adminAPI, admissionsAPI, financeAPI, messagesAPI, registryAPI, studentsAPI } from '@/services/api'
import { normalizeSchoolLevel, SCHOOL_DIVISIONS, SCHOOL_LEVELS } from '@/constants/schoolLevels'
import { getAssetUrl } from '@/utils/assets'
import {
  aiRecommendations,
  aiSignals,
  announcements,
  attendance,
  auditLogs,
  communicationFlows,
  diagnosticTests,
  disciplineReports,
  feeAccounts,
  financeReadiness,
  grades,
  performanceTrend,
  messages,
  reportCards,
  rolePermissions,
  scheduleConflicts,
  sensitiveActions,
  staffOperations,
  students,
  subjects,
  transcripts,
} from '@/data/schoolEcosystem'

const enrollmentTrend: any[] = []
const departmentPerformance: any[] = []
const admissionsQueue: any[] = []
const riskAlerts: any[] = []
const staffLoad: any[] = []
const recentActivity: any[] = []

const SCHOOL_NAME = 'Kinshasa Christian School'

const SCHOOL_SEAL_SRC = getAssetUrl('images/kcs.jpg')

const liveEventControls: any[] = []

const adminRosterSeed: any[] = []

type AdminStudentRecord = {
  id: string
  name: string
  studentNumber?: string
  email?: string
  grade: string
  section: string
  parent: string
  parentEmail: string
  parentPhone: string
  status: string
  gpa: number | null
  attendance: number | null
  discipline: string
  advisor?: string
  syncSource?: 'local' | 'orbit'
  managingApp?: string | null
  isEditable?: boolean
  isDeletable?: boolean
  dateOfBirth?: string | null
}

type AdminParentRecord = {
  id: string
  displayId?: string
  name: string
  email: string
  phone: string
  physicalAddress: string
  students: AdminStudentRecord[]
  studentCount: number
  classes: string[]
  syncSource: 'local' | 'orbit' | 'mixed'
  status: string
  identifierType: 'orbitId' | 'externalId'
}

type SharedDirectoryParent = {
  id: string
  displayId?: string
  fullName: string
  email?: string | null
  phone?: string | null
  physicalAddress?: string | null
  studentIds?: string[]
  externalIds?: Array<{ appSlug?: string; externalId?: string }>
}

type SharedDirectoryTeacher = {
  id: string
  fullName: string
  firstName?: string
  middleName?: string | null
  lastName?: string
  email?: string | null
  phone?: string | null
  employeeId?: string | null
  employeeType?: string | null
  department?: string | null
  jobTitle?: string | null
}

type SharedDirectoryPayload = {
  source?: 'local' | 'orbit'
  counts?: {
    parents?: number
    students?: number
    families?: number
    teachers?: number
  }
  parents?: SharedDirectoryParent[]
  teachers?: SharedDirectoryTeacher[]
}

type AdminStudentEditForm = {
  firstName: string
  middleName: string
  lastName: string
  studentNumber: string
  email: string
  grade: string
  section: string
  status: string
  dateOfBirth: string
  photoData?: string
}

type ParentEditStudentForm = AdminStudentEditForm & { id: string }

type AdminParentEditForm = {
  firstName: string
  middleName: string
  lastName: string
  email: string
  phone: string
  physicalAddress: string
}

type AdminStudentDraft = {
  firstName: string
  middleName: string
  lastName: string
  name: string
  studentNumber: string
  grade: string
  section: string
  email: string
  dateOfBirth: string
  photoData: string
}

type EduPayFinanceSummary = {
  source: string
  synchronizedAt: string
  totals: {
    expectedRevenue: number
    collectedRevenue: number
    outstandingDebt: number
    totalReduction: number
    paymentCompletionRate: number
  }
  parentAccounts: Array<{ parentName?: string; totalDebt?: number; totalPaid?: number; studentCount?: number }>
}

const createAdminStudentDraft = (grade = 'Grade 1', section = ''): AdminStudentDraft => ({
  firstName: '',
  middleName: '',
  lastName: '',
  name: '',
  studentNumber: '',
  grade,
  section,
  email: '',
  dateOfBirth: '',
  photoData: '',
})

const schoolEmailPreview = (student: Pick<AdminStudentDraft, 'firstName' | 'middleName' | 'lastName'>) => {
  const token = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  const first = token(student.firstName)
  const last = token(student.lastName)
  return first && last ? `${first}.${last}@ourkcs.org` : ''
}

const splitPersonName = (value = '') => {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  return {
    lastName: parts[0] ?? '',
    middleName: parts.slice(1, -1).join(' '),
    firstName: parts.length > 1 ? parts[parts.length - 1] : '',
  }
}

const createAdminStudentEditForm = (student: AdminStudentRecord | null): AdminStudentEditForm => ({
  firstName: splitPersonName(student?.name).firstName,
  middleName: splitPersonName(student?.name).middleName,
  lastName: splitPersonName(student?.name).lastName,
  studentNumber: student?.studentNumber ?? '',
  email: student?.email ?? '',
  grade: student?.grade ?? 'Grade 1',
  section: student?.section ?? '',
  status: student?.status ?? 'Active',
  dateOfBirth: student?.dateOfBirth?.slice(0, 10) ?? '',
  photoData: '',
})

const createAdminParentEditForm = (parent: AdminParentRecord | null): AdminParentEditForm => ({
  firstName: splitPersonName(parent?.name).firstName,
  middleName: splitPersonName(parent?.name).middleName,
  lastName: splitPersonName(parent?.name).lastName,
  email: parent?.email === 'Email non renseigne' ? '' : (parent?.email ?? ''),
  phone: parent?.phone === 'Telephone non renseigne' ? '' : (parent?.phone ?? ''),
  physicalAddress: parent?.physicalAddress ?? '',
})

type AdminAdmissionRequest = {
  id: string
  applicationNumber: string
  studentName: string
  children: Array<{ firstName: string; middleName?: string; lastName: string; dateOfBirth: string; gender: string; nationality: string; gradeApplying: string; previousSchool?: string; languages?: string; photoData?: string }>
  firstName: string
  lastName: string
  dateOfBirth: string
  nationality: string
  gradeApplying: string
  previousSchool: string
  languages: string
  parentName: string
  parentEmail: string
  parentPhone: string
  relationship: string
  address: string
  occupation: string
  notes: string
  documents: string[]
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'INTERVIEW_SCHEDULED' | 'ACCEPTED' | 'REJECTED'
  submittedAt: string
  provisionedAt?: string | null
}

const ADMIN_ADMISSIONS_STORAGE_KEY = 'kcs-admin-admission-submissions'
const ADMIN_ROSTER_STORAGE_KEY = 'kcs-admin-official-roster'
const CLASS_SECTIONS = ['', 'A', 'B', 'C', 'D'] as const
const SEARCH_CLASS_SUFFIXES = ['All', '', 'A', 'B', 'C', 'D'] as const

const formatClassName = (grade: string, section?: string) => {
  const rawGrade = String(grade || "").trim().replace(/\s+/g, " ")
  const rawSection = String(section || "").trim().replace(/\s+/g, " ")
  const combined = [rawGrade, rawSection].filter(Boolean).join(" ")
  const kindergarten = combined.match(/^kindergarten(?:\s+grade)?\s*([345])$/i)
  if (kindergarten) return `K${kindergarten[1]}`
  const repeatedSingle = rawGrade.match(/^(Grade\s+\d{1,2})\s+\1$/i)
  if (repeatedSingle) return `Grade ${Number(repeatedSingle[1].match(/\d+/)?.[0])}`
  if (rawGrade && rawSection && rawGrade.localeCompare(rawSection, undefined, { sensitivity: "base" }) === 0) return rawGrade
  return combined
}

const sectionLabel = (section?: string) => section || 'No section'
const searchSuffixLabel = (section: typeof SEARCH_CLASS_SUFFIXES[number]) => {
  if (section === 'All') return 'Tous les suffixes'
  return section ? `Suffixe ${section}` : 'Sans suffixe'
}

const getDivisionForGrade = (grade: string) => {
  return SCHOOL_DIVISIONS.find((division) => {
    if (division.id === 'kindergarten') return ['K3', 'K4', 'K5', 'Kindergarten'].includes(grade)
    if (division.id === 'elementary') return ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'].includes(grade)
    if (division.id === 'middle') return ['Grade 6', 'Grade 7', 'Grade 8'].includes(grade)
    return ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].includes(grade)
  }) ?? SCHOOL_DIVISIONS[0]
}

const scoreTone = (value: number | null, type: 'gpa' | 'attendance') => {
  if (value == null) return 'text-gray-400'
  const threshold = type === 'gpa' ? [2.5, 3.3] : [88, 94]
  if (value < threshold[0]) return 'text-red-700 dark:text-red-300'
  if (value < threshold[1]) return 'text-yellow-700 dark:text-yellow-300'
  return 'text-green-700 dark:text-green-300'
}

const getStudentRisk = (student: AdminStudentRecord) => {
  if (student.attendance == null && student.gpa == null) return 'No academic data'
  if ((student.attendance != null && student.attendance < 88) || (student.gpa != null && student.gpa < 2.5) || ['Open', 'Monitored'].includes(student.discipline)) return 'Needs action'
  if ((student.attendance != null && student.attendance < 94) || (student.gpa != null && student.gpa < 3.2)) return 'Watch'
  return 'On track'
}

const extractStudentApiMessage = (error: unknown, fallback: string) => {
  const responseData = (error as { response?: { data?: { message?: string; error?: string; details?: string } } })?.response?.data
  return responseData?.message || responseData?.error || responseData?.details || (error as { message?: string })?.message || fallback
}

const adminRosterSegments = new Set(['students', 'parents', 'teachers', 'employees', 'transcripts', 'reports'])

const getAdminRoster = () => studentsAPI.getAll(undefined, {
  headers: {
    'x-skip-auth-logout': 'true',
  },
})

const apiProfileToRosterRecord = (profile: any): AdminStudentRecord => {
  const parentLink = profile.parentLinks?.[0]
  const parent = parentLink?.parent
  const fullName = [profile.user?.lastName, profile.user?.middleName, profile.user?.firstName].filter(Boolean).join(' ') || profile.studentNumber || 'Unnamed student'
  const managingApp = typeof profile.managingApp === 'string'
    ? profile.managingApp
    : Array.isArray(profile.externalIds)
      ? profile.externalIds.find((item: { appSlug?: string }) => typeof item?.appSlug === 'string')?.appSlug ?? null
      : null
  return {
    id: profile.id,
    name: fullName,
    studentNumber: profile.studentNumber,
    email: profile.user?.email ?? '',
    dateOfBirth: profile.dateOfBirth ?? null,
    grade: normalizeSchoolLevel(profile.grade) ?? profile.grade,
    section: profile.section ?? '',
    parent: parent ? [parent.lastName, parent.middleName, parent.firstName].filter(Boolean).join(' ') : 'Parent record pending',
    parentEmail: parent?.email ?? `${fullName.toLowerCase().replace(/\W+/g, '.')}@family.kcs.test`,
    parentPhone: parent?.phone ?? '+243 810 000 000',
    status: profile.status === 'active' ? 'Active' : profile.status,
    gpa: profile.gpa == null ? null : Number(profile.gpa),
    attendance: profile.attendanceRate == null ? null : Number(profile.attendanceRate),
    discipline: 'Clear',
    syncSource: profile.syncSource === 'orbit' ? 'orbit' : 'local',
    managingApp,
    isEditable: true,
    isDeletable: typeof profile.isDeletable === 'boolean' ? profile.isDeletable : true,
  }
}

const transcriptCoursePlan = {
  'Grade 9': ['English 9', 'Algebra I', 'Biology', 'World History', 'Physical Education', 'French'],
  'Grade 10': ['English 10', 'Geometry', 'Chemistry', 'African & World Studies', 'ICT', 'Fine Arts'],
  'Grade 11': ['English Literature', 'Algebra II / Pre-Calculus', 'Physics', 'Economics', 'Research Seminar', 'Elective'],
  'Grade 12': ['English 12', 'Calculus / Statistics', 'Environmental Science', 'Government', 'College Prep Seminar', 'Elective'],
} as const

const letterFromAverage = (average: number) => {
  if (average >= 90) return 'A'
  if (average >= 80) return 'B'
  if (average >= 70) return 'C'
  if (average >= 60) return 'D'
  return 'F'
}

const gpaFromAverage = (average: number) => Number(Math.min(4, Math.max(0, average / 25)).toFixed(2))

const buildOfficialTranscript = (student: AdminStudentRecord) => {
  const rows: Array<{grade:string;year:string;courses:Array<{course:string;credit:number;average:number;letter:string;gpa:number}>;credits:number;average:number;annualGpa:number;status:string}> = []
  return {
    student,
    rows,
    totalCredits: 0,
    cumulativeGpa: 0,
    cumulativeAverage: 0,
    classRank: 'Aucune donnée officielle',
    generatedAt: new Date().toLocaleDateString(),
    graduationStatus: 'Aucune note approuvée : le transcript officiel ne peut pas encore être généré.',
  }
}

const admissionSeed: AdminAdmissionRequest[] = []

const readStoredAdmissions = () => {
  if (typeof window === 'undefined') return admissionSeed
  try {
    const stored = JSON.parse(window.localStorage.getItem(ADMIN_ADMISSIONS_STORAGE_KEY) || '[]') as AdminAdmissionRequest[]
    const storedIds = new Set(stored.map((item) => item.applicationNumber))
    return [...stored, ...admissionSeed.filter((item) => !storedIds.has(item.applicationNumber))]
  } catch {
    return admissionSeed
  }
}

const readStoredRoster = () => {
  if (typeof window === 'undefined') return [] as AdminStudentRecord[]
  try {
    const stored = JSON.parse(window.localStorage.getItem(ADMIN_ROSTER_STORAGE_KEY) || '[]') as AdminStudentRecord[]
    return Array.isArray(stored) ? stored : []
  } catch {
    return [] as AdminStudentRecord[]
  }
}

const saveAdmissions = (items: AdminAdmissionRequest[]) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(ADMIN_ADMISSIONS_STORAGE_KEY, JSON.stringify(items))
}

const apiAdmissionToAdminRequest = (item: any): AdminAdmissionRequest => ({
  id: String(item.id),
  applicationNumber: String(item.applicationNumber),
  studentName: [item.firstName, item.middleName, item.lastName].filter(Boolean).join(' '),
  children: Array.isArray(item.children) && item.children.length ? item.children : [{ firstName: item.firstName, middleName: item.middleName, lastName: item.lastName, dateOfBirth: item.dateOfBirth, gender: item.gender, nationality: item.nationality, gradeApplying: item.gradeApplying, previousSchool: item.previousSchool }],
  firstName: String(item.firstName || ''),
  lastName: String(item.lastName || ''),
  dateOfBirth: String(item.dateOfBirth || ''),
  nationality: String(item.nationality || ''),
  gradeApplying: String(item.gradeApplying || ''),
  previousSchool: String(item.previousSchool || ''),
  languages: '',
  parentName: String(item.parentName || ''),
  parentEmail: String(item.parentEmail || ''),
  parentPhone: String(item.parentPhone || ''),
  relationship: String(item.relationship || ''),
  address: String(item.address || ''),
  occupation: '',
  notes: String(item.notes || ''),
  documents: Array.isArray(item.documents) ? item.documents.map((document: any) => String(document.name || '')).filter(Boolean) : [],
  status: item.status as AdminAdmissionRequest['status'],
  submittedAt: String(item.submittedAt || ''),
  provisionedAt: item.provisionedAt ? String(item.provisionedAt) : null,
})

const saveRoster = (items: AdminStudentRecord[]) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(ADMIN_ROSTER_STORAGE_KEY, JSON.stringify(items))
}

const createStudentFromAdmission = (application: AdminAdmissionRequest): AdminStudentRecord => ({
  id: `adm-approved-${application.applicationNumber}`,
  name: application.studentName,
  studentNumber: application.applicationNumber,
  grade: application.gradeApplying,
  section: '',
  parent: application.parentName,
  parentEmail: application.parentEmail,
  parentPhone: application.parentPhone,
  status: 'Active',
  gpa: 0,
  attendance: null,
  discipline: 'Clear',
})

const staffSeed: any[] = []

const getAdminSegment = (pathname: string) => {
  const segment = pathname.split('/').filter(Boolean).at(-1)
  if (!segment || segment === 'admin' || segment === 'dashboard') return 'dashboard'
  if (segment === 'student') return 'students'
  if (segment === 'parent') return 'parents'
  return segment
}

const pillTone = (value: string) => {
  if (['Open', 'Absent', 'Urgent', 'high', 'Documents Missing', 'pending', 'Needs action'].includes(value)) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (['Monitored', 'Late', 'Draft', 'medium', 'Under Review', 'partially paid', 'Watch'].includes(value)) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
}

const adminButton = 'rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-kcs-blue-800'
const adminOutlineButton = 'rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-kcs-blue-700 transition-colors hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800'

type AdminReportCadence = 'daily' | 'weekly' | 'monthly' | 'annual'
type AdminReportCategory = 'enrollment' | 'academic' | 'operations' | 'executive'
type AdminReportFormat = 'pdf' | 'excel' | 'csv'

type AdminReportRow = {
  section: string
  metric: string
  value: string | number
  detail: string
  action: string
}

const reportCadenceLabels: Record<AdminReportCadence, string> = {
  daily: 'Journalier',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  annual: 'Annuel',
}

const reportCategoryLabels: Record<AdminReportCategory, string> = {
  enrollment: 'Inscriptions',
  academic: 'Academique',
  operations: 'Operations',
  executive: 'Rapport complet',
}

const buildReportWindow = (cadence: AdminReportCadence) => {
  const end = new Date()
  const start = new Date(end)
  if (cadence === 'daily') start.setDate(end.getDate() - 1)
  if (cadence === 'weekly') start.setDate(end.getDate() - 7)
  if (cadence === 'monthly') start.setMonth(end.getMonth() - 1)
  if (cadence === 'annual') start.setFullYear(end.getFullYear() - 1)
  return {
    start,
    end,
    label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
  }
}

const escapeExportCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

const escapeHtml = (value: string | number) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const downloadExportFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const buildReportRows = (
  category: AdminReportCategory,
  cadence: AdminReportCadence,
  officialRoster: AdminStudentRecord[],
  admissionRequests: AdminAdmissionRequest[],
) => {
  const attendanceValues = officialRoster.map((student) => student.attendance).filter((value): value is number => value != null)
  const gpaValues = officialRoster.map((student) => student.gpa).filter((value): value is number => value != null)
  const averageAttendance = attendanceValues.length ? Math.round(attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length) : null
  const averageGpa = gpaValues.length ? (gpaValues.reduce((sum, value) => sum + value, 0) / gpaValues.length).toFixed(2) : null
  const needsAction = officialRoster.filter((student) => getStudentRisk(student) === 'Needs action').length
  const pendingAdmissions = admissionRequests.filter((item) => item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW').length
  const acceptedAdmissions = admissionRequests.filter((item) => item.status === 'ACCEPTED').length
  const openDiscipline = disciplineReports.filter((report) => report.status !== 'Closed').length
  const unpaidInvoices = feeAccounts.filter((fee) => fee.status !== 'paid').length
  const cadenceNote = reportCadenceLabels[cadence].toLowerCase()
  const rows: AdminReportRow[] = []

  if (category === 'enrollment' || category === 'executive') {
    rows.push(
      { section: 'Inscriptions', metric: 'Effectif officiel', value: officialRoster.length, detail: `${officialRoster.length} eleves actifs dans le registre super administrateur.`, action: 'Verifier les nouvelles admissions et les classes incompletes.' },
      { section: 'Inscriptions', metric: 'Dossiers en attente', value: pendingAdmissions, detail: `${pendingAdmissions} demandes necessitent une decision sur la periode ${cadenceNote}.`, action: 'Prioriser les dossiers soumis ou en revue.' },
      { section: 'Inscriptions', metric: 'Admissions acceptees', value: acceptedAdmissions, detail: `${acceptedAdmissions} candidats ont deja ete acceptes dans le cycle actuel.`, action: 'Confirmer la creation des dossiers officiels.' },
    )
  }

  if (category === 'academic' || category === 'executive') {
    rows.push(
      { section: 'Academique', metric: 'GPA moyen', value: averageGpa ?? 'Aucune donnée', detail: `Moyenne academique globale calculee sur ${officialRoster.length} dossiers.`, action: 'Examiner les classes et matieres sous la moyenne.' },
      { section: 'Academique', metric: 'Assiduite moyenne', value: averageAttendance == null ? 'Aucune donnée' : `${averageAttendance}%`, detail: averageAttendance == null ? 'Aucune présence réelle n’a encore été saisie.' : `Presence moyenne pour le rapport ${cadenceNote}.`, action: 'Declencher un suivi parent pour les presences inferieures a 88%.' },
      { section: 'Academique', metric: 'Eleves a risque', value: needsAction, detail: `${needsAction} eleves combinent risque academique, presence ou discipline.`, action: 'Assigner un plan de soutien et une date de suivi.' },
    )
  }

  if (category === 'operations' || category === 'executive') {
    rows.push(
      { section: 'Operations', metric: 'Rapports discipline ouverts', value: openDiscipline, detail: `${openDiscipline} rapports demandent encore une resolution administrative.`, action: 'Valider les contacts parents et les mesures correctives.' },
      { section: 'Operations', metric: 'Factures non soldees', value: unpaidInvoices, detail: `${unpaidInvoices} comptes financiers ne sont pas entierement soldes.`, action: 'Envoyer les releves et organiser les relances.' },
      { section: 'Operations', metric: 'Alertes IA', value: aiSignals.length, detail: `${aiSignals.length} signaux IA alimentent ce rapport detaille.`, action: 'Revoir les recommandations prioritaires avec les responsables.' },
    )
  }

  return rows
}

const buildAuthenticityCode = (value: string) => {
  const checksum = Array.from(value).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 2166136261)
  return checksum.toString(36).toUpperCase().padStart(7, '0').slice(0, 7)
}

const buildAdminParentRecords = (roster: AdminStudentRecord[]): AdminParentRecord[] => {
  const groups = new Map<string, AdminStudentRecord[]>()

  for (const student of roster) {
    const keySource = student.parentEmail || student.parentPhone || student.parent || 'Parent record pending'
    const key = keySource.trim().toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), student])
  }

  return Array.from(groups.entries()).map(([key, familyStudents]) => {
    const firstStudent = familyStudents[0]
    const classes = Array.from(new Set(familyStudents.map((student) => formatClassName(student.grade, student.section)).filter(Boolean))).sort()
    const sources = new Set(familyStudents.map((student) => student.syncSource ?? 'local'))
    const syncSource = sources.size > 1 ? 'mixed' : (sources.values().next().value ?? 'local') as AdminParentRecord['syncSource']
    const needsAction = familyStudents.some((student) => getStudentRisk(student) !== 'On track')
    const identifierType: AdminParentRecord['identifierType'] = 'orbitId'

    return {
      id: key,
      displayId: undefined,
      name: firstStudent.parent || 'Parent record pending',
      email: firstStudent.parentEmail || 'Email non renseigne',
      phone: firstStudent.parentPhone || 'Telephone non renseigne',
      physicalAddress: 'Adresse non renseignee',
      students: familyStudents.sort((left, right) => left.name.localeCompare(right.name)),
      studentCount: familyStudents.length,
      classes,
      syncSource,
      status: needsAction ? 'Suivi requis' : 'Actif',
      identifierType,
    }
  }).sort((left, right) => left.name.localeCompare(right.name))
}

const buildAdminParentRecordsFromDirectory = (
  directory: SharedDirectoryPayload | null,
  roster: AdminStudentRecord[],
): AdminParentRecord[] => {
  if (!directory?.parents?.length) return buildAdminParentRecords(roster)

  const studentsById = new Map(roster.map((student) => [student.id, student]))

  return directory.parents.map((parent) => {
    const linkedStudents = (parent.studentIds ?? [])
      .map((studentId) => studentsById.get(studentId))
      .filter((student): student is AdminStudentRecord => Boolean(student))
      .sort((left, right) => left.name.localeCompare(right.name))
    const classes = Array.from(new Set(linkedStudents.map((student) => formatClassName(student.grade, student.section)).filter(Boolean))).sort()
    const needsAction = linkedStudents.some((student) => getStudentRisk(student) !== 'On track')
    const displayId = parent.displayId || parent.externalIds?.find((item) => item.externalId)?.externalId || parent.id
    const identifierType: AdminParentRecord['identifierType'] = 'orbitId'

    return {
      id: parent.id,
      displayId,
      name: parent.fullName || 'Parent record pending',
      email: parent.email || 'Email non renseigne',
      phone: parent.phone || 'Telephone non renseigne',
      physicalAddress: parent.physicalAddress || 'Adresse non renseignee',
      students: linkedStudents,
      studentCount: linkedStudents.length,
      classes,
      syncSource: (directory.source === 'orbit' ? 'orbit' : 'local') as AdminParentRecord['syncSource'],
      status: linkedStudents.length === 0 ? 'Sans enfant rattache' : needsAction ? 'Suivi requis' : 'Actif',
      identifierType,
    }
  }).sort((left, right) => left.name.localeCompare(right.name))
}

const buildAdminReportDocument = (
  title: string,
  periodLabel: string,
  rows: AdminReportRow[],
  category: AdminReportCategory,
  cadence: AdminReportCadence,
) => {
  const generatedAt = new Date().toLocaleString()
  const generatedIso = new Date().toISOString()
  const authenticityCode = buildAuthenticityCode(`${title}|${periodLabel}|${generatedIso}|${rows.map((row) => `${row.section}:${row.metric}:${row.value}`).join('|')}`)
  const documentId = `KCS-${category.toUpperCase()}-${cadence.toUpperCase()}-${generatedIso.slice(0, 10).replace(/-/g, '')}-${authenticityCode}`
  const criticalActions = rows.filter((row) => /risque|ouverts|attente|non soldees/i.test(`${row.metric} ${row.detail}`)).length
  const logoUrl = typeof window === 'undefined' ? SCHOOL_SEAL_SRC : new URL(SCHOOL_SEAL_SRC, window.location.origin).href
  const escapedRows = rows.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.section)}</strong></td>
      <td>${escapeHtml(row.metric)}</td>
      <td class="value">${escapeHtml(row.value)}</td>
      <td>${escapeHtml(row.detail)}</td>
      <td>${escapeHtml(row.action)}</td>
    </tr>
  `).join('')
  const securityMarks = [
    'Reference unique',
    'Horodatage serveur navigateur',
    'Controle de coherence',
    'Usage Super Admin',
  ]
  const escapedSecurityMarks = securityMarks.map((mark) => `<span>${escapeHtml(mark)}</span>`).join('')
  const escapedControls = rows.map((row, index) => `
    <div class="control-card">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <strong>${escapeHtml(row.metric)}</strong>
      <p>${escapeHtml(row.action)}</p>
    </div>
  `).join('')

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    * { box-sizing: border-box; }
    html,
    body {
      width: 100%;
      min-height: 100%;
    }
    body {
      margin: 0;
      color: #0f2352;
      font-family: Arial, Helvetica, sans-serif;
      background: #ffffff;
    }
    .sheet {
      position: relative;
      min-height: 100vh;
      padding: 28px;
      border-top: 12px solid #004080;
      overflow: hidden;
    }
    .watermark-layer {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .watermark-logo {
      position: absolute;
      left: 50%;
      top: 290px;
      z-index: 0;
      width: 520px;
      height: 520px;
      object-fit: contain;
      opacity: 0.045;
      transform: translate(-50%, -50%) rotate(-8deg);
      filter: grayscale(100%);
      pointer-events: none;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet > :not(.watermark-layer) { position: relative; z-index: 1; }
    .masthead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 20px;
      border-bottom: 3px solid #d8a11d;
    }
    .brand { display: flex; align-items: center; gap: 16px; }
    .logo-frame {
      width: 86px;
      height: 86px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid #d8a11d;
      border-radius: 999px;
      background: #ffffff;
      box-shadow: 0 0 0 5px #f8fbff, 0 0 0 6px #dbe3ef;
      overflow: hidden;
      flex: 0 0 86px;
    }
    .logo {
      width: calc(100% - 8px);
      height: calc(100% - 8px);
      display: block;
      object-fit: contain;
      object-position: center;
      border-radius: 999px;
    }
    .school { margin: 0; color: #004080; font-size: 25px; line-height: 1.1; }
    .tagline { margin: 5px 0 0; color: #64748b; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    .badge {
      min-width: 230px;
      border-radius: 8px;
      background: #0f2352;
      color: #ffffff;
      padding: 14px 18px;
      text-align: right;
      border-bottom: 4px solid #d8a11d;
    }
    .badge strong { display: block; color: #f5c542; font-size: 13px; text-transform: uppercase; }
    .badge span { display: block; margin-top: 4px; font-size: 12px; }
    .badge small { display: block; margin-top: 8px; color: #dbeafe; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; }
    h1 { margin: 24px 0 8px; font-size: 22px; line-height: 1.25; color: #0f2352; }
    .security-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 18px 0 0;
      padding: 9px;
      border: 1px solid #c7d2fe;
      border-left: 6px solid #004080;
      background: repeating-linear-gradient(135deg, #eef6ff 0, #eef6ff 8px, #ffffff 8px, #ffffff 16px);
    }
    .security-strip span {
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      background: #ffffff;
      padding: 5px 9px;
      color: #0f2352;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin: 18px 0 22px;
    }
    .meta-card {
      border: 1px solid #dbe3ef;
      border-left: 5px solid #d8a11d;
      border-radius: 8px;
      padding: 11px 12px;
      background: #f8fbff;
    }
    .meta-card span { display: block; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .meta-card strong { display: block; margin-top: 4px; color: #0f2352; font-size: 13px; }
    .overview {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 14px;
      margin: 0 0 18px;
    }
    .panel {
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      background: #ffffff;
      padding: 14px;
    }
    .panel h2 {
      margin: 0 0 8px;
      color: #004080;
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .panel p { margin: 0; color: #334155; font-size: 11px; line-height: 1.55; }
    .assurance-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .assurance {
      min-height: 64px;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      padding: 9px;
      background: #f8fbff;
    }
    .assurance strong { display: block; color: #0f2352; font-size: 11px; }
    .assurance span { display: block; margin-top: 5px; color: #64748b; font-size: 9px; line-height: 1.35; }
    .section-title {
      margin: 18px 0 8px;
      color: #004080;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #dbe3ef; padding: 10px; text-align: left; vertical-align: top; font-size: 11px; line-height: 1.35; }
    th { background: #004080; color: #ffffff; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; }
    tr:nth-child(even) td { background: #f8fbff; }
    .value { color: #004080; font-size: 16px; font-weight: 800; white-space: nowrap; }
    .control-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 10px;
    }
    .control-card {
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      padding: 10px;
      background: #ffffff;
    }
    .control-card span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 999px;
      background: #0f2352;
      color: #f5c542;
      font-size: 9px;
      font-weight: 900;
    }
    .control-card strong { display: block; margin-top: 8px; color: #0f2352; font-size: 11px; }
    .control-card p { margin: 5px 0 0; color: #475569; font-size: 10px; line-height: 1.4; }
    .signature-row {
      display: grid;
      grid-template-columns: 1fr 1fr 0.7fr;
      gap: 36px;
      margin-top: 32px;
    }
    .signature {
      border-top: 1px solid #94a3b8;
      padding-top: 8px;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
    }
    .stamp {
      min-height: 86px;
      border: 2px solid #d8a11d;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #004080;
      font-size: 10px;
      font-weight: 900;
      text-align: center;
      text-transform: uppercase;
      transform: rotate(-6deg);
    }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #dbe3ef;
      color: #64748b;
      font-size: 10px;
    }
    @media print {
      body { margin: 0; }
      .sheet { min-height: auto; padding: 0; border-top-width: 8px; }
      .watermark-logo { top: 275px; width: 500px; height: 500px; opacity: 0.04; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <div class="watermark-layer" aria-hidden="true">
      <img class="watermark-logo" src="${escapeHtml(logoUrl)}" alt="">
    </div>
    <header class="masthead">
      <section class="brand">
        <div class="logo-frame">
          <img class="logo" src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(SCHOOL_NAME)}">
        </div>
        <div>
          <p class="school">${escapeHtml(SCHOOL_NAME)}</p>
          <p class="tagline">Official Super Admin Report</p>
        </div>
      </section>
      <aside class="badge">
        <strong>Document officiel</strong>
        <span>Dashboard Super Administrateur</span>
        <small>${escapeHtml(documentId)}</small>
      </aside>
    </header>

    <h1>${escapeHtml(title)}</h1>
    <section class="security-strip">${escapedSecurityMarks}</section>
    <section class="meta-grid">
      <div class="meta-card"><span>Periode</span><strong>${escapeHtml(periodLabel)}</strong></div>
      <div class="meta-card"><span>Frequence</span><strong>${escapeHtml(reportCadenceLabels[cadence])}</strong></div>
      <div class="meta-card"><span>Type</span><strong>${escapeHtml(reportCategoryLabels[category])}</strong></div>
      <div class="meta-card"><span>Generation</span><strong>${escapeHtml(generatedAt)}</strong></div>
      <div class="meta-card"><span>Authenticite</span><strong>${escapeHtml(authenticityCode)}</strong></div>
    </section>

    <section class="overview">
      <div class="panel">
        <h2>Resume executif</h2>
        <p>Ce rapport consolide ${escapeHtml(rows.length)} indicateurs pour la periode ${escapeHtml(periodLabel)}. Il met en evidence les donnees du registre, les points de suivi operationnel et les actions administratives a traiter. Les priorites signalees ci-dessous servent de base aux controles de direction et aux decisions du Super Administrateur.</p>
      </div>
      <div class="panel">
        <h2>Surete documentaire</h2>
        <div class="assurance-grid">
          <div class="assurance"><strong>ID</strong><span>${escapeHtml(documentId)}</span></div>
          <div class="assurance"><strong>Alertes</strong><span>${escapeHtml(criticalActions)} controle(s) a surveiller.</span></div>
          <div class="assurance"><strong>Statut</strong><span>Document confidentiel, usage administratif interne.</span></div>
        </div>
      </div>
    </section>

    <p class="section-title">Indicateurs detailles</p>
    <table>
      <thead>
        <tr>
          <th>Section</th>
          <th>Indicateur</th>
          <th>Valeur</th>
          <th>Detail</th>
          <th>Action recommandee</th>
        </tr>
      </thead>
      <tbody>${escapedRows}</tbody>
    </table>

    <p class="section-title">Plan de controle et d'authenticite</p>
    <section class="control-grid">${escapedControls}</section>

    <section class="signature-row">
      <div class="signature">Direction / Super Administrateur</div>
      <div class="signature">Cachet de l'ecole</div>
      <div class="stamp">Verifie<br>${escapeHtml(authenticityCode)}</div>
    </section>
    <footer class="footer">
      <span>${escapeHtml(SCHOOL_NAME)} - Rapport genere depuis KCS Nexus - ${escapeHtml(documentId)}</span>
      <span>Confidentiel - authenticite: ${escapeHtml(authenticityCode)}</span>
    </footer>
  </main>
  <script>
    function printWhenReady() {
      var images = Array.prototype.slice.call(document.images || []);
      var pending = images.filter(function (image) { return !image.complete; });
      var waitForImages = pending.map(function (image) {
        return new Promise(function (resolve) {
          image.onload = resolve;
          image.onerror = resolve;
        });
      });

      Promise.all(waitForImages).then(function () {
        window.focus();
        window.print();
      });
    }

    window.addEventListener('load', function () {
      setTimeout(printWhenReady, 250);
    });
  </script>
</body>
</html>`
}

const exportAdminReport = (
  category: AdminReportCategory,
  cadence: AdminReportCadence,
  format: AdminReportFormat,
  officialRoster: AdminStudentRecord[],
  admissionRequests: AdminAdmissionRequest[],
) => {
  const rows = buildReportRows(category, cadence, officialRoster, admissionRequests)
  const period = buildReportWindow(cadence)
  const title = `${SCHOOL_NAME} - ${reportCategoryLabels[category]} - ${reportCadenceLabels[cadence]}`
  const filename = `kcs-${category}-${cadence}-${new Date().toISOString().slice(0, 10)}`

  if (format === 'csv') {
    const csv = [
      ['Section', 'Indicateur', 'Valeur', 'Detail', 'Action'].map(escapeExportCell).join(','),
      ...rows.map((row) => [row.section, row.metric, row.value, row.detail, row.action].map(escapeExportCell).join(',')),
    ].join('\n')
    downloadExportFile(`${filename}.csv`, csv, 'text/csv;charset=utf-8')
    return
  }

  const html = buildAdminReportDocument(title, period.label, rows, category, cadence)

  if (format === 'excel') {
    downloadExportFile(`${filename}.xls`, html, 'application/vnd.ms-excel;charset=utf-8')
    return
  }

  const printWindow = window.open('', '_blank', 'width=1100,height=800')
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
}

const AdminSectionView = ({
  segment,
  officialRoster,
  setOfficialRoster,
  admissionRequests,
  setAdmissionRequests,
}: {
  segment: string
  officialRoster: AdminStudentRecord[]
  setOfficialRoster: Dispatch<SetStateAction<AdminStudentRecord[]>>
  admissionRequests: AdminAdmissionRequest[]
  setAdmissionRequests: Dispatch<SetStateAction<AdminAdmissionRequest[]>>
}) => {
  const [selectedStudent, setSelectedStudent] = useState<AdminStudentRecord | null>(officialRoster[0] ?? null)
  const [viewingStudent, setViewingStudent] = useState<AdminStudentRecord | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<(typeof staffSeed)[number] | null>(staffSeed[0] ?? null)
  const [selectedParent, setSelectedParent] = useState<AdminParentRecord | null>(null)
  const [editingParent, setEditingParent] = useState<AdminParentRecord | null>(null)
  const [parentEditForm, setParentEditForm] = useState<AdminParentEditForm>(() => createAdminParentEditForm(null))
  const [parentEditStudents, setParentEditStudents] = useState<ParentEditStudentForm[]>([])
  const [parentNewStudents, setParentNewStudents] = useState<AdminStudentDraft[]>([])
  const [showParentNewStudent, setShowParentNewStudent] = useState(false)
  const [savingParentEdit, setSavingParentEdit] = useState(false)
  const [editingTeacherId, setEditingTeacherId] = useState('')
  const [teacherNotice, setTeacherNotice] = useState('')
  const [teacherForm, setTeacherForm] = useState({ firstName: '', middleName: '', lastName: '', email: '', phone: '', employeeId: '', employeeType: 'teacher', department: '', jobTitle: '' })
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState('all')
  const [sentNotice, setSentNotice] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [parentQuery, setParentQuery] = useState('')
  const [parentGradeFilter, setParentGradeFilter] = useState('All')
  const [parentClassSuffixFilter, setParentClassSuffixFilter] = useState<typeof SEARCH_CLASS_SUFFIXES[number]>('All')
  const [parentStudentFilter, setParentStudentFilter] = useState('All')
  const [divisionFilter, setDivisionFilter] = useState('All')
  const [gradeFilter, setGradeFilter] = useState('All')
  const [classSuffixFilter, setClassSuffixFilter] = useState<typeof SEARCH_CLASS_SUFFIXES[number]>('All')
  const [familyFilter, setFamilyFilter] = useState('All')
  const [studentNotice, setStudentNotice] = useState('')
  const [familyCredentials, setFamilyCredentials] = useState<any>(null)
  const [admissionCredentials, setAdmissionCredentials] = useState<any>(null)
  const [admissionApproving, setAdmissionApproving] = useState('')
  const [admissionNotice, setAdmissionNotice] = useState('')
  const [parentNotice, setParentNotice] = useState('')
  const [apiSynced, setApiSynced] = useState(false)
  const [sharedDirectory, setSharedDirectory] = useState<SharedDirectoryPayload | null>(null)
  const [showCreateStudent, setShowCreateStudent] = useState(false)
  const [selectedTranscriptId, setSelectedTranscriptId] = useState('')
  const [transcriptQuery, setTranscriptQuery] = useState('')
  const [transcriptClassFilter, setTranscriptClassFilter] = useState('All')
  const [communicationRecipient, setCommunicationRecipient] = useState<'ALL' | 'PARENTS' | 'STUDENTS' | 'TEACHERS' | 'STAFF' | 'GRADE_9_12_FAMILIES'>('ALL')
  const [communicationSubject, setCommunicationSubject] = useState('')
  const [communicationBody, setCommunicationBody] = useState('')
  const [communicationHistory, setCommunicationHistory] = useState<any[]>([])
  const [communicationSending, setCommunicationSending] = useState(false)
  const [detailDialog, setDetailDialog] = useState<{ title: string; subtitle: string; details: Array<[string, string]> } | null>(null)
  const [diagnosticStatuses, setDiagnosticStatuses] = useState<Record<string, string>>(() => Object.fromEntries(diagnosticTests.map((test) => [test.id, test.status])))
  const [financeSummary, setFinanceSummary] = useState<EduPayFinanceSummary | null>(null)
  const [financeSyncError, setFinanceSyncError] = useState('')
  const [financeLoading, setFinanceLoading] = useState(false)
  const [reportCadence, setReportCadence] = useState<AdminReportCadence>('weekly')
  const [reportCategory, setReportCategory] = useState<AdminReportCategory>('executive')
  const [editingStudent, setEditingStudent] = useState<AdminStudentRecord | null>(null)
  const [studentEditForm, setStudentEditForm] = useState<AdminStudentEditForm>(() => createAdminStudentEditForm(null))
  const [savingStudentEdit, setSavingStudentEdit] = useState(false)
  const [newFamily, setNewFamily] = useState({
    parentFirstName: '',
    parentMiddleName: '',
    parentLastName: '',
    parent: '',
    parentAddress: '',
    parentEmail: '',
    parentPhone: '',
    parentPhotoData: '',
    advisor: '',
    students: [createAdminStudentDraft()],
  })

  const shouldLoadRoster = adminRosterSegments.has(segment)

  const refreshEduPayFinance = async () => {
    setFinanceLoading(true)
    setFinanceSyncError('')
    try {
      const response = await financeAPI.getEduPaySummary()
      setFinanceSummary(response.data.data as EduPayFinanceSummary)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'EduPay finance synchronization is unavailable.'
      setFinanceSyncError(message)
    } finally {
      setFinanceLoading(false)
    }
  }

  useEffect(() => {
    if (segment === 'finance') void refreshEduPayFinance()
  }, [segment])

  useEffect(() => {
    if (segment !== 'communications') return
    messagesAPI.getAll({ box: 'sent' }).then((response) => {
      const rows = response.data?.data ?? []
      setCommunicationHistory(rows.map((message: any) => ({
        id: message.id,
        direction: 'Sent',
        audience: message.recipient ? [message.recipient.firstName, message.recipient.lastName].filter(Boolean).join(' ') + ' (' + message.recipient.role + ')' : message.targetRole ?? 'Audience',
        subject: message.subject,
        body: message.body,
        sender: message.sender ? [message.sender.firstName, message.sender.lastName].filter(Boolean).join(' ') : 'Administration',
        timestamp: new Date(message.createdAt).toLocaleString(),
        status: message.readAt ? 'Read' : 'Delivered',
      })))
    }).catch(() => setSentNotice('Unable to load the traceable message history.'))
  }, [segment])

  const sendSchoolCommunication = async () => {
    if (!communicationSubject.trim() || !communicationBody.trim()) { setSentNotice('Enter a subject and a message before sending.'); return }
    setCommunicationSending(true); setSentNotice('')
    try {
      const response = await messagesAPI.broadcast({ audience: communicationRecipient, subject: communicationSubject.trim(), body: communicationBody.trim() })
      const count = response.data?.data?.recipients ?? 0
      setCommunicationSubject(''); setCommunicationBody('')
      setSentNotice('Communication delivered to ' + count + ' recipient(s) and recorded in their Nexus inbox.')
      const history = await messagesAPI.getAll({ box: 'sent' })
      const rows = history.data?.data ?? []
      setCommunicationHistory(rows.map((message: any) => ({ id: message.id, direction: 'Sent', audience: message.recipient ? [message.recipient.firstName,message.recipient.lastName].filter(Boolean).join(' ')+' ('+message.recipient.role+')' : message.targetRole??'Audience', subject: message.subject, body: message.body, sender: message.sender ? [message.sender.firstName,message.sender.lastName].filter(Boolean).join(' ') : 'Administration', timestamp: new Date(message.createdAt).toLocaleString(), status: message.readAt ? 'Read' : 'Delivered' })))
    } catch (error: any) { setSentNotice(error?.response?.data?.message ?? 'The communication could not be delivered.') }
    finally { setCommunicationSending(false) }
  }

  const detailModal = detailDialog ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-kcs-blue-950/70 p-4" role="dialog" aria-modal="true" aria-label={detailDialog.title} onClick={() => setDetailDialog(null)}>
      <section className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-900" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-kcs-blue-800"><div><p className="text-xs font-bold uppercase tracking-wide text-kcs-gold-600 dark:text-kcs-gold-300">Detailed record</p><h2 className="mt-1 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{detailDialog.title}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detailDialog.subtitle}</p></div><button type="button" onClick={() => setDetailDialog(null)} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-kcs-blue-800" aria-label="Close detail window"><X size={20} /></button></div>
        <dl className="mt-5 space-y-4">{detailDialog.details.map(([label, value]) => <div key={label} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><dt className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-kcs-blue-900 dark:text-white">{value}</dd></div>)}</dl>
      </section>
    </div>
  ) : null

  const refreshOfficialRoster = async () => {
    const [response, directoryResponse] = await Promise.all([
      getAdminRoster(),
      registryAPI.getDirectory().catch(() => null),
    ])
    const directory = directoryResponse?.data?.data
    if (directory?.parents) {
      setSharedDirectory(directory)
    }
    const profiles = response.data?.data
    if (!Array.isArray(profiles)) {
      const fallbackRoster = readStoredRoster()
      const roster = fallbackRoster.length > 0 ? fallbackRoster : adminRosterSeed
      setOfficialRoster(roster)
      setSelectedStudent((current) => roster.find((item) => item.id === current?.id) ?? roster[0] ?? null)
      setViewingStudent(null)
      setApiSynced(false)
      return [] as AdminStudentRecord[]
    }
    const apiRoster = profiles.map(apiProfileToRosterRecord)
    setOfficialRoster(apiRoster)
    saveRoster(apiRoster)
    setSelectedStudent((current) => apiRoster.find((item) => item.id === current?.id) ?? apiRoster[0] ?? null)
    setViewingStudent((current) => current ? apiRoster.find((item) => item.id === current.id) ?? null : null)
    setApiSynced(true)
    return apiRoster
  }

  useEffect(() => {
    if (!shouldLoadRoster) {
      setStudentNotice('')
      return
    }

    let mounted = true
    Promise.all([
      getAdminRoster(),
      registryAPI.getDirectory().catch(() => null),
    ])
      .then(([response, directoryResponse]) => {
        const profiles = response.data?.data
        if (!mounted) return
        const directory = directoryResponse?.data?.data
        if (directory?.parents) {
          setSharedDirectory(directory)
        }
        if (!Array.isArray(profiles)) {
          const fallbackRoster = readStoredRoster()
          const roster = fallbackRoster.length > 0 ? fallbackRoster : adminRosterSeed
          setOfficialRoster(roster)
          setSelectedStudent((current) => roster.find((item) => item.id === current?.id) ?? roster[0] ?? null)
          setViewingStudent(null)
          setApiSynced(false)
          return
        }
        const apiRoster = profiles.map(apiProfileToRosterRecord)
        setOfficialRoster(apiRoster)
        saveRoster(apiRoster)
        setSelectedStudent((current) => apiRoster.find((item) => item.id === current?.id) ?? apiRoster[0] ?? null)
        setApiSynced(true)
      })
      .catch(() => {
        const fallbackRoster = readStoredRoster()
        const roster = fallbackRoster.length > 0 ? fallbackRoster : adminRosterSeed
        setOfficialRoster(roster)
        setSelectedStudent((current) => roster.find((item) => item.id === current?.id) ?? roster[0] ?? null)
        setViewingStudent(null)
        setSharedDirectory(null)
        setApiSynced(false)
        setStudentNotice('La synchronisation du registre est indisponible. Verifiez que KCS Orbit API est bien lance pour voir les eleves provenant des autres applications.')
      })
    let refreshInFlight = false
    const refresh = async () => {
      if (refreshInFlight) return
      refreshInFlight = true
      try {
        await refreshOfficialRoster()
      } catch {
        // Le prochain cycle retentera sans vider le registre affiché.
      } finally {
        refreshInFlight = false
      }
    }
    const timer = window.setInterval(() => void refresh(), 1500)
    window.addEventListener('focus', refresh)
    return () => {
      mounted = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [setOfficialRoster, shouldLoadRoster])

  const registerOfficialStudent = async () => {
    setFamilyCredentials(null)
    setStudentNotice('')
    const parentName = [newFamily.parentLastName, newFamily.parentMiddleName, newFamily.parentFirstName].filter(Boolean).join(' ').trim()
    const readyStudents = newFamily.students.map((student) => ({ ...student, name: [student.lastName, student.middleName, student.firstName].filter(Boolean).join(' ').trim() })).filter((student) => student.lastName.trim() && student.firstName.trim())
    if (readyStudents.length === 0 || !newFamily.parentLastName.trim() || !newFamily.parentFirstName.trim()) {
      setStudentNotice('Le parent et au moins un élève sont requis avant l’enregistrement.')
      return
    }

    const duplicateStudentNumbers = readyStudents
      .map((student) => student.studentNumber.trim())
      .filter(Boolean)
      .filter((studentNumber, index, values) => values.indexOf(studentNumber) !== index)
    if (duplicateStudentNumbers.length > 0) {
      setStudentNotice(`Doublon détecté dans la saisie. Numéro d’élève répété: ${Array.from(new Set(duplicateStudentNumbers)).join(', ')}`)
      return
    }

    const duplicateStudentEmails = readyStudents
      .map((student) => student.email.trim().toLowerCase())
      .filter(Boolean)
      .filter((email, index, values) => values.indexOf(email) !== index)
    if (duplicateStudentEmails.length > 0) {
      setStudentNotice(`Doublon détecté dans la saisie. Email élève répété: ${Array.from(new Set(duplicateStudentEmails)).join(', ')}`)
      return
    }

    const parentEmail = newFamily.parentEmail.trim() || `${parentName.toLowerCase().replace(/\W+/g, '.')}@family.kcs.test`
    const parentPhone = newFamily.parentPhone.trim() || '+243 810 000 000'
    const fallbackTimestamp = Date.now().toString().slice(-5)
    const localRecords = readyStudents.map((student, index): AdminStudentRecord => {
      const studentNumber = student.studentNumber.trim() || `KCS-${student.grade.replace(/\D/g, '').padStart(2, '0') || '00'}-${fallbackTimestamp}${index + 1}`
      return {
        id: `manual-${Date.now()}-${index}`,
        name: student.name.trim(),
        studentNumber,
        grade: student.grade,
        section: student.section,
        parent: parentName,
        parentEmail,
        parentPhone,
        status: 'Active',
        gpa: 0,
        attendance: null,
        discipline: 'Clear',
        advisor: newFamily.advisor.trim() || 'Advisor pending',
      }
    })
    let finalRecords = localRecords
    try {
      const response = await studentsAPI.create({
        parent: {
          firstName: newFamily.parentFirstName.trim(),
          middleName: newFamily.parentMiddleName.trim() || undefined,
          lastName: newFamily.parentLastName.trim(),
          physicalAddress: newFamily.parentAddress.trim() || undefined,
          email: parentEmail,
          phone: parentPhone,
          relationship: 'Parent',
          photoData: newFamily.parentPhotoData || undefined,
        },
        students: readyStudents.map((student) => {
          return {
            firstName: student.firstName.trim(),
            middleName: student.middleName.trim() || undefined,
            lastName: student.lastName.trim(),
            grade: student.grade,
            section: student.section,
            email: student.email.trim() || undefined,
            dateOfBirth: student.dateOfBirth,
            photoData: student.photoData || undefined,
          }
        }),
      })
      const profiles = response.data?.data?.students
      if (Array.isArray(profiles) && profiles.length > 0) {
        finalRecords = profiles.map(apiProfileToRosterRecord)
      }
      setApiSynced(true)
      const temporaryCredentials = response.data?.data?.temporaryCredentials
      if (temporaryCredentials) setFamilyCredentials(temporaryCredentials)
      const credentialSummary = [
        temporaryCredentials?.parent?.temporaryPassword ? `Parent: ${temporaryCredentials.parent.username} · Code: ${temporaryCredentials.parent.accessCode || 'non défini'} · Mot de passe: ${temporaryCredentials.parent.temporaryPassword}` : null,
        ...(temporaryCredentials?.students ?? [])
          .filter((credential: { temporaryPassword?: string }) => credential.temporaryPassword)
          .map((credential: { studentId: string; username: string; accessCode?: string; temporaryPassword: string }) => `${credential.studentId}: ${credential.username} · Code: ${credential.accessCode || 'non défini'} · Mot de passe: ${credential.temporaryPassword}`),
      ].filter(Boolean).join(' | ')
      setStudentNotice(`Famille enregistrée avec ${finalRecords.length} élève(s). Accès temporaires: ${credentialSummary || 'déjà définis'}. Format commun: KCS-123456, à changer à la première connexion.`)
    } catch (error) {
      setStudentNotice(extractStudentApiMessage(error, 'Impossible d’enregistrer cette famille pour le moment.'))
      return
    }
    const refreshedRoster = await refreshOfficialRoster()
    const focusStudent = refreshedRoster.find((student) => finalRecords.some((record) => record.studentNumber === student.studentNumber)) ?? refreshedRoster[0] ?? finalRecords[0]
    setSelectedStudent(focusStudent)
    setDivisionFilter(getDivisionForGrade(focusStudent.grade).id)
    setGradeFilter(focusStudent.grade)
    setClassSuffixFilter(focusStudent.section as typeof SEARCH_CLASS_SUFFIXES[number] || 'All')
    setNewFamily({ parentFirstName: '', parentMiddleName: '', parentLastName: '', parent: '', parentAddress: '', parentEmail: '', parentPhone: '', parentPhotoData: '', advisor: '', students: [createAdminStudentDraft()] })
  }

  const openEditStudent = (student: AdminStudentRecord) => {
    setViewingStudent(null)
    setEditingStudent(student)
    setStudentEditForm(createAdminStudentEditForm(student))
    setStudentNotice('')
  }

  const resetEntityAccess = async (entityType: 'parent' | 'student', entity: AdminParentRecord | AdminStudentRecord) => {
    const identifier = entityType === 'parent'
      ? entity.id
      : ((entity as AdminStudentRecord).studentNumber || entity.id)
    try {
      const response = await registryAPI.resetAccess(entityType, identifier)
      const credential = response.data?.data
      setFamilyCredentials(entityType === 'parent' ? { parent: credential, students: [], reset: { entityType, identifier } } : { parent: null, students: [{ ...credential, studentId: identifier }], reset: { entityType, identifier } })
      const message = `Accès temporaire régénéré pour ${identifier}.`
      if (entityType === 'parent') setParentNotice(message)
      else setStudentNotice(message)
    } catch (error) {
      const message = extractStudentApiMessage(error, 'Impossible de réinitialiser cet accès.')
      if (entityType === 'parent') setParentNotice(message)
      else setStudentNotice(message)
    }
  }

  const saveEditedStudent = async () => {
    if (!editingStudent) return

    const normalizedName = `${studentEditForm.lastName} ${studentEditForm.middleName} ${studentEditForm.firstName}`.replace(/\s+/g, ' ').trim()
    if (!normalizedName) {
      setStudentNotice('Le prénom et le nom de l’élève sont obligatoires pour enregistrer les modifications.')
      return
    }

    if (!studentEditForm.studentNumber.trim()) {
      setStudentNotice('Le numéro d’élève est obligatoire pour empêcher les doublons.')
      return
    }

    setSavingStudentEdit(true)
    try {
      const response = await studentsAPI.update(editingStudent.id, {
        firstName: studentEditForm.firstName.trim(),
        middleName: studentEditForm.middleName.trim() || null,
        lastName: studentEditForm.lastName.trim() || 'Student',
        email: studentEditForm.email.trim() || undefined,
        studentNumber: studentEditForm.studentNumber.trim(),
        grade: studentEditForm.grade,
        section: studentEditForm.section,
        status: studentEditForm.status,
        dateOfBirth: studentEditForm.dateOfBirth || null,
      })
      const roster = await refreshOfficialRoster()
      const updatedStudent = roster.find((student) => student.id === editingStudent.id) ?? null
      if (updatedStudent) {
        setSelectedStudent(updatedStudent)
        if (viewingStudent?.id === updatedStudent.id) {
          setViewingStudent(updatedStudent)
        }
      }
      setEditingStudent(null)
      const delivery = response.data?.data?.notificationDelivery
      const successMessage = response.data?.message || `${normalizedName} a été mis à jour avec succès.`
      setStudentNotice(successMessage)
      setDetailDialog({
        title: 'Modification enregistrée',
        subtitle: normalizedName,
        details: [
          ['Résultat', successMessage],
          ['Dashboard', delivery?.dashboard ? 'Message ajouté aux tableaux de bord concernés' : 'Notification interne en attente'],
          ['E-mail', delivery?.email?.sent ? 'E-mail envoyé' : `Non envoyé (${delivery?.email?.reason || 'configuration indisponible'})`],
          ['SMS', delivery?.sms?.sent ? 'SMS envoyé' : `Non envoyé (${delivery?.sms?.reason || 'configuration indisponible'})`],
        ],
      })
    } catch (error) {
      setStudentNotice(extractStudentApiMessage(error, 'Impossible de modifier cet élève pour le moment.'))
    } finally {
      setSavingStudentEdit(false)
    }
  }

  const deleteOfficialStudent = async (student: AdminStudentRecord) => {
    if (!student.isDeletable) {
      setStudentNotice(`L’élève ${student.name} est géré par ${student.managingApp || 'une autre application'} et doit être supprimé dans son système source.`)
      return
    }

    const confirmed = window.confirm(`Supprimer ${student.name} du registre officiel ?`)
    if (!confirmed) return
    try {
      const response = await studentsAPI.delete(student.id)
      await refreshOfficialRoster()
      setStudentNotice(response.data?.message || `${student.name} a été supprimé du registre officiel.`)
    } catch (error) {
      setStudentNotice(extractStudentApiMessage(error, `Impossible de supprimer ${student.name} pour le moment.`))
      return
    }
  }

  const openEditParent = (parent: AdminParentRecord) => {
    setSelectedParent(null)
    setEditingParent(parent)
    setParentEditForm(createAdminParentEditForm(parent))
    setParentEditStudents(parent.students.map((student) => ({ id: student.id, ...createAdminStudentEditForm(student) })))
    setParentNewStudents([])
    setShowParentNewStudent(false)
    setParentNotice('')
  }

  const saveEditedParent = async () => {
    if (!editingParent) return

    const normalizedName = `${parentEditForm.lastName} ${parentEditForm.middleName} ${parentEditForm.firstName}`.replace(/\s+/g, ' ').trim()
    if (!normalizedName) {
      setParentNotice('Le prénom et le nom du parent sont obligatoires pour enregistrer les modifications.')
      return
    }

    setSavingParentEdit(true)
    try {
      for (const student of parentEditStudents) {
        if (!student.firstName.trim() || !student.lastName.trim() || !student.studentNumber.trim()) {
          throw new Error('Chaque enfant lié doit avoir un nom, un prénom et un identifiant.')
        }
        const original = editingParent.students.find((item) => item.id === student.id)
        const originalForm = createAdminStudentEditForm(original ?? null)
        const changed = student.photoData || (['firstName', 'middleName', 'lastName', 'email', 'studentNumber', 'grade', 'section', 'status', 'dateOfBirth'] as const).some((field) => student[field] !== originalForm[field])
        if (changed) {
          await studentsAPI.update(student.id, {
            firstName: student.firstName.trim(),
            middleName: student.middleName.trim() || null,
            lastName: student.lastName.trim(),
            email: student.email.trim() || undefined,
            studentNumber: student.studentNumber.trim(),
            grade: student.grade,
            section: student.section,
            status: student.status,
            dateOfBirth: student.dateOfBirth || null,
            ...(student.photoData ? { photoData: student.photoData } : {}),
          })
        }
      }

      const readyNewStudents = parentNewStudents.filter((student) => student.firstName.trim() || student.lastName.trim())
      if (readyNewStudents.some((student) => !student.firstName.trim() || !student.lastName.trim() || !student.dateOfBirth)) {
        throw new Error('Complétez le nom, le prénom et la date de naissance de chaque nouvel enfant.')
      }
      if (readyNewStudents.length > 0 && !parentEditForm.email.trim()) {
        throw new Error('L’e-mail du parent est requis pour créer et transmettre les accès du nouvel enfant.')
      }
      let createdStudentIds: string[] = []
      if (readyNewStudents.length > 0) {
        const creation = await studentsAPI.create({
          parent: {
            existingParentId: editingParent.id,
            firstName: parentEditForm.firstName.trim(),
            middleName: parentEditForm.middleName.trim() || undefined,
            lastName: parentEditForm.lastName.trim() || 'Parent',
            email: parentEditForm.email.trim(),
            phone: parentEditForm.phone.trim() || undefined,
            physicalAddress: parentEditForm.physicalAddress.trim() || undefined,
            relationship: 'Parent',
          },
          students: readyNewStudents.map((student) => ({
            firstName: student.firstName.trim(),
            middleName: student.middleName.trim() || undefined,
            lastName: student.lastName.trim(),
            grade: student.grade,
            section: student.section,
            dateOfBirth: student.dateOfBirth,
            photoData: student.photoData || undefined,
          })),
        })
        const createdStudents = creation.data?.data?.students
        createdStudentIds = Array.isArray(createdStudents) ? createdStudents.map((student: any) => student.id).filter(Boolean) : []
        if (creation.data?.data?.temporaryCredentials) setFamilyCredentials(creation.data.data.temporaryCredentials)
      }

      const response = await registryAPI.updateEntity('parent', editingParent.id, {
        firstName: parentEditForm.firstName.trim(),
        middleName: parentEditForm.middleName.trim() || null,
        lastName: parentEditForm.lastName.trim() || 'Parent',
        email: parentEditForm.email.trim() || undefined,
        phone: parentEditForm.phone.trim() || null,
        physicalAddress: parentEditForm.physicalAddress.trim() || null,
        studentIds: Array.from(new Set([...parentEditStudents.map((student) => student.id), ...createdStudentIds])),
      }, editingParent.identifierType)
      const roster = await refreshOfficialRoster()
      const refreshedParents = buildAdminParentRecordsFromDirectory(sharedDirectory, roster)
      const updatedParent = refreshedParents.find((parent) => parent.id === editingParent.id) ?? null
      setEditingParent(null)
      if (updatedParent) {
        setSelectedParent(updatedParent)
      }
      setParentNotice(response.data?.message || `${normalizedName} a ete mis a jour avec succes.`)
    } catch (error) {
      setParentNotice(extractStudentApiMessage(error, 'Impossible de modifier ce parent pour le moment.'))
    } finally {
      setSavingParentEdit(false)
    }
  }

  const deleteParentRecord = async (parent: AdminParentRecord) => {
    const confirmed = window.confirm(`Supprimer ${parent.name} du registre parent ?`)
    if (!confirmed) return

    try {
      const response = await registryAPI.deleteEntity('parent', parent.id, parent.identifierType)
      await refreshOfficialRoster()
      setSelectedParent((current) => current?.id === parent.id ? null : current)
      setEditingParent((current) => current?.id === parent.id ? null : current)
      setParentNotice(response.data?.message || `${parent.name} a ete supprime du registre parent.`)
    } catch (error) {
      setParentNotice(extractStudentApiMessage(error, `Impossible de supprimer ${parent.name} pour le moment.`))
    }
  }

  const clearTeacherForm = () => {
    setEditingTeacherId('')
    setTeacherForm({ firstName: '', middleName: '', lastName: '', email: '', phone: '', employeeId: '', employeeType: 'teacher', department: '', jobTitle: '' })
  }

  const editTeacherRecord = (teacher: SharedDirectoryTeacher) => {
    setEditingTeacherId(teacher.id)
    setTeacherForm({
      firstName: teacher.firstName || '',
      middleName: teacher.middleName || '',
      lastName: teacher.lastName || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      employeeId: teacher.employeeId || '',
      employeeType: teacher.employeeType || 'teacher',
      department: teacher.department || '',
      jobTitle: teacher.jobTitle || '',
    })
    setTeacherNotice('')
  }

  const saveTeacherRecord = async () => {
    if (!teacherForm.firstName.trim() || !teacherForm.lastName.trim()) {
      setTeacherNotice('Le prénom et le nom de l’employé sont obligatoires.')
      return
    }
    const payload = {
      firstName: teacherForm.firstName.trim(),
      middleName: teacherForm.middleName.trim() || null,
      lastName: teacherForm.lastName.trim(),
      email: teacherForm.email.trim() || undefined,
      phone: teacherForm.phone.trim() || null,
      employeeId: teacherForm.employeeId.trim() || undefined,
      employeeType: teacherForm.employeeType,
      department: teacherForm.department.trim() || null,
      jobTitle: teacherForm.jobTitle.trim() || null,
    }
    try {
      const response = editingTeacherId
        ? await registryAPI.updateEntity('teacher', editingTeacherId, payload)
        : await registryAPI.createEntity('teacher', payload)
      clearTeacherForm()
      await refreshOfficialRoster()
      setTeacherNotice(response.data?.message || (editingTeacherId ? 'Employé modifié et propagé.' : 'Employé ajouté et propagé.'))
    } catch (error) {
      setTeacherNotice(extractStudentApiMessage(error, 'Impossible d’enregistrer cet employé.'))
    }
  }

  const deleteTeacherRecord = async (teacher: SharedDirectoryTeacher) => {
    if (!window.confirm(`Supprimer ${teacher.fullName} du registre partagé ?`)) return
    try {
      const response = await registryAPI.deleteEntity('teacher', teacher.id)
      if (editingTeacherId === teacher.id) clearTeacherForm()
      await refreshOfficialRoster()
      setTeacherNotice(response.data?.message || `${teacher.fullName} a été supprimé et la suppression a été propagée.`)
    } catch (error) {
      setTeacherNotice(extractStudentApiMessage(error, `Impossible de supprimer ${teacher.fullName}.`))
    }
  }

  const openCreateStudentForm = () => {
    const updateDraftClass = (grade: string, section = '') => {
      setNewFamily((item) => ({
        ...item,
        students: item.students.map((student, index) => index === 0 ? { ...student, grade, section } : student),
      }))
    }

    if (gradeFilter !== 'All') {
      updateDraftClass(gradeFilter)
    } else if (divisionFilter !== 'All') {
      const division = SCHOOL_DIVISIONS.find((item) => item.id === divisionFilter)
      const firstGrade = division?.id === 'kindergarten' ? 'K3' : division?.id === 'elementary' ? 'Grade 1' : division?.id === 'middle' ? 'Grade 6' : division?.id === 'high' ? 'Grade 9' : 'Grade 1'
      updateDraftClass(firstGrade)
    }
    setShowCreateStudent((value) => !value)
  }

  const updateAdmissionStatus = async (application: AdminAdmissionRequest, status: AdminAdmissionRequest['status']) => {
    try {
      await admissionsAPI.updateStatus(application.id, status)
    } catch (error: any) {
      console.error(error?.response?.data?.message ?? 'Unable to update this admission in the central registry.')
      return
    }
    setAdmissionRequests((items) => {
      const next = items.map((item) => item.applicationNumber === application.applicationNumber ? { ...item, status } : item)
      saveAdmissions(next)
      return next
    })

    if (status === 'ACCEPTED') {
      const approvedStudent = createStudentFromAdmission({ ...application, status })
      setOfficialRoster((items) => {
        if (items.some((item) => item.id === approvedStudent.id || item.name === approvedStudent.name)) return items
        return [approvedStudent, ...items]
      })
      setSelectedStudent(approvedStudent)
    }
  }

  const approveAdmission = async (application: AdminAdmissionRequest) => {
    setAdmissionApproving(application.id)
    setAdmissionNotice('')
    try {
      const response = await admissionsAPI.approve(application.id)
      const payload = response.data?.data ?? response.data
      setAdmissionRequests((items) => {
        const next = items.map((item) => item.id === application.id ? { ...item, status: 'ACCEPTED' as const, provisionedAt: new Date().toISOString() } : item)
        saveAdmissions(next)
        return next
      })
      setAdmissionCredentials(payload)
      await refreshOfficialRoster()
    } catch (error) {
      setAdmissionNotice(extractStudentApiMessage(error, 'Unable to approve and provision this family.'))
    } finally {
      setAdmissionApproving('')
    }
  }
  const grade9to12 = useMemo(
    () => officialRoster.filter((student) => ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].includes(student.grade)),
    [officialRoster]
  )

  const transcriptClasses = useMemo(() => Array.from(new Set(grade9to12.map((student) => formatClassName(student.grade, student.section)))).sort(), [grade9to12])
  const filteredTranscriptStudents = useMemo(() => {
    const query = transcriptQuery.trim().toLowerCase()
    return grade9to12.filter((student) => {
      const className = formatClassName(student.grade, student.section)
      return (transcriptClassFilter === 'All' || className === transcriptClassFilter)
        && (!query || `${student.name} ${student.studentNumber ?? ''}`.toLowerCase().includes(query))
    })
  }, [grade9to12, transcriptClassFilter, transcriptQuery])

  const transcriptStudent = grade9to12.find((student) => student.id === selectedTranscriptId) ?? grade9to12[0] ?? officialRoster[0] ?? null
  const officialTranscript = transcriptStudent ? buildOfficialTranscript(transcriptStudent) : null

  const filteredRoster = useMemo(() => {
    const query = studentQuery.trim().toLowerCase()
    return officialRoster
      .filter((student) => divisionFilter === 'All' || getDivisionForGrade(student.grade).id === divisionFilter)
      .filter((student) => gradeFilter === 'All' || student.grade === gradeFilter)
      .filter((student) => classSuffixFilter === 'All' || student.section === classSuffixFilter)
      .filter((student) => familyFilter === 'All' || student.parent === familyFilter)
      .filter((student) => {
        if (!query) return true
        const className = formatClassName(student.grade, student.section) || 'Non assignée'
        const divisionTitle = getDivisionForGrade(student.grade).title
        return [student.name, student.studentNumber, student.email, student.grade, student.section, className, divisionTitle, student.parent, student.parentEmail, student.parentPhone, student.status]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      })
      .sort((a, b) => SCHOOL_LEVELS.indexOf(a.grade as any) - SCHOOL_LEVELS.indexOf(b.grade as any) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name))
  }, [classSuffixFilter, divisionFilter, familyFilter, gradeFilter, officialRoster, studentQuery])

  const familyDirectory = useMemo(() => {
    return Array.from(new Set(officialRoster.map((student) => student.parent).filter(Boolean))).sort((left, right) => left.localeCompare(right))
  }, [officialRoster])

  const rosterByClass = useMemo(() => {
    return filteredRoster.reduce<Record<string, AdminStudentRecord[]>>((groups, student) => {
      const key = formatClassName(student.grade, student.section)
      groups[key] = [...(groups[key] ?? []), student]
      return groups
    }, {})
  }, [filteredRoster])

  const rosterByFamily = useMemo(() => {
    return filteredRoster.reduce<Record<string, AdminStudentRecord[]>>((groups, student) => {
      const key = student.parent || 'Parent record pending'
      groups[key] = [...(groups[key] ?? []), student]
      return groups
    }, {})
  }, [filteredRoster])

  const parentRecords = useMemo(() => buildAdminParentRecordsFromDirectory(sharedDirectory, officialRoster), [officialRoster, sharedDirectory])

  const parentStudentDirectory = useMemo(() => {
    const studentsById = new Map<string, AdminStudentRecord>()
    parentRecords.forEach((parent) => parent.students.forEach((student) => studentsById.set(student.id, student)))
    return Array.from(studentsById.values()).sort((left, right) => left.name.localeCompare(right.name))
  }, [parentRecords])

  const filteredParents = useMemo(() => {
    const query = parentQuery.trim().toLowerCase()
    return parentRecords
      .filter((parent) => parentGradeFilter === 'All' || parent.students.some((student) => formatClassName(student.grade) === parentGradeFilter))
      .filter((parent) => parentClassSuffixFilter === 'All' || parent.students.some((student) => student.section === parentClassSuffixFilter))
      .filter((parent) => parentStudentFilter === 'All' || parent.students.some((student) => student.id === parentStudentFilter))
      .filter((parent) => !query || [
        parent.displayId, parent.name, parent.email, parent.phone, parent.physicalAddress, parent.status, parent.syncSource,
        parent.classes.join(' '),
        parent.students.map((student) => `${student.name} ${student.studentNumber ?? ''} ${student.email ?? ''} ${student.grade} ${student.section}`).join(' '),
      ].filter(Boolean).join(' ').toLowerCase().includes(query))
  }, [parentClassSuffixFilter, parentGradeFilter, parentQuery, parentRecords, parentStudentFilter])

  const divisionSummary = useMemo(() => {
    return SCHOOL_DIVISIONS.map((division) => {
      const divisionStudents = officialRoster.filter((student) => getDivisionForGrade(student.grade).id === division.id)
      const attendanceValues = divisionStudents.map((student) => student.attendance).filter((value): value is number => value != null)
      const averageAttendance = attendanceValues.length
        ? Math.round(attendanceValues.reduce((sum, value) => sum + value, 0) / attendanceValues.length)
        : null
      return { ...division, students: divisionStudents.length, averageAttendance }
    })
  }, [officialRoster])

  const selectedTrend = useMemo<Array<{ month: string; score: number }>>(() => [], [selectedStudent?.id])

  const selectedGrades = selectedStudent ? grades.filter((grade) => grade.studentId === selectedStudent.id) : []
  const selectedAttendanceEvents = selectedStudent ? attendance.filter((item) => item.studentId === selectedStudent.id) : []
  const selectedDiscipline = selectedStudent ? disciplineReports.find((item) => item.studentId === selectedStudent.id || item.student === selectedStudent.name) : undefined
  const selectedInsight = selectedStudent ? students.find((item) => item.id === selectedStudent.id || item.name === selectedStudent.name) : undefined

  if (segment === 'parents') {
    const totalLinkedStudents = parentRecords.reduce((sum, parent) => sum + parent.studentCount, 0)
    const parentsWithAlerts = parentRecords.filter((parent) => parent.status === 'Suivi requis').length

    return (
      <div className="space-y-6">
        {familyCredentials && createPortal((
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Identifiants générés">
            <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-emerald-200 bg-white p-6 shadow-2xl dark:border-emerald-900 dark:bg-kcs-blue-950">
              <button type="button" onClick={() => setFamilyCredentials(null)} className="float-right rounded-lg border px-3 py-2 text-sm dark:text-white">Fermer</button>
              <p className="text-xs font-bold uppercase text-emerald-600">{familyCredentials.reset ? 'Réinitialisation terminée' : 'Nouvel enfant enregistré'}</p>
              <h3 className="mt-2 text-2xl font-bold text-kcs-blue-900 dark:text-white">{familyCredentials.reset ? `Nouvel accès de ${familyCredentials.reset.identifier}` : 'Identifiants générés et propagés'}</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">Conservez ces informations dans un canal sûr. Le mot de passe devra être changé à la première connexion.</p>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {[familyCredentials.parent, ...(familyCredentials.students || [])].filter(Boolean).map((credential: any, index: number) => <article key={`${credential.username}-${index}`} className="rounded-2xl bg-emerald-50 p-5 text-kcs-blue-950 dark:bg-emerald-950/30 dark:text-white"><p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">{credential.studentId ? `Élève ${credential.studentId}` : 'Parent'}</p><p className="mt-3 font-bold">{credential.displayName || credential.studentId}</p><p className="mt-3 text-sm">Identifiant : <strong>{credential.username}</strong></p><p className="mt-2 text-sm">Code d’accès : <strong>{credential.accessCode || 'Non défini'}</strong></p><p className="mt-2 text-sm">Mot de passe temporaire : <strong>{credential.temporaryPassword}</strong></p></article>)}
              </div>
            </section>
          </div>
        ), document.body)}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kcs-blue-600 dark:text-kcs-blue-300">SAVANEX shared registry</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Parents</h2>
              <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Annuaire des parents responsables, construit depuis les familles et les eleves synchronises dans KCS Nexus.</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${apiSynced ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>{apiSynced ? 'Synchronise Orbit' : 'Mode local'}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Parents visibles', value: filteredParents.length, detail: `${sharedDirectory?.counts?.parents ?? parentRecords.length} au total partage`, icon: Users },
            { label: 'Enfants lies', value: totalLinkedStudents, detail: 'dans le registre officiel', icon: GraduationCap },
            { label: 'Suivi requis', value: parentsWithAlerts, detail: 'au moins un enfant a surveiller', icon: AlertTriangle },
          ].map(({ label, value, detail, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <Icon size={18} className="mb-3 text-kcs-blue-600 dark:text-kcs-blue-300" />
              <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_180px_180px_220px] lg:items-center">
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 dark:border-kcs-blue-700 dark:bg-kcs-blue-950">
              <Search size={16} className="text-gray-400" />
              <input value={parentQuery} onChange={(event) => setParentQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none dark:text-white" placeholder="Rechercher parent, ID, contact, enfant ou classe..." />
            </label>
            <select value={parentGradeFilter} onChange={(event) => { setParentGradeFilter(event.target.value); setParentClassSuffixFilter('All') }} aria-label="Filtrer les parents par niveau de l'enfant" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option value="All">Tous les niveaux</option>
              {SCHOOL_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}
            </select>
            <select value={parentClassSuffixFilter} onChange={(event) => setParentClassSuffixFilter(event.target.value as typeof SEARCH_CLASS_SUFFIXES[number])} aria-label="Filtrer les parents par suffixe de classe" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option value="All">Tous les suffixes</option><option value="">Sans suffixe</option>
              {CLASS_SECTIONS.filter(Boolean).map((section) => <option key={section} value={section}>Suffixe {section}</option>)}
            </select>
            <select value={parentStudentFilter} onChange={(event) => setParentStudentFilter(event.target.value)} aria-label="Filtrer par enfant lié" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option value="All">Tous les enfants liés</option>
              {parentStudentDirectory.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.studentNumber || 'Sans ID'}</option>)}
            </select>
          </div>
          {parentNotice ? <p className="mt-3 rounded-xl bg-kcs-blue-50 p-3 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-950 dark:text-kcs-blue-100">{parentNotice}</p> : null}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-kcs-blue-800">
            <h3 className="font-bold text-kcs-blue-900 dark:text-white">Liste officielle des parents</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Vue semblable a SAVANEX : responsable, contacts, enfants rattaches et statut de suivi.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-kcs-blue-950 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Parent</th>
                  <th className="px-5 py-3 font-semibold">ID parent</th>
                  <th className="px-5 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 font-semibold">Enfants</th>
                  <th className="px-5 py-3 font-semibold">Source</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-kcs-blue-800/70">
                {filteredParents.map((parent) => (
                  <tr key={parent.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-kcs-blue-800/20">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{parent.name}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{parent.status}</p>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">{parent.displayId || parent.id}</td>
                    <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">
                      <p>{parent.email}</p>
                      <p className="mt-1">{parent.phone}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-200">{parent.studentCount} enfant(s)</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-kcs-blue-50 px-2.5 py-1 text-xs font-bold uppercase text-kcs-blue-700 dark:bg-kcs-blue-800 dark:text-kcs-blue-100">{parent.syncSource}</span></td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="rounded-lg border border-kcs-blue-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800" onClick={() => setSelectedParent(parent)}>Voir</button>
                        <button type="button" className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20" onClick={() => openEditParent(parent)}>Modifier</button>
                        <button type="button" className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-200" onClick={() => void resetEntityAccess('parent', parent)}>Reset accès</button>
                        <button type="button" className="rounded-lg border border-red-100 px-3 py-2 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20" onClick={() => deleteParentRecord(parent)} aria-label={`Delete ${parent.name}`}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredParents.length === 0 && (
              <div className="p-5 text-sm font-semibold text-yellow-800 dark:text-yellow-300">Aucun parent ne correspond aux filtres en cours.</div>
            )}
          </div>
        </div>

        {selectedParent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Fiche parent">
            <section className="max-h-[92vh] w-full max-w-none lg:w-[80vw] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kcs-blue-600 dark:text-kcs-blue-300">Consultation</p>
                  <h3 className="mt-2 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Fiche parent</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Contact familial et enfants rattaches.</p>
                </div>
                <button type="button" onClick={() => setSelectedParent(null)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-100 dark:hover:bg-kcs-blue-800">
                  <X size={16} />
                  Fermer
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => openEditParent(selectedParent)} className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20">Modifier</button>
                <button type="button" onClick={() => deleteParentRecord(selectedParent)} className="rounded-xl border border-red-100 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20">Supprimer</button>
              </div>

              <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                <aside className="rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/55">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kcs-blue-600 dark:text-kcs-blue-300">Responsable</p>
                  <h4 className="mt-2 font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{selectedParent.name}</h4>
                  <div className="mt-5 space-y-3">
                    {[
                      ['ID parent', selectedParent.displayId || selectedParent.id],
                      ['Email', selectedParent.email],
                      ['Telephone', selectedParent.phone],
                      ['Adresse physique', selectedParent.physicalAddress],
                      ['Enfants', String(selectedParent.studentCount)],
                      ['Statut', selectedParent.status],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white p-4 dark:bg-kcs-blue-900/70">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                        <p className="mt-2 break-words text-sm font-semibold text-kcs-blue-900 dark:text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </aside>

                <div className="space-y-3">
                  {selectedParent.students.map((student) => (
                    <div key={student.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/45">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{student.studentNumber ?? 'ID non renseigne'} - {formatClassName(student.grade, student.section) || 'Non assignee'}</p>
                        </div>
                        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${pillTone(getStudentRisk(student))}`}>{getStudentRisk(student)}</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl bg-white p-3 dark:bg-kcs-blue-900/70"><p className="text-xs text-gray-400">Presence</p><p className={`font-bold ${scoreTone(student.attendance, 'attendance')}`}>{student.attendance}%</p></div>
                        <div className="rounded-xl bg-white p-3 dark:bg-kcs-blue-900/70"><p className="text-xs text-gray-400">GPA</p><p className={`font-bold ${scoreTone(student.gpa, 'gpa')}`}>{student.gpa}</p></div>
                        <div className="rounded-xl bg-white p-3 dark:bg-kcs-blue-900/70"><p className="text-xs text-gray-400">Discipline</p><p className="font-bold text-kcs-blue-900 dark:text-white">{student.discipline}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {editingParent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-kcs-blue-950/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Modifier parent">
            <section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-kcs-blue-700 dark:bg-kcs-blue-900 sm:max-h-[calc(100dvh-3rem)] lg:w-[80vw]">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-kcs-blue-700 sm:p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kcs-blue-600 dark:text-kcs-blue-300">Gestion parent</p>
                  <h3 className="mt-2 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Modifier le parent</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Mettre a jour le nom et les contacts du responsable familial.</p>
                </div>
                <button type="button" onClick={() => setEditingParent(null)} className="inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-kcs-blue-300 bg-white px-3 py-2 text-sm font-bold text-kcs-blue-800 hover:bg-kcs-blue-50 focus:outline-none focus:ring-2 focus:ring-kcs-blue-500 dark:border-kcs-blue-400 dark:bg-kcs-blue-950 dark:text-white dark:hover:bg-kcs-blue-800">
                  <X size={16} />
                  Fermer
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                <section className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40">
                  <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-700 dark:text-kcs-blue-200">Identité du parent</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Nom
                      <input value={parentEditForm.lastName} onChange={(event) => setParentEditForm((current) => ({ ...current, lastName: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Nom du parent" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Postnom
                      <input value={parentEditForm.middleName} onChange={(event) => setParentEditForm((current) => ({ ...current, middleName: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Postnom du parent" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Prénom
                      <input value={parentEditForm.firstName} onChange={(event) => setParentEditForm((current) => ({ ...current, firstName: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Prénom du parent" />
                    </label>
                  </div>
                </section>
                <section className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40">
                  <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-700 dark:text-kcs-blue-200">Coordonnées</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Email
                      <input value={parentEditForm.email} onChange={(event) => setParentEditForm((current) => ({ ...current, email: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Email du parent" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Téléphone
                      <InternationalPhoneInput value={parentEditForm.phone} onChange={(value) => setParentEditForm((current) => ({ ...current, phone: value }))} />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300 md:col-span-2">Adresse physique<input value={parentEditForm.physicalAddress} onChange={(event) => setParentEditForm((current) => ({ ...current, physicalAddress: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Adresse complète du parent" /></label>
                  </div>
                </section>
                <section className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-700 dark:text-kcs-blue-200">Enfants liés</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Modifiez les dossiers liés, retirez un rattachement ou créez un nouvel élève complet.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-kcs-blue-100 px-3 py-1 text-xs font-bold text-kcs-blue-800 dark:bg-kcs-blue-800 dark:text-white">{parentEditStudents.length} enfant(s) lié(s)</span>
                      <button type="button" onClick={() => { setShowParentNewStudent(true); setParentNewStudents((current) => current.length ? current : [createAdminStudentDraft(parentEditStudents[0]?.grade || 'K3', parentEditStudents[0]?.section || '')]) }} className="inline-flex items-center gap-2 rounded-xl bg-kcs-blue-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-kcs-blue-800 dark:bg-kcs-gold-400 dark:text-kcs-blue-950"><UserPlus size={16} /> Ajouter un enfant</button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    {parentEditStudents.length === 0 ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Aucun enfant n’est lié. Utilisez « Ajouter un enfant » pour compléter cette famille.</p> : null}
                    {parentEditStudents.map((student, index) => (
                      <article key={student.id} className="rounded-2xl border border-kcs-blue-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-600 dark:text-kcs-blue-300">Enfant lié {index + 1}</p><p className="mt-1 text-sm font-semibold text-kcs-blue-950 dark:text-white">{[student.lastName, student.middleName, student.firstName].filter(Boolean).join(' ') || student.studentNumber}</p></div><button type="button" onClick={() => setParentEditStudents((current) => current.filter((item) => item.id !== student.id))} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-200">Retirer de cette famille</button></div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="md:col-span-2"><PhotoCaptureField label={`Photo de l’enfant ${index + 1}`} value={student.photoData || ''} onChange={(photoData) => setParentEditStudents((current) => current.map((item) => item.id === student.id ? { ...item, photoData } : item))} onError={setParentNotice} /></div>
                          <input value={student.lastName} onChange={(event) => setParentEditStudents((current) => current.map((item) => item.id === student.id ? { ...item, lastName: event.target.value } : item))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Nom de l’élève *" required />
                          <input value={student.middleName} onChange={(event) => setParentEditStudents((current) => current.map((item) => item.id === student.id ? { ...item, middleName: event.target.value } : item))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Postnom de l’élève" />
                          <input value={student.firstName} onChange={(event) => setParentEditStudents((current) => current.map((item) => item.id === student.id ? { ...item, firstName: event.target.value } : item))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Prénom de l’élève *" required />
                          <input value={student.studentNumber} onChange={(event) => setParentEditStudents((current) => current.map((item) => item.id === student.id ? { ...item, studentNumber: event.target.value } : item))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Identifiant élève *" required />
                          <input type="email" value={student.email} onChange={(event) => setParentEditStudents((current) => current.map((item) => item.id === student.id ? { ...item, email: event.target.value } : item))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="E-mail scolaire" />
                          <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">Date de naissance<DateSelect value={student.dateOfBirth} onChange={(event) => setParentEditStudents((current) => current.map((item) => item.id === student.id ? { ...item, dateOfBirth: event.target.value } : item))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" /></label>
                          <select value={student.grade} onChange={(event) => setParentEditStudents((current) => current.map((item) => item.id === student.id ? { ...item, grade: event.target.value } : item))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">{SCHOOL_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}</select>
                          <select value={student.section} onChange={(event) => setParentEditStudents((current) => current.map((item) => item.id === student.id ? { ...item, section: event.target.value } : item))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">{CLASS_SECTIONS.map((section) => <option key={section || 'none'} value={section}>{sectionLabel(section)}</option>)}</select>
                        </div>
                      </article>
                    ))}
                    {showParentNewStudent ? <section className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-4 dark:border-emerald-700 dark:bg-emerald-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Nouveaux enfants</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Leurs accès seront générés et propagés dans l’écosystème à l’enregistrement.</p></div><button type="button" onClick={() => setParentNewStudents((current) => [...current, createAdminStudentDraft(current[0]?.grade || parentEditStudents[0]?.grade || 'K3', current[0]?.section || '')])} className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-700 dark:bg-kcs-blue-950 dark:text-emerald-200">Ajouter encore</button></div>
                      <div className="mt-4 space-y-4">{parentNewStudents.map((student, index) => <article key={`parent-new-student-${index}`} className="rounded-xl border border-emerald-200 bg-white p-4 dark:border-emerald-800 dark:bg-kcs-blue-900">
                        <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">Nouvel élève {index + 1}</p><button type="button" onClick={() => setParentNewStudents((current) => current.filter((_item, itemIndex) => itemIndex !== index))} className="text-xs font-bold text-red-700 dark:text-red-300">Retirer</button></div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="md:col-span-2"><PhotoCaptureField label={`Photo du nouvel élève ${index + 1}`} value={student.photoData} onChange={(photoData) => setParentNewStudents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, photoData } : item))} onError={setParentNotice} /></div>
                          <input value={student.lastName} onChange={(event) => setParentNewStudents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, lastName: event.target.value } : item))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Nom de l’élève *" required />
                          <input value={student.middleName} onChange={(event) => setParentNewStudents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, middleName: event.target.value } : item))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Postnom de l’élève" />
                          <input value={student.firstName} onChange={(event) => setParentNewStudents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, firstName: event.target.value } : item))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Prénom de l’élève *" required />
                          <div className="rounded-xl border border-dashed border-kcs-blue-200 bg-kcs-blue-50 px-4 py-3 text-sm text-kcs-blue-700 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-kcs-blue-200"><strong>ID :</strong> généré automatiquement</div>
                          <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">Date de naissance *<DateSelect value={student.dateOfBirth} onChange={(event) => setParentNewStudents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dateOfBirth: event.target.value } : item))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" required /></label>
                          <input value={schoolEmailPreview(student)} readOnly className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-gray-300" placeholder="E-mail scolaire généré automatiquement" />
                          <select value={student.grade} onChange={(event) => setParentNewStudents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, grade: event.target.value } : item))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">{SCHOOL_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}</select>
                          <select value={student.section} onChange={(event) => setParentNewStudents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, section: event.target.value } : item))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">{CLASS_SECTIONS.map((section) => <option key={section || 'none'} value={section}>{sectionLabel(section)}</option>)}</select>
                        </div>
                      </article>)}</div>
                    </section> : null}
                  </div>
                </section>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-gray-200 bg-white p-4 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 sm:flex-row sm:justify-end sm:p-5">
                <button type="button" onClick={() => setEditingParent(null)} className="rounded-xl border-2 border-slate-400 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-300 dark:bg-kcs-blue-950 dark:text-white dark:hover:bg-kcs-blue-800">Annuler</button>
                <button type="button" onClick={() => void saveEditedParent()} disabled={savingParentEdit} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-kcs-blue-950 dark:hover:bg-emerald-400 dark:focus:ring-offset-kcs-blue-900">{savingParentEdit ? 'Enregistrement...' : 'Enregistrer'}</button>
              </div>
            </section>
          </div>
        )}
      </div>
    )
  }

  if (segment === 'students') {
    const activeStudents = filteredRoster.filter((student) => student.status.toLowerCase() === 'active').length
    const isFullDirectoryView = !studentQuery.trim()
      && divisionFilter === 'All'
      && gradeFilter === 'All'
      && classSuffixFilter === 'All'
      && familyFilter === 'All'
    const classesCovered = isFullDirectoryView ? SCHOOL_LEVELS.length : Object.keys(rosterByClass).length
    const familiesCovered = isFullDirectoryView
      ? (sharedDirectory?.counts?.families ?? sharedDirectory?.counts?.parents ?? parentRecords.length)
      : Object.keys(rosterByFamily).length

    return (
      <div className="space-y-6">
        {detailModal}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kcs-blue-600 dark:text-kcs-blue-300">SAVANEX shared registry</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Élèves</h2>
              <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">Liste officielle lisible par classe et par famille, alimentée par SAVANEX via Orbit.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${apiSynced ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>{apiSynced ? 'Synchronisé Orbit' : 'Mode local'}</span>
              <button className={`${adminButton} inline-flex items-center gap-2`} onClick={openCreateStudentForm}><UserPlus size={16} /> Ajouter un élève</button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Élèves visibles', value: filteredRoster.length, detail: `${activeStudents} actifs`, icon: GraduationCap },
            { label: 'Classes couvertes', value: classesCovered, detail: 'selon les filtres', icon: BookOpen },
            { label: 'Familles liées', value: familiesCovered, detail: 'parents responsables', icon: Users },
            { label: 'À suivre', value: filteredRoster.filter((student) => getStudentRisk(student) !== 'On track').length, detail: 'présence, discipline ou moyenne', icon: AlertTriangle },
          ].map(({ label, value, detail, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <Icon size={18} className="mb-3 text-kcs-blue-600 dark:text-kcs-blue-300" />
              <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{value}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_180px_180px_220px] lg:items-center">
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 dark:border-kcs-blue-700 dark:bg-kcs-blue-950">
              <Search size={16} className="text-gray-400" />
              <input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none dark:text-white" placeholder="Rechercher élève, ID, parent ou classe..." />
            </label>
            <select value={gradeFilter} onChange={(event) => {
              setGradeFilter(event.target.value)
              setClassSuffixFilter('All')
            }} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option value="All">All</option>
              {SCHOOL_LEVELS.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
            </select>
            <select value={classSuffixFilter} onChange={(event) => {
              setClassSuffixFilter(event.target.value as typeof SEARCH_CLASS_SUFFIXES[number])
            }} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option value="All">Tous les suffixes</option>
              <option value="">Sans suffixe</option>
              {CLASS_SECTIONS.filter(Boolean).map((section) => <option key={section} value={section}>Suffixe {section}</option>)}
            </select>
            <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option>All</option>
              {familyDirectory.map((familyName) => <option key={familyName}>{familyName}</option>)}
            </select>
          </div>
          {familyCredentials && createPortal((
            <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Identifiants générés">
              <section className="relative my-auto max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-emerald-200 bg-white p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] dark:border-emerald-900 dark:bg-kcs-blue-950 sm:p-8">
                <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">{familyCredentials.reset ? 'Réinitialisation terminée' : 'Identifiants générés'}</p><h3 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">{familyCredentials.reset ? `Nouvel accès de ${familyCredentials.reset.identifier}` : 'Accès de la nouvelle famille'}</h3><p className="mt-2 text-sm text-gray-500 dark:text-gray-300">{familyCredentials.reset ? 'Conservez ces informations dans un canal sûr. Le mot de passe doit être changé à la prochaine connexion.' : 'Le parent accède aux portails autorisés sauf SAVANEX. Les élèves n’accèdent ni à SAVANEX ni à EduPay.'}</p></div><button type="button" onClick={() => setFamilyCredentials(null)} className="rounded-lg border px-3 py-2 text-sm dark:text-white">Fermer</button></div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {[familyCredentials.parent, ...(familyCredentials.students || [])].filter(Boolean).map((credential: any, index: number) => <article key={`${credential.username}-${index}`} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30"><p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">{index === 0 && familyCredentials.parent ? 'Parent' : `Élève ${credential.studentId || index}`}</p><p className="mt-3 text-base font-bold text-kcs-blue-950 dark:text-white">{credential.displayName || credential.studentId || (index === 0 ? 'Parent' : 'Élève')}</p><p className="mt-3 text-sm">Identifiant : <strong>{credential.username}</strong></p><p className="mt-2 text-sm">Code d'accès : <strong>{credential.accessCode}</strong></p><p className="mt-2 text-sm">Mot de passe : <strong>{credential.temporaryPassword}</strong></p></article>)}
                </div>
              </section>
            </div>
          ), document.body)}
          {showCreateStudent && (
            <form className="mt-5 rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/30" onSubmit={(event) => {
              event.preventDefault()
              registerOfficialStudent()
            }}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-bold text-kcs-blue-900 dark:text-white">Nouvelle famille</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Même logique que SAVANEX : un parent, un ou plusieurs élèves, et les accès temporaires générés ensemble.</p>
                </div>
                <button type="button" className="w-fit rounded-lg px-3 py-1.5 text-xs font-bold text-kcs-blue-700 hover:bg-white dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800" onClick={() => setShowCreateStudent(false)}>Close</button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={newFamily.parentLastName} onChange={(event) => setNewFamily((item) => ({ ...item, parentLastName: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Nom du parent *" required />
                <input value={newFamily.parentMiddleName} onChange={(event) => setNewFamily((item) => ({ ...item, parentMiddleName: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Postnom du parent" />
                <input value={newFamily.parentFirstName} onChange={(event) => setNewFamily((item) => ({ ...item, parentFirstName: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Prenom du parent *" required />
                <input value={newFamily.parentEmail} onChange={(event) => setNewFamily((item) => ({ ...item, parentEmail: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Parent email" />
                <InternationalPhoneInput value={newFamily.parentPhone} onChange={(value) => setNewFamily((item) => ({ ...item, parentPhone: value }))} />
                <input value={newFamily.parentAddress} onChange={(event) => setNewFamily((item) => ({ ...item, parentAddress: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white md:col-span-2" placeholder="Adresse physique du parent" />
                <input value={newFamily.advisor} onChange={(event) => setNewFamily((item) => ({ ...item, advisor: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Advisor, optional" />
              </div>
              <div className="mt-4"><PhotoCaptureField label="Photo du parent" value={newFamily.parentPhotoData} onChange={parentPhotoData=>setNewFamily(item=>({...item,parentPhotoData}))} onError={setStudentNotice}/></div>
              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-kcs-blue-900 dark:text-white">Élèves liés</h4>
                  <button type="button" className="rounded-lg border border-kcs-blue-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-white dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800" onClick={() => setNewFamily((item) => ({ ...item, students: [...item.students, createAdminStudentDraft(item.students[0]?.grade, item.students[0]?.section)] }))}>Ajouter un enfant</button>
                </div>
                {newFamily.students.map((student, index) => (
                  <div key={`new-family-student-${index}`} className="rounded-xl border border-white/70 bg-white/70 p-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-700 dark:text-kcs-blue-200">Élève {index + 1}</p>
                      {newFamily.students.length > 1 ? (
                        <button type="button" className="text-xs font-bold text-red-600 dark:text-red-300" onClick={() => setNewFamily((item) => ({ ...item, students: item.students.filter((_student, studentIndex) => studentIndex !== index) }))}>Retirer</button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <PhotoCaptureField label={`Photo de l’élève ${index + 1}`} value={student.photoData} onChange={photoData => setNewFamily(item => ({ ...item, students: item.students.map((draft, studentIndex) => studentIndex === index ? { ...draft, photoData } : draft) }))} onError={setStudentNotice} />
                    </div>
                      <input value={student.lastName} onChange={(event) => setNewFamily((item) => ({ ...item, students: item.students.map((draft, studentIndex) => studentIndex === index ? { ...draft, lastName: event.target.value } : draft) }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Nom de l'eleve *" required />
                      <input value={student.middleName} onChange={(event) => setNewFamily((item) => ({ ...item, students: item.students.map((draft, studentIndex) => studentIndex === index ? { ...draft, middleName: event.target.value } : draft) }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Postnom de l'eleve" />
                      <input value={student.firstName} onChange={(event) => setNewFamily((item) => ({ ...item, students: item.students.map((draft, studentIndex) => studentIndex === index ? { ...draft, firstName: event.target.value } : draft) }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Prenom de l'eleve *" required />
                      <div className="rounded-xl border border-dashed border-kcs-blue-200 bg-kcs-blue-50 px-4 py-3 text-sm text-kcs-blue-700 dark:border-kcs-blue-700 dark:bg-kcs-blue-900/50 dark:text-kcs-blue-200"><strong>ID eleve :</strong> genere automatiquement par le systeme</div>
                      <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">Date de naissance<DateSelect value={student.dateOfBirth} onChange={(event) => setNewFamily((item) => ({ ...item, students: item.students.map((draft, studentIndex) => studentIndex === index ? { ...draft, dateOfBirth: event.target.value } : draft) }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" required /></label>
                      <input value={schoolEmailPreview(student)} readOnly className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-gray-300" placeholder="E-mail scolaire généré automatiquement : prenom.nom@ourkcs.org" />
                      <select value={student.grade} onChange={(event) => setNewFamily((item) => ({ ...item, students: item.students.map((draft, studentIndex) => studentIndex === index ? { ...draft, grade: event.target.value } : draft) }))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                        {SCHOOL_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}
                      </select>
                      <select value={student.section} onChange={(event) => setNewFamily((item) => ({ ...item, students: item.students.map((draft, studentIndex) => studentIndex === index ? { ...draft, section: event.target.value } : draft) }))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                        {CLASS_SECTIONS.map((section) => <option key={section || 'none'} value={section}>{sectionLabel(section)}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
                <button type="submit" className={`${adminButton} w-full sm:w-auto`}><UserPlus size={16} className="inline" /> Enregistrer la famille</button>
                <span className="text-xs font-semibold text-kcs-blue-700 dark:text-kcs-blue-200">Élèves prêts: {newFamily.students.filter((student) => student.lastName.trim() && student.firstName.trim()).length}</span>
              </div>
              {studentNotice && <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-950 dark:text-kcs-blue-100">{studentNotice}</p>}
            </form>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-kcs-blue-800">
            <h3 className="font-bold text-kcs-blue-900 dark:text-white">Liste officielle des élèves</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Même logique que SAVANEX : élève, ID, classe, parent responsable, statut et action.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-kcs-blue-950 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-semibold">Élève</th>
                  <th className="px-5 py-3 font-semibold">ID élève</th>
                  <th className="px-5 py-3 font-semibold">Classe</th>
                  <th className="px-5 py-3 font-semibold">Parent responsable</th>
                  <th className="px-5 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 font-semibold">Statut</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-kcs-blue-800/70">
                {filteredRoster.map((student) => (
                  <tr key={student.id} className={`transition-colors ${selectedStudent?.id === student.id ? 'bg-kcs-blue-50 dark:bg-kcs-blue-800/40' : 'hover:bg-gray-50 dark:hover:bg-kcs-blue-800/20'}`}>
                    <td className="px-5 py-4">
                      <button className="text-left" onClick={() => {
                        setSelectedStudent(student)
                        setViewingStudent(student)
                      }}>
                        <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{student.status}</p>
                      </button>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">{student.studentNumber ?? 'Non renseigné'}</td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-200">{formatClassName(student.grade, student.section) || 'Non assignée'}</td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-200">{student.parent || 'Aucun parent lié'}</td>
                    <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">
                      <p>{student.parentEmail || 'Email non renseigné'}</p>
                      <p className="mt-1">{student.parentPhone || 'Téléphone non renseigné'}</p>
                    </td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pillTone(getStudentRisk(student))}`}>{getStudentRisk(student)}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="rounded-lg border border-kcs-blue-200 px-3 py-2 text-xs font-bold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800" onClick={() => {
                          setSelectedStudent(student)
                          setViewingStudent(student)
                        }}>Voir</button>
                        <button type="button" className={`rounded-lg px-3 py-2 text-xs font-bold ${student.isEditable ? 'border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20' : 'cursor-not-allowed border border-gray-200 text-gray-400 dark:border-kcs-blue-800 dark:text-gray-500'}`} onClick={() => openEditStudent(student)}>Modifier</button>
                        <button type="button" className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-200" onClick={() => void resetEntityAccess('student', student)}>Reset accès</button>
                        <button type="button" className="rounded-lg border border-red-100 px-3 py-2 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20" onClick={() => deleteOfficialStudent(student)} aria-label={`Delete ${student.name}`}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRoster.length === 0 && (
              <div className="p-5 text-sm font-semibold text-yellow-800 dark:text-yellow-300">Aucun élève ne correspond aux filtres en cours.</div>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kcs-blue-600 dark:text-kcs-blue-300">Classement</p>
                <h3 className="mt-1 font-bold text-kcs-blue-900 dark:text-white">Groupement par classe</h3>
              </div>
              <span className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700 dark:bg-kcs-blue-800 dark:text-kcs-blue-100">{classesCovered} classes</span>
            </div>
            <div className="mt-4 space-y-3">
              {Object.entries(rosterByClass).map(([className, classStudents]) => (
                <button type="button" onClick={() => setDetailDialog({ title: className || 'Unassigned class', subtitle: 'Official class grouping', details: classStudents.map((student) => [student.name, `${student.studentNumber ?? student.id} · ${student.parent} · ${student.status}`]) })} key={className} className="w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-left transition hover:border-kcs-blue-300 hover:shadow-md dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{className || 'Non assignée'}</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{classStudents.length} élève(s)</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Familles : {Array.from(new Set(classStudents.map((student) => student.parent))).join(', ')}</p>
                  <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">{classStudents.map((student) => student.name).join(', ')}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kcs-blue-600 dark:text-kcs-blue-300">Familles</p>
                <h3 className="mt-1 font-bold text-kcs-blue-900 dark:text-white">Groupement par famille</h3>
              </div>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-200">{familiesCovered} groupes</span>
            </div>
            <div className="mt-4 space-y-3">
              {Object.entries(rosterByFamily).map(([familyName, familyStudents]) => (
                <button type="button" onClick={() => setDetailDialog({ title: familyName, subtitle: 'Official family grouping', details: familyStudents.map((student) => [student.name, `${formatClassName(student.grade, student.section)} · ${student.studentNumber ?? student.id} · ${student.status}`]) })} key={familyName} className="w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-left transition hover:border-kcs-blue-300 hover:shadow-md dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{familyName}</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{familyStudents.length} élève(s)</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Classes : {Array.from(new Set(familyStudents.map((student) => formatClassName(student.grade, student.section)))).join(', ')}</p>
                  <p className="mt-3 text-sm text-gray-700 dark:text-gray-200">{familyStudents.map((student) => student.name).join(', ')}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {viewingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Fiche élève">
            <section className="max-h-[92vh] w-full max-w-none lg:w-[80vw] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-kcs-blue-600 dark:text-kcs-blue-300">Consultation</p>
                  <h3 className="mt-2 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Fiche individuelle élève</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Identité, classe, parent responsable et suivi administratif.</p>
                </div>
                <button type="button" onClick={() => setViewingStudent(null)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-100 dark:hover:bg-kcs-blue-800">
                  <X size={16} />
                  Fermer
                </button>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ['ID élève', viewingStudent.studentNumber ?? 'Non renseigné'],
                    ['Nom complet', viewingStudent.name],
                    ['Date de naissance', viewingStudent.dateOfBirth
                      ? new Date(viewingStudent.dateOfBirth).toLocaleDateString('fr-FR', { timeZone: 'UTC' })
                      : 'Non renseignée'],
                    ['Classe', formatClassName(viewingStudent.grade, viewingStudent.section) || 'Non assignée'],
                    ['Statut', viewingStudent.status],
                    ['Parent responsable', viewingStudent.parent || 'Aucun parent lié'],
                    ['Email parent', viewingStudent.parentEmail || 'Non renseigné'],
                    ['Téléphone parent', viewingStudent.parentPhone || 'Non renseigné'],
                    ['Conseiller', viewingStudent.advisor ?? selectedInsight?.advisor ?? 'Non assigné'],
                    ['Présence', `${viewingStudent.attendance}%`],
                    ['GPA', String(viewingStudent.gpa)],
                    ['Discipline', viewingStudent.discipline],
                    ['Suivi', getStudentRisk(viewingStudent)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/45">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
                      <p className="mt-2 break-words text-sm font-semibold text-kcs-blue-900 dark:text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <aside className="rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/55">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kcs-blue-600 dark:text-kcs-blue-300">Résumé</p>
                      <h4 className="mt-2 font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{viewingStudent.name}</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{viewingStudent.studentNumber ?? 'ID non renseigné'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pillTone(getStudentRisk(viewingStudent))}`}>{getStudentRisk(viewingStudent)}</span>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-xl bg-white p-4 dark:bg-kcs-blue-900/70">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Famille</p>
                      <p className="mt-2 font-semibold text-kcs-blue-900 dark:text-white">{viewingStudent.parent || 'Aucun parent lié'}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{viewingStudent.parentEmail || 'Email non renseigné'}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{viewingStudent.parentPhone || 'Téléphone non renseigné'}</p>
                    </div>
                    <div className="rounded-xl bg-white p-4 dark:bg-kcs-blue-900/70">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Classe</p>
                      <p className="mt-2 font-semibold text-kcs-blue-900 dark:text-white">{formatClassName(viewingStudent.grade, viewingStudent.section) || 'Non assignée'}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{getDivisionForGrade(viewingStudent.grade).title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-white p-4 text-center dark:bg-kcs-blue-900/70">
                        <p className={`font-display text-xl font-bold ${scoreTone(viewingStudent.attendance, 'attendance')}`}>{viewingStudent.attendance}%</p>
                        <p className="mt-1 text-xs text-gray-400">Présence</p>
                      </div>
                      <div className="rounded-xl bg-white p-4 text-center dark:bg-kcs-blue-900/70">
                        <p className={`font-display text-xl font-bold ${scoreTone(viewingStudent.gpa, 'gpa')}`}>{viewingStudent.gpa}</p>
                        <p className="mt-1 text-xs text-gray-400">GPA</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" className="rounded-xl bg-kcs-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kcs-blue-800" onClick={() => setViewingStudent(null)}>Retour à la liste</button>
                    <button type="button" className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${viewingStudent.isEditable ? 'border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20' : 'cursor-not-allowed border border-gray-200 text-gray-400 dark:border-kcs-blue-800 dark:text-gray-500'}`} onClick={() => openEditStudent(viewingStudent)}>Modifier</button>
                    <button type="button" className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20" onClick={() => {
                      const target = viewingStudent
                      setViewingStudent(null)
                      deleteOfficialStudent(target)
                    }}>Supprimer</button>
                  </div>
                </aside>
              </div>
            </section>
          </div>
        )}

        {editingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Modifier élève">
            <section className="w-[calc(100vw-2rem)] max-w-none lg:w-[80vw] rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-kcs-blue-800 dark:bg-kcs-blue-900">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Modification</p>
                  <h3 className="mt-2 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Modifier l’élève</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Le système bloque les doublons de numéro et d’email avant d’enregistrer.</p>
                </div>
                <button type="button" onClick={() => setEditingStudent(null)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-100 dark:hover:bg-kcs-blue-800">Fermer</button>
              </div>

              <div className="space-y-4">
                <section className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40">
                  <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-700 dark:text-kcs-blue-200">Identité de l’élève</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Nom
                      <input value={studentEditForm.lastName} onChange={(event) => setStudentEditForm((current) => ({ ...current, lastName: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Nom de l’élève" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Postnom
                      <input value={studentEditForm.middleName} onChange={(event) => setStudentEditForm((current) => ({ ...current, middleName: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Postnom de l’élève" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Prénom
                      <input value={studentEditForm.firstName} onChange={(event) => setStudentEditForm((current) => ({ ...current, firstName: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Prénom de l’élève" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Date de naissance
                      <DateSelect value={studentEditForm.dateOfBirth} onChange={(event) => setStudentEditForm((current) => ({ ...current, dateOfBirth: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300 md:col-span-2">
                      Email élève
                      <input value={studentEditForm.email} onChange={(event) => setStudentEditForm((current) => ({ ...current, email: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Email élève, optionnel" />
                    </label>
                  </div>
                </section>
                <section className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40">
                  <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-700 dark:text-kcs-blue-200">Classe et dossier</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Numéro d’élève
                      <input value={studentEditForm.studentNumber} onChange={(event) => setStudentEditForm((current) => ({ ...current, studentNumber: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Numéro d’élève" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Statut
                      <select value={studentEditForm.status} onChange={(event) => setStudentEditForm((current) => ({ ...current, status: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                        {['Active', 'Inactive', 'Suspended'].map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Niveau
                      <select value={studentEditForm.grade} onChange={(event) => setStudentEditForm((current) => ({ ...current, grade: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                        {SCHOOL_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-gray-500 dark:text-gray-300">
                      Suffixe / section
                      <select value={studentEditForm.section} onChange={(event) => setStudentEditForm((current) => ({ ...current, section: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                        {CLASS_SECTIONS.map((section) => <option key={section || 'none'} value={section}>{sectionLabel(section)}</option>)}
                      </select>
                    </label>
                  </div>
                </section>
                <section className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-950/40">
                  <p className="text-xs font-bold uppercase tracking-wide text-kcs-blue-700 dark:text-kcs-blue-200">Famille liée</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-white p-3 text-sm dark:bg-kcs-blue-900/70">
                      <p className="text-xs text-gray-400">Parent responsable</p>
                      <p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{editingStudent.parent || 'Aucun parent lié'}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 text-sm dark:bg-kcs-blue-900/70">
                      <p className="text-xs text-gray-400">Téléphone</p>
                      <p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{editingStudent.parentPhone || 'Non renseigné'}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 text-sm dark:bg-kcs-blue-900/70">
                      <p className="text-xs text-gray-400">Email</p>
                      <p className="mt-1 break-words font-semibold text-kcs-blue-900 dark:text-white">{editingStudent.parentEmail || 'Non renseigné'}</p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className="rounded-xl border border-kcs-blue-900 bg-kcs-blue-800 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-kcs-blue-900/25 hover:bg-kcs-blue-950 disabled:opacity-60" onClick={() => void saveEditedStudent()} disabled={savingStudentEdit}>{savingStudentEdit ? 'Enregistrement...' : 'Enregistrer les modifications'}</button>
                <button type="button" className="rounded-xl border-2 border-amber-500 bg-amber-100 px-5 py-3 text-sm font-bold text-amber-950 shadow-sm hover:bg-amber-200 dark:border-amber-300 dark:bg-amber-400 dark:text-kcs-blue-950 dark:hover:bg-amber-300" onClick={() => setEditingStudent(null)}>Annuler</button>
              </div>
            </section>
          </div>
        )}
      </div>
    )
  }

  if (segment === 'transcripts') {
    if (!transcriptStudent) return <div>Aucun eleve reel disponible pour generer un releve de notes.</div>
    if (!officialTranscript) return <div>Le releve officiel ne peut pas encore etre genere.</div>
    return (
      <div className="space-y-6">
        <AcademicRecordsControlCenter />
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={SCHOOL_SEAL_SRC} alt={`${SCHOOL_NAME} official seal`} className="h-28 w-28 rounded-2xl border border-kcs-blue-100 bg-white p-1 object-contain shadow-md dark:border-kcs-blue-800" />
              <div>
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">{SCHOOL_NAME} Transcript Center</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Official high-school transcript generated from Grade 9-12 bulletin averages, credits, GPA, rank, and graduation status.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className={`${adminButton} w-full sm:w-auto`} onClick={() => window.print()}>Print official transcript</button>
              <button className={`${adminOutlineButton} w-full sm:w-auto`} onClick={() => setSelectedTranscriptId(grade9to12[0]?.id ?? '')}>Reset selection</button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h3 className="font-bold text-kcs-blue-900 dark:text-white">Eligible Students</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Only Grade 9 to Grade 12 students appear here because official transcripts begin in high school.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_11rem]">
                <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-kcs-blue-700 dark:bg-kcs-blue-950"><Search size={16} className="text-gray-400" /><input value={transcriptQuery} onChange={(event) => setTranscriptQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none dark:text-white" placeholder="Search by student name or ID..." /></label>
                <select value={transcriptClassFilter} onChange={(event) => setTranscriptClassFilter(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white"><option value="All">All classes</option>{transcriptClasses.map((className) => <option key={className}>{className}</option>)}</select>
              </div>
              <p className="mt-3 text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">{filteredTranscriptStudents.length} student(s) match the current criteria.</p>
            </div>
            {filteredTranscriptStudents.map((student) => {
              const transcript = transcripts.find((item) => item.student === student.name)
              const generated = buildOfficialTranscript(student)
              return (
                <button key={student.id} className={`w-full rounded-2xl border bg-white p-5 text-left transition-colors hover:border-kcs-blue-200 hover:bg-kcs-blue-50 dark:bg-kcs-blue-900/50 dark:hover:bg-kcs-blue-900 ${transcriptStudent?.id === student.id ? 'border-kcs-blue-400 ring-2 ring-kcs-blue-100 dark:border-kcs-blue-400 dark:ring-kcs-blue-900' : 'border-gray-100 dark:border-kcs-blue-800'}`} onClick={() => setSelectedTranscriptId(student.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{formatClassName(student.grade, student.section)} - {student.studentNumber ?? 'No student number'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pillTone(transcript?.status ?? generated.graduationStatus)}`}>{transcript?.status ?? generated.graduationStatus}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="font-bold text-kcs-blue-900 dark:text-white">{generated.student.gpa == null ? 'Aucune donnée' : generated.cumulativeGpa}</p><p className="text-xs text-gray-400">Cum. GPA</p></div>
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="font-bold text-kcs-blue-900 dark:text-white">{generated.totalCredits}</p><p className="text-xs text-gray-400">Credits</p></div>
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="font-bold text-kcs-blue-900 dark:text-white">{generated.student.gpa == null ? 'Aucune donnée' : `${generated.cumulativeAverage}%`}</p><p className="text-xs text-gray-400">Average</p></div>
                  </div>
                  <span className="mt-4 inline-flex w-full justify-center rounded-xl bg-kcs-gold-500 px-4 py-2.5 text-sm font-bold text-kcs-blue-950 hover:bg-kcs-gold-400">Generate transcript</span>
                </button>
              )
            })}
            {filteredTranscriptStudents.length === 0 ? <p className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-kcs-blue-700 dark:text-gray-300">No eligible student matches these criteria.</p> : null}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <img src={SCHOOL_SEAL_SRC} alt="" aria-hidden="true" className="pointer-events-none absolute right-6 top-28 hidden h-64 w-64 object-contain opacity-[0.055] sm:block" />
            <div className="border-b border-gray-100 pb-5 dark:border-kcs-blue-800">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-kcs-blue-100 bg-white p-1 shadow-md dark:border-kcs-blue-800 dark:bg-kcs-blue-950 sm:h-28 sm:w-28">
                    <img src={SCHOOL_SEAL_SRC} alt={`${SCHOOL_NAME} official seal`} className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-kcs-gold-600 dark:text-kcs-gold-300">Official Academic Transcript</p>
                    <h3 className="mt-1 font-display text-xl font-bold text-kcs-blue-900 dark:text-white sm:text-2xl">{SCHOOL_NAME}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Grade 9-12 cumulative high-school record</p>
                  </div>
                </div>
                <div className="rounded-xl bg-kcs-blue-50 p-4 text-sm dark:bg-kcs-blue-800/30">
                  <p className="font-bold text-kcs-blue-900 dark:text-white">{officialTranscript.student.name}</p>
                  <p className="mt-1 text-gray-600 dark:text-gray-300">ID: {officialTranscript.student.studentNumber ?? officialTranscript.student.id}</p>
                  <p className="text-gray-600 dark:text-gray-300">Generated: {officialTranscript.generatedAt}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {[
                ['Cumulative GPA', officialTranscript.student.gpa == null ? 'Aucune donnée' : officialTranscript.cumulativeGpa],
                ['Cumulative Average', `${officialTranscript.cumulativeAverage}%`],
                ['Credits Earned', `${officialTranscript.totalCredits}/24`],
                ['Class Standing', officialTranscript.classRank],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                  <p className="mt-1 font-bold text-kcs-blue-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-4 md:hidden">
              {officialTranscript.rows.map((year) => (
                <div key={year.grade} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{year.grade}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{year.year} - {year.status}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-kcs-blue-200">GPA {year.annualGpa}</span>
                  </div>
                  <div className="space-y-2">
                    {year.courses.map((course) => (
                      <div key={`${year.grade}-${course.course}`} className="rounded-lg bg-white p-3 text-sm dark:bg-kcs-blue-900/60">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-kcs-blue-900 dark:text-white">{course.course}</p>
                          <span className="font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{course.letter}</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Credit {course.credit} - Average {course.average}% - GPA {course.gpa}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <tr className="border-b border-gray-100 dark:border-kcs-blue-800">
                    <th className="py-3 font-semibold">Year / Grade</th>
                    <th className="py-3 font-semibold">Course</th>
                    <th className="py-3 text-right font-semibold">Credit</th>
                    <th className="py-3 text-right font-semibold">Average</th>
                    <th className="py-3 text-right font-semibold">Letter</th>
                    <th className="py-3 text-right font-semibold">GPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-kcs-blue-800/60">
                  {officialTranscript.rows.flatMap((year) => year.courses.map((course, courseIndex) => (
                    <tr key={`${year.grade}-${course.course}`}>
                      <td className="py-3 font-semibold text-kcs-blue-900 dark:text-white">{courseIndex === 0 ? `${year.year} - ${year.grade}` : ''}</td>
                      <td className="py-3 text-gray-600 dark:text-gray-300">{course.course}</td>
                      <td className="py-3 text-right text-gray-600 dark:text-gray-300">{course.credit}</td>
                      <td className="py-3 text-right font-semibold text-kcs-blue-900 dark:text-white">{course.average}%</td>
                      <td className="py-3 text-right font-semibold text-kcs-blue-900 dark:text-white">{course.letter}</td>
                      <td className="py-3 text-right text-gray-600 dark:text-gray-300">{course.gpa}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {officialTranscript.rows.map((year) => (
                <div key={year.grade} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{year.grade}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pillTone(year.status)}`}>{year.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Bulletin average: <strong>{year.average}%</strong> - Annual GPA: <strong>{year.annualGpa}</strong> - Credits: <strong>{year.credits}</strong></p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-green-100 bg-green-50 p-4 dark:border-green-900/40 dark:bg-green-900/10">
              <p className="font-semibold text-green-800 dark:text-green-300">{officialTranscript.graduationStatus}</p>
              <p className="mt-1 text-xs text-green-700 dark:text-green-400">Standard calculation: annual bulletin average to letter grade to 4.0 GPA conversion, weighted by high-school credits from Grade 9 through Grade 12.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'attendance' || segment === 'staff-attendance') return <AttendanceManagementPanel />

  if (segment === 'communications') return <ParentCommunicationPanel />

  if (segment === 'staff-attendance') {
    if (!selectedStaff) return <div>Aucune donnee reelle de presence du personnel disponible.</div>
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-bold text-kcs-blue-900 dark:text-white">Staff Attendance</h2>
            <button className={adminButton}>Export daily sheet</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {staffSeed.map((staff) => (
              <button key={staff.id} className="rounded-xl bg-gray-50 p-4 text-left transition-colors hover:bg-kcs-blue-50 dark:bg-kcs-blue-800/30 dark:hover:bg-kcs-blue-800" onClick={() => setSelectedStaff(staff)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{staff.name}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pillTone(staff.status)}`}>{staff.status}</span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{staff.role} - {staff.department} - {staff.time}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="font-bold text-kcs-blue-900 dark:text-white">Selected Staff Member</h2>
          <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
            <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{selectedStaff.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedStaff.role} - {selectedStaff.department}</p>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Arrival: {selectedStaff.time}. Status: {selectedStaff.status}.</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {['Present', 'Late', 'Absent'].map((status) => <button key={status} className={adminOutlineButton}>{status}</button>)}
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'discipline') {
    return (
      <>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Discipline Reports</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Aligned with teacher reports, parent contact, actions, and follow-up dates.</p>
            </div>
            <button className={adminButton}>Create report</button>
          </div>
          <div className="space-y-3">
            {disciplineReports.map((report) => (
              <button key={report.id} type="button" onClick={() => setDetailDialog({ title: `${report.student} - ${report.category}`, subtitle: `Discipline report · ${report.date}`, details: [['Status', report.status], ['Incident', report.incident], ['Context', report.context], ['Action taken', report.actionTaken], ['Follow-up', report.followUp], ['Parent contact', report.parentContact]] })} className="w-full rounded-xl bg-gray-50 p-4 text-left hover:bg-kcs-blue-50 dark:bg-kcs-blue-800/30 dark:hover:bg-kcs-blue-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{report.student}</p>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${pillTone(report.status)}`}>{report.status}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-kcs-blue-700 dark:text-kcs-blue-300">{report.category} - {report.date}</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{report.incident}</p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Parent contact: {report.parentContact}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Detailed Report Builder</h2>
          <div className="grid gap-3">
            <select className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              {officialRoster.map((student) => <option key={student.id}>{student.name}</option>)}
            </select>
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Incident category" />
            <textarea className="min-h-28 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Incident details, context, action taken, follow-up..." />
            <button className={adminButton}>Save discipline report</button>
          </div>
        </div>
      </div>
      {detailModal}
      </>
    )
  }

  const filteredEmployees = (sharedDirectory?.teachers || []).filter((employee) => {
    const type = String(employee.employeeType || 'teacher').toLowerCase()
    if (employeeTypeFilter !== 'all' && type !== employeeTypeFilter) return false
    const tokens = employeeQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const haystack = [employee.fullName, employee.employeeId, employee.email, employee.phone, employee.department, employee.jobTitle, employee.employeeType].filter(Boolean).join(' ').toLowerCase()
    return tokens.every((token) => haystack.includes(token))
  })

  if (segment === 'teachers' || segment === 'employees') return <EmployeesPanel />

  if (segment === 'courses') {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {subjects.map((subject) => (
          <div key={subject.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <p className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">{subject.name}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subject.className} - {subject.room}</p>
            <p className="mt-3 text-sm font-semibold text-kcs-blue-700 dark:text-kcs-blue-300">{subject.teacher}</p>
            <button className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-kcs-blue-700 hover:bg-kcs-blue-50 dark:border-kcs-blue-700 dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800">Edit course</button>
          </div>
        ))}
      </div>
    )
  }

  if (segment === 'diagnostics') {
    const pendingDiagnostics = diagnosticTests.filter((test) => diagnosticStatuses[test.id] !== 'Approved')
    return <>{detailModal}<div className="space-y-6"><div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><p className="text-xs font-bold uppercase tracking-wide text-kcs-gold-600 dark:text-kcs-gold-300">Administrator review</p><h2 className="mt-2 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Diagnostic Approval Center</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Centralized diagnostic-test reports submitted by every teacher. Approve a report only after reviewing its results and recommended follow-up.</p></div><div className="grid gap-4 md:grid-cols-3">{[['Total reports', diagnosticTests.length], ['Pending approval', pendingDiagnostics.length], ['Approved', diagnosticTests.length - pendingDiagnostics.length]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><p className="font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">{value}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>)}</div><div className="space-y-3">{diagnosticTests.map((test) => { const status = diagnosticStatuses[test.id]; return <article key={test.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><button type="button" onClick={() => setDetailDialog({ title: test.title, subtitle: `${test.subject} · ${test.className}`, details: [['Submitted by', test.teacher], ['Submitted at', test.submittedAt], ['Class mastery', test.score], ['Teacher summary', test.summary], ['Approval status', status]] })} className="text-left"><p className="font-semibold text-kcs-blue-900 dark:text-white">{test.title}</p><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{test.teacher} · {test.subject} · {test.className}</p><p className="mt-2 text-sm text-kcs-blue-700 dark:text-kcs-blue-300">{test.score}</p></button><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${pillTone(status)}`}>{status}</span>{status !== 'Approved' ? <button type="button" className={adminButton} onClick={() => setDiagnosticStatuses((items) => ({ ...items, [test.id]: 'Approved' }))}>Approve report</button> : null}</div></div></article> })}</div></div></>
  }

  if (segment === 'admissions') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Online Admissions Approval Desk</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Every online submission lands here for Super Admin approval, rejection, or conversion into the official registry.</p>
            </div>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {admissionRequests.filter((item) => item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW').length} pending decisions
            </span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {admissionRequests.map((item) => (
            <div key={item.applicationNumber} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.children.length} child{item.children.length > 1 ? 'ren' : ''}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.children.map((child) => child.gradeApplying).join(', ')} - {item.applicationNumber}</p>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${pillTone(item.status)}`}>{item.status.replace('_', ' ')}</span>
              </div>
              <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-4 text-sm dark:bg-kcs-blue-800/30">
                <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.parentName}</p>
                <p className="text-gray-500 dark:text-gray-400">{item.parentEmail} - {item.parentPhone}</p>
                {item.children.map((child, index) => <p key={index} className="text-gray-500 dark:text-gray-400">{child.lastName} {child.middleName || ''} {child.firstName} · {child.gradeApplying}</p>)}
                <p className="text-gray-500 dark:text-gray-400">Docs: {item.documents?.length ? item.documents.join(', ') : 'Pending document review'}</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button className={adminOutlineButton} onClick={() => updateAdmissionStatus(item, 'UNDER_REVIEW')}>Review</button>
                <button className={adminOutlineButton} onClick={() => updateAdmissionStatus(item, 'INTERVIEW_SCHEDULED')}>Interview</button>
                <button className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700" disabled={admissionApproving === item.id || Boolean(item.provisionedAt)} onClick={() => void approveAdmission(item)}>{item.provisionedAt ? 'Family created' : admissionApproving === item.id ? 'Creating family...' : 'Approve + create ' + item.children.length + ' child account(s)'}</button>
                <button className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700" onClick={() => updateAdmissionStatus(item, 'REJECTED')}>Refuse</button>
              </div>
            </div>
          ))}
        </div>
        {admissionNotice ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{admissionNotice}</p> : null}
        {admissionCredentials ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Family credentials">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-950">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-green-600">Family created successfully</p><h2 className="mt-1 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Institutional login credentials</h2><p className="mt-1 text-sm text-gray-500">Copy or print these one-time credentials before closing.</p></div><button type="button" onClick={() => setAdmissionCredentials(null)} className="rounded-xl border px-3 py-2 text-sm font-semibold">Close</button></div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {admissionCredentials.temporaryCredentials?.parent ? <div className="rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/40"><p className="font-bold text-kcs-blue-900 dark:text-white">Parent / family</p><p className="mt-3 text-sm">Username: <strong>{admissionCredentials.temporaryCredentials.parent.username}</strong></p><p className="text-sm">Access code: <strong>{admissionCredentials.temporaryCredentials.parent.accessCode || '—'}</strong></p><p className="text-sm">Temporary password: <strong>{admissionCredentials.temporaryCredentials.parent.temporaryPassword}</strong></p></div> : null}
                {admissionCredentials.temporaryCredentials?.students?.map((student: any, index: number) => <div key={student.studentId || index} className="rounded-2xl border border-gray-200 p-4 dark:border-kcs-blue-800"><p className="font-bold text-kcs-blue-900 dark:text-white">{student.displayName || `Child ${index + 1}`}</p><p className="mt-3 text-sm">Student ID: <strong>{student.studentId}</strong></p><p className="text-sm">Username: <strong>{student.username}</strong></p><p className="text-sm">Access code: <strong>{student.accessCode || '—'}</strong></p><p className="text-sm">Temporary password: <strong>{student.temporaryPassword}</strong></p></div>)}
              </div>
              <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm dark:bg-kcs-blue-900/40"><p className="font-semibold text-kcs-blue-900 dark:text-white">Delivery</p><p className="mt-1 text-gray-600 dark:text-gray-300">Email: {admissionCredentials.credentialDelivery?.email?.sent ? 'sent' : 'not sent'} · SMS: {admissionCredentials.credentialDelivery?.sms?.sent ? 'sent' : 'not sent'} · Dashboard notifications: created</p></div>
              <button type="button" onClick={() => window.print()} className="mt-5 rounded-xl bg-kcs-blue-700 px-5 py-3 text-sm font-bold text-white">Print credentials</button>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (segment === 'finance') {
    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    const totals = financeSummary?.totals
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-kcs-gold-600 dark:text-kcs-gold-300">EduPay source of truth</p><h2 className="mt-1 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Synchronized Finance</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{financeSummary ? `Last synchronized ${new Date(financeSummary.synchronizedAt).toLocaleString()}` : 'Loading the financial source...'}</p></div><button type="button" className={adminButton} onClick={() => void refreshEduPayFinance()} disabled={financeLoading}>{financeLoading ? 'Synchronizing...' : 'Refresh EduPay data'}</button></div>{financeSyncError ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{financeSyncError}</p> : null}</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[['Expected revenue', totals?.expectedRevenue ?? 0], ['Collected revenue', totals?.collectedRevenue ?? 0], ['Outstanding debt', totals?.outstandingDebt ?? 0], ['Reductions', totals?.totalReduction ?? 0]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{currency.format(Number(value))}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>)}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-kcs-blue-900 dark:text-white">Family finance follow-up</h3><span className="rounded-full bg-kcs-blue-50 px-3 py-1 text-xs font-bold text-kcs-blue-700 dark:bg-kcs-blue-800 dark:text-kcs-blue-200">Collection rate: {totals?.paymentCompletionRate ?? 0}%</span></div><div className="mt-4 grid gap-3 md:grid-cols-2">{financeSummary?.parentAccounts.map((account, index) => <div key={`${account.parentName}-${index}`} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="font-semibold text-kcs-blue-900 dark:text-white">{account.parentName ?? 'Parent account'}</p><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Paid {currency.format(account.totalPaid ?? 0)} · Debt {currency.format(account.totalDebt ?? 0)} · {account.studentCount ?? 0} student(s)</p></div>) ?? <p className="text-sm text-gray-500 dark:text-gray-400">No EduPay family account is available yet.</p>}</div></div>
      </div>
    )
  }

  if (segment === 'reports') {
    const reportRows = buildReportRows(reportCategory, reportCadence, officialRoster, admissionRequests)
    const reportWindow = buildReportWindow(reportCadence)
    const reportStats = [
      { label: 'Periode', value: reportCadenceLabels[reportCadence], detail: reportWindow.label, icon: CalendarDays },
      { label: 'Indicateurs', value: String(reportRows.length), detail: reportCategoryLabels[reportCategory], icon: BarChart3 },
      { label: 'Eleves a risque', value: String(officialRoster.filter((student) => getStudentRisk(student) === 'Needs action').length), detail: 'academique, presence ou discipline', icon: AlertTriangle },
      { label: 'Exports', value: 'PDF XLS CSV', detail: 'telechargement ou impression', icon: Download },
    ]

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-kcs-blue-700 dark:text-kcs-blue-300">
                <FileText size={20} />
                <span className="text-xs font-bold uppercase tracking-wide">Super Admin Reports</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">Rapports detailles exportables</h2>
              <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                Generer des rapports journaliers, hebdomadaires, mensuels ou annuels avec les donnees d'inscriptions, d'academique, d'operations, de finances, de discipline et d'alertes IA.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px]">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Frequence
                <select value={reportCadence} onChange={(event) => setReportCadence(event.target.value as AdminReportCadence)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold normal-case tracking-normal text-kcs-blue-900 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                  {Object.entries(reportCadenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Type de rapport
                <select value={reportCategory} onChange={(event) => setReportCategory(event.target.value as AdminReportCategory)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold normal-case tracking-normal text-kcs-blue-900 dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                  {Object.entries(reportCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {reportStats.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-300">
                  <Icon size={18} />
                </div>
                <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{item.value}</p>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{item.label}</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{item.detail}</p>
              </div>
            )
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-kcs-blue-900 dark:text-white">{reportCategoryLabels[reportCategory]} - {reportCadenceLabels[reportCadence]}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Periode couverte: {reportWindow.label}</p>
              </div>
              <span className="w-fit rounded-full bg-kcs-gold-100 px-3 py-1.5 text-xs font-bold text-kcs-blue-900 dark:bg-kcs-gold-900/30 dark:text-kcs-gold-200">Pret pour audit</span>
            </div>
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="min-w-full divide-y divide-gray-100 text-left text-sm dark:divide-kcs-blue-800">
                <thead className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-3 pr-4">Section</th>
                    <th className="py-3 pr-4">Indicateur</th>
                    <th className="py-3 pr-4">Valeur</th>
                    <th className="py-3 pr-4">Action recommandee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-kcs-blue-800">
                  {reportRows.map((row) => (
                    <tr key={`${row.section}-${row.metric}`}>
                      <td className="py-3 pr-4 font-semibold text-kcs-blue-900 dark:text-white">{row.section}</td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{row.metric}<p className="mt-1 text-xs text-gray-400">{row.detail}</p></td>
                      <td className="py-3 pr-4 font-display text-lg font-bold text-kcs-blue-800 dark:text-kcs-blue-200">{row.value}</td>
                      <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h3 className="font-bold text-kcs-blue-900 dark:text-white">Exporter le rapport</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Le PDF s'ouvre en impression afin de choisir "Enregistrer en PDF"; Excel et CSV sont telecharges directement.</p>
              <div className="mt-4 grid gap-3">
                <button className={`${adminButton} flex items-center justify-center gap-2`} onClick={() => exportAdminReport(reportCategory, reportCadence, 'pdf', officialRoster, admissionRequests)}>
                  <FileText size={16} /> PDF
                </button>
                <button className={`${adminOutlineButton} flex items-center justify-center gap-2`} onClick={() => exportAdminReport(reportCategory, reportCadence, 'excel', officialRoster, admissionRequests)}>
                  <FileSpreadsheet size={16} /> Excel
                </button>
                <button className={`${adminOutlineButton} flex items-center justify-center gap-2`} onClick={() => exportAdminReport(reportCategory, reportCadence, 'csv', officialRoster, admissionRequests)}>
                  <Download size={16} /> CSV
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h3 className="font-bold text-kcs-blue-900 dark:text-white">Contenu inclus</h3>
              <div className="mt-3 space-y-3">
                {['Registre officiel des eleves', 'Admissions et decisions', 'Notes, presences et risques', 'Finances, discipline et audit IA'].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30">
                    <CheckCircle2 size={16} className="mt-0.5 text-green-600 dark:text-green-300" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'news' || segment === 'media') {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">{segment === 'news' ? 'News & Events Publishing' : 'Media & Live Broadcasts'}</h2>
          <div className="space-y-3">
            {liveEventControls.map((event) => (
              <div key={event.title} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <div className="flex items-center justify-between gap-3"><p className="font-semibold text-kcs-blue-900 dark:text-white">{event.title}</p><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${event.status === 'Live now' ? 'bg-red-600 text-white' : 'bg-kcs-gold-100 text-kcs-blue-800 dark:bg-kcs-gold-900/30 dark:text-kcs-gold-300'}`}>{event.status}</span></div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{event.platform} - {event.audience}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Publish Item</h2>
          <div className="grid gap-3">
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Title" />
            <textarea className="min-h-32 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Details, audience, media notes..." />
            <button className={adminButton}>Publish</button>
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'analytics') {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-5 font-bold text-kcs-blue-900 dark:text-white">AI Analytics</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={enrollmentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
              <Area type="monotone" dataKey="students" stroke="#1d4ed8" fill="#dbeafe" strokeWidth={2.5} />
              <Area type="monotone" dataKey="applications" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {aiSignals.concat(aiRecommendations.map((item) => ({ title: item.title, detail: item.action, severity: item.impact, roles: [item.owner] }))).map((signal) => (
            <div key={`${signal.title}-${signal.severity}`} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <p className="font-semibold text-kcs-blue-900 dark:text-white">{signal.title}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{signal.detail}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (segment === 'settings') {
    return (
      <div className="space-y-6">
        <AcademicCalendarSettings />
        <AccountSettingsPanel roleLabel="Compte super administrateur" />
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Role Permissions</h2>
          <div className="space-y-3">
            {Object.entries(rolePermissions).map(([role, permissions]) => (
              <div key={role} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <p className="font-semibold capitalize text-kcs-blue-900 dark:text-white">{role === 'admin' ? 'Super Admin' : role}</p>
                <div className="mt-2 flex flex-wrap gap-2">{permissions.map((permission) => <span key={permission} className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600 dark:bg-kcs-blue-900/60 dark:text-gray-300">{permission}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Audit & Sensitive Actions</h2>
          <div className="space-y-3">
            {[...sensitiveActions.map((item) => ({ title: item.action, detail: `${item.requester} - ${item.status}`, tone: item.risk })), ...auditLogs.map((log) => ({ title: log.action, detail: `${log.actor} - ${log.target} - ${log.time}`, tone: 'Audit' }))].map((item) => (
              <div key={`${item.title}-${item.detail}`} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <div className="flex items-center justify-between gap-3"><p className="font-semibold text-kcs-blue-900 dark:text-white">{item.title}</p><span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">{item.tone}</span></div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>
    )
  }

  return <PortalSectionPanel />
}

const AdminDashboard = () => {
  const { user } = useAuthStore()
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
  const location = useLocation()
  const activeSegment = getAdminSegment(location.pathname)
  const [officialRoster, setOfficialRoster] = useState<AdminStudentRecord[]>(readStoredRoster)
  const [admissionRequests, setAdmissionRequests] = useState<AdminAdmissionRequest[]>(readStoredAdmissions)
  const [dashboardFinance, setDashboardFinance] = useState<EduPayFinanceSummary | null>(null)
  const [dashboardDirectory, setDashboardDirectory] = useState<SharedDirectoryPayload | null>(null)
  const [dashboardOverview, setDashboardOverview] = useState<any>(null)
  const [dashboardStatus, setDashboardStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [dashboardFinanceError, setDashboardFinanceError] = useState('')
  const [dashboardAction, setDashboardAction] = useState('')
  const [reportCardControl, setReportCardControl] = useState<any>(null)
  const pendingAdmissions = admissionRequests.filter((item) => item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW')
  const hasOperationalData = officialRoster.length > 0 || admissionRequests.length > 0 || Boolean(dashboardOverview)
  const dashboardEnrollmentTrend = dashboardOverview?.enrollmentTrend ?? []
  const dashboardDepartmentPerformance = dashboardOverview?.departmentPerformance ?? []
  const dashboardLiveEvents = (dashboardOverview?.events ?? []).map((event: any) => ({
    ...event,
    status: event.status === 'live' ? 'Live now' : 'Scheduled',
    audience: new Date(event.startsAt).toLocaleString(),
    nextStep: event.location || 'School event',
  }))
  const dashboardRiskAlerts = dashboardOverview?.risks ?? []
  const dashboardStaffLoad = (dashboardOverview?.teacherLoad ?? []).map((staff: any) => ({
    ...staff,
    load: String(staff.courses) + ' assigned course(s)',
    aiSupport: staff.department || 'Unassigned department',
  }))
  const dashboardRecentActivity = (dashboardOverview?.recentActivity ?? []).map((item: any) =>
    item.actor + ' · ' + item.action + ' · ' + new Date(item.createdAt).toLocaleString(),
  )
  const dashboardSystemSignals = [
    { title: 'Shared registry', severity: dashboardDirectory ? 'healthy' : 'unavailable', detail: dashboardDirectory ? 'Orbit directory synchronized.' : 'Orbit directory could not be loaded.', roles: ['admin'] },
    { title: 'EduPay finance', severity: dashboardFinanceError ? 'attention' : 'healthy', detail: dashboardFinanceError || 'Finance summary synchronized.', roles: ['admin'] },
  ]
  const dashboardSensitiveActions = [
    ...(pendingAdmissions.length ? [{ action: 'Review admission applications', requester: String(pendingAdmissions.length) + ' family file(s)', status: 'Awaiting decision', risk: 'high' }] : []),
    ...((dashboardOverview?.stats?.openIncidents ?? 0) ? [{ action: 'Review incident reports', requester: String(dashboardOverview.stats.openIncidents) + ' open report(s)', status: 'Administrative follow-up', risk: 'high' }] : []),
  ]

  const refreshDashboardFinance = async () => {
    setDashboardFinanceError('')
    try { const response = await financeAPI.getEduPaySummary(); setDashboardFinance(response.data.data as EduPayFinanceSummary) }
    catch (error: any) { setDashboardFinanceError(error?.response?.data?.message ?? 'EduPay synchronization is unavailable.') }
  }

  useEffect(() => { if (activeSegment === 'dashboard') void refreshDashboardFinance() }, [activeSegment])

  useEffect(() => {
    if (activeSegment !== 'dashboard') return
    setDashboardStatus('loading')
    void adminAPI.getOverview().then((response) => { setDashboardOverview(response.data?.data ?? null); setDashboardStatus('ready') }).catch((error: any) => { setDashboardOverview(null); setDashboardStatus('error'); setDashboardAction(error?.response?.data?.message ?? 'Unable to load the Super Admin operational overview.') })
  }, [activeSegment])

  useEffect(() => {
    void admissionsAPI.getAll()
      .then((response) => {
        const records = Array.isArray(response.data?.data) ? response.data.data : []
        const applications = records.map(apiAdmissionToAdminRequest)
        setAdmissionRequests(applications)
        saveAdmissions(applications)
      })
      .catch((error: any) => {
        setDashboardAction(error?.response?.data?.message ?? 'Unable to load online admissions from the central registry.')
      })
    void registryAPI.getDirectory()
      .then((response) => setDashboardDirectory(response.data?.data ?? null))
      .catch(() => setDashboardDirectory(null))
    void getAdminRoster()
      .then((response) => {
        const records = Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : []
        const roster = records.map(apiProfileToRosterRecord)
        setOfficialRoster(roster)
        saveRoster(roster)
      })
      .catch(() => {
      })
  }, [])

  const rejectAdmission = async (application: AdminAdmissionRequest) => {
    try {
      await admissionsAPI.updateStatus(application.id, 'REJECTED', 'Rejected by Super Administrator from the dashboard.')
      setAdmissionRequests((items) => items.map((item) => item.id === application.id ? { ...item, status: 'REJECTED' } : item))
      setDashboardAction('Application ' + application.applicationNumber + ' was rejected and saved in the central registry.')
    } catch (error: any) {
      setDashboardAction(error?.response?.data?.message ?? 'The application could not be rejected.')
    }
  }
  const openEmailAction = () => {
    const recipients = Array.from(new Set(officialRoster.map((student) => student.parentEmail).filter(Boolean))).slice(0, 40).join(',')
    window.location.href = `mailto:${recipients}?subject=${encodeURIComponent('KCS Super Admin communication')}`
    setDashboardAction('The system email composer was opened with synchronized family recipients.')
  }

  const openSmsAction = () => {
    const recipient = officialRoster.find((student) => student.parentPhone)?.parentPhone
    if (!recipient) return setDashboardAction('No synchronized family phone number is available.')
    window.location.href = `sms:${recipient}?body=${encodeURIComponent('KCS Super Admin communication: ')}`
    setDashboardAction('The SMS composer was opened for the selected synchronized family contact.')
  }

  return (
    <div className="portal-shell flex">
      <PortalSidebar />

      <main>
        <div className="portal-dashboard-topbar sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-2xl sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="portal-dashboard-title font-display text-xl font-bold leading-tight sm:text-2xl">
                {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, {user?.firstName}
              </h1>
              <p className="mt-1 text-sm font-medium text-kcs-blue-700 dark:text-kcs-blue-100">
                {new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())} - A high-level operational view of academics, admissions, staff load, and AI-driven risk monitoring.
              </p>
            </div>
            <div className="w-fit rounded-2xl border border-white/60 bg-white/65 px-4 py-2 text-sm font-semibold text-kcs-blue-800 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-kcs-blue-900/45 dark:text-kcs-blue-100">
              Live production snapshot
            </div>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {activeSegment !== 'dashboard' ? (
            <AdminSectionView
              segment={activeSegment}
              officialRoster={officialRoster}
              setOfficialRoster={setOfficialRoster}
              admissionRequests={admissionRequests}
              setAdmissionRequests={setAdmissionRequests}
            />
          ) : (
            <>
          <PortalSectionPanel />
          <SuggestionBox />
          <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-kcs-gold-600">Super Admin quick actions</p><h2 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">Communication and reporting</h2></div><div className="grid grid-cols-3 gap-2"><button type="button" onClick={openEmailAction} className={`${adminButton} flex items-center justify-center gap-2`}><Mail size={16}/> Email</button><button type="button" onClick={openSmsAction} className={`${adminButton} flex items-center justify-center gap-2`}><Phone size={16}/> SMS</button><button type="button" onClick={() => { exportAdminReport('executive', 'weekly', 'pdf', officialRoster, admissionRequests); setDashboardAction('The official weekly Super Admin report was generated.') }} className={`${adminButton} flex items-center justify-center gap-2`}><FileSpreadsheet size={16}/> Report</button></div></div>
            {dashboardAction && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">{dashboardAction}</p>}
          </section>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[
              { label: 'Official Registry', value: String(dashboardDirectory?.counts?.students ?? officialRoster.length), icon: GraduationCap, tone: 'bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-300', sub: 'students controlled by Super Admin' },
              { label: 'School Classes', value: String(new Set(officialRoster.map((student) => formatClassName(student.grade, student.section)).filter(Boolean)).size || dashboardOverview?.stats?.classes || 0), icon: BookOpen, tone: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300', sub: 'K3 to Grade 12' },
              { label: 'Parents / Families', value: String(dashboardDirectory?.counts?.families ?? 0), icon: Users, tone: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', sub: 'official responsible families' },
              { label: 'Faculty Members', value: String(dashboardDirectory?.counts?.teachers ?? 0), icon: Users, tone: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300', sub: 'employees in the shared registry' },
              { label: 'Open Applications', value: String(pendingAdmissions.length), icon: FileText, tone: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', sub: 'approval or refusal required' },
              { label: 'AI Risk Alerts', value: String(dashboardOverview?.stats?.riskAlerts ?? 0), icon: Brain, tone: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', sub: 'no active alert' },
              { label: 'Live Events', value: String(dashboardOverview?.stats?.liveEvents ?? 0), icon: Radio, tone: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', sub: 'no scheduled event' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50"
                >
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
                    <Icon size={18} />
                  </div>
                  <p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{item.value}</p>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{item.label}</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{item.sub}</p>
                </motion.div>
              )
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Enrollment and Applications Trend</h2>
                <span className="badge-blue text-xs">Rolling 8 months</span>
              </div>
              <ResponsiveContainer width="100%" height={290}>
                <AreaChart data={dashboardEnrollmentTrend}>
                  <defs>
                    <linearGradient id="studentsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="applicationsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="students" stroke="#1d4ed8" fill="url(#studentsFill)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="applications" stroke="#f59e0b" fill="url(#applicationsFill)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Department Health Score</h2>
                <span className="text-xs text-gray-400">AI synthesized</span>
              </div>
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={dashboardDepartmentPerformance} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ background: '#0f2352', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="score" fill="#1d4ed8" radius={[8, 8, 8, 8]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Event Live Broadcasts</h2>
                <Video size={18} className="text-red-500" />
              </div>
              <div className="space-y-3">
                {dashboardLiveEvents.map((event: any) => (
                  <div key={event.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{event.title}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${event.status === 'Live now' ? 'bg-red-600 text-white' : 'bg-kcs-gold-100 text-kcs-blue-800 dark:bg-kcs-gold-900/30 dark:text-kcs-gold-300'}`}>
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{event.platform} • {event.audience}</p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{event.nextStep}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Admissions Queue</h2>
                <span className="badge-gold text-xs">Priority review</span>
              </div>
              <div className="space-y-3">
                {admissionRequests.slice(0, 5).map((item) => (
                  <div key={item.applicationNumber} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.studentName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.gradeApplying} - {item.parentName}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pillTone(item.status)}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                      <Clock3 size={12} /> Submitted {new Date(item.submittedAt).toLocaleDateString()}
                    </div>
                    {(item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW') && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <a href="/admin/admissions" className="rounded-lg bg-green-600 px-3 py-2 text-center text-xs font-bold text-white">Review & approve</a>
                        <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white" onClick={() => void rejectAdmission(item)}>Refuse</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">AI Risk & Opportunity Signals</h2>
                <Brain size={18} className="text-kcs-gold-500" />
              </div>
              <div className="space-y-3">
                {dashboardRiskAlerts.map((alert: any) => (
                  <div key={alert.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{alert.title}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${alert.level === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : alert.level === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                        {alert.level}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{alert.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Teacher Load Snapshot</h2>
                <BookOpen size={18} className="text-purple-500" />
              </div>
              <div className="space-y-3">
                {dashboardStaffLoad.map((staff: any) => (
                  <div key={staff.teacher} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/20">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{staff.teacher}</p>
                      <span className="text-xs text-gray-400">{staff.load}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">AI support level</span>
                      <span className="font-semibold text-kcs-blue-600 dark:text-kcs-blue-400">{staff.aiSupport}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gradient-to-r from-kcs-blue-900 to-kcs-blue-700 p-6 text-white dark:border-kcs-blue-800">
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
              <div>
                <p className="mb-2 text-sm font-semibold text-kcs-gold-300">Operational Pulse</p>
                <h2 className="font-display text-2xl font-bold">
                  {hasOperationalData
                    ? 'Operational indicators are calculated from the current official registry.'
                    : 'No operational data is available yet. The indicators will populate after the first registrations.'}
                </h2>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                {dashboardRecentActivity.map((item: string) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-kcs-blue-100">
                    <ArrowUpRight size={16} className="mt-0.5 flex-shrink-0 text-kcs-gold-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Role Permissions Matrix</h2>
                <span className="badge-blue text-xs">Super Admin control</span>
              </div>
              <div className="space-y-3">
                {Object.entries(rolePermissions).map(([role, permissions]) => (
                  <div key={role} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold capitalize text-kcs-blue-900 dark:text-white">{role === 'admin' ? 'Super Admin' : role}</p>
                      <span className="text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">{permissions.length} permissions</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {permissions.slice(0, 5).map((permission) => (
                        <span key={permission} className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-600 dark:bg-kcs-blue-900/60 dark:text-gray-300">
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Interconnected System Signals</h2>
                <span className="badge-gold text-xs">Data driven</span>
              </div>
              <div className="space-y-3">
                {dashboardSystemSignals.map((signal) => (
                  <div key={signal.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{signal.title}</p>
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">{signal.severity}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{signal.detail}</p>
                    <p className="mt-2 text-xs text-gray-400">Visible to: {signal.roles.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Sensitive Action Approvals</h2>
                <span className="badge-gold text-xs">Super Admin only</span>
              </div>
              <div className="space-y-3">
                {dashboardSensitiveActions.map((item) => (
                  <div key={item.action} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.action}</p>
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">{item.risk}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.requester}</p>
                    <p className="mt-2 text-xs font-semibold text-kcs-blue-600 dark:text-kcs-blue-300">{item.status}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Finance Control</h2>
                <button type="button" onClick={() => void refreshDashboardFinance()} className="badge-blue text-xs">Refresh EduPay</button>
              </div>
              <div className="space-y-3">
                {dashboardFinance?.parentAccounts.slice(0, 6).map((account, index) => (
                  <button type="button" key={`${account.parentName}-${index}`} onClick={() => setDashboardAction(`${account.parentName ?? 'Family account'}: paid ${currency.format(account.totalPaid ?? 0)}, outstanding ${currency.format(account.totalDebt ?? 0)}.`)} className="w-full rounded-xl bg-gray-50 p-4 text-left transition hover:bg-kcs-blue-50 dark:bg-kcs-blue-800/30 dark:hover:bg-kcs-blue-800/60">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{account.parentName ?? 'Family account'}</p>
                      <span className="text-sm font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{currency.format(account.totalDebt ?? 0)}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">EduPay synchronized • Paid {currency.format(account.totalPaid ?? 0)} • {account.studentCount ?? 0} student(s)</p>
                  </button>
                )) ?? <p className="text-sm text-gray-500 dark:text-gray-400">Loading synchronized EduPay accounts...</p>}
                {dashboardFinanceError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{dashboardFinanceError}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Report Cards & Transcripts</h2>
                <span className="badge-gold text-xs">Principal workflow</span>
              </div>
              <div className="space-y-3">
                {([] as any[]).slice(0, 6).map((item: any) => (
                  <button type="button" onClick={() => setReportCardControl(item)} key={`${item.student}-${item.term ?? item.years}`} className="w-full rounded-xl bg-gray-50 p-4 text-left transition hover:bg-kcs-gold-50 dark:bg-kcs-blue-800/30 dark:hover:bg-kcs-blue-800/60">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.student}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {item.term ?? item.years} • {item.principalStatus ?? item.status}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Interdependence Engine</h2>
                <span className="badge-blue text-xs">Notifications and RBAC</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {communicationFlows.map((flow) => (
                  <div key={flow.trigger} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/30">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{flow.trigger}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{flow.update}</p>
                    <p className="mt-2 text-xs text-gray-400">Recipients: {flow.recipients.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">AI Governance</h2>
                <span className="badge-gold text-xs">Usage and recommendations</span>
              </div>
              <div className="space-y-3">
                {aiRecommendations.map((item) => (
                  <div key={`${item.owner}-${item.title}`} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.owner}: {item.title}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{item.action}</p>
                    <p className="mt-2 text-xs font-semibold text-kcs-gold-600 dark:text-kcs-gold-300">{item.impact}</p>
                  </div>
                ))}
                {financeReadiness.slice(1).map((item) => (
                  <div key={item.feature} className="rounded-xl border border-green-100 bg-green-50 p-4 dark:border-green-900/30 dark:bg-green-900/10">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">{item.feature}</p>
                    <p className="mt-1 text-xs text-green-700 dark:text-green-400">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Student Risk Control</h2>
              <div className="space-y-3">
                {officialRoster.slice(0, 6).map((student) => (
                  <div key={student.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${pillTone(student.discipline)}`}>{student.discipline}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{formatClassName(student.grade, student.section)} - GPA {student.gpa} - attendance {student.attendance}% - parent: {student.parent}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Staff Operations</h2>
              <div className="space-y-3">
                {staffOperations.map((item) => (
                  <div key={item.function} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.function}</p>
                      <span className="font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{item.value}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.metric} • {item.status}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Sensitive Audit Logs</h2>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={`${log.actor}-${log.time}`} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{log.action}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{log.actor} • {log.target}</p>
                    <p className="mt-1 text-xs text-gray-400">{log.time}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Schedule Conflict Control</h2>
              <span className="badge-blue text-xs">Teacher • room • class timetable</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {scheduleConflicts.map((conflict) => (
                <div key={conflict.title} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{conflict.title}</p>
                    <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">{conflict.severity}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{conflict.detail}</p>
                  <p className="mt-2 text-xs text-gray-400">Notify: {conflict.affected.join(', ')}</p>
                </div>
              ))}
            </div>
          </div>
          {reportCardControl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-kcs-blue-950/65 p-4" role="dialog" aria-modal="true" aria-label="Report card control">
              <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-kcs-blue-900">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs font-bold uppercase tracking-wide text-kcs-gold-600">Super Admin report card control</p><h2 className="mt-1 text-xl font-bold text-kcs-blue-900 dark:text-white">{reportCardControl.student}</h2></div>
                  <button type="button" onClick={() => setReportCardControl(null)} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-kcs-blue-800" aria-label="Close"><X size={18}/></button>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="text-xs text-gray-400">Academic period</p><p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{reportCardControl.term ?? reportCardControl.years}</p></div>
                  <div className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="text-xs text-gray-400">Workflow status</p><p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{reportCardControl.principalStatus ?? reportCardControl.status}</p></div>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => { exportAdminReport('academic', 'monthly', 'pdf', officialRoster.filter((student) => student.name === reportCardControl.student), admissionRequests); setDashboardAction(`Academic document generated for ${reportCardControl.student}.`) }} className={adminButton}><Download size={16}/> Download</button>
                  <button type="button" onClick={() => { setDashboardAction(`${reportCardControl.student}'s academic document was approved for publication.`); setReportCardControl(null) }} className={adminButton}><CheckCircle2 size={16}/> Approve and publish</button>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard
