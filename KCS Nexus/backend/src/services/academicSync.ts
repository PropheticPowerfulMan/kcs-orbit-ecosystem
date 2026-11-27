import {gradePoints as kcsGradePoints,creditWeightedGpa}from '../utils/academicGpa.js'
import type { Prisma, PrismaClient } from '@prisma/client'
import { attendanceRateFromStatuses } from '../utils/attendancePolicy.js'

type DbClient = PrismaClient | Prisma.TransactionClient
export const attendanceRate = attendanceRateFromStatuses
export const gradePoints = kcsGradePoints
export const weightedGpa = (grades:Array<{percentage:number;course:{credits:number}}>)=>creditWeightedGpa(grades.map(g=>({percentage:g.percentage,credits:Math.max(g.course.credits||1,1)}))).gpa
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
