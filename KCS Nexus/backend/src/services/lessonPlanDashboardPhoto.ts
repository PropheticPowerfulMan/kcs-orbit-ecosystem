import { ApiError } from '../utils/api.js'
export async function readLessonPlanDashboardPhoto(authorization: string, dependencies: {
  verifySession: (authorization: string) => Promise<{ allowed?: boolean; nexusUserId?: unknown }>
  readAvatar: (userId: string) => Promise<string | null>
}) {
  if (!/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(authorization)) throw new ApiError(401, 'An authenticated Eduplanner session is required')
  const identity = await dependencies.verifySession(authorization)
  if (identity.allowed !== true) throw new ApiError(403, 'Eduplanner access is not allowed')
  if (typeof identity.nexusUserId !== 'string' || !/^[A-Za-z0-9-]{1,128}$/.test(identity.nexusUserId)) throw new ApiError(404, 'This Eduplanner account is not linked to Nexus')
  const avatar = await dependencies.readAvatar(identity.nexusUserId)
  return { avatar: avatar && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/s.test(avatar) ? avatar : null }
}
