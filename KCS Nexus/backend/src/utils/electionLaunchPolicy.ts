import {hasPrincipalWorkspaceAccess,hasSeniorWorkspaceAccess} from './staffWorkspace.js'
export type ElectionLaunchAudience='PARENT'|'STUDENT'|'ADMIN'
export const ELECTION_ORIGIN='https://kcsparentelection.kinshasachristianschool.org'
export const ELECTION_LAUNCH_TTL_MS=120_000
export function electionManagementAccess(subject:string,user:{role?:string;permissions?:string[]}|null|undefined):'MANAGE'|'OBSERVE'|null{
 if(!user||user.permissions?.includes('nexus:media-only'))return null
 if(subject==='configured-superadmin')return 'MANAGE'
 // The Principal and ST have an explicit read-only ceiling, including through direct login.
 if(hasPrincipalWorkspaceAccess(user)||hasSeniorWorkspaceAccess(user))return 'OBSERVE'
 if(user.permissions?.includes('nexus:elections-manage'))return 'MANAGE'
 return user.permissions?.includes('nexus:elections-observe')?'OBSERVE':null
}
export function electionReturnPath(audience:ElectionLaunchAudience,value:unknown){
 const fallback=audience==='ADMIN'?'/admin':'/portal/'+audience.toLowerCase()
 if(typeof value!=='string'||value.length>500||/[\u0000-\u0020\\]/.test(value))return fallback
 const prefixes=audience==='ADMIN'?['/admin','/portal/senior','/portal/teacher','/portal/staff']: [fallback]
 try{const url=new URL(value,'https://kinshasachristianschool.org');return url.origin==='https://kinshasachristianschool.org'&&prefixes.some(prefix=>url.pathname===prefix||url.pathname.startsWith(prefix+'/'))?url.pathname:fallback}catch{return fallback}
}
export function electionLaunchUrl(audience:ElectionLaunchAudience,ticket:string){
 const prefix=audience==='STUDENT'?'/student-government':audience==='ADMIN'?'/admin':''
 return ELECTION_ORIGIN+prefix+'/sso/#launch='+encodeURIComponent(ticket)
}
export function electionSessionAllows(audience:unknown,method:string,url:string,readOnly=false){
 let pathname:string;try{pathname=new URL(url,'https://nexus.invalid').pathname}catch{return false}
 if(['ADMIN','PARENT','STUDENT'].includes(String(audience))&&method==='GET'&&pathname==='/api/elections/personal-portrait')return true
 if(audience==='ADMIN')return (/^\/api\/elections\/admin(?:\/|$)/.test(pathname)&&(!readOnly||['GET','HEAD'].includes(method)))||method==='GET'&&/^\/api\/elections\/(?:PARENT|STUDENT)\/(?:public|results|history)$/.test(pathname)
 if(audience!=='PARENT'&&audience!=='STUDENT')return false
 const prefix='/api/elections/'+audience
 return method==='GET'&&['/session','/public','/results','/history'].some(path=>pathname===prefix+path)||method==='POST'&&(pathname===prefix+'/vote'||pathname===prefix+'/applications'||new RegExp('^'+prefix+'/applications/[^/]+/photo$').test(pathname))
}
