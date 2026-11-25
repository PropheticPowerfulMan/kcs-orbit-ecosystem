import {createHash,randomBytes} from 'node:crypto'
// Nexus-only administrators need no invented teacher or shared Orbit account.
// Opaque, process-local sessions fail closed on restart and never carry credentials.
export function createAcademyNexusSessions(now=Date.now){
 const tickets=new Map<string,{id:string;expiresAt:number}>(),sessions=new Map<string,{id:string;expiresAt:number}>();
 const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
 const prune=()=>{for(const pool of[tickets,sessions])for(const[k,v]of pool)if(v.expiresAt<=now())pool.delete(k)};
 return{
  issue(id:string){prune();if(tickets.size+sessions.size>=10000)throw new Error('Academy launch is busy');const token=randomBytes(32).toString('base64url');tickets.set(hash(token),{id,expiresAt:now()+60000});return token},
  exchange(ticket:unknown){prune();if(typeof ticket!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(ticket))return null;const k=hash(ticket),r=tickets.get(k);if(!r)return null;tickets.delete(k);const token='nxacad_'+randomBytes(32).toString('base64url'),session={id:r.id,expiresAt:now()+8*60*60*1000};sessions.set(hash(token),session);return{token,...session}},
  read(token:unknown){prune();return typeof token==='string'&&/^nxacad_[A-Za-z0-9_-]{43}$/.test(token)?sessions.get(hash(token))||null:null},
  revoke(token:unknown){if(typeof token==='string')sessions.delete(hash(token))},
 }
}
