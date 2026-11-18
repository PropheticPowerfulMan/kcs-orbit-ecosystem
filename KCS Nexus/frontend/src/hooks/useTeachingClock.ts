import {useCallback,useEffect,useRef,useState} from 'react'
import {teachingAttendanceAPI} from '@/services/api'
export function useTeachingClock(){
 const anchor=useRef<{epoch:number;performance:number}|null>(null)
 const [now,setNow]=useState<Date|null>(null),[schoolDate,setSchoolDate]=useState(''),[synchronized,setSynchronized]=useState(false)
 const sync=useCallback(async()=>{
  const start=performance.now()
  try{
   const response=await teachingAttendanceAPI.clock(),end=performance.now()
   const epoch=Date.parse(response.data.data.serverUtc)
   if(!Number.isFinite(epoch))throw Error('Invalid clock')
   anchor.current={epoch:epoch+(end-start)/2,performance:end}
   setSchoolDate(response.data.data.schoolDate);setSynchronized(true)
   setNow(new Date(anchor.current.epoch))
  }catch{setSynchronized(false)}
 },[])
 useEffect(()=>{
  let active=true
  const tick=()=>{if(active&&anchor.current)setNow(new Date(anchor.current.epoch+performance.now()-anchor.current.performance))}
  void sync();const second=window.setInterval(tick,1000),resync=window.setInterval(()=>{if(document.visibilityState==='visible')void sync()},30000)
  const resume=()=>{if(document.visibilityState==='visible')void sync()}
  document.addEventListener('visibilitychange',resume);window.addEventListener('pageshow',resume)
  return()=>{active=false;clearInterval(second);clearInterval(resync);document.removeEventListener('visibilitychange',resume);window.removeEventListener('pageshow',resume)}
 },[sync])
 return{now,schoolDate,synchronized,resync:sync}
}
