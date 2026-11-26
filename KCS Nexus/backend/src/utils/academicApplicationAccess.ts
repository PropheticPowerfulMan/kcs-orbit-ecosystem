import {hasPrincipalWorkspaceAccess,hasSeniorWorkspaceAccess} from './staffWorkspace.js'
export type AcademicWorkspace='superadmin'|'principal'|'senior'|'teacher'|'student'
type Account={role:string;permissions?:string[];teacherProfile?:unknown}
/** Application scope is derived from current school grants, never from the active screen. */
export function academicWorkspaceFor(account:Account|null|undefined,superadmin=false):AcademicWorkspace|null{
 if(!account||account.permissions?.includes('nexus:media-only'))return null
 const role=account.role.toUpperCase()
 if(!['ADMIN','STAFF','TEACHER'].includes(role))return role==='STUDENT'?'student':null
 if(superadmin)return 'superadmin'
 if(account.permissions?.includes('nexus:principal-workspace'))return 'principal'
 if(hasSeniorWorkspaceAccess(account))return 'senior'
 if(hasPrincipalWorkspaceAccess(account))return 'principal'
 return role==='TEACHER'||account.teacherProfile?'teacher':null
}
export const academyRoleFor=(workspace:AcademicWorkspace)=>workspace==='superadmin'?'SUPER_ADMIN':workspace==='principal'||workspace==='senior'?'ADMIN':workspace==='student'?'STUDENT':'TEACHER'
export const academicNexusHome=(workspace:AcademicWorkspace)=>workspace==='superadmin'||workspace==='principal'?'/admin':'/portal/'+(workspace==='senior'?'senior':workspace)

/** A selected view may use only a currently granted workspace; teaching is the default when available. */
export function selectedAcademicWorkspace(account:Account|null|undefined,superadmin=false,requested?:unknown):AcademicWorkspace|null{
 const granted=academicWorkspaceFor(account,superadmin);if(!granted)return null
 const teaching=account?.role.toUpperCase()==='TEACHER'||Boolean(account?.teacherProfile)
 if(requested===undefined||requested===null||requested==='')return superadmin?'superadmin':teaching?'teacher':granted
 if(requested==='teacher')return teaching?'teacher':null
 if(requested==='superadmin')return superadmin?'superadmin':null
 if(requested==='principal')return hasPrincipalWorkspaceAccess(account)?'principal':null
 if(requested==='senior')return hasSeniorWorkspaceAccess(account)?'senior':null
 if(requested==='student')return account?.role.toUpperCase()==='STUDENT'?'student':null
 return null
}
