import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {api} from '@/services/api';
import {useAuthStore} from '@/store/authStore';
export type TeachingPeriod={academicYear:string;semesters:number[]};
export type PeriodCourse={id:string;periods:TeachingPeriod[];revision:number};
type PeriodData={courses:PeriodCourse[];calendars:Array<{name:string}>;activeAcademicYear:string|null;activeEntryTerm:string|null};
export function useTeacherCoursePeriods(enabled:boolean){
 const owner=useAuthStore(s=>s.user?.id),[data,setData]=useState<PeriodData|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(false),[year,setYear]=useState(''),[semester,setSemester]=useState('1');
 const generation=useRef(0);
 const reload=useCallback(async()=>{const request=++generation.current;setLoading(true);try{const r=await api.get('/teachers/me/course-periods');const next=r.data.data as PeriodData;if(request!==generation.current)return next;setData(next);setError(false);setYear(current=>current||next.activeAcademicYear||'');setSemester(current=>current||(/Semester\s*2/.test(next.activeEntryTerm||'')?'2':'1'));return next}catch(e){if(request===generation.current)setError(true);throw e}finally{if(request===generation.current)setLoading(false)}},[owner]);
 useEffect(()=>{generation.current++;setData(null);setYear('');setSemester('');return()=>{generation.current++}},[owner]);
 useEffect(()=>{if(enabled)void reload().catch(()=>undefined)},[enabled,reload]);
 const states=useMemo(()=>new Map((data?.courses||[]).map(c=>[c.id,c])),[data]);
 const years=useMemo(()=>[...new Set([...(data?.calendars||[]).map(c=>c.name),...(data?.courses||[]).flatMap(c=>c.periods.map(p=>p.academicYear))])].sort().reverse(),[data]);
 const matches=(id:string)=>{const periods=states.get(id)?.periods||[];if(semester==='unclassified')return !periods.length;if(!periods.length)return true;return periods.some(p=>(year==='all'||p.academicYear===year)&&(semester==='all'||p.semesters.includes(Number(semester))))};
 const save=async(ids:string[],targetYear:string,semesters:number[])=>{const request=generation.current;const response=await api.put('/teachers/me/course-periods',{courses:ids.map(id=>({id,revision:states.get(id)?.revision||0})),academicYear:targetYear,semesters,mode:'add'},{headers:{'x-silent-feedback':'true'}});const confirmed=response.data.data as PeriodCourse[];if(request!==generation.current)return confirmed;setData(current=>current?{...current,courses:current.courses.map(c=>confirmed.find(n=>n.id===c.id)||c)}:current);return confirmed};
 return {data,loading,error,year,setYear,semester,setSemester,states,years,matches,save,reload,ready:Boolean(data?.activeAcademicYear)};
}
export type CoursePeriodModel=ReturnType<typeof useTeacherCoursePeriods>;
