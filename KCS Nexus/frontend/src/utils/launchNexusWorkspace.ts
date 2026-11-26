export type LinkedWorkspace='academy'|'elections'|'eduplanner'
const origins:Record<LinkedWorkspace,string>={academy:'https://academy.kinshasachristianschool.org',elections:'https://kcsparentelection.kinshasachristianschool.org',eduplanner:'https://kinshasachristianschool.org'}
export class WorkspaceLaunchError extends Error {}
export function workspaceUrl(app:LinkedWorkspace,value:string){
 const url=new URL(value,window.location.origin)
 if(url.origin!==origins[app]||url.username||url.password)throw new WorkspaceLaunchError('INVALID_DESTINATION')
 const path=app==='academy'?/^\/(?:api\/auth\/callback\/?|login\/?)$/:app==='eduplanner'?/^\/lesson-plan\/$/:/^\/(?:admin\/|student-government\/)?(?:sso|login)\/$/
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

export function linkedWorkspaceLogin(app:Exclude<LinkedWorkspace,'eduplanner'>,scope:{audience?:'PARENT'|'STUDENT'|'ADMIN';workspace?:string;returnPath:string;language:string;theme:string}){
 const path=app==='academy'?'/login':scope.audience==='STUDENT'?'/student-government/login/':scope.audience==='ADMIN'?'/admin/login/':'/login/';
 const url=new URL(path,origins[app]);url.searchParams.set('nexusReturn',scope.returnPath);url.searchParams.set('lang',scope.language);url.searchParams.set('theme',scope.theme);if(app==='academy'&&scope.workspace)url.searchParams.set('workspace',scope.workspace);return workspaceUrl(app,url.href);
}
