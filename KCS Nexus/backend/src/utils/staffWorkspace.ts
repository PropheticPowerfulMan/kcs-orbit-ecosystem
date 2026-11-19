export const STAFF_WORKSPACE_PERMISSION = 'nexus:staff-workspace'
export const SENIOR_WORKSPACE_PERMISSION = 'nexus:senior-teacher-workspace'
export const PRINCIPAL_WORKSPACE_PERMISSION = 'nexus:principal-workspace'
type Account = { role?: string; permissions?: string[] } | null | undefined
export const hasPrincipalWorkspaceAccess = (account: Account) => Boolean(account && !account.permissions?.includes('nexus:media-only') && (account.role?.toUpperCase() === 'ADMIN' || account.permissions?.includes(PRINCIPAL_WORKSPACE_PERMISSION)))
export const hasStaffWorkspaceAccess = (account: Account) => Boolean(account && (account.role?.toUpperCase() === 'STAFF' || hasPrincipalWorkspaceAccess(account) || account.permissions?.includes(STAFF_WORKSPACE_PERMISSION)))
export const hasSeniorWorkspaceAccess = (account: Account) => Boolean(account && !account.permissions?.includes('nexus:media-only') && account.permissions?.includes(SENIOR_WORKSPACE_PERMISSION))
const localPermissions = [STAFF_WORKSPACE_PERMISSION, PRINCIPAL_WORKSPACE_PERMISSION, SENIOR_WORKSPACE_PERMISSION]
// Federated profiles cannot grant or revoke locally administered workspace rights.
export const mergeStaffWorkspacePermission = (local: string[], external: string[]) => [...new Set([...external.filter(p => !localPermissions.includes(p)), ...local.filter(p => localPermissions.includes(p))])]

export const requestedWorkspaceRole = (account: Account, requested: string, hasTeacherProfile = false): 'admin' | 'staff' | 'teacher' | null => {
  if (!account || account.permissions?.includes('nexus:media-only')) return null
  if (requested === 'admin') return hasPrincipalWorkspaceAccess(account) ? 'admin' : null
  if (requested === 'staff') return hasStaffWorkspaceAccess(account) ? 'staff' : null
  if (requested === 'teacher') return account.role?.toUpperCase() === 'TEACHER' || hasTeacherProfile ? 'teacher' : null
  return null
}
