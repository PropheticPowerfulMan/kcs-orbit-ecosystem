import {describe,it,expect} from 'vitest'
import {createSchoolCalendarReader} from '../src/integrations/schoolCalendar'
const calendar={name:'2026-2027',status:'ACTIVE',isCurrent:true,startDate:'2026-09-07',endDate:'2027-06-11',periods:Array.from({length:6},()=>({type:'QUARTER',sequence:1,startDate:'2026-09-07',endDate:'2026-11-06'}))}
describe('published school calendar reader',()=>{
 it('coalesces reads, refreshes publication, retains verified data during outage and never activates a planned year',async()=>{
 let time=0,calls=0,payload:any={calendar},failure=false
 const request:any=async()=>{calls++;if(failure)throw Error('offline');return {ok:true,json:async()=>payload}}
 const read=createSchoolCalendarReader('http://school.invalid',request,()=>time)
 const first=await Promise.all([read(),read()]);expect(calls).toBe(1);expect(first[0]?.name).toBe(calendar.name)
 time=31000;payload={calendar:{...calendar,name:'2027-2028',startDate:'2027-09-06',endDate:'2028-06-09'}}
 expect((await read())?.name).toBe('2027-2028');time+=31000;failure=true;expect((await read())?.name).toBe('2027-2028')
 failure=false;time+=6000;payload={calendar:{...calendar,status:'PLANNED'}};expect((await read())?.name).toBe('2027-2028')
 time+=6000;payload={calendar:{...calendar,status:'CLOSED',isCurrent:false}};expect((await read())?.isCurrent).toBe(false)
 })
})
