import { prisma } from '../config/prisma.js'
import { ApiError } from './api.js'

export async function databaseActorId(sessionUserId: string): Promise<string> {
  const account = await prisma.user.findUnique({
    where: sessionUserId === 'configured-superadmin'
      ? { email: process.env.SUPERADMIN_EMAIL || 'superadmin@kcsnexus.com' }
      : { id: sessionUserId },
    select: { id: true },
  })
  if (!account) throw new ApiError(409, 'The publishing account is not synchronized with the school registry. Reload your session.')
  return account.id
}
