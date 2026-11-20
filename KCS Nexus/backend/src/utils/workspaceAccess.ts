import {createHash} from 'node:crypto'
import {STAFF_WORKSPACE_PERMISSION,PRINCIPAL_WORKSPACE_PERMISSION,SENIOR_WORKSPACE_PERMISSION,hasStaffWorkspaceAccess,hasPrincipalWorkspaceAccess,hasSeniorWorkspaceAccess} from './staffWorkspace.js'
export const WORKSPACE_KEYS=['staff','principal','senior'] as const
export type Workspace=typeof WORKSPACE_KEYS[number]
const permissionByWorkspace:Record<Workspace,string>={staff:STAFF_WORKSPACE_PERMISSION,principal:PRINCIPAL_WORKSPACE_PERMISSION,senior:SENIOR_WORKSPACE_PERMISSION}
type Account={role:string;permissions:string[]}
export const explicitWorkspaces=(account:Account)=>WORKSPACE_KEYS.filter(workspace=>account.permissions.includes(permissionByWorkspace[workspace]))
export const workspaceAccessVersion=(account:Account)=>createHash('sha256').update(JSON.stringify([account.role.toUpperCase(),explicitWorkspaces(account)])).digest('hex')
export function workspaceAccessView(account:Account){
 const includedWorkspaces:Workspace[]=account.role.toUpperCase()==='ADMIN'?['staff','principal']:account.role.toUpperCase()==='STAFF'?['staff']:[]
 const workspaces:Workspace[]=[]
 if(hasStaffWorkspaceAccess(account))workspaces.push('staff')
 if(hasPrincipalWorkspaceAccess(account))workspaces.push('principal')
 if(hasSeniorWorkspaceAccess(account))workspaces.push('senior')
 return {enabled:hasStaffWorkspaceAccess(account),included:includedWorkspaces.length>0,workspace:hasPrincipalWorkspaceAccess(account)?'principal':'staff',workspaces,grantedWorkspaces:explicitWorkspaces(account),includedWorkspaces,version:workspaceAccessVersion(account)}
}
export function selectedWorkspacePermissions(account:Account,workspaces:readonly Workspace[]){
 const local=new Set(Object.values(permissionByWorkspace))
 return [...new Set([...account.permissions.filter(value=>!local.has(value)),...WORKSPACE_KEYS.filter(value=>workspaces.includes(value)).map(value=>permissionByWorkspace[value])])]
}
export function toggleWorkspacePermissions(account:Account,workspace:Workspace,enabled:boolean){
 const permissions=account.permissions.filter(value=>value!==permissionByWorkspace[workspace])
 if(enabled)permissions.push(permissionByWorkspace[workspace])
 return [...new Set(permissions)]
}
