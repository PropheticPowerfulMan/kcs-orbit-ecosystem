// Personal Nexus portraits only. Official registry photos never enter this cache.
const memory=new Map<string,string|null>(),versions=new Map<string,number>(),requests=new Map<string,Promise<string|null>>()
const database=()=>new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('kcs-nexus-media-cache',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('avatars'))request.result.createObjectStore('avatars')};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
async function stored(id:string){try{const db=await database();try{return await new Promise<Blob|null>((resolve,reject)=>{const r=db.transaction('avatars','readonly').objectStore('avatars').get(id);r.onsuccess=()=>resolve(r.result instanceof Blob?r.result:null);r.onerror=()=>reject(r.error)})}finally{db.close()}}catch{return null}}
async function persist(id:string,blob:Blob|null,version=versions.get(id)||0){try{const db=await database();try{if(version!==(versions.get(id)||0))return;await new Promise<void>((resolve,reject)=>{const tx=db.transaction('avatars','readwrite'),store=tx.objectStore('avatars');if(blob)store.put(blob,id);else store.delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}catch{/* Offline cache failure cannot discard an in-memory portrait. */}}
export function rememberPersonalAvatar(id:string,value:string){
 if(value!==''&&!value.startsWith('data:image/'))return
 versions.set(id,(versions.get(id)||0)+1);memory.set(id,value||null)
 if(!value){void persist(id,null);return}
 try{const match=value.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s);if(!match)return;const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));void persist(id,new Blob([bytes],{type:match[1]}))}catch{/* Keep the valid display value if durable storage is unavailable. */}
}
export async function cachedPersonalAvatar(id:string){
 if(memory.has(id))return memory.get(id)||null
 const version=versions.get(id)||0,blob=await stored(id)
 if(version!==(versions.get(id)||0))return memory.get(id)||null
 if(!blob?.size)return null
 const url=URL.createObjectURL(blob);memory.set(id,url);return url
}
export function loadPersonalAvatar(id:string,load:()=>Promise<Blob>,onCached?:(url:string)=>void,force=false){
 if(!force&&requests.has(id))return requests.get(id)!
 const version=versions.get(id)||0
 const promise=(async()=>{
  const cached=await cachedPersonalAvatar(id);if(version!==(versions.get(id)||0))return memory.get(id)||null;if(cached)onCached?.(cached)
  try{const blob=await load();if(version!==(versions.get(id)||0))return memory.get(id)||null;if(!(blob instanceof Blob)||!blob.size||!blob.type.startsWith('image/'))return cached;const url=URL.createObjectURL(blob);memory.set(id,url);void persist(id,blob);return url}catch{return memory.get(id)||cached}
 })().finally(()=>{if(requests.get(id)===promise)requests.delete(id)})
 requests.set(id,promise);return promise
}
