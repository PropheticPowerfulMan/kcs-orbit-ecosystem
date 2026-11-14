import {createAccessVerifier} from './ecosystemAccessVerifier.js'
import {env} from '../config/env.js'
const verifyEcosystemAccess=createAccessVerifier({url:env.KCS_ORBIT_API_URL||'',key:env.KCS_ORBIT_API_KEY||'',organization:env.KCS_ORBIT_ORGANIZATION_ID||'',app:'KCS_NEXUS'})
import { prisma } from '../config/prisma.js'
import { ApiError } from '../utils/api.js'

export const inactiveStudentStatus = (status: unknown) => ['GRADUATED', 'ARCHIVED', 'DISMISSED', 'EXPELLED', 'DELETED', 'INACTIVE'].includes(String(status ?? '').trim().toUpperCase())
export async function assertAccountAccess(userId: string) {
  if (userId === 'configured-superadmin') return
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id:true,email:true,accessCode:true,orbitUserId:true,accountBlockedAt: true, role: true, studentProfile: { select: { status: true, archive: { select: { id: true } } } } } })
  if(user)await verifyEcosystemAccess([user.id,user.email,user.accessCode,user.orbitUserId])
  if (!user || user.accountBlockedAt || (user.role === 'STUDENT' && (inactiveStudentStatus(user.studentProfile?.status) || user.studentProfile?.archive))) {
    throw new ApiError(403, 'This account is inactive or archived. Contact the school administration.')
  }
}
