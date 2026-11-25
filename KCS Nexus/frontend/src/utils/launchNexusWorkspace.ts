export type LinkedWorkspace='academy'|'elections'
const origins:Record<LinkedWorkspace,string>={academy:'https://academy.kinshasachristianschool.org',elections:'https://kcsparentelection.kinshasachristianschool.org'}
export class WorkspaceLaunchError extends Error {}
export function workspaceUrl(app:LinkedWorkspace,value:string){
 const url=new URL(value,window.location.origin)
 if(url.origin!==origins[app]||url.username||url.password)throw new WorkspaceLaunchError('INVALID_DESTINATION')
 const path=app==='academy'?/^\/api\/auth\/callback\/?$/:/^\/(?:admin\/|student-government\/)?sso\/$/
 if(!path.test(url.pathname))throw new WorkspaceLaunchError('INVALID_DESTINATION')
 return url.href
}
export function installedNexusWindow(){
 return ['standalone','window-controls-overlay','minimal-ui','fullscreen'].some(mode=>window.matchMedia('(display-mode: '+mode+')').matches)||(navigator as Navigator&{standalone?:boolean}).standalone===true
}
/** A PWA must not replace its own origin with an external workspace: the browser adds an out-of-scope toolbar. */
export async function launchNexusWorkspace(app:LinkedWorkspace,request:()=>Promise<string>,options:{language:string;theme:string;isCurrent:()=>boolean}){
 if(!options.isCurrent())throw new WorkspaceLaunchError('ACCOUNT_CHANGED')
 // Capturable app navigation must be openerless; reserving an auxiliary tab prevents PWA capture.
 const url=workspaceUrl(app,await request())
 if(!options.isCurrent())throw new WorkspaceLaunchError('ACCOUNT_CHANGED')
 if(navigator.userActivation?.isActive===false)return {manualUrl:url}
 window.open(url,'_blank','noopener,noreferrer')
 // Browsers deliberately return null for a successful noopener navigation.
 return
}
