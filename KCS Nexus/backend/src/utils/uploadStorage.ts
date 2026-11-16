// Load the same local environment as config/env before resolving any upload paths.
import 'dotenv/config'
import path from 'node:path'
import {existsSync,readFileSync} from 'node:fs'
import {mkdir,access,realpath} from 'node:fs/promises'
import {constants} from 'node:fs'

export function resolveUploadRoot(environment:NodeJS.ProcessEnv=process.env,cwd=process.cwd()){
 return path.resolve(environment.NEXUS_UPLOADS_DIR||environment.UPLOAD_ROOT||(environment.NODE_ENV==='production'?'/app/uploads':path.join(cwd,'uploads')))
}
export const uploadRoot=resolveUploadRoot()
export const uploadPath=(...segments:string[])=>path.join(uploadRoot,...segments)
export function isMountedUploadPath(directory:string,mountInfo:string){
 const root=path.resolve(directory)
 return mountInfo.trim().split('\n').some(line=>{const mount=line.split(' ')[4]?.replace(/\\040/g,' ');return mount&&mount!=='/'&&(root===mount||root.startsWith(mount+'/'))})
}
/** Refuse to run production in Docker with uploads on the disposable container layer. */
export async function ensureUploadStorage(){
 await mkdir(uploadRoot,{recursive:true})
 await access(uploadRoot,constants.R_OK|constants.W_OK)
 if(process.env.NODE_ENV==='production'&&existsSync('/.dockerenv')){
  const actual=await realpath(uploadRoot)
  if(!isMountedUploadPath(actual,readFileSync('/proc/self/mountinfo','utf8')))throw new Error('Persistent upload storage is not mounted. Refusing startup to protect published files.')
 }
}
