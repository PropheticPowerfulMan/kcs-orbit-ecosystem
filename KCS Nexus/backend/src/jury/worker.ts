import {drainJuryOutbox,scheduleJuryReminders} from './outbox.js'
let started=false
/** Opt-in worker: unchanged deployments do not start any Jury jobs. */
export function startJuryWorkers(){
 if(process.env.JURY_ENABLED!=='true'||started)return()=>{}
 started=true;let delivering=false,reminding=false
 const deliver=async()=>{if(delivering)return;delivering=true;try{await drainJuryOutbox(20)}catch{console.error('[jury-worker] OUTBOX_RETRY')}finally{delivering=false}}
 const remind=async()=>{if(reminding)return;reminding=true;try{await scheduleJuryReminders()}catch{console.error('[jury-worker] REMINDER_RETRY')}finally{reminding=false}}
 const initial=setTimeout(()=>{void deliver();void remind()},1000),delivery=setInterval(()=>void deliver(),10000),reminders=setInterval(()=>void remind(),3600000)
 initial.unref();delivery.unref();reminders.unref()
 return()=>{clearTimeout(initial);clearInterval(delivery);clearInterval(reminders);started=false}
}
