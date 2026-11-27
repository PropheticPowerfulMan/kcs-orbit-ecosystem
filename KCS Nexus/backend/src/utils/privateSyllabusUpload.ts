import path from 'node:path'
/** Private syllabus files may only be served by the authenticated download route. */
export function privateSyllabusUploadStatus(raw:string):404|400|null{let value=raw;try{for(let i=0;i<4;i++){const decoded=decodeURIComponent(value);if(decoded===value)break;value=decoded}}catch{return 400}if(value.includes(String.fromCharCode(0)))return 400;const normalized=path.posix.normalize('/'+value.split(String.fromCharCode(92)).join('/'));return normalized.split('/')[1]?.toLowerCase()==='syllabi'?404:null}
