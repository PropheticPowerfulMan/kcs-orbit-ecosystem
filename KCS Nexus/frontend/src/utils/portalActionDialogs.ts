type Kind='confirm'|'prompt'|'alert'
export type PortalActionDialog={id:number;kind:Kind;message:string;initialValue:string;resolve:(answer:boolean|string|null)=>void}
const listeners=new Set<()=>void>()
let queue:PortalActionDialog[]=[],sequence=0
export const subscribePortalDialogs=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}}
export const currentPortalDialog=()=>queue[0]||null
const publish=()=>{for(const listener of listeners)listener()}
const ask=(kind:Kind,message:string,initialValue='')=>{
 // A repeated click while its question is open must never duplicate a destructive action.
 if(queue.some(item=>item.kind===kind&&item.message===message))return Promise.resolve(kind==='confirm'?false:null)
 return new Promise<boolean|string|null>(resolve=>{queue=[...queue,{id:++sequence,kind,message,initialValue,resolve}];publish()})
}
export const confirmPortalAction=(message:string)=>ask('confirm',message).then(value=>value===true)
export const promptPortalAction=(message:string,initialValue='')=>ask('prompt',message,initialValue).then(value=>typeof value==='string'?value:null)
export const alertPortalMessage=(message:string)=>ask('alert',message).then(()=>undefined)
export function answerPortalDialog(id:number,answer:boolean|string|null){const active=queue[0];if(!active||active.id!==id)return;queue=queue.slice(1);active.resolve(answer);publish()}
export function cancelPortalDialogs(){const pending=queue;queue=[];for(const item of pending)item.resolve(item.kind==='confirm'?false:null);publish()}
