import type {User} from '@/types'
export const isMediaAccount=(user:Pick<User,'permissions'>|null|undefined)=>Boolean(user?.permissions?.includes('nexus:media-only'))
export const portalHome=(user:Pick<User,'permissions'|'role'>)=>isMediaAccount(user)?'/portal/media/site':user.role==='admin'?'/admin':`/portal/${user.role}`

export const canManageWebsite=(user:Pick<User,'id'|'permissions'>|null|undefined)=>user?.id==='configured-superadmin'||isMediaAccount(user)
export const websiteManagementHome=(user:Pick<User,'permissions'>|null|undefined)=>isMediaAccount(user)?'/portal/media/site':'/admin/site'
