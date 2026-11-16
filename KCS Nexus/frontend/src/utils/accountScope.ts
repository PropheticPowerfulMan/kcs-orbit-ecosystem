import type {User} from '@/types'
export const isMediaAccount=(user:Pick<User,'permissions'>|null|undefined)=>Boolean(user?.permissions?.includes('nexus:media-only'))
export const portalHome=(user:Pick<User,'permissions'|'role'>)=>isMediaAccount(user)?'/portal/media/news':user.role==='admin'?'/admin':`/portal/${user.role}`
