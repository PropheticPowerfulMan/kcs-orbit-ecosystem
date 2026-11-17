export const STAFF_WORKSPACE_PERMISSION='nexus:staff-workspace'
export const hasStaffWorkspaceAccess=(account:{role?:string;permissions?:string[]}|null|undefined)=>Boolean(account&&((account.role||'').toUpperCase()==='STAFF'||(account.role||'').toUpperCase()==='ADMIN'||account.permissions?.includes(STAFF_WORKSPACE_PERMISSION)))
export const mergeStaffWorkspacePermission=(local:string[],external:string[])=>[...new Set([...external.filter(p=>p!==STAFF_WORKSPACE_PERMISSION),...local.filter(p=>p===STAFF_WORKSPACE_PERMISSION)])]
