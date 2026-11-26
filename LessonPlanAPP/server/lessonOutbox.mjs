export const clientId=()=>typeof globalThis.crypto?.randomUUID==='function'?globalThis.crypto.randomUUID():Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16))).map(n=>n.toString(16).padStart(2,'0')).join('');
// Durable, actor-bound outbox. Conditional writes prevent one device overwriting another.
const stable=value=>JSON.stringify(value&&typeof value==='object'?(Array.isArray(value)?value.map(v=>JSON.parse(stable(v))):Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,JSON.parse(stable(value[k]))]))):value??null);
export function createLessonOutbox({storage,actor,remote,emit=()=>{}}){
 const jobs=new Map(),states=new Map(),acknowledged=new Map();let generation=0;
 const key=id=>'powerful-lesson-planner:outbox:v1:'+id;
 const revisions=id=>'powerful-lesson-planner:revisions:v1:'+id;
 const read=k=>JSON.parse(storage.getItem(k)||'{}');
 const write=(k,v)=>storage.setItem(k,JSON.stringify(v));
 const readRevisions=owner=>{
  const records=read(revisions(owner));let changed=false;
  for(const row of Object.values(records)){if(row?.payload&&Object.keys(row.payload).some(key=>key!=='saveRevisionId')){row.payload={...(row.payload.saveRevisionId?{saveRevisionId:row.payload.saveRevisionId}:{})};changed=true}}
  if(changed)write(revisions(owner),records);
  return records;
 };
 const state=(id,status,error)=>{const value={id,status,error:error?.message||'',code:error?.code||''};states.set(id,value);emit(value);return value};
 const remember=(id,row)=>{const owner=actor();if(!owner)return;write(revisions(owner),{...readRevisions(owner),[id]:{revision:row.updated_at,payload:{...(row.payload?.saveRevisionId?{saveRevisionId:row.payload.saveRevisionId}:{})}}});if(!read(key(owner))[id])state(id,'saved')};
 const pending=(id)=>{const owner=actor();return owner?read(key(owner))[id]:undefined};
 async function run(id,owner){
  while(actor()===owner){
   const operation=read(key(owner))[id];if(!operation)return state(id,'saved');
   state(id,'saving');
   try{
    let known=readRevisions(owner)[id];
    if(!known){
     const existing=await remote.read(id);
     if(existing){
      if(stable(existing.payload)!==stable(operation.row.payload)&&!operation.ownWrites?.includes(existing.payload?.saveRevisionId))throw Object.assign(new Error('The server contains another version. Your local draft is preserved. Reload the server version or save your draft as a copy.'),{code:'conflict'});
      known={revision:existing.updated_at,payload:existing.payload};remember(id,existing);
     }
    }
    if(actor()!==owner)throw new Error('The active account changed. This draft remains on its original account.');
    const result=await remote.write(operation.row,known?.revision,known?.payload?.saveRevisionId);
    const saved=await remote.read(id);
    if(!result&&saved&&(saved.updated_at!==known?.revision||saved.payload?.saveRevisionId!==known?.payload?.saveRevisionId)&&operation.ownWrites?.includes(saved.payload?.saveRevisionId)){remember(id,saved);continue}
    if(!saved||stable(saved.payload)!==stable(operation.row.payload))throw Object.assign(new Error('A newer server version was found. Your local draft is preserved.'),{code:result?'conflict':'conflict'});
    if(actor()!==owner)throw new Error('The active account changed.');
    remember(id,saved);acknowledged.set(id,++generation);
    const queue=read(key(owner));if(queue[id]?.version===operation.version){delete queue[id];write(key(owner),queue)}
   }catch(error){state(id,error.code==='conflict'?'conflict':'pending',error);throw error}
  }
  throw new Error('The active account changed.');
 }
 const flush=id=>{
  const owner=actor();if(!owner)return Promise.reject(new Error('Sign in to synchronize your saved draft.'));
  const jobKey=owner+':'+id;if(jobs.has(jobKey))return jobs.get(jobKey);
  const job=run(id,owner).finally(()=>jobs.delete(jobKey));jobs.set(jobKey,job);return job;
 };
 return {
  enqueue(row,owner=actor()){
   if(!owner||owner!==actor())throw new Error('The draft must be saved by its active account.');
   const queue=read(key(owner)),previous=queue[row.id],version=clientId();
   let ownWrites=[...new Set([...(previous?.ownWrites||[]),previous?.version].filter(Boolean))];if(ownWrites.length>256)ownWrites=[ownWrites[0],...ownWrites.slice(-255)];
   queue[row.id]={row:{...row,payload:{...row.payload,saveRevisionId:version}},version,ownWrites};write(key(owner),queue);state(row.id,'pending');
   void flush(row.id).catch(()=>{});
  },
  flush,pending,remember,
  generation:()=>generation,changedSince:(id,epoch)=>(acknowledged.get(id)||0)>epoch,
  status:id=>states.get(id)||{id,status:pending(id)?'pending':actor()&&readRevisions(actor())[id]?'saved':'unverified',error:'',code:''},
  async retry(){const owner=actor();if(!owner)return;await Promise.allSettled(Object.keys(read(key(owner))).map(flush))},
  discard(id){const owner=actor();if(!owner)return;const queue=read(key(owner));delete queue[id];write(key(owner),queue);state(id,'saved')}
 };
}
