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

export const parents = [
  { id: 'parent-kabongo', name: 'Rachel Kabongo', studentIds: ['stu-elise', 'stu-david'], email: 'rachel.kabongo@kcs.local', phone: '+243812450221' },
  { id: 'parent-mbuyi', name: 'Mireille Mbuyi', studentIds: ['stu-amani'], email: 'mireille.mbuyi@kcs.local', phone: '+243899120882' },
  { id: 'parent-ilunga', name: 'Patrick Ilunga', studentIds: ['stu-naomi'], email: 'patrick.ilunga@kcs.local', phone: '+243843774101' },
  { id: 'parent-kalala', name: 'Claire Kalala', studentIds: ['stu-sarah'], email: 'claire.kalala@kcs.local', phone: '+243815330477' },
  { id: 'parent-banza', name: 'Beatrice Banza', studentIds: ['stu-joel'], email: 'beatrice.banza@kcs.local', phone: '+243817444909' },
]

export const employees = [
  { id: 'teacher-lukusa', name: 'M. Alain Lukusa', role: 'teacher', subject: 'Mathematiques' },
  { id: 'teacher-moke', name: 'Mme Chantal Moke', role: 'teacher', subject: 'Francais' },
  { id: 'teacher-ngalula', name: 'Dr. Peter Ngalula', role: 'teacher', subject: 'Sciences' },
  { id: 'teacher-kalala', name: 'Mme Esther Kalala', role: 'teacher', subject: 'Anglais' },
]

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
  {
    id: 'stu-amani',
    name: 'Amani Mbuyi',
    grade: 'Grade 10',
    section: 'A',
    parentId: 'parent-mbuyi',
    advisor: 'Mrs. Diallo',
    average: 64,
    gpa: 2.0,
    rank: 31,
    attendance: 72,
    risk: 'high',
    strengths: ['Oral participation'],
    weaknesses: ['Attendance consistency', 'Exam readiness'],
    aiInsight: 'Amani needs a coordinated attendance and academic support plan this week.',
  },
  {
    id: 'stu-naomi',
    name: 'Naomi Ilunga',
    grade: 'Grade 7',
    section: 'A',
    parentId: 'parent-ilunga',
    advisor: 'Mrs. Nkosi',
    average: 82,
    gpa: 3.0,
    rank: 12,
    attendance: 91,
    risk: 'low',
    strengths: ['Reading comprehension'],
    weaknesses: ['Science lab vocabulary'],
    aiInsight: 'Naomi is stable; keep vocabulary reinforcement inside science lessons.',
  },
  {
    id: 'stu-sarah',
    name: 'Sarah Kalala',
    grade: 'Grade 6',
    section: '',
    parentId: 'parent-kalala',
    advisor: 'Dr. Mukendi',
    average: 76,
    gpa: 2.5,
    rank: 20,
    attendance: 88,
    risk: 'low',
    strengths: ['Steady improvement'],
    weaknesses: ['Writing structure'],
    aiInsight: 'Sarah is improving; weekly writing practice should lift her next report.',
  },
  {
    id: 'stu-joel',
    name: 'Joel Banza',
    grade: 'Grade 10',
    section: 'B',
    parentId: 'parent-banza',
    advisor: 'Mr. Belanger',
    average: 61,
    gpa: 1.8,
    rank: 34,
    attendance: 74,
    risk: 'high',
    strengths: ['Practical projects'],
    weaknesses: ['Homework completion', 'Attendance'],
    aiInsight: 'Joel should be escalated to the academic coordinator and family follow-up queue.',
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
  { role: 'student', ownerId: 'stu-elise', day: 'Monday', time: '8:15 AM', title: 'AP Calculus', room: 'Room 204', teacher: 'Mr. Belanger', source: 'admin-assigned', linkedTeacherId: 'teacher-belanger', parentOwnerId: 'parent-kabongo' },
  { role: 'student', ownerId: 'stu-elise', day: 'Monday', time: '10:15 AM', title: 'AP Biology', room: 'Lab 3', teacher: 'Dr. Mukendi', source: 'admin-assigned', linkedTeacherId: 'teacher-mukendi', parentOwnerId: 'parent-kabongo' },
  { role: 'student', ownerId: 'stu-david', day: 'Monday', time: '11:00 AM', title: 'Pre-Algebra', room: 'Room 202', teacher: 'Mr. Belanger', source: 'admin-assigned', linkedTeacherId: 'teacher-belanger', parentOwnerId: 'parent-kabongo' },
  { role: 'parent', ownerId: 'parent-kabongo', day: 'Monday', time: '8:15 AM', title: 'Elise - AP Calculus', room: 'Room 204', teacher: 'Mr. Belanger', source: 'admin-assigned', linkedStudentId: 'stu-elise' },
  { role: 'parent', ownerId: 'parent-kabongo', day: 'Monday', time: '10:15 AM', title: 'Elise - AP Biology', room: 'Lab 3', teacher: 'Dr. Mukendi', source: 'admin-assigned', linkedStudentId: 'stu-elise' },
  { role: 'parent', ownerId: 'parent-kabongo', day: 'Monday', time: '11:00 AM', title: 'David - Pre-Algebra', room: 'Room 202', teacher: 'Mr. Belanger', source: 'admin-assigned', linkedStudentId: 'stu-david' },
  { role: 'teacher', ownerId: 'teacher-belanger', day: 'Monday', time: '8:15 AM', title: 'Grade 11 AP Calculus', room: 'Room 204', teacher: 'Mr. Belanger', students: 18, source: 'admin-assigned', assignedBy: 'Super Admin', linkedStudentIds: ['stu-elise'], parentOwnerIds: ['parent-kabongo'] },
  { role: 'teacher', ownerId: 'teacher-belanger', day: 'Monday', time: '11:00 AM', title: 'Grade 8 Pre-Algebra', room: 'Room 202', teacher: 'Mr. Belanger', students: 1, source: 'admin-assigned', assignedBy: 'Super Admin', linkedStudentIds: ['stu-david'], parentOwnerIds: ['parent-kabongo'] },
  { role: 'teacher', ownerId: 'teacher-mukendi', day: 'Monday', time: '10:15 AM', title: 'Grade 11 AP Biology', room: 'Lab 3', teacher: 'Dr. Mukendi', students: 24, source: 'admin-assigned', assignedBy: 'Super Admin', linkedStudentIds: ['stu-elise'], parentOwnerIds: ['parent-kabongo'] },
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
  { trigger: 'Grade entered', update: 'Student and parent dashboard refresh', notification: 'Grade alert if score is below 70%', recipients: ['student', 'parent', 'teacher'] },
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

export const diagnosticTests = [
  { id: 'diag-001', teacher: 'Mr. Belanger', className: 'Grade 8B', subject: 'Pre-Algebra', title: 'Numeracy baseline', submittedAt: 'Apr 22, 8:40 AM', score: '76% class mastery', summary: 'Fractions and multi-step equations require a targeted support group.', status: 'Pending approval' },
  { id: 'diag-002', teacher: 'Dr. Mukendi', className: 'Grade 11A', subject: 'AP Biology', title: 'Scientific reasoning diagnostic', submittedAt: 'Apr 21, 3:15 PM', score: '88% class mastery', summary: 'Students are ready for the genetics unit; two learners need data interpretation support.', status: 'Pending approval' },
  { id: 'diag-003', teacher: 'Mrs. Diallo', className: 'Grade 11A', subject: 'English Literature', title: 'Academic writing diagnostic', submittedAt: 'Apr 20, 1:05 PM', score: '84% class mastery', summary: 'Argument structure is secure; citations and evidence integration need a refresher.', status: 'Approved' },
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

const scienceSubjectTerms = ['biology', 'science', 'chemistry', 'physics', 'lab', 'calculus', 'math', 'algebra']

const subjectDomain = (subject: string) => {
  const normalized = subject.toLowerCase()
  return scienceSubjectTerms.some((term) => normalized.includes(term)) ? 'scientific' : 'non_scientific'
}

const averageScores = (scores: number[]) => {
  if (!scores.length) return null
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

const predictionTone = (riskScore: number) => {
  if (riskScore >= 72) return 'critical'
  if (riskScore >= 48) return 'warning'
  if (riskScore <= 20) return 'strong'
  return 'stable'
}

const buildStudentTrackingProfile = (student: (typeof students)[number]) => {
  const studentGrades = grades.filter((grade) => grade.studentId === student.id)
  const scientificScores = studentGrades.filter((grade) => subjectDomain(grade.subject) === 'scientific').map((grade) => Math.round((grade.score / grade.max) * 100))
  const nonScientificScores = studentGrades.filter((grade) => subjectDomain(grade.subject) === 'non_scientific').map((grade) => Math.round((grade.score / grade.max) * 100))
  const scienceAverage = averageScores(scientificScores)
  const nonScienceAverage = averageScores(nonScientificScores)
  const studentAttendance = attendance.filter((record) => record.studentId === student.id)
  const lateCount = studentAttendance.filter((record) => record.status === 'late').length
  const absentCount = studentAttendance.filter((record) => record.status === 'absent').length
  const studentDiscipline = disciplineReports.filter((report) => report.studentId === student.id)
  const openDiscipline = studentDiscipline.filter((report) => report.status !== 'Resolved' && report.status !== 'Closed').length
  const missingAssignments = assignments.filter((assignment) => assignment.studentId === student.id && assignment.status === 'missing').length
  const parent = parents.find((item) => item.id === student.parentId)
  const riskScore = Math.min(100, Math.max(0,
    (100 - student.average) * 0.34 +
    (100 - student.attendance) * 0.28 +
    openDiscipline * 18 +
    absentCount * 10 +
    lateCount * 5 +
    missingAssignments * 12 +
    (student.risk === 'high' ? 16 : student.risk === 'medium' ? 8 : 0),
  ))
  const preference =
    scienceAverage !== null && nonScienceAverage !== null
      ? scienceAverage >= nonScienceAverage + 4
        ? 'Scientific preference'
        : nonScienceAverage >= scienceAverage + 4
          ? 'Non-scientific preference'
          : 'Balanced preference'
      : scienceAverage !== null
        ? 'Scientific preference'
        : nonScienceAverage !== null
          ? 'Non-scientific preference'
          : 'Insufficient evidence'
  const recommendations = [
    student.average < 70 ? 'Open a weekly academic intervention plan with the advisor.' : 'Maintain enrichment tasks and monitor the next assessment window.',
    student.attendance < 88 ? 'Send an attendance digest to the parent and require a daily check-in.' : 'Keep regular attendance monitoring active.',
    openDiscipline > 0 ? 'Schedule restorative discipline follow-up and record parent confirmation.' : 'Reinforce positive conduct notes in the student file.',
    preference === 'Scientific preference' ? 'Offer science lab extension, AP/STEM pathway guidance, and project mentorship.' : preference === 'Non-scientific preference' ? 'Offer humanities, arts, languages, leadership, and presentation pathway guidance.' : 'Use mixed STEM/humanities projects before assigning a pathway.',
  ]

  return {
    student,
    parent,
    scienceAverage,
    nonScienceAverage,
    preference,
    disciplineOpen: openDiscipline,
    disciplineTotal: studentDiscipline.length,
    absences: absentCount,
    lates: lateCount,
    missingAssignments,
    riskScore: Math.round(riskScore),
    prediction: predictionTone(riskScore),
    recommendation: recommendations[0],
    recommendations,
    alerts: {
      email: Boolean(parent?.email) && riskScore >= 48,
      sms: Boolean(parent?.phone) && (riskScore >= 48 || absentCount > 0 || openDiscipline > 0),
      report: riskScore >= 20 || studentDiscipline.length > 0,
    },
    timeline: [
      ...studentGrades.map((grade) => ({ date: grade.date, type: 'Grade', label: `${grade.subject}: ${Math.round((grade.score / grade.max) * 100)}%` })),
      ...studentAttendance.map((record) => ({ date: record.date, type: 'Attendance', label: `${record.status} - ${record.className}` })),
      ...studentDiscipline.map((report) => ({ date: report.date, type: 'Discipline', label: `${report.category}: ${report.status}` })),
    ],
  }
}

export const studentTrackingProfiles = students
  .map(buildStudentTrackingProfile)
  .sort((left, right) => right.riskScore - left.riskScore)

// Operational data must come from the Super Admin registry and backend APIs.
;[
  parents, employees, students, subjects, grades, attendance, attendanceAnalytics,
  assignments, lmsResources, schedules, scheduleConflicts, announcements, events,
  messages, internalThreads, aiSignals, aiRecommendations, reportCards,
  disciplineReports, transcripts, diagnosticTests, feeAccounts, auditLogs,
  sensitiveActions, staffOperations, performanceTrend, studentTrackingProfiles,
].forEach((collection) => collection.splice(0, collection.length))


// Production policy: this legacy module retains only schemas and configuration.
// Runtime records must come from authenticated APIs; an empty API stays empty.
;[parents, employees, students, subjects, grades, attendance, attendanceAnalytics,
  assignments, lmsResources, schedules, scheduleConflicts, announcements,
  communicationFlows, events, messages, internalThreads, aiSignals,
  aiRecommendations, reportCards, disciplineReports, transcripts, diagnosticTests,
  feeAccounts, financeReadiness, auditLogs, sensitiveActions, staffOperations,
  performanceTrend, studentTrackingProfiles].forEach((records) => records.splice(0, records.length))
