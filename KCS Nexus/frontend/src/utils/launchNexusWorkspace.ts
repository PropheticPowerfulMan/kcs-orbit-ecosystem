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
 // A noopener navigation is capturable by the installed electoral PWA. An
 // auxiliary window reserved before fetching a ticket cannot be captured.
 if(app==='elections'){
  const url=workspaceUrl(app,await request());if(!options.isCurrent())throw new WorkspaceLaunchError('ACCOUNT_CHANGED')
  // A slow connection can exhaust user activation. Keep a real, explicit link
  // for the next click rather than opening a blocked or empty browser window.
  if(navigator.userActivation?.isActive===false)return {manualUrl:url}
  window.open(url,'_blank','noopener,noreferrer')
  // noopener intentionally returns null even when opening succeeds.
  return
 }
 if(!installedNexusWindow()){const url=workspaceUrl(app,await request());if(options.isCurrent())window.location.assign(url);return}
 const origin=origins[app],requestId=crypto.randomUUID(),landing=new URL('/nexus-launch.html',origin)
 landing.hash=new URLSearchParams({request:requestId,lang:options.language==='fr'?'fr':'en',theme:options.theme==='dark'?'dark':'light'}).toString()
 // Reserve the destination tab during the actual click, before a slow network can lose user activation.
 const child=window.open(landing.href,'_blank')
 if(!child)throw new WorkspaceLaunchError('POPUP_BLOCKED')
 try{child.opener=null}catch{child.close();throw new WorkspaceLaunchError('WINDOW_ISOLATION_FAILED')}
 return new Promise<void>((resolve,reject)=>{
  let settled=false,ready=false,url='',sent=false
  const finish=(error?:unknown)=>{if(settled)return;settled=true;clearTimeout(timeout);clearInterval(ping);window.removeEventListener('message',message);if(error){try{child.close()}catch{};reject(error)}else resolve()}
  const deliver=()=>{if(!ready||!url||sent||settled)return;if(!options.isCurrent())return finish(new WorkspaceLaunchError('ACCOUNT_CHANGED'));sent=true;child.postMessage({type:'KCS_WORKSPACE_COMMIT',requestId,url},origin)}
  const message=(event:MessageEvent)=>{if(event.source!==child||event.origin!==origin||event.data?.requestId!==requestId)return;if(event.data.type==='KCS_WORKSPACE_READY'){ready=true;deliver()}else if(event.data.type==='KCS_WORKSPACE_COMMITTED'&&sent)finish()}
  window.addEventListener('message',message)
  const ping=setInterval(()=>{if(child.closed)return finish(new WorkspaceLaunchError('WINDOW_CLOSED'));if(!options.isCurrent())return finish(new WorkspaceLaunchError('ACCOUNT_CHANGED'));child.postMessage({type:'KCS_WORKSPACE_PING',requestId},origin)},200)
  const timeout=setTimeout(()=>finish(new WorkspaceLaunchError('LAUNCH_TIMEOUT')),90000)
  Promise.resolve().then(request).then(value=>{if(settled)return;url=workspaceUrl(app,value);deliver()}).catch(finish)
 })
}
