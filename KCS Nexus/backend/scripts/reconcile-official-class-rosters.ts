import { prisma } from '../src/config/prisma.js'
import { normalizeClassParts } from '../src/utils/className.js'
import { reconcileOfficialClassCourseEnrollments } from '../src/services/officialClassRoster.js'

async function main() {
  const students = await prisma.studentProfile.findMany({
    where: { status: { equals: 'active', mode: 'insensitive' } },
    select: { id: true, grade: true, section: true },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }, { id: 'asc' }],
  })
  const summary = { students: students.length, enrolled: 0, removed: 0 }
  for (const student of students) {
    const officialClass = normalizeClassParts(student.grade, student.section)
    const result = await prisma.$transaction((tx) => reconcileOfficialClassCourseEnrollments(tx, [student.id], officialClass))
    summary.enrolled += result.enrolled
    summary.removed += result.removed
  }
  await prisma.auditLog.create({ data: { actorId: null, action: 'OFFICIAL_CLASS_ROSTERS_RECONCILED', targetType: 'ClassRoster', targetId: new Date().toISOString(), metadata: summary } })
  console.log(JSON.stringify({ ok: true, ...summary }))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
})
