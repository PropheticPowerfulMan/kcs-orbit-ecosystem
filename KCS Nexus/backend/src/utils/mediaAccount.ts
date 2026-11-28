export const MEDIA_ONLY_PERMISSION='nexus:media-only'
export function isMediaAccount(account:{permissions?:readonly string[]|null}|null|undefined){return Boolean(account?.permissions?.includes(MEDIA_ONLY_PERMISSION))}
/** Restrict the account at every authenticated endpoint, including direct URL calls. */
export function mediaRequestAllowed(method:string,originalUrl:string,userId:string){
 const path=new URL(originalUrl,'http://nexus.internal').pathname.replace(/\/$/,'')
 if(/^\/api\/(?:news|events|media)(?:\/|$)/.test(path))return ['GET','POST','PUT','DELETE'].includes(method)
 if(method==='GET'&&path==='/api/site-content/manage')return true
 if(method==='PUT'&&/^\/api\/site-content\/(?:home|about|academics|admissions|news|gallery|contact|school-handbook|shared)$/.test(path))return true
 if(method==='GET'&&/^\/api\/value-word(?:\/|$)/.test(path))return true
 if(method==='GET'&&path==='/api/notifications')return true
 if(method==='PATCH'&&(/^\/api\/notifications\/[^/]+\/read$/.test(path)||path==='/api/notifications/read-all'))return true
 if(method==='POST'&&path==='/api/notifications/bulk-delete')return true
 if(method==='GET')return path==='/api/auth/me'||path==='/api/auth/avatar/'+encodeURIComponent(userId)
 if(method==='PUT')return ['/api/auth/profile','/api/auth/change-password','/api/auth/access-code'].includes(path)
 if(method==='POST')return ['/api/auth/2fa/setup','/api/auth/2fa/toggle','/api/auth/2fa/verify'].includes(path)
 return false
}
