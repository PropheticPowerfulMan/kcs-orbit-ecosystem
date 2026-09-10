import { prisma } from '../config/prisma.js'

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const normalize = (value: string | null | undefined) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const gradeNumber = (value: string) => value.match(/(?:grade|g)\s*(\d{1,2})/i)?.[1]

const portalEntry = (entry: any) => ({
  id: entry.id, sourceKey: entry.sourceKey, academicYear: entry.academicYear, semester: entry.semester,
  classGroup: entry.classGroup, day: entry.day, period: entry.period, startTime: entry.startTime,
  endTime: entry.endTime, room: entry.room || 'Room to confirm',
  teacher: entry.teacherName || 'Teacher to confirm', sourceDocument: entry.sourceDocument,
  course: { id: entry.sourceKey, name: entry.classGroup ? `${entry.subject} (${entry.classGroup})` : entry.subject, code: entry.sourceKey, description: `Official 2026-2027 semester 1 timetable · ${entry.grade}` },
})
const ordered = (rows: any[]) => rows.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime) || (a.course?.name || a.subject).localeCompare(b.course?.name || b.subject))

export async function academicScheduleForGrade(grade: string, section?: string | null) {
  const number = gradeNumber(grade) || gradeNumber(section || '')
  if (!number) return []
  const canonicalGrade = `Grade ${number}`
  const normalizedSection = normalize(section)
  const group = /(?:^| )9 ?a(?: |$)/.test(normalizedSection) ? 'G9A' : /(?:^| )9 ?b(?: |$)/.test(normalizedSection) ? 'G9B' : null
  const rows = await prisma.academicScheduleEntry.findMany({ where: { academicYear: '2026-2027', semester: 1, grade: canonicalGrade, active: true, ...(group ? { OR: [{ classGroup: null }, { classGroup: group }] } : {}) } })
  return ordered(rows.map(portalEntry))
}

export async function academicScheduleForTeacher(user: { firstName: string; middleName?: string | null; lastName: string } | null | undefined) {
  if (!user) return []
  const identityTokens = new Set(normalize([user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')).split(' ').filter(Boolean))
  const rows = await prisma.academicScheduleEntry.findMany({ where: { academicYear: '2026-2027', semester: 1, active: true, teacherName: { not: null } } })
  return ordered(rows.filter((row) => normalize(row.teacherName).split(' ').some((token) => identityTokens.has(token))).map((row) => ({ ...portalEntry(row), courseId: row.sourceKey, courseName: row.classGroup ? `${row.subject} (${row.classGroup})` : `${row.subject} · ${row.grade}`, studentCount: null, grade: row.grade })))
}

export async function fullAcademicSchedule() {
  const rows = await prisma.academicScheduleEntry.findMany({ where: { academicYear: '2026-2027', semester: 1, active: true } })
  return ordered(rows.map((row) => ({ ...portalEntry(row), grade: row.grade })))
}
