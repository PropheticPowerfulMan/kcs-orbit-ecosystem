import type { UserRole } from '@/types'

export const rolePermissions: Record<UserRole, string[]> = {
  admin: ['*'],
  staff: ['records:read', 'announcements:write', 'admissions:manage', 'reports:export', 'messages:send'],
  teacher: ['attendance:write', 'grades:write', 'assignments:write', 'comments:write', 'classes:read'],
  parent: ['children:read', 'messages:reply', 'documents:upload', 'meetings:book'],
  student: ['own:read', 'assignments:submit', 'ai:tutor', 'messages:read'],
}

export const academicContext = {
  year: '2025/26',
  term: 'Term 3',
  activeDay: 'Tuesday',
  nextExamWindow: 'May 3 - May 17',
}

export const students = [
  {
    id: 'stu-elise',
    name: 'Elise Kabongo',
    grade: 'Grade 11',
    section: 'A',
    parentId: 'parent-kabongo',
    advisor: 'Dr. Mukendi',
    average: 92,
    gpa: 3.9,
    rank: 5,
    attendance: 97,
    risk: 'low',
    strengths: ['Biology analysis', 'Essay structure', 'Independent study habits'],
    weaknesses: ['Timed calculus drills'],
    aiInsight: 'Elise is on an upward trend. Maintain AP revision blocks and add timed calculus practice twice per week.',
  },
  {
    id: 'stu-david',
    name: 'David Kabongo',
    grade: 'Grade 8',
    section: 'B',
    parentId: 'parent-kabongo',
    advisor: 'Mr. Belanger',
    average: 78,
    gpa: 3.1,
    rank: 18,
    attendance: 89,
    risk: 'medium',
    strengths: ['Class participation', 'History recall', 'Oral presentations'],
    weaknesses: ['Fractions', 'Homework consistency'],
    aiInsight: 'David needs a parent-teacher follow-up and a 20-minute daily math routine for the next 14 days.',
  },
]

export const subjects = [
  { id: 'math-11', name: 'AP Calculus', teacher: 'Mr. Belanger', className: 'Grade 11A', room: 'Room 204' },
  { id: 'bio-11', name: 'AP Biology', teacher: 'Dr. Mukendi', className: 'Grade 11A', room: 'Lab 3' },
  { id: 'eng-11', name: 'English Literature', teacher: 'Mrs. Diallo', className: 'Grade 11A', room: 'Room 110' },
  { id: 'math-8', name: 'Pre-Algebra', teacher: 'Mr. Belanger', className: 'Grade 8B', room: 'Room 202' },
]

export const grades = [
  { studentId: 'stu-elise', subject: 'AP Biology', assessment: 'Lab Report', score: 95, max: 100, date: 'Apr 18', teacher: 'Dr. Mukendi' },
  { studentId: 'stu-elise', subject: 'AP Calculus', assessment: 'Quiz #7', score: 89, max: 100, date: 'Apr 17', teacher: 'Mr. Belanger' },
  { studentId: 'stu-david', subject: 'Pre-Algebra', assessment: 'Chapter Test', score: 76, max: 100, date: 'Apr 16', teacher: 'Mr. Belanger' },
  { studentId: 'stu-elise', subject: 'English Literature', assessment: 'Essay Draft', score: 91, max: 100, date: 'Apr 15', teacher: 'Mrs. Diallo' },
  { studentId: 'stu-david', subject: 'World Geography', assessment: 'Map Quiz', score: 88, max: 100, date: 'Apr 14', teacher: 'Mrs. Nkosi' },
]

export const gradebookCategories = [
  { name: 'Homework', weight: 15, average: 86, visibility: 'Parents and students' },
  { name: 'Quizzes', weight: 20, average: 88, visibility: 'Parents and students' },
  { name: 'Tests', weight: 25, average: 84, visibility: 'Parents and students after teacher release' },
  { name: 'Exams', weight: 30, average: 91, visibility: 'Term report only until approved' },
  { name: 'Participation', weight: 10, average: 94, visibility: 'Teacher and admin' },
]

export const gradingScales = [
  { letter: 'A', range: '90-100', gpa: 4.0, descriptor: 'Excellent mastery' },
  { letter: 'B', range: '80-89', gpa: 3.0, descriptor: 'Strong progress' },
  { letter: 'C', range: '70-79', gpa: 2.0, descriptor: 'Developing mastery' },
  { letter: 'D', range: '60-69', gpa: 1.0, descriptor: 'Intervention required' },
]

export const attendance = [
  { studentId: 'stu-elise', date: 'Apr 22', status: 'present', className: 'Grade 11A' },
  { studentId: 'stu-david', date: 'Apr 22', status: 'late', className: 'Grade 8B' },
  { studentId: 'stu-david', date: 'Apr 19', status: 'absent', className: 'Grade 8B' },
]

export const attendanceAnalytics = [
  { scope: 'Grade 11A', present: 96, late: 3, absent: 1, trend: 'stable' },
  { scope: 'Grade 8B', present: 89, late: 7, absent: 4, trend: 'needs follow-up' },
  { scope: 'High School', present: 94, late: 4, absent: 2, trend: 'improving' },
]

export const assignments = [
  { id: 'asg-1', studentId: 'stu-elise', title: 'AP Calculus Problem Set #8', subject: 'AP Calculus', due: 'Tomorrow', status: 'pending', priority: 'high' },
  { id: 'asg-2', studentId: 'stu-elise', title: 'Biology Lab Report', subject: 'AP Biology', due: 'Apr 23', status: 'submitted', priority: 'low' },
  { id: 'asg-3', studentId: 'stu-david', title: 'Fraction Fluency Practice', subject: 'Pre-Algebra', due: 'Tonight', status: 'missing', priority: 'high' },
  { id: 'asg-4', studentId: 'stu-david', title: 'Geography Map Corrections', subject: 'World Geography', due: 'Apr 25', status: 'pending', priority: 'medium' },
]

export const lmsResources = [
  { title: 'AP Biology meiosis explainer', type: 'video', subject: 'AP Biology', audience: ['student', 'parent'], status: 'published' },
  { title: 'Fraction fluency worksheet', type: 'file', subject: 'Pre-Algebra', audience: ['student', 'parent'], status: 'assigned' },
  { title: 'Exam revision discussion', type: 'discussion', subject: 'AP Calculus', audience: ['student'], status: 'open' },
]

export const schedules = [
  { role: 'student', ownerId: 'stu-elise', time: '8:15 AM', title: 'AP Calculus', room: 'Room 204', teacher: 'Mr. Belanger' },
  { role: 'student', ownerId: 'stu-elise', time: '10:15 AM', title: 'AP Biology', room: 'Lab 3', teacher: 'Dr. Mukendi' },
  { role: 'teacher', ownerId: 'teacher-belanger', time: '8:15 AM', title: 'Grade 11 AP Calculus', room: 'Room 204', teacher: 'Mr. Belanger' },
  { role: 'teacher', ownerId: 'teacher-belanger', time: '11:00 AM', title: 'Grade 8 Pre-Algebra', room: 'Room 202', teacher: 'Mr. Belanger' },
]

export const scheduleConflicts = [
  { title: 'Room 204 double-booking risk', detail: 'AP Calculus and Grade 10 Biology overlap on Friday period 2.', severity: 'medium', affected: ['teacher', 'staff', 'admin'] },
  { title: 'AP exam timetable adjustment', detail: 'Grade 11A Biology lab must move before the AP exam window.', severity: 'high', affected: ['student', 'parent', 'teacher', 'staff'] },
]

export const announcements = [
  { id: 'ann-1', title: 'Exam schedules published', audience: ['parent', 'student', 'teacher', 'staff'], priority: 'high', date: 'Apr 22' },
  { id: 'ann-2', title: 'Parent rights and duties policy updated', audience: ['parent', 'staff', 'admin'], priority: 'medium', date: 'Apr 21' },
  { id: 'ann-3', title: 'Emergency drill on Friday', audience: ['parent', 'student', 'teacher', 'staff'], priority: 'high', date: 'Apr 20' },
]

export const communicationFlows = [
  { trigger: 'Grade entered', update: 'Student and parent dashboard refresh', notification: 'Grade alert if score is below 75%', recipients: ['student', 'parent', 'teacher'] },
  { trigger: 'Attendance marked late/absent', update: 'Attendance analytics and child record update', notification: 'Parent absence alert', recipients: ['parent', 'staff', 'admin'] },
  { trigger: 'Assignment published', update: 'Student workload and parent deadlines update', notification: 'Homework due reminder', recipients: ['student', 'parent'] },
  { trigger: 'Schedule changed', update: 'Timetable and room schedule update', notification: 'Affected user alert', recipients: ['student', 'parent', 'teacher', 'staff'] },
  { trigger: 'Academic risk detected', update: 'AI recommendation generated', notification: 'Coordinator and family follow-up', recipients: ['parent', 'teacher', 'staff', 'admin'] },
]

export const events = [
  { date: 'Apr 25', title: 'Parent-Teacher Conferences', type: 'meeting', target: ['parent', 'teacher', 'staff'] },
  { date: 'May 3', title: 'AP Exams Begin', type: 'exam', target: ['student', 'parent', 'teacher'] },
  { date: 'May 12', title: 'Spring Music Concert', type: 'event', target: ['parent', 'student', 'staff'] },
]

export const messages = [
  { from: 'Mr. Belanger', toRole: 'parent', subject: 'David math intervention', body: 'Please confirm tonight that David completes Fraction Fluency Practice.', requiresResponse: true },
  { from: 'Admissions Office', toRole: 'staff', subject: 'Three interviews need scheduling', body: 'New family interviews are pending office confirmation.', requiresResponse: true },
  { from: 'Academic Coordinator', toRole: 'teacher', subject: 'Risk review', body: 'Please review students below 80% before Friday.', requiresResponse: false },
]

export const internalThreads = [
  { subject: 'David intervention plan', participants: ['Mr. Belanger', 'Rachel Kabongo', 'Academic Coordinator'], unread: 2, channel: 'Private teacher-parent thread' },
  { subject: 'Emergency drill logistics', participants: ['Administration', 'Teachers', 'Staff'], unread: 0, channel: 'Targeted announcement' },
  { subject: 'Fee balance reminder', participants: ['Finance Office', 'Rachel Kabongo'], unread: 1, channel: 'Finance message' },
]

export const aiSignals = [
  { title: 'Academic risk detected', detail: 'David Kabongo combines missing work with attendance decline.', severity: 'medium', roles: ['admin', 'staff', 'teacher', 'parent'] },
  { title: 'Schedule impact', detail: 'AP exam window affects Grade 11 parent meetings and teacher assessment deadlines.', severity: 'high', roles: ['admin', 'staff', 'teacher', 'parent', 'student'] },
  { title: 'Parent engagement opportunity', detail: 'Conference completion is 82%; communications office should send targeted reminders.', severity: 'low', roles: ['admin', 'staff'] },
]

export const aiRecommendations = [
  { owner: 'Parent', title: 'David math routine', action: '20 minutes of fraction practice for 14 days, then reassess.', impact: 'Reduce medium academic risk' },
  { owner: 'Teacher', title: 'Grade 8 support group', action: 'Group David with two peers for targeted algebra practice.', impact: 'Improve homework completion' },
  { owner: 'Staff', title: 'Attendance escalation', action: 'Send weekly attendance digest to families below 90%.', impact: 'Lower absence trend' },
  { owner: 'Super Admin', title: 'Policy approval', action: 'Approve updated parent duties policy before publication.', impact: 'Protect sensitive workflow' },
]

export const reportCards = [
  { student: 'Elise Kabongo', term: 'Term 3', average: 92, conduct: 'Excellent', teacherComment: 'Elise shows mature independence and high analytical skill.', principalStatus: 'Approved', download: 'PDF ready' },
  { student: 'David Kabongo', term: 'Term 3', average: 78, conduct: 'Good', teacherComment: 'David participates well and needs consistency in homework.', principalStatus: 'Pending review', download: 'Draft' },
]

export const disciplineReports = [
  {
    id: 'disc-001',
    studentId: 'stu-david',
    student: 'David Kabongo',
    date: 'Apr 22',
    level: 'medium',
    category: 'Homework consistency',
    incident: 'Repeated missing math practice affected readiness for science group work.',
    context: 'Third missing assignment in two weeks, combined with one late arrival on Apr 22.',
    actionTaken: 'Restorative meeting with advisor, parent message drafted, daily planner check assigned.',
    followUp: 'Review completion log on Apr 29 and escalate to academic coordinator if no improvement.',
    parentContact: 'Pending confirmation',
    status: 'Open',
  },
  {
    id: 'disc-002',
    studentId: 'stu-elise',
    student: 'Elise Kabongo',
    date: 'Apr 18',
    level: 'low',
    category: 'Classroom leadership',
    incident: 'Peer lab group conflict resolved after guided discussion.',
    context: 'Student accepted feedback and helped reset lab roles before submission.',
    actionTaken: 'Teacher conference and positive leadership note.',
    followUp: 'Monitor collaboration during next AP Biology lab.',
    parentContact: 'Not required',
    status: 'Resolved',
  },
]

export const transcripts = [
  { student: 'Elise Kabongo', years: '2023-2026', credits: 24, cumulativeGpa: 3.8, status: 'Ready for export' },
  { student: 'David Kabongo', years: '2025-2026', credits: 8, cumulativeGpa: 3.1, status: 'In progress' },
]

export const feeAccounts = [
  { family: 'Kabongo Family', student: 'Elise Kabongo', invoice: 'KCS-INV-2026-041', balance: 420, status: 'partially paid', dueDate: 'May 5', lastPayment: 600 },
  { family: 'Kabongo Family', student: 'David Kabongo', invoice: 'KCS-INV-2026-042', balance: 0, status: 'paid', dueDate: 'May 5', lastPayment: 980 },
  { family: 'Mbuyi Family', student: 'Amani Mbuyi', invoice: 'KCS-INV-2026-043', balance: 1120, status: 'pending', dueDate: 'May 10', lastPayment: 0 },
]

export const financeReadiness = [
  { feature: 'Invoices and receipts', status: 'Ready', note: 'PDF-ready records for finance office and parents' },
  { feature: 'Mobile money integration', status: 'Prepared', note: 'Architecture reserved for future provider connection' },
  { feature: 'Card payment integration', status: 'Prepared', note: 'Payment status can sync back to parent obligations' },
]

export const auditLogs = [
  { actor: 'Super Admin', action: 'Updated parent duties policy', target: 'Parent Portal', time: 'Apr 22, 9:14 AM' },
  { actor: 'Mr. Belanger', action: 'Entered Pre-Algebra grade', target: 'David Kabongo', time: 'Apr 22, 8:40 AM' },
  { actor: 'Registrar Office', action: 'Approved admission document', target: 'Amani M.', time: 'Apr 21, 3:12 PM' },
]

export const sensitiveActions = [
  { action: 'Publish final report cards', requester: 'Academic Coordinator', status: 'Awaiting Super Admin approval', risk: 'high' },
  { action: 'Change grading scale', requester: 'Registrar Office', status: 'Requires audit note', risk: 'high' },
  { action: 'Waive finance balance', requester: 'Finance Office', status: 'Rejected pending documentation', risk: 'critical' },
]

export const staffOperations = [
  { function: 'Registrar', metric: 'Student record updates', value: 18, status: 'On track' },
  { function: 'Accountant', metric: 'Fee follow-ups', value: 9, status: 'Needs review' },
  { function: 'Discipline Office', metric: 'Open behavior cases', value: 4, status: 'Monitored' },
  { function: 'Communications', metric: 'Unread parent replies', value: 12, status: 'Action needed' },
]

export const performanceTrend = [
  { month: 'Sep', Elise: 84, David: 75 },
  { month: 'Oct', Elise: 87, David: 77 },
  { month: 'Nov', Elise: 88, David: 74 },
  { month: 'Dec', Elise: 90, David: 80 },
  { month: 'Jan', Elise: 89, David: 78 },
  { month: 'Feb', Elise: 91, David: 81 },
  { month: 'Mar', Elise: 92, David: 79 },
  { month: 'Apr', Elise: 92, David: 78 },
]
