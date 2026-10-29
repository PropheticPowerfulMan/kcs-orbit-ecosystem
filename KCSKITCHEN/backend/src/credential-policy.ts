export const NEXUS_CONFIGURED_SUPERADMIN_ID = 'configured-superadmin'

export type CredentialPolicySubject = {
  userId: string
  orbitPersonId: string
  explicitKitchenAdmin: boolean
}

export function canManageOwnKitchenCredentials(subject: CredentialPolicySubject) {
  return subject.userId !== NEXUS_CONFIGURED_SUPERADMIN_ID && subject.explicitKitchenAdmin
}

export function reauthenticatedAsSameAccount(sessionUserId: string, authenticatedUserId: unknown) {
  return typeof authenticatedUserId === 'string' && authenticatedUserId === sessionUserId
}
