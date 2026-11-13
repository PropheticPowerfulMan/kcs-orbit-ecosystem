import {useEffect,useState} from 'react'
import {attendanceAPI} from '@/services/api'
type DayAccess={date:string;allowed:boolean;code:string;reason:{fr:string;en:string};academicYear:string|null}
export function useAttendanceDayAccess(date:string){
 const[value,setValue]=useState<DayAccess|null>(null)
 useEffect(()=>{let active=true,sequence=0;const load=()=>{const request=++sequence;void attendanceAPI.dayAccess(date).then(r=>{if(active&&request===sequence)setValue(r.data.data)}).catch(()=>{if(active&&request===sequence)setValue({date,allowed:false,code:'UNAVAILABLE',reason:{fr:'Impossible de vérifier le calendrier. Réessayez avant d’enregistrer.',en:'The school calendar could not be verified. Retry before saving.'},academicYear:null})})};load();const timer=setInterval(load,30000);window.addEventListener('focus',load);window.addEventListener('online',load);window.addEventListener('kcs-attendance-calendar-updated',load);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('online',load);window.removeEventListener('kcs-attendance-calendar-updated',load)}},[date])
 return{allowed:value?.date===date&&value.allowed,pending:value?.date!==date,reason:value?.date===date?value.reason:{fr:'Vérification du calendrier scolaire…',en:'Checking the school calendar…'}}
}
