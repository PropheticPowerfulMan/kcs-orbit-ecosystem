const nexusOrigin='https://kinshasachristianschool.org'
export function safeNexusReturn(value:unknown):string|null{
 if(typeof value!=='string'||value.length>1000||!value.startsWith('/')||value.startsWith('//')||/[\\\r\n]/.test(value))return null
 try{const url=new URL(value,nexusOrigin);return url.origin===nexusOrigin&&/^\/(?:admin|portal\/(?:teacher|staff|senior|student|parent))(?:\/|$)/.test(url.pathname)&&!url.search&&!url.hash?url.pathname:null}catch{return null}
}
export function defaultNexusReturn(role:string){return ['admin','super_admin','administrator','principal'].includes(role.toLowerCase())?'/admin':['student','parent','staff'].includes(role.toLowerCase())?'/portal/'+role.toLowerCase():'/portal/teacher'}
export const nexusReturnUrl=(value:unknown,role:string)=>nexusOrigin+(safeNexusReturn(value)||defaultNexusReturn(role))
export function rememberNexusReturn(value:unknown){const path=safeNexusReturn(value);if(path)try{sessionStorage.setItem('kcs-edup-nexus-return',path)}catch{}}
export function eduplannerNexusReturn(role:string,workspace?:string){if(workspace==='senior')return nexusOrigin+'/portal/senior';if(workspace==='superadmin'||workspace==='principal')return nexusOrigin+'/admin';let path:string|null=null;try{path=sessionStorage.getItem('kcs-edup-nexus-return')}catch{}return nexusReturnUrl(path,role)}
