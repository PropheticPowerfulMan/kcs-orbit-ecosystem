import type { Prisma, PrismaClient } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient
const attendedStatuses = new Set(['PRESENT', 'LATE', 'EXCUSED'])
export const attendanceRate = (statuses: string[]) => statuses.length ? Number((statuses.filter((status) => attendedStatuses.has(status)).length * 100 / statuses.length).toFixed(1)) : null
export const gradePoints = (percentage: number) => percentage >= 90 ? 4 : percentage >= 80 ? 3 : percentage >= 70 ? 2 : percentage >= 60 ? 1 : 0
export const weightedGpa = (grades: Array<{ percentage: number; course: { credits: number } }>) => {
  const credits = grades.reduce((sum, grade) => sum + Math.max(grade.course.credits || 1, 1), 0)
  return credits ? Number((grades.reduce((sum, grade) => sum + gradePoints(grade.percentage) * Math.max(grade.course.credits || 1, 1), 0) / credits).toFixed(2)) : null
}
export async function synchronizeStudentAcademicMetrics(db: DbClient, studentIds: string[]) {
  const ids = [...new Set(studentIds)].filter(Boolean)
  if (!ids.length) return []
  const [attendance, approved, current] = await Promise.all([
    db.attendanceRecord.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, status: true } }),
    db.grade.findMany({ where: { studentId: { in: ids }, assignmentId: null, period: { endsWith: '::APPROVED' } }, select: { studentId: true, percentage: true, course: { select: { credits: true } } } }),
    db.grade.findMany({ where: { studentId: { in: ids }, period: 'CURRENT' }, select: { studentId: true, percentage: true, course: { select: { credits: true } } } }),
  ])
  const metrics = ids.map((studentId) => {
    const official = approved.filter((row) => row.studentId === studentId)
    return { studentId, attendanceRate: attendanceRate(attendance.filter((row) => row.studentId === studentId).map((row) => row.status)), gpa: weightedGpa(official.length ? official : current.filter((row) => row.studentId === studentId)) }
  })
  for (const metric of metrics) await db.studentProfile.update({ where: { id: metric.studentId }, data: { attendanceRate: metric.attendanceRate, gpa: metric.gpa } })
  return metrics
}