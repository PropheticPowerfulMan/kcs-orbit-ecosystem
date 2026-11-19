export type CampusPolicy={latitude:number;longitude:number;radiusMeters:number;maxAccuracyMeters:number;version:string}
export type Position={latitude:number;longitude:number;accuracy:number}
export function campusDistance(a:Position,b:CampusPolicy){
 const rad=(v:number)=>v*Math.PI/180
 const dlat=rad(a.latitude-b.latitude),dlon=rad(a.longitude-b.longitude)
 const h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)))
}
export function insideCampus(position:Position,policy:CampusPolicy){
 if(![position.latitude,position.longitude,position.accuracy,policy.latitude,policy.longitude,policy.radiusMeters,policy.maxAccuracyMeters].every(Number.isFinite)||Math.abs(position.latitude)>90||Math.abs(position.longitude)>180||position.accuracy<0||Math.abs(policy.latitude)>90||Math.abs(policy.longitude)>180||policy.radiusMeters<=0||policy.maxAccuracyMeters<=0)return {accepted:false,distanceMeters:null}
 const distance=campusDistance(position,policy)
 return {accepted:position.accuracy<=policy.maxAccuracyMeters&&distance+position.accuracy<=policy.radiusMeters,distanceMeters:Math.round(distance)}
}
type Slot={id:string|null;courseReference:string;teacherUserId:string;className:string;room:string;schoolDate:string;academicYear:string;term:string;scheduleKey:string;expectedStartAt:Date;expectedEndAt:Date}
/** Keep recorded periods intact. Only consecutive, otherwise identical unrecorded periods become one lesson. */
export function combineTeachingSlots<T extends Slot>(slots:T[],blockKey:(keys:string[])=>string):T[]{
 const records=slots.filter(row=>row.id)
 const pending=slots.filter(row=>!row.id&&!records.some(saved=>saved.scheduleKey.startsWith('lesson-block:')&&saved.courseReference===row.courseReference&&saved.schoolDate===row.schoolDate&&saved.className===row.className&&saved.expectedStartAt<=row.expectedStartAt&&saved.expectedEndAt>=row.expectedEndAt))
 const same=(a:T,b:T)=>['courseReference','teacherUserId','className','room','schoolDate','academicYear','term'].every(key=>a[key as keyof T]===b[key as keyof T])
 const ordered=[...pending,...records].sort((a,b)=>a.courseReference.localeCompare(b.courseReference)||a.schoolDate.localeCompare(b.schoolDate)||a.expectedStartAt.getTime()-b.expectedStartAt.getTime())
 const out:T[]=[];let chain:T[]=[]
 const flush=()=>{if(chain.length>1)out.push({...chain[0],scheduleKey:blockKey(chain.map(row=>row.scheduleKey)),expectedEndAt:chain[chain.length-1].expectedEndAt});else if(chain[0])out.push(chain[0]);chain=[]}
 for(const row of ordered){const previous=chain[chain.length-1];if(previous&&(!same(previous,row)||previous.id||row.id||previous.expectedEndAt.getTime()!==row.expectedStartAt.getTime()))flush();chain.push(row)}
 flush();return out
}
