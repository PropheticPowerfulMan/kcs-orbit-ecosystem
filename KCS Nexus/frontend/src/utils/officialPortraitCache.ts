/** Confirmed official portraits use IndexedDB, separately from personal dashboard avatars. */
const database='kcs-nexus-official-portraits-v1';
type RecordPhoto={key:string;owner:string;entity:string;photo:string;storedAt:number};
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(database,1);request.onupgradeneeded=()=>request.result.createObjectStore('portraits',{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
export async function rememberOfficialPortraits(owner:string,rows:Array<{id:string;photoData?:string|null}>,kind='student'){
 if(!owner||!('indexedDB'in globalThis))return;
 const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('portraits','readwrite'),store=tx.objectStore('portraits');
 for(const row of rows){if(row.photoData===undefined)continue;const entity=kind+':'+row.id,key=owner+':'+entity;if(!row.photoData)store.delete(key);else if(/^data:image\/(?:jpeg|png|webp);base64,/.test(row.photoData)&&row.photoData.length<300000)store.put({key,owner,entity,photo:row.photoData,storedAt:Date.now()}satisfies RecordPhoto)}
 const request=store.getAll();request.onsuccess=()=>{const entries=(request.result as RecordPhoto[]).sort((a,b)=>b.storedAt-a.storedAt);let bytes=0;entries.forEach((row,index)=>{bytes+=row.photo.length;if(index>=600||bytes>96*1024*1024)store.delete(row.key)})};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});}finally{db.close()}
}
export async function cachedOfficialPortraits(owner:string,ids:string[],kind='student'):Promise<Map<string,string>>{
 const photos=new Map<string,string>();if(!owner||!('indexedDB'in globalThis))return photos;
 const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('portraits','readonly'),store=tx.objectStore('portraits');for(const id of ids){const request=store.get(owner+':'+kind+':'+id);request.onsuccess=()=>{if(request.result?.photo)photos.set(id,request.result.photo)}}tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});}finally{db.close()}return photos;
}
