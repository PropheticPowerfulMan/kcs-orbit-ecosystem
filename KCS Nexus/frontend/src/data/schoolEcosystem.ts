import type { UserRole } from '@/types'

// Production dashboards must obtain operational records from authenticated APIs.
// These empty compatibility exports keep legacy views honest until their API-backed modules are enabled.
export const rolePermissions: Record<UserRole, string[]> = {
  admin: ['*'],
  staff: ['records:read', 'announcements:write', 'admissions:manage', 'reports:export', 'messages:send'],
  teacher: ['attendance:write', 'grades:write', 'assignments:write', 'comments:write', 'classes:read'],
  parent: ['children:read', 'messages:reply', 'documents:upload', 'meetings:book'],
  student: ['own:read', 'assignments:submit', 'ai:tutor', 'messages:read'],
}

export const academicContext = { year: '', term: '', activeDay: '', nextExamWindow: '' }

export const parents: any[] = []
export const employees: any[] = []
export const students: any[] = []
export const subjects: any[] = []
export const grades: any[] = []
export const gradebookCategories: any[] = []
export const gradingScales: any[] = []
export const attendance: any[] = []
export const attendanceAnalytics: any[] = []
export const assignments: any[] = []
export const lmsResources: any[] = []
export const schedules: any[] = []
export const scheduleConflicts: any[] = []
export const announcements: any[] = []
export const communicationFlows: any[] = []
export const events: any[] = []
export const messages: any[] = []
export const internalThreads: any[] = []
export const aiSignals: any[] = []
export const aiRecommendations: any[] = []
export const reportCards: any[] = []
export const disciplineReports: any[] = []
export const transcripts: any[] = []
export const diagnosticTests: any[] = []
export const feeAccounts: any[] = []
export const financeReadiness: any[] = []
export const auditLogs: any[] = []
export const sensitiveActions: any[] = []
export const staffOperations: any[] = []
export const performanceTrend: any[] = []
