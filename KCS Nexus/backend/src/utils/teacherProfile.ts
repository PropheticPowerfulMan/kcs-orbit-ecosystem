import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { ApiError } from './api.js'
import { extractWorkspaceClasses } from './teacherClassAccess.js'

/**
 * Legacy ecosystem teachers already have a Nexus User and TeacherWorkspace, but
 * some predate TeacherProfile. Academic records require the relational profile,
 * so provision it lazily without changing the teacher's identity or workspace.
 */
export async function ensureTeacherProfile(userId: string) {
  const existing = await prisma.teacherProfile.findUnique({ where: { userId } })
  if (existing) return existing

  const [user, workspace] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
    prisma.teacherWorkspace.findUnique({ where: { userId }, select: { state: true } }),
  ])
  if (!user) throw new ApiError(404, 'Authenticated teacher not found')
  if (user.role !== 'TEACHER') throw new ApiError(403, 'Teacher profile access required')

  const assignedClasses = extractWorkspaceClasses(workspace?.state)
  const singleHomeroom = assignedClasses.length === 1 ? assignedClasses[0] : null

  try {
    return await prisma.$transaction(async (tx) => {
      const profile = await tx.teacherProfile.create({
        data: {
          userId,
          employeeNumber: `NEXUS-${userId}`,
          department: 'Academic',
          qualification: 'Ecosystem teacher profile',
          yearsOfExperience: 0,
          homeroomGrade: singleHomeroom?.grade ?? null,
          homeroomSection: singleHomeroom?.section || null,
        },
      })
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'TEACHER_PROFILE_SYNCHRONIZED',
          targetType: 'TeacherProfile',
          targetId: profile.id,
          metadata: {
            source: 'legacy-teacher-workspace',
            inferredHomeroom: singleHomeroom ?? null,
          },
        },
      })
      return profile
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrent = await prisma.teacherProfile.findUnique({ where: { userId } })
      if (concurrent) return concurrent
    }
    throw error
  }
}
