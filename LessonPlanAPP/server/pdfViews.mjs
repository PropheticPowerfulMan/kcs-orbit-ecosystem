import{randomBytes}from'node:crypto';
// Short-lived read-only capabilities allow native, same-origin PDF previews under the site's CSP.
export function createPdfViews({now=()=>Date.now(),maxBytes=32*1024*1024,lifetime=5*60*1000}={}){
 const entries=new Map();let size=0;
 function purge(){for(const[key,value]of entries)if(value.expires<=now()){size-=value.bytes.length;entries.delete(key)}}
 return{put(pdf){purge();if(pdf.bytes.length>maxBytes)throw Object.assign(new Error('The PDF exceeds the preview limit.'),{status:413});while(size+pdf.bytes.length>maxBytes){const first=entries.keys().next().value;size-=entries.get(first).bytes.length;entries.delete(first)}const token=randomBytes(32).toString('hex');entries.set(token,{...pdf,expires:now()+lifetime});size+=pdf.bytes.length;return token},get(token){purge();return typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)?entries.get(token):undefined}};
}
