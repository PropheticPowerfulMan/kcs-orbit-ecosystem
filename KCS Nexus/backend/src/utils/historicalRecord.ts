import {createHash} from 'node:crypto'
const privateKeys=new Set(['password','passwordhash','password_hash','accesstoken','refreshtoken','twofactorsecret','resettoken','avatar','officialavatar','photodata','photourl','signatureimage','officialsealimage'])
export function historicalData(value:any):any{if(value instanceof Date)return value.toISOString();if(Array.isArray(value))return value.map(historicalData);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!privateKeys.has(key.toLowerCase())).map(([key,item])=>[key,historicalData(item)]));if(typeof value==='string'&&value.startsWith('data:'))return '[binary retained in ecosystem backup]';return value}
export function stableHistoryJson(value:any):string{const stable=(x:any):any=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;return JSON.stringify(stable(value))}
export const historicalDigest=(value:any)=>createHash('sha256').update(stableHistoryJson(value)).digest('hex')
export type HistoryIdentity={entityType:string;entityId:string;label:string;grade?:string;section?:string}
export function historicalRecord(input:HistoryIdentity&{academicYear:string;term:string;data:any;reason:string;capturedAt:Date;actorId?:string|null}){
 const data=historicalData(input.data),sha256=historicalDigest(data),id='school-history-'+historicalDigest([1,input.academicYear,input.term,input.entityType,input.entityId,sha256]);
 const searchText=[input.label,input.grade,input.section,input.entityId].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return {id,actorId:input.actorId??null,action:'HISTORICAL_RECORD_CAPTURED',targetType:'SchoolHistoricalRecord',targetId:input.entityId,metadata:{formatVersion:1,source:'KCS_NEXUS',academicYear:input.academicYear,term:input.term,entityType:input.entityType,entityId:input.entityId,label:input.label,grade:input.grade||'',section:input.section||'',searchText,capturedAt:input.capturedAt.toISOString(),reason:input.reason,sha256,data}}
}

/** Keep searchable headers small; large gradebooks live in a separate immutable payload. */
export function historicalStorageRows(record:ReturnType<typeof historicalRecord>){
 const {data,...metadata}=record.metadata,payloadId=record.id+'-payload'
 return {header:{...record,metadata:{...metadata,payloadId}},payload:{...record,id:payloadId,targetType:record.metadata.entityType==='COURSE'?'SchoolCourseArchive':'SchoolHistoricalPayload',metadata:{...metadata,data}}}
}
