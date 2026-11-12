import { prisma } from '../config/prisma.js'
import { ApiError } from '../utils/api.js'

export const inactiveStudentStatus = (status: unknown) => ['GRADUATED', 'ARCHIVED', 'DISMISSED', 'EXPELLED', 'DELETED', 'INACTIVE'].includes(String(status ?? '').trim().toUpperCase())
export async function assertAccountAccess(userId: string) {
  if (userId === 'configured-superadmin') return
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { accountBlockedAt: true, role: true, studentProfile: { select: { status: true, archive: { select: { id: true } } } } } })
  if (!user || user.accountBlockedAt || (user.role === 'STUDENT' && (inactiveStudentStatus(user.studentProfile?.status) || user.studentProfile?.archive))) {
    throw new ApiError(403, 'This account is inactive or archived. Contact the school administration.')
  }
}
