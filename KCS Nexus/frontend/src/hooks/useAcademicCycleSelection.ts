import {useCallback,useEffect,useRef,useState} from 'react'
import {useAcademicPeriodAccess} from './useAcademicPeriodAccess'
import {officialAcademicCycle} from '@/utils/academicCycleSelection'
import {useAuthStore} from '@/store/authStore'
/** Central closure state chooses defaults. A deliberate historical selection stays put. */
export function useAcademicCycleSelection(){
 const owner=useAuthStore(s=>s.user?.id),{access,loading}=useAcademicPeriodAccess()
 const [year,setYearState]=useState('2026-2027'),[term,setTermState]=useState('Semester 1 · Quarter 1')
 const manual=useRef(false),last=useRef(''),identity=useRef(owner)
 if(identity.current!==owner){identity.current=owner;manual.current=false;last.current=''}
 const official=officialAcademicCycle(access),key=official?official.academicYear+'|'+official.term:''
 useEffect(()=>{
  if(!official||last.current===key)return
  last.current=key
  if(manual.current)return
  setYearState(official.academicYear);setTermState(official.term)
 },[key,owner])
 const setYear=useCallback((value:string)=>{manual.current=true;setYearState(value)},[])
 const setTerm=useCallback((value:string)=>{manual.current=true;setTermState(value)},[])
 const hold=useCallback(()=>{manual.current=true},[])
 const followCurrent=()=>{if(official){manual.current=false;setYearState(official.academicYear);setTermState(official.term)}}
 return {year,term,setYear,setTerm,access,loading,hold,followCurrent,official}
}
