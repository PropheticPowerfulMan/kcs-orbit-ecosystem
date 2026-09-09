import { prisma } from '../config/prisma.js'

export async function resolveStudentProfileId(userId: string): Promise<string | null> {
  const direct = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } })
  if (direct) return direct.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, accessCode: true, orbitUserId: true },
  })
  if (!user) return null

  const studentNumbers = [user.accessCode, user.orbitUserId].filter((value): value is string => Boolean(value?.trim()))
  const matched = await prisma.studentProfile.findFirst({
    where: {
      OR: [
        ...(studentNumbers.length ? [{ studentNumber: { in: studentNumbers, mode: 'insensitive' as const } }] : []),
        { user: { email: { equals: user.email, mode: 'insensitive' } } },
        ...(user.orbitUserId ? [{ user: { orbitUserId: user.orbitUserId } }] : []),
      ],
    },
    select: { id: true },
  })
  return matched?.id ?? null
}
