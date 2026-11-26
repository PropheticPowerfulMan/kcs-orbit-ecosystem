import type {User,UserRole} from '@/types'
export const isMediaAccount=(user:Pick<User,'permissions'>|null|undefined)=>Boolean(user?.permissions?.includes('nexus:media-only'))
export const canUseSeniorWorkspace=(user:Pick<User,'permissions'>|null|undefined)=>Boolean(user&&!isMediaAccount(user)&&user.permissions?.includes('nexus:senior-teacher-workspace'))
export const portalHome=(user:Pick<User,'permissions'|'role'>&Partial<Pick<User,'id'|'accessRoles'>>)=>isMediaAccount(user)?'/portal/media/site':user.id==='configured-superadmin'?'/admin':user.role==='teacher'||user.accessRoles?.includes('teacher')?'/portal/teacher':user.role==='admin'?'/admin':canUseSeniorWorkspace(user)?'/portal/senior':`/portal/${user.role}`

export const canManageWebsite=(user:Pick<User,'id'|'permissions'>|null|undefined)=>user?.id==='configured-superadmin'||isMediaAccount(user)
export const websiteManagementHome=(user:Pick<User,'permissions'>|null|undefined)=>isMediaAccount(user)?'/portal/media/site':'/admin/site'

export const canUseStaffWorkspace=(user:Pick<User,'role'|'permissions'>|null|undefined)=>Boolean(user&&(user.role==='staff'||user.role==='admin'||user.permissions?.includes('nexus:staff-workspace')||canUsePrincipalWorkspace(user)))

export const canUsePrincipalWorkspace=(user:Pick<User,'role'|'permissions'>|null|undefined)=>Boolean(user&&!isMediaAccount(user)&&(user.role==='admin'||user.permissions?.includes('nexus:principal-workspace')))
export const workspaceRole=(user:User|null|undefined,pathname:string):UserRole|undefined=>{
 if(!user)return undefined
 if(/^\/admin(?:\/|$)/.test(pathname)&&canUsePrincipalWorkspace(user))return 'admin'
 if(/^\/portal\/staff(?:\/|$)/.test(pathname)&&canUseStaffWorkspace(user))return 'staff'
 if(/^\/portal\/teacher(?:\/|$)/.test(pathname)&&(user.role==='teacher'||user.accessRoles?.includes('teacher')))return 'teacher'
 return user.role
}

export const canUseDisciplineWorkspace=(user:Pick<User,'id'|'permissions'>|null|undefined)=>Boolean(user&&!isMediaAccount(user)&&(user.id==='configured-superadmin'||user.permissions?.includes('nexus:discipline-director-workspace')))
