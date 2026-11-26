// One editor, one authenticated content/settings signature. No persistent PDF cache.
export function createPreparedPreviewCache({now=()=>Date.now(),ttl=180000}={}){
 let current=null;
 return {
  get(key,create,force=false){
   if(!force&&current?.key===key&&(current.pending||current.expires>now()))return current.promise;
   const entry={key,pending:true,expires:0,promise:null};
   entry.promise=Promise.resolve().then(create).then(value=>{entry.pending=false;entry.expires=now()+ttl;return value},error=>{if(current===entry)current=null;throw error});
   current=entry;return entry.promise;
  },
  clear(){current=null}
 };
}
