export const READ_RETRY_LIMIT = 2
export const READ_RETRY_BUDGET_MS = 65_000
export type NetworkFailure = {code?:string;response?:{status?:number};name?:string}
export const isTemporaryFailure=(error:NetworkFailure)=>error.code!=='ERR_CANCELED'&&error.name!=='AbortError'&&(!error.response||[408,425,429,502,503,504].includes(error.response.status||0))
export const isSessionRejection=(error:NetworkFailure)=>[401,403,410].includes(error.response?.status||0)
export function readRetryDelay(input:{method?:string;attempt:number;elapsed:number;status?:number;code?:string;retryAfter?:string|null;now?:number}):number|null {
 if(!['GET','HEAD','OPTIONS'].includes((input.method||'GET').toUpperCase())||input.code==='ERR_CANCELED'||input.attempt>=READ_RETRY_LIMIT||input.status!==undefined&&![408,425,429,502,503,504].includes(input.status))return null
 const retryAfter=input.retryAfter?.trim(),seconds=retryAfter?Number(retryAfter):NaN
 const directed=retryAfter?(Number.isFinite(seconds)?seconds*1000:Date.parse(retryAfter)-(input.now??Date.now())):0
 const delay=Math.max(650*2**input.attempt,Number.isFinite(directed)?directed:0)
 return input.elapsed+delay+1000<READ_RETRY_BUDGET_MS?delay:null
}
