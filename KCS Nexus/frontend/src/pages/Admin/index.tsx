import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowUpRight, BookOpen, Brain,
  AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock3, Download, FileSpreadsheet, FileText, GraduationCap, Mail, Megaphone, MessageSquare, Phone, Radio, Search, Shield, Trash2, UserPlus, Users, Video
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts'
import PortalSidebar from '@/components/layout/PortalSidebar'
import PortalSectionPanel from '@/components/shared/PortalSectionPanel'
import { useAuthStore } from '@/store/authStore'
import { studentsAPI } from '@/services/api'
import { SCHOOL_DIVISIONS, SCHOOL_LEVELS } from '@/constants/schoolLevels'
import { getAssetUrl } from '@/utils/assets'
import {
  aiRecommendations,
  aiSignals,
  announcements,
  attendance,
  auditLogs,
  communicationFlows,
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

const enrollmentTrend = [
  { month: 'Sep', students: 472, applications: 68 },
  { month: 'Oct', students: 478, applications: 74 },
  { month: 'Nov', students: 481, applications: 71 },
  { month: 'Dec', students: 483, applications: 79 },
  { month: 'Jan', students: 489, applications: 83 },
  { month: 'Feb', students: 496, applications: 91 },
  { month: 'Mar', students: 503, applications: 96 },
  { month: 'Apr', students: 511, applications: 102 },
]

const departmentPerformance = [
  { name: 'Elementary', score: 91 },
  { name: 'Middle', score: 88 },
  { name: 'High', score: 93 },
  { name: 'Admissions', score: 84 },
  { name: 'Support', score: 89 },
]

const admissionsQueue = [
  { name: 'Amani M.', grade: 'Grade 6', status: 'Interview Scheduled', date: 'Apr 22' },
  { name: 'Lydia T.', grade: 'Grade 10', status: 'Under Review', date: 'Apr 21' },
  { name: 'Joel B.', grade: 'Grade 2', status: 'Documents Missing', date: 'Apr 20' },
  { name: 'Nathan S.', grade: 'Grade 11', status: 'Accepted', date: 'Apr 18' },
]

const riskAlerts = [
  { title: 'Attendance risk cluster', description: '7 students in Grade 8 crossed the 85% threshold this month.', level: 'high' },
  { title: 'Admissions response time', description: 'Average review cycle slipped to 6.2 days. Goal is under 5 days.', level: 'medium' },
  { title: 'Teacher capacity opportunity', description: 'High school math section demand suggests adding one more instructor next term.', level: 'positive' },
]

const staffLoad = [
  { teacher: 'Dr. Mukendi', load: '5 sections', aiSupport: 'High' },
  { teacher: 'Mrs. Diallo', load: '4 sections', aiSupport: 'Medium' },
  { teacher: 'Mr. Belanger', load: '5 sections', aiSupport: 'Medium' },
  { teacher: 'Mrs. Nkosi', load: '3 sections', aiSupport: 'Low' },
]

const recentActivity = [
  '24 new admission documents uploaded this week.',
  'AI tutor sessions increased by 38% among Grade 11 students.',
  'Parent conference booking reached 82% completion.',
  'News post on science fair produced 1,240 page views in 48 hours.',
]

const SCHOOL_NAME = 'Kinshasa Christian School'

const SCHOOL_LOGO_SRC = getAssetUrl('images/kcs-logo.png')
const SCHOOL_SEAL_SRC = getAssetUrl('images/kcs.jpg')

const liveEventControls = [
  { title: 'Spring Arts Festival', status: 'Live now', platform: 'YouTube Live', audience: '312 viewers', nextStep: 'Monitor comments and stream health' },
  { title: 'Annual Sports Day', status: 'Scheduled', platform: 'KCS Live', audience: 'May 10, 8:00 AM', nextStep: 'Confirm camera crew and field audio' },
  { title: 'Graduation Ceremony 2026', status: 'Scheduled', platform: 'YouTube Live', audience: 'Jun 8, 4:00 PM', nextStep: 'Publish family access link' },
]

const adminRosterSeed = [
  { id: 'adm-001', name: 'Anne Itela Mouyeke', grade: 'Grade 11', section: 'A', parent: 'Beatrice Itela', parentEmail: 'beatrice.itela@kcs.test', parentPhone: '+243 810 100 001', status: 'Active', gpa: 3.7, attendance: 94, discipline: 'Clear' },
  { id: 'adm-002', name: 'Assimbo Loango Grace', grade: 'Grade 11', section: 'A', parent: 'Moise Loango', parentEmail: 'moise.loango@kcs.test', parentPhone: '+243 810 100 002', status: 'Active', gpa: 3.5, attendance: 92, discipline: 'Monitored' },
  { id: 'adm-003', name: 'Beni Amisi Ali', grade: 'Grade 9', section: 'B', parent: 'Sarah Amisi', parentEmail: 'sarah.amisi@kcs.test', parentPhone: '+243 810 100 003', status: 'Active', gpa: 3.1, attendance: 88, discipline: 'Open' },
  { id: 'adm-004', name: 'Daniella Sambu', grade: 'Grade 10', section: 'A', parent: 'Joel Sambu', parentEmail: 'joel.sambu@kcs.test', parentPhone: '+243 810 100 004', status: 'Active', gpa: 3.8, attendance: 96, discipline: 'Clear' },
  { id: 'adm-005', name: 'Eliane Kazadi Mbuyi', grade: 'Grade 12', section: 'A', parent: 'Rachel Kazadi', parentEmail: 'rachel.kazadi@kcs.test', parentPhone: '+243 810 100 005', status: 'Graduation track', gpa: 3.9, attendance: 97, discipline: 'Clear' },
  ...students.map((student, index) => ({
    id: student.id,
    name: student.name,
    grade: student.grade,
    section: student.section,
    parent: student.parentId === 'parent-kabongo' ? 'Rachel Kabongo' : 'Parent record pending',
    parentEmail: `${student.name.toLowerCase().replace(/\s+/g, '.')}@family.kcs.test`,
    parentPhone: `+243 810 200 00${index + 1}`,
    status: 'Active',
    gpa: student.gpa,
    attendance: student.attendance,
    discipline: student.risk === 'low' ? 'Clear' : 'Monitored',
  })),
]

type AdminStudentRecord = {
  id: string
  name: string
  studentNumber?: string
  grade: string
  section: string
  parent: string
  parentEmail: string
  parentPhone: string
  status: string
  gpa: number
  attendance: number
  discipline: string
  advisor?: string
}

type AdminAdmissionRequest = {
  id: string
  applicationNumber: string
  studentName: string
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
}

const ADMIN_ADMISSIONS_STORAGE_KEY = 'kcs-admin-admission-submissions'
const ADMIN_ROSTER_STORAGE_KEY = 'kcs-admin-official-roster'
const CLASS_SECTIONS = ['', 'A', 'B', 'C', 'D'] as const

const formatClassName = (grade: string, section?: string) => [grade, section].filter(Boolean).join(' ')

const splitClassName = (className: string) => {
  const match = className.match(/^(.*?)(?:\s([A-D]))?$/)
  return {
    grade: match?.[1] || className,
    section: match?.[2] || '',
  }
}

const sectionLabel = (section?: string) => section || 'No section'

const getDivisionForGrade = (grade: string) => {
  return SCHOOL_DIVISIONS.find((division) => {
    if (division.id === 'kindergarten') return ['K1', 'K2', 'K3', 'K4', 'K5', 'Kindergarten'].includes(grade)
    if (division.id === 'elementary') return ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'].includes(grade)
    if (division.id === 'middle') return ['Grade 6', 'Grade 7', 'Grade 8'].includes(grade)
    return ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].includes(grade)
  }) ?? SCHOOL_DIVISIONS[0]
}

const scoreTone = (value: number, type: 'gpa' | 'attendance') => {
  const threshold = type === 'gpa' ? [2.5, 3.3] : [88, 94]
  if (value < threshold[0]) return 'text-red-700 dark:text-red-300'
  if (value < threshold[1]) return 'text-yellow-700 dark:text-yellow-300'
  return 'text-green-700 dark:text-green-300'
}

const getStudentRisk = (student: AdminStudentRecord) => {
  if (student.attendance < 88 || student.gpa < 2.5 || ['Open', 'Monitored'].includes(student.discipline)) return 'Needs action'
  if (student.attendance < 94 || student.gpa < 3.2) return 'Watch'
  return 'On track'
}

const apiProfileToRosterRecord = (profile: any): AdminStudentRecord => {
  const parentLink = profile.parentLinks?.[0]
  const parent = parentLink?.parent
  const fullName = [profile.user?.firstName, profile.user?.lastName].filter(Boolean).join(' ') || profile.studentNumber || 'Unnamed student'
  return {
    id: profile.id,
    name: fullName,
    studentNumber: profile.studentNumber,
    grade: profile.grade,
    section: profile.section ?? '',
    parent: parent ? [parent.firstName, parent.lastName].filter(Boolean).join(' ') : 'Parent record pending',
    parentEmail: parent?.email ?? `${fullName.toLowerCase().replace(/\W+/g, '.')}@family.kcs.test`,
    parentPhone: parent?.phone ?? '+243 810 000 000',
    status: profile.status === 'active' ? 'Active' : profile.status,
    gpa: Number(profile.gpa ?? 0),
    attendance: Number(profile.attendanceRate ?? 100),
    discipline: 'Clear',
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
  const gradeOrder = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']
  const currentIndex = Math.max(0, gradeOrder.indexOf(student.grade))
  const baseline = Math.round((student.gpa || 3.0) * 25)
  const rows = gradeOrder.map((grade, gradeIndex) => {
    const publishedReport = reportCards.find((item) => item.student === student.name && gradeIndex === currentIndex)
    const yearlyAverage = Math.max(58, Math.min(99, Math.round(publishedReport?.average ?? baseline - (currentIndex - gradeIndex) * 2 + (student.attendance >= 94 ? 1 : -1))))
    const credits = gradeIndex <= currentIndex ? 6 : 0
    const courses = transcriptCoursePlan[grade as keyof typeof transcriptCoursePlan].map((course, courseIndex) => {
      const courseAverage = Math.max(55, Math.min(100, yearlyAverage + ((courseIndex % 3) - 1) * 3))
      return {
        course,
        credit: gradeIndex <= currentIndex ? 1 : 0,
        average: courseAverage,
        letter: letterFromAverage(courseAverage),
        gpa: gpaFromAverage(courseAverage),
      }
    })
    return {
      grade,
      year: `${2022 + gradeIndex}-${2023 + gradeIndex}`,
      courses,
      credits,
      average: yearlyAverage,
      annualGpa: gpaFromAverage(yearlyAverage),
      status: gradeIndex <= currentIndex ? 'Completed' : 'Projected',
    }
  })
  const earnedRows = rows.filter((row) => row.credits > 0)
  const totalCredits = earnedRows.reduce((sum, row) => sum + row.credits, 0)
  const cumulativeGpa = totalCredits
    ? Number((earnedRows.reduce((sum, row) => sum + row.annualGpa * row.credits, 0) / totalCredits).toFixed(2))
    : 0
  const cumulativeAverage = earnedRows.length
    ? Math.round(earnedRows.reduce((sum, row) => sum + row.average, 0) / earnedRows.length)
    : 0
  return {
    student,
    rows,
    totalCredits,
    cumulativeGpa,
    cumulativeAverage,
    classRank: student.gpa >= 3.7 ? 'Top 10%' : student.gpa >= 3.2 ? 'Upper half' : 'In progress',
    generatedAt: new Date().toLocaleDateString(),
    graduationStatus: totalCredits >= 24 ? 'Graduation requirement met' : `${24 - totalCredits} credits remaining`,
  }
}

const admissionSeed: AdminAdmissionRequest[] = admissionsQueue.map((item, index) => ({
  id: `seed-adm-${index + 1}`,
  applicationNumber: `KCS-SEED-${index + 1}`,
  studentName: item.name,
  firstName: item.name.split(' ')[0] ?? item.name,
  lastName: item.name.split(' ').slice(1).join(' ') || 'Applicant',
  dateOfBirth: '2012-01-01',
  nationality: 'Congolese',
  gradeApplying: item.grade,
  previousSchool: 'Previous school pending verification',
  languages: 'English, French',
  parentName: `${item.name.split(' ')[0]} Parent`,
  parentEmail: `${item.name.toLowerCase().replace(/\W+/g, '.')}@family.kcs.test`,
  parentPhone: `+243 810 300 00${index + 1}`,
  relationship: 'Guardian',
  address: 'Kinshasa, DRC',
  occupation: 'Pending',
  notes: 'Seed application available for Super Admin workflow preview.',
  documents: ['Application form', 'Transcript'],
  status: item.status === 'Accepted' ? 'ACCEPTED' : item.status === 'Under Review' ? 'UNDER_REVIEW' : 'SUBMITTED',
  submittedAt: new Date(2026, 3, 22 - index).toISOString(),
}))

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
  if (typeof window === 'undefined') return adminRosterSeed
  try {
    const stored = JSON.parse(window.localStorage.getItem(ADMIN_ROSTER_STORAGE_KEY) || '[]') as AdminStudentRecord[]
    return stored.length ? stored : adminRosterSeed
  } catch {
    return adminRosterSeed
  }
}

const saveAdmissions = (items: AdminAdmissionRequest[]) => {
  if (typeof window !== 'undefined') window.localStorage.setItem(ADMIN_ADMISSIONS_STORAGE_KEY, JSON.stringify(items))
}

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
  attendance: 100,
  discipline: 'Clear',
})

const staffSeed = [
  { id: 'staff-001', name: 'Dr. Mukendi', role: 'Science Teacher', department: 'High School', status: 'Present', time: '7:12 AM' },
  { id: 'staff-002', name: 'Mrs. Diallo', role: 'English Teacher', department: 'High School', status: 'Present', time: '7:18 AM' },
  { id: 'staff-003', name: 'Mr. Belanger', role: 'Math Teacher', department: 'Middle School', status: 'Late', time: '7:51 AM' },
  { id: 'staff-004', name: 'Registrar Office', role: 'Registrar', department: 'Administration', status: 'Present', time: '7:05 AM' },
  { id: 'staff-005', name: 'Discipline Office', role: 'Discipline Lead', department: 'Student Life', status: 'Absent', time: '-' },
]

const getAdminSegment = (pathname: string) => {
  const segment = pathname.split('/').filter(Boolean).at(-1)
  return !segment || segment === 'admin' || segment === 'dashboard' ? 'dashboard' : segment
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
  const averageAttendance = Math.round(officialRoster.reduce((sum, student) => sum + student.attendance, 0) / Math.max(officialRoster.length, 1))
  const averageGpa = (officialRoster.reduce((sum, student) => sum + student.gpa, 0) / Math.max(officialRoster.length, 1)).toFixed(2)
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
      { section: 'Academique', metric: 'GPA moyen', value: averageGpa, detail: `Moyenne academique globale calculee sur ${officialRoster.length} dossiers.`, action: 'Examiner les classes et matieres sous la moyenne.' },
      { section: 'Academique', metric: 'Assiduite moyenne', value: `${averageAttendance}%`, detail: `Presence moyenne pour le rapport ${cadenceNote}.`, action: 'Declencher un suivi parent pour les presences inferieures a 88%.' },
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
  const [selectedStudent, setSelectedStudent] = useState(officialRoster[0] ?? adminRosterSeed[0])
  const [selectedStaff, setSelectedStaff] = useState(staffSeed[0])
  const [sentNotice, setSentNotice] = useState('')
  const [studentQuery, setStudentQuery] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('All')
  const [gradeFilter, setGradeFilter] = useState('All')
  const [classFilter, setClassFilter] = useState('All')
  const [studentNotice, setStudentNotice] = useState('')
  const [apiSynced, setApiSynced] = useState(false)
  const [showCreateStudent, setShowCreateStudent] = useState(false)
  const [selectedTranscriptId, setSelectedTranscriptId] = useState('')
  const [reportCadence, setReportCadence] = useState<AdminReportCadence>('weekly')
  const [reportCategory, setReportCategory] = useState<AdminReportCategory>('executive')
  const [newStudent, setNewStudent] = useState({
    name: '',
    studentNumber: '',
    grade: 'Grade 1',
    section: '',
    parent: '',
    parentEmail: '',
    parentPhone: '',
    advisor: '',
  })

  useEffect(() => {
    let mounted = true
    studentsAPI.getAll()
      .then((response) => {
        const profiles = response.data?.data
        if (!mounted || !Array.isArray(profiles) || profiles.length === 0) return
        const apiRoster = profiles.map(apiProfileToRosterRecord)
        setOfficialRoster(apiRoster)
        saveRoster(apiRoster)
        setSelectedStudent(apiRoster[0])
        setApiSynced(true)
      })
      .catch(() => setApiSynced(false))
    return () => {
      mounted = false
    }
  }, [setOfficialRoster])

  const registerOfficialStudent = async () => {
    if (!newStudent.name.trim() || !newStudent.parent.trim()) {
      setStudentNotice('Student and parent names are required before creating the record.')
      return
    }
    const [firstName, ...lastParts] = newStudent.name.trim().split(/\s+/)
    const [parentFirst, ...parentLastParts] = newStudent.parent.trim().split(/\s+/)
    const studentNumber = newStudent.studentNumber.trim() || `KCS-${newStudent.grade.replace(/\D/g, '').padStart(2, '0') || '00'}-${Date.now().toString().slice(-4)}`
    const record: AdminStudentRecord = {
      id: `manual-${Date.now()}`,
      name: newStudent.name.trim(),
      studentNumber,
      grade: newStudent.grade,
      section: newStudent.section,
      parent: newStudent.parent.trim(),
      parentEmail: newStudent.parentEmail.trim() || `${newStudent.parent.toLowerCase().replace(/\W+/g, '.')}@family.kcs.test`,
      parentPhone: newStudent.parentPhone.trim() || '+243 810 000 000',
      status: 'Active',
      gpa: 0,
      attendance: 100,
      discipline: 'Clear',
      advisor: newStudent.advisor.trim() || 'Advisor pending',
    }
    let finalRecord = record
    try {
      const response = await studentsAPI.create({
        student: {
          firstName,
          lastName: lastParts.join(' ') || 'Student',
          studentNumber,
          grade: newStudent.grade,
          section: newStudent.section,
          email: `${studentNumber.toLowerCase()}@students.kcs.local`,
        },
        parent: {
          firstName: parentFirst,
          lastName: parentLastParts.join(' ') || 'Guardian',
          email: record.parentEmail,
          phone: record.parentPhone,
          relationship: 'Parent',
        },
      })
      const profile = response.data?.data?.student?.studentProfile ?? response.data?.data
      if (profile?.id) finalRecord = apiProfileToRosterRecord(profile)
      setApiSynced(true)
      setStudentNotice('Official student record created and synced with the school API.')
    } catch {
      setStudentNotice('Student created locally. It will sync when the school API is available.')
    }
    setOfficialRoster((items) => {
      const next = [finalRecord, ...items.filter((item) => item.studentNumber !== finalRecord.studentNumber)]
      saveRoster(next)
      return next
    })
    setSelectedStudent(finalRecord)
    setDivisionFilter(getDivisionForGrade(finalRecord.grade).id)
    setGradeFilter(finalRecord.grade)
    setClassFilter(formatClassName(finalRecord.grade, finalRecord.section))
    setNewStudent({ name: '', studentNumber: '', grade: 'Grade 1', section: '', parent: '', parentEmail: '', parentPhone: '', advisor: '' })
  }

  const deleteOfficialStudent = async (student: AdminStudentRecord) => {
    const confirmed = window.confirm(`Delete ${student.name} from the official roster?`)
    if (!confirmed) return
    try {
      await studentsAPI.delete(student.id)
      setStudentNotice(`${student.name} was removed from the school API and the Super Admin roster.`)
    } catch {
      setStudentNotice(`${student.name} was removed locally. API deletion will need to run when the server is available.`)
    }
    setOfficialRoster((items) => {
      const next = items.filter((item) => item.id !== student.id)
      saveRoster(next)
      setSelectedStudent(next[0] ?? adminRosterSeed[0])
      return next
    })
  }

  const openCreateStudentForm = () => {
    if (classFilter !== 'All') {
      const { grade, section } = splitClassName(classFilter)
      setNewStudent((item) => ({ ...item, grade, section }))
    } else if (gradeFilter !== 'All') {
      setNewStudent((item) => ({ ...item, grade: gradeFilter }))
    } else if (divisionFilter !== 'All') {
      const division = SCHOOL_DIVISIONS.find((item) => item.id === divisionFilter)
      const firstGrade = division?.id === 'kindergarten' ? 'K1' : division?.id === 'elementary' ? 'Grade 1' : division?.id === 'middle' ? 'Grade 6' : division?.id === 'high' ? 'Grade 9' : 'Grade 1'
      setNewStudent((item) => ({ ...item, grade: firstGrade }))
    }
    setShowCreateStudent((value) => !value)
  }

  const updateAdmissionStatus = (application: AdminAdmissionRequest, status: AdminAdmissionRequest['status']) => {
    setAdmissionRequests((items) => {
      const next = items.map((item) => item.applicationNumber === application.applicationNumber ? { ...item, status } : item)
      saveAdmissions(next)
      return next
    })

    if (status === 'ACCEPTED') {
      const approvedStudent = createStudentFromAdmission({ ...application, status })
      setOfficialRoster((items) => {
        if (items.some((item) => item.id === approvedStudent.id || item.name === approvedStudent.name)) return items
        const next = [approvedStudent, ...items]
        saveRoster(next)
        return next
      })
      setSelectedStudent(approvedStudent)
    }
  }

  const grade9to12 = useMemo(
    () => officialRoster.filter((student) => ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].includes(student.grade)),
    [officialRoster]
  )

  const transcriptStudent = grade9to12.find((student) => student.id === selectedTranscriptId) ?? grade9to12[0] ?? officialRoster[0]
  const officialTranscript = buildOfficialTranscript(transcriptStudent)

  const filteredRoster = useMemo(() => {
    const query = studentQuery.trim().toLowerCase()
    return officialRoster
      .filter((student) => divisionFilter === 'All' || getDivisionForGrade(student.grade).id === divisionFilter)
      .filter((student) => gradeFilter === 'All' || student.grade === gradeFilter)
      .filter((student) => classFilter === 'All' || formatClassName(student.grade, student.section) === classFilter)
      .filter((student) => {
        if (!query) return true
        return [student.name, student.studentNumber, student.grade, student.section, student.parent, student.parentEmail]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      })
      .sort((a, b) => SCHOOL_LEVELS.indexOf(a.grade as any) - SCHOOL_LEVELS.indexOf(b.grade as any) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name))
  }, [classFilter, divisionFilter, gradeFilter, officialRoster, studentQuery])

  const classDirectory = useMemo(() => {
    const classes = officialRoster
      .filter((student) => divisionFilter === 'All' || getDivisionForGrade(student.grade).id === divisionFilter)
      .filter((student) => gradeFilter === 'All' || student.grade === gradeFilter)
      .map((student) => formatClassName(student.grade, student.section))
    return Array.from(new Set(classes)).sort((a, b) => {
      const { grade: gradeA, section: sectionA } = splitClassName(a)
      const { grade: gradeB, section: sectionB } = splitClassName(b)
      return SCHOOL_LEVELS.indexOf(gradeA as any) - SCHOOL_LEVELS.indexOf(gradeB as any) || sectionA.localeCompare(sectionB)
    })
  }, [divisionFilter, gradeFilter, officialRoster])

  const rosterByClass = useMemo(() => {
    return filteredRoster.reduce<Record<string, AdminStudentRecord[]>>((groups, student) => {
      const key = formatClassName(student.grade, student.section)
      groups[key] = [...(groups[key] ?? []), student]
      return groups
    }, {})
  }, [filteredRoster])

  const divisionSummary = useMemo(() => {
    return SCHOOL_DIVISIONS.map((division) => {
      const divisionStudents = officialRoster.filter((student) => getDivisionForGrade(student.grade).id === division.id)
      const averageAttendance = divisionStudents.length
        ? Math.round(divisionStudents.reduce((sum, student) => sum + student.attendance, 0) / divisionStudents.length)
        : 0
      return { ...division, students: divisionStudents.length, averageAttendance }
    })
  }, [officialRoster])

  const selectedTrend = useMemo(() => {
    const knownTrend = performanceTrend.map((item) => {
      const exact = item[selectedStudent.name.split(' ')[0] as keyof typeof item]
      if (typeof exact === 'number') return { month: item.month, score: exact }
      const baseline = Math.round((selectedStudent.gpa || 2.8) * 25)
      const monthIndex = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].indexOf(item.month)
      return { month: item.month, score: Math.max(55, Math.min(99, baseline - 5 + monthIndex + (selectedStudent.attendance >= 94 ? 2 : -2))) }
    })
    return knownTrend
  }, [selectedStudent])

  const selectedGrades = grades.filter((grade) => grade.studentId === selectedStudent.id || selectedStudent.name.includes('Elise') && grade.studentId === 'stu-elise' || selectedStudent.name.includes('David') && grade.studentId === 'stu-david')
  const selectedAttendanceEvents = attendance.filter((item) => item.studentId === selectedStudent.id || selectedStudent.name.includes('Elise') && item.studentId === 'stu-elise' || selectedStudent.name.includes('David') && item.studentId === 'stu-david')
  const selectedDiscipline = disciplineReports.find((item) => item.studentId === selectedStudent.id || item.student === selectedStudent.name)
  const selectedInsight = students.find((item) => item.id === selectedStudent.id || item.name === selectedStudent.name)

  if (segment === 'students') {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {divisionSummary.map((division) => (
            <button key={division.id} className={`rounded-2xl border bg-white p-4 text-left transition-colors hover:border-kcs-blue-200 hover:bg-kcs-blue-50 dark:bg-kcs-blue-900/50 dark:hover:bg-kcs-blue-900 ${divisionFilter === division.id ? 'border-kcs-blue-400 ring-2 ring-kcs-blue-100 dark:border-kcs-blue-400 dark:ring-kcs-blue-900' : 'border-gray-100 dark:border-kcs-blue-800'}`} onClick={() => {
              setDivisionFilter(division.id)
              setGradeFilter('All')
              setClassFilter('All')
            }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{division.levels}</p>
                <GraduationCap size={17} className="text-kcs-blue-600 dark:text-kcs-blue-300" />
              </div>
              <p className="mt-2 font-display text-lg font-bold text-kcs-blue-900 dark:text-white">{division.title}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="text-lg font-bold text-kcs-blue-900 dark:text-white">{division.students}</p><p className="text-xs text-gray-500 dark:text-gray-400">students</p></div>
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="text-lg font-bold text-kcs-blue-900 dark:text-white">{division.averageAttendance}%</p><p className="text-xs text-gray-500 dark:text-gray-400">attendance</p></div>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-kcs-blue-100 bg-white p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-bold text-kcs-blue-900 dark:text-white">Student Actions</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Create, delete, filter by division, then open any class to inspect students one by one.</p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className={`${adminButton} w-full sm:w-auto`} onClick={openCreateStudentForm}><UserPlus size={16} className="inline" /> Create student</button>
              <button className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 sm:w-auto" onClick={() => deleteOfficialStudent(selectedStudent)}><Trash2 size={16} className="inline" /> Delete selected</button>
              <button className={`${adminOutlineButton} w-full sm:w-auto`} onClick={() => {
                setDivisionFilter('All')
                setGradeFilter('All')
                setClassFilter('All')
                setStudentQuery('')
              }}>View all students</button>
            </div>
          </div>
          <div className="-mx-1 mt-4 overflow-x-auto px-1">
            <div className="flex min-w-max gap-2 pb-1">
              <button className={`rounded-full px-3 py-1.5 text-xs font-bold ${classFilter === 'All' ? 'bg-kcs-blue-700 text-white' : 'bg-gray-100 text-gray-600 dark:bg-kcs-blue-800 dark:text-gray-200'}`} onClick={() => setClassFilter('All')}>All classes</button>
              {classDirectory.map((className) => (
                <button key={className} className={`rounded-full px-3 py-1.5 text-xs font-bold ${classFilter === className ? 'bg-kcs-blue-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-kcs-blue-50 dark:bg-kcs-blue-800 dark:text-gray-200 dark:hover:bg-kcs-blue-700'}`} onClick={() => setClassFilter(className)}>
                  {className}
                </button>
              ))}
            </div>
          </div>
          {showCreateStudent && (
            <form className="mt-5 rounded-2xl border border-kcs-blue-100 bg-kcs-blue-50 p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/30" onSubmit={(event) => {
              event.preventDefault()
              registerOfficialStudent()
            }}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-bold text-kcs-blue-900 dark:text-white">Create Student + Parent</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Choose a class above, then create the student directly inside that class.</p>
                </div>
                <button type="button" className="w-fit rounded-lg px-3 py-1.5 text-xs font-bold text-kcs-blue-700 hover:bg-white dark:text-kcs-blue-200 dark:hover:bg-kcs-blue-800" onClick={() => setShowCreateStudent(false)}>Close</button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input value={newStudent.name} onChange={(event) => setNewStudent((item) => ({ ...item, name: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Student full name" required />
                <input value={newStudent.studentNumber} onChange={(event) => setNewStudent((item) => ({ ...item, studentNumber: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Student number, optional" />
                <select value={newStudent.grade} onChange={(event) => setNewStudent((item) => ({ ...item, grade: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                  {SCHOOL_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}
                </select>
                <select value={newStudent.section} onChange={(event) => setNewStudent((item) => ({ ...item, section: event.target.value }))} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                  {CLASS_SECTIONS.map((section) => <option key={section || 'none'} value={section}>{sectionLabel(section)}</option>)}
                </select>
                <input value={newStudent.parent} onChange={(event) => setNewStudent((item) => ({ ...item, parent: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Parent / guardian full name" required />
                <input value={newStudent.parentEmail} onChange={(event) => setNewStudent((item) => ({ ...item, parentEmail: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Parent email" />
                <input value={newStudent.parentPhone} onChange={(event) => setNewStudent((item) => ({ ...item, parentPhone: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Parent phone" />
                <input value={newStudent.advisor} onChange={(event) => setNewStudent((item) => ({ ...item, advisor: event.target.value }))} className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Advisor, optional" />
              </div>
              <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
                <button type="submit" className={`${adminButton} w-full sm:w-auto`}><UserPlus size={16} className="inline" /> Create official record</button>
                <span className="text-xs font-semibold text-kcs-blue-700 dark:text-kcs-blue-200">Target class: {formatClassName(newStudent.grade, newStudent.section)}</span>
              </div>
              {studentNotice && <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-kcs-blue-800 dark:bg-kcs-blue-950 dark:text-kcs-blue-100">{studentNotice}</p>}
            </form>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Super Admin Student Command Center</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">All school students, grouped by official class and connected to parent, academic, attendance, and discipline signals.</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${apiSynced ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>{apiSynced ? 'Live API synced' : 'Local control mode'}</span>
            </div>
            <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px]">
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 dark:border-kcs-blue-700 dark:bg-kcs-blue-950">
                <Search size={16} className="text-gray-400" />
                <input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none dark:text-white" placeholder="Search name, number, parent, grade, section" />
              </label>
              <select value={gradeFilter} onChange={(event) => {
                setGradeFilter(event.target.value)
                setClassFilter('All')
              }} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                <option>All</option>
                {SCHOOL_LEVELS.map((grade) => <option key={grade}>{grade}</option>)}
              </select>
              <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
                <option>All</option>
                {classDirectory.map((className) => <option key={className}>{className}</option>)}
              </select>
            </div>
            {filteredRoster.length === 0 && (
              <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-5 text-sm font-semibold text-yellow-800 dark:border-yellow-900/40 dark:bg-yellow-900/10 dark:text-yellow-300">
                No students match this class filter yet. Use Create student above to add one directly into this class.
              </div>
            )}
            <div className="space-y-4">
              {Object.entries(rosterByClass).map(([className, classStudents]) => {
                const classAttendance = Math.round(classStudents.reduce((sum, student) => sum + student.attendance, 0) / classStudents.length)
                const classGpa = Number((classStudents.reduce((sum, student) => sum + student.gpa, 0) / classStudents.length).toFixed(2))
                const riskCounts = classStudents.reduce<Record<string, number>>((counts, student) => {
                  const risk = getStudentRisk(student)
                  counts[risk] = (counts[risk] ?? 0) + 1
                  return counts
                }, {})
                return (
                  <div key={className} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-kcs-blue-800 dark:bg-kcs-blue-800/20">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="font-display text-lg font-bold text-kcs-blue-900 dark:text-white">{className}</p><p className="text-xs text-gray-500 dark:text-gray-400">{getDivisionForGrade(classStudents[0].grade).title} - {classStudents.length} enrolled</p></div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-kcs-blue-200">GPA {classGpa}</span>
                        <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-kcs-blue-700 dark:bg-kcs-blue-900 dark:text-kcs-blue-200">{classAttendance}% attendance</span>
                        {Object.entries(riskCounts).map(([risk, count]) => <span key={risk} className={`rounded-full px-3 py-1.5 font-semibold ${pillTone(risk)}`}>{count} {risk}</span>)}
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
                      <div className="space-y-3 p-3 md:hidden">
                        {classStudents.map((student) => (
                          <div key={student.id} className={`rounded-xl border p-3 ${selectedStudent.id === student.id ? 'border-kcs-blue-300 bg-kcs-blue-50 dark:border-kcs-blue-500 dark:bg-kcs-blue-800/40' : 'border-gray-100 bg-white dark:border-kcs-blue-800 dark:bg-kcs-blue-900/60'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <button className="min-w-0 text-left" onClick={() => setSelectedStudent(student)}>
                                <p className="truncate font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{student.studentNumber ?? 'No number'} - {student.parent}</p>
                              </button>
                              <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${pillTone(getStudentRisk(student))}`}>{getStudentRisk(student)}</span>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="rounded-lg bg-gray-50 p-2 dark:bg-kcs-blue-800/40"><p className={`font-bold ${scoreTone(student.gpa, 'gpa')}`}>{student.gpa}</p><p className="text-gray-400">GPA</p></div>
                              <div className="rounded-lg bg-gray-50 p-2 dark:bg-kcs-blue-800/40"><p className={`font-bold ${scoreTone(student.attendance, 'attendance')}`}>{student.attendance}%</p><p className="text-gray-400">Attend.</p></div>
                              <div className="rounded-lg bg-gray-50 p-2 dark:bg-kcs-blue-800/40"><p className="font-bold text-kcs-blue-900 dark:text-white">{student.discipline}</p><p className="text-gray-400">Conduct</p></div>
                            </div>
                            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                              <button className="rounded-lg bg-kcs-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-kcs-blue-800" onClick={() => setSelectedStudent(student)}>Open evolution</button>
                              <button className="rounded-lg border border-red-100 px-3 py-2 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20" onClick={() => deleteOfficialStudent(student)} aria-label={`Delete ${student.name}`}><Trash2 size={15} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="max-h-[520px] overflow-auto">
                        <table className="hidden min-w-[780px] w-full text-sm md:table">
                          <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-400 dark:bg-kcs-blue-900 dark:text-gray-500">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Student</th>
                              <th className="px-4 py-3 font-semibold">Parent</th>
                              <th className="px-4 py-3 text-right font-semibold">GPA</th>
                              <th className="px-4 py-3 text-right font-semibold">Attendance</th>
                              <th className="px-4 py-3 font-semibold">Risk</th>
                              <th className="px-4 py-3 text-right font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 dark:divide-kcs-blue-800/60">
                            {classStudents.map((student) => (
                              <tr key={student.id} className={`transition-colors ${selectedStudent.id === student.id ? 'bg-kcs-blue-50 dark:bg-kcs-blue-800/40' : 'hover:bg-gray-50 dark:hover:bg-kcs-blue-800/20'}`}>
                                <td className="px-4 py-3">
                                  <button className="text-left" onClick={() => setSelectedStudent(student)}>
                                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{student.studentNumber ?? 'No number'} - {student.status}</p>
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                  <p className="font-medium">{student.parent}</p>
                                  <p className="text-xs text-gray-400">{student.parentPhone}</p>
                                </td>
                                <td className={`px-4 py-3 text-right font-bold ${scoreTone(student.gpa, 'gpa')}`}>{student.gpa}</td>
                                <td className={`px-4 py-3 text-right font-bold ${scoreTone(student.attendance, 'attendance')}`}>{student.attendance}%</td>
                                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pillTone(getStudentRisk(student))}`}>{getStudentRisk(student)}</span></td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    <button className="rounded-lg bg-kcs-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-kcs-blue-800" onClick={() => setSelectedStudent(student)}>Open</button>
                                    <button className="rounded-lg border border-red-100 px-3 py-2 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20" onClick={() => deleteOfficialStudent(student)} aria-label={`Delete ${student.name}`}><Trash2 size={15} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="space-y-6 xl:sticky xl:top-4 xl:self-start">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-kcs-blue-900 dark:text-white">Individual Evolution</h2><p className="text-sm text-gray-500 dark:text-gray-400">{formatClassName(selectedStudent.grade, selectedStudent.section)} - {selectedStudent.status}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pillTone(getStudentRisk(selectedStudent))}`}>{getStudentRisk(selectedStudent)}</span></div>
              <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30"><p className="font-display text-2xl font-bold text-kcs-blue-900 dark:text-white">{selectedStudent.name}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedStudent.studentNumber ?? 'No student number'} - advisor: {selectedStudent.advisor ?? selectedInsight?.advisor ?? 'Advisor pending'}</p></div>
              <div className="mt-4 h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={selectedTrend}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} /><YAxis domain={[50, 100]} tickLine={false} axisLine={false} fontSize={11} /><Tooltip /><Bar dataKey="score" fill="#1d4ed8" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className={`font-bold ${scoreTone(selectedStudent.gpa, 'gpa')}`}>{selectedStudent.gpa}</p><p className="text-xs text-gray-400">GPA</p></div><div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className={`font-bold ${scoreTone(selectedStudent.attendance, 'attendance')}`}>{selectedStudent.attendance}%</p><p className="text-xs text-gray-400">Attendance</p></div><div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="font-bold text-kcs-blue-900 dark:text-white">{selectedStudent.discipline}</p><p className="text-xs text-gray-400">Discipline</p></div></div>
              <div className="mt-4 space-y-3 text-sm">{[['Parent', selectedStudent.parent], ['Email', selectedStudent.parentEmail], ['Phone', selectedStudent.parentPhone], ['AI note', selectedInsight?.aiInsight ?? 'Build a 30-day support plan from attendance, GPA, conduct, and parent engagement signals.']].map(([label, value]) => <div key={label} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 font-semibold text-kcs-blue-900 dark:text-white">{value}</p></div>)}</div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-kcs-blue-900 dark:text-white">Live School Signals</h3><BarChart3 size={17} className="text-kcs-gold-500" /></div>
              <div className="space-y-3">
                {(selectedGrades.length ? selectedGrades : [{ subject: 'Class average', assessment: 'Current term estimate', score: Math.round(selectedStudent.gpa * 25), max: 100, date: 'Now', teacher: selectedStudent.advisor ?? 'Advisor' }]).slice(0, 3).map((item) => <div key={`${item.subject}-${item.assessment}`} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-kcs-blue-900 dark:text-white">{item.subject}</p><span className="font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{item.score}/{item.max}</span></div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.assessment} - {item.teacher}</p></div>)}
                {(selectedAttendanceEvents.length ? selectedAttendanceEvents : [{ date: 'Current term', status: selectedStudent.attendance >= 94 ? 'present' : 'watch', className: formatClassName(selectedStudent.grade, selectedStudent.section) }]).slice(0, 2).map((item) => <div key={`${item.date}-${item.status}`} className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="font-semibold capitalize text-kcs-blue-900 dark:text-white">{item.status}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.date} - {item.className}</p></div>)}
                {selectedDiscipline && <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-3 dark:border-yellow-900/40 dark:bg-yellow-900/10"><p className="font-semibold text-yellow-800 dark:text-yellow-300">{selectedDiscipline.category}</p><p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">{selectedDiscipline.followUp}</p></div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'transcripts') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img src={SCHOOL_LOGO_SRC} alt={`${SCHOOL_NAME} logo`} className="h-12 w-12 rounded-xl object-contain ring-1 ring-kcs-blue-100 dark:ring-kcs-blue-800" />
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
            </div>
            {grade9to12.map((student) => {
              const transcript = transcripts.find((item) => item.student === student.name)
              const generated = buildOfficialTranscript(student)
              return (
                <button key={student.id} className={`w-full rounded-2xl border bg-white p-5 text-left transition-colors hover:border-kcs-blue-200 hover:bg-kcs-blue-50 dark:bg-kcs-blue-900/50 dark:hover:bg-kcs-blue-900 ${transcriptStudent.id === student.id ? 'border-kcs-blue-400 ring-2 ring-kcs-blue-100 dark:border-kcs-blue-400 dark:ring-kcs-blue-900' : 'border-gray-100 dark:border-kcs-blue-800'}`} onClick={() => setSelectedTranscriptId(student.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{student.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{formatClassName(student.grade, student.section)} - {student.studentNumber ?? 'No student number'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pillTone(transcript?.status ?? generated.graduationStatus)}`}>{transcript?.status ?? generated.graduationStatus}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="font-bold text-kcs-blue-900 dark:text-white">{generated.cumulativeGpa}</p><p className="text-xs text-gray-400">Cum. GPA</p></div>
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="font-bold text-kcs-blue-900 dark:text-white">{generated.totalCredits}</p><p className="text-xs text-gray-400">Credits</p></div>
                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-kcs-blue-800/30"><p className="font-bold text-kcs-blue-900 dark:text-white">{generated.cumulativeAverage}%</p><p className="text-xs text-gray-400">Average</p></div>
                  </div>
                  <span className="mt-4 inline-flex w-full justify-center rounded-xl bg-kcs-gold-500 px-4 py-2.5 text-sm font-bold text-kcs-blue-950 hover:bg-kcs-gold-400">Generate transcript</span>
                </button>
              )
            })}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
            <img src={SCHOOL_LOGO_SRC} alt="" aria-hidden="true" className="pointer-events-none absolute right-6 top-28 hidden h-48 w-48 object-contain opacity-[0.04] sm:block" />
            <div className="border-b border-gray-100 pb-5 dark:border-kcs-blue-800">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-kcs-blue-100 bg-white p-2 shadow-sm dark:border-kcs-blue-800 dark:bg-kcs-blue-950 sm:h-20 sm:w-20">
                    <img src={SCHOOL_LOGO_SRC} alt={`${SCHOOL_NAME} logo`} className="h-full w-full object-contain" />
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
                ['Cumulative GPA', officialTranscript.cumulativeGpa],
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

  if (segment === 'communications') {
    return (
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Communication Flows</h2>
          <div className="space-y-3">
            {communicationFlows.map((flow) => (
              <div key={flow.trigger} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <p className="font-semibold text-kcs-blue-900 dark:text-white">{flow.trigger}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{flow.update}</p>
                <p className="mt-2 text-xs font-semibold text-kcs-gold-600 dark:text-kcs-gold-300">{flow.notification}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Send School Communication</h2>
          <div className="grid gap-3">
            <select className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white">
              <option>All parents, students, teachers, and staff</option>
              <option>Parents only</option>
              <option>Grade 9-12 families</option>
              <option>Staff only</option>
            </select>
            <input className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Subject" />
            <textarea className="min-h-36 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-kcs-blue-700 dark:bg-kcs-blue-950 dark:text-white" placeholder="Email, SMS, and portal message..." />
            <button className={adminButton} onClick={() => setSentNotice('Communication queued for email, SMS, and in-site inbox.')}>Send communication</button>
            {sentNotice && <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">{sentNotice}</p>}
          </div>
        </div>
      </div>
    )
  }

  if (segment === 'staff-attendance') {
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
              <div key={report.id} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{report.student}</p>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${pillTone(report.status)}`}>{report.status}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-kcs-blue-700 dark:text-kcs-blue-300">{report.category} - {report.date}</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{report.incident}</p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Parent contact: {report.parentContact}</p>
              </div>
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
    )
  }

  if (segment === 'teachers') {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Teachers & Load</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {staffLoad.map((teacher) => (
              <div key={teacher.teacher} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{teacher.teacher}</p>
                  <span className="rounded-full bg-kcs-blue-100 px-2.5 py-1 text-xs font-semibold text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">{teacher.load}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">AI support: {teacher.aiSupport}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
          <h2 className="mb-4 font-bold text-kcs-blue-900 dark:text-white">Staff Operations</h2>
          <div className="space-y-3">
            {staffOperations.map((item) => (
              <div key={item.function} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                <div className="flex items-center justify-between"><p className="font-semibold text-kcs-blue-900 dark:text-white">{item.function}</p><span className="font-bold text-kcs-blue-700 dark:text-kcs-blue-300">{item.value}</span></div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.metric} - {item.status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

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
                  <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.studentName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.gradeApplying} - {item.applicationNumber}</p>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${pillTone(item.status)}`}>{item.status.replace('_', ' ')}</span>
              </div>
              <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-4 text-sm dark:bg-kcs-blue-800/30">
                <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.parentName}</p>
                <p className="text-gray-500 dark:text-gray-400">{item.parentEmail} - {item.parentPhone}</p>
                <p className="text-gray-500 dark:text-gray-400">Previous school: {item.previousSchool}</p>
                <p className="text-gray-500 dark:text-gray-400">Docs: {item.documents?.length ? item.documents.join(', ') : 'Pending document review'}</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button className={adminOutlineButton} onClick={() => updateAdmissionStatus(item, 'UNDER_REVIEW')}>Review</button>
                <button className={adminOutlineButton} onClick={() => updateAdmissionStatus(item, 'INTERVIEW_SCHEDULED')}>Interview</button>
                <button className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700" onClick={() => updateAdmissionStatus(item, 'ACCEPTED')}>Approve + create student</button>
                <button className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700" onClick={() => updateAdmissionStatus(item, 'REJECTED')}>Refuse</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (segment === 'finance') {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {feeAccounts.map((fee) => (
            <div key={fee.invoice} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="flex items-center justify-between gap-3"><p className="font-semibold text-kcs-blue-900 dark:text-white">{fee.invoice}</p><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pillTone(fee.status)}`}>{fee.status}</span></div>
              <p className="mt-3 font-display text-3xl font-bold text-kcs-blue-900 dark:text-white">${fee.balance}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{fee.family} - last payment ${fee.lastPayment}</p>
              <button className="mt-4 w-full rounded-xl bg-kcs-gold-500 px-4 py-2.5 text-sm font-bold text-kcs-blue-950 hover:bg-kcs-gold-400">Receipt / statement</button>
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {financeReadiness.map((item) => (
            <div key={item.feature} className="rounded-xl bg-green-50 p-4 dark:bg-green-900/10"><p className="font-semibold text-green-800 dark:text-green-300">{item.feature}</p><p className="mt-1 text-sm text-green-700 dark:text-green-400">{item.note}</p></div>
          ))}
        </div>
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
    )
  }

  return <PortalSectionPanel />
}

const AdminDashboard = () => {
  const { user } = useAuthStore()
  const location = useLocation()
  const activeSegment = getAdminSegment(location.pathname)
  const [officialRoster, setOfficialRoster] = useState<AdminStudentRecord[]>(readStoredRoster)
  const [admissionRequests, setAdmissionRequests] = useState<AdminAdmissionRequest[]>(readStoredAdmissions)
  const pendingAdmissions = admissionRequests.filter((item) => item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW')

  return (
    <div className="portal-shell flex">
      <PortalSidebar />

      <main>
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/85 px-6 py-4 backdrop-blur-md dark:border-kcs-blue-800 dark:bg-kcs-blue-950/85">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-xl font-bold text-kcs-blue-900 dark:text-white">
                Executive Dashboard, {user?.firstName}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                A high-level operational view of academics, admissions, staff load, and AI-driven risk monitoring.
              </p>
            </div>
            <div className="rounded-2xl bg-kcs-blue-50 px-4 py-2 text-sm font-medium text-kcs-blue-700 dark:bg-kcs-blue-900/40 dark:text-kcs-blue-300">
              Live snapshot • 2025/26 cycle
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

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            {[
              { label: 'Official Registry', value: String(officialRoster.length), icon: GraduationCap, tone: 'bg-kcs-blue-50 text-kcs-blue-700 dark:bg-kcs-blue-900/30 dark:text-kcs-blue-300', sub: 'students controlled by Super Admin' },
              { label: 'Faculty Members', value: '64', icon: Users, tone: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300', sub: '92% retention' },
              { label: 'Open Applications', value: String(pendingAdmissions.length), icon: FileText, tone: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', sub: 'approval or refusal required' },
              { label: 'AI Risk Alerts', value: '10', icon: Brain, tone: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', sub: '3 high severity' },
              { label: 'Live Events', value: '4', icon: Radio, tone: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', sub: '1 currently live' },
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
                <AreaChart data={enrollmentTrend}>
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
                <BarChart data={departmentPerformance} layout="vertical" margin={{ left: 10, right: 10 }}>
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
                {liveEventControls.map((event) => (
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
                        <button className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white" onClick={() => {
                          const approvedStudent = createStudentFromAdmission({ ...item, status: 'ACCEPTED' })
                          setAdmissionRequests((items) => {
                            const next = items.map((application) => application.applicationNumber === item.applicationNumber ? { ...application, status: 'ACCEPTED' as const } : application)
                            saveAdmissions(next)
                            return next
                          })
                          setOfficialRoster((records) => {
                            if (records.some((record) => record.id === approvedStudent.id || record.name === approvedStudent.name)) return records
                            const next = [approvedStudent, ...records]
                            saveRoster(next)
                            return next
                          })
                        }}>Approve</button>
                        <button className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white" onClick={() => setAdmissionRequests((items) => {
                          const next = items.map((application) => application.applicationNumber === item.applicationNumber ? { ...application, status: 'REJECTED' as const } : application)
                          saveAdmissions(next)
                          return next
                        })}>Refuse</button>
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
                {riskAlerts.map((alert) => (
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
                {staffLoad.map((staff) => (
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
                <h2 className="font-display text-2xl font-bold">This week&apos;s strongest signals point to steady enrollment growth and higher AI engagement in senior grades.</h2>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                {recentActivity.map((item) => (
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
                {aiSignals.map((signal) => (
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
                {sensitiveActions.map((item) => (
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
                <span className="badge-blue text-xs">Invoices • receipts • exports</span>
              </div>
              <div className="space-y-3">
                {feeAccounts.map((fee) => (
                  <div key={fee.invoice} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-kcs-blue-900 dark:text-white">{fee.invoice}</p>
                      <span className="text-sm font-bold text-kcs-blue-700 dark:text-kcs-blue-300">${fee.balance}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{fee.family} • {fee.status} • last payment ${fee.lastPayment}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-kcs-blue-800 dark:bg-kcs-blue-900/50">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-bold text-kcs-blue-900 dark:text-white">Report Cards & Transcripts</h2>
                <span className="badge-gold text-xs">Principal workflow</span>
              </div>
              <div className="space-y-3">
                {[...reportCards, ...transcripts].map((item: any) => (
                  <div key={`${item.student}-${item.term ?? item.years}`} className="rounded-xl bg-gray-50 p-4 dark:bg-kcs-blue-800/30">
                    <p className="font-semibold text-kcs-blue-900 dark:text-white">{item.student}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {item.term ?? item.years} • {item.principalStatus ?? item.status}
                    </p>
                  </div>
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
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard
