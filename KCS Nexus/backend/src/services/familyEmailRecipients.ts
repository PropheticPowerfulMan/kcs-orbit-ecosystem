import {z} from 'zod'
import {prisma} from '../config/prisma.js'
import {env} from '../config/env.js'
import {getOrbitSharedDirectory,type OrbitSharedDirectory} from './orbitSharedDirectory.js'
import {ApiError} from '../utils/api.js'
export type FamilyEmailTarget={parentId:string;email:string;name:string;phone:string|null;relationship:string}
type Parent={id:string;email?:string|null;phone?:string|null;firstName?:string;middleName?:string|null;lastName?:string}
const name=(p:{firstName?:string|null;middleName?:string|null;lastName?:string|null})=>[p.lastName,p.middleName,p.firstName].filter(Boolean).join(' ')
export function registeredFamilyEmailTargets(parent:Parent,official?:OrbitSharedDirectory['parents'][number]):FamilyEmailTarget[]{
 const result=new Map<string,FamilyEmailTarget>();const add=(email:unknown,display:string,phone:unknown,relationship:string)=>{const value=typeof email==='string'?email.trim().toLowerCase():'';if(!z.string().email().safeParse(value).success||value.endsWith('.local')||result.has(value))return;result.set(value,{parentId:parent.id,email:value,name:display||name(parent),phone:typeof phone==='string'?phone:null,relationship})}
 add(official?.email??parent.email,official?name(official)||official.fullName:name(parent),official?.phone??parent.phone,'PARENT')
 for(const contact of official?.familyContacts??[])add(contact.email,name(contact),contact.phone,contact.relationship||contact.kind||'FAMILY_CONTACT')
 return [...result.values()]
}
export async function familyEmailRecipients(parents:Parent[],provided?:OrbitSharedDirectory|null,skipUnavailable=false){
 const directory=provided===undefined&&env.KCS_ORBIT_API_URL&&env.KCS_ORBIT_API_KEY&&env.KCS_ORBIT_ORGANIZATION_ID?await getOrbitSharedDirectory():provided
 const accounts=parents.length?await prisma.user.findMany({where:{id:{in:[...new Set(parents.map(p=>p.id))]}},select:{id:true,orbitUserId:true,accountBlockedAt:true}}):[]
 const result=new Map<string,FamilyEmailTarget[]>()
 for(const parent of parents){const account=accounts.find(row=>row.id===parent.id);if(account?.accountBlockedAt){if(skipUnavailable){result.set(parent.id,[]);continue}throw new ApiError(409,'A selected family account is inactive. Refresh the recipient list.');}const linked=directory?.parents.filter(row=>row.id===account?.orbitUserId||row.externalIds.some(link=>link.externalId===parent.id))??[];const byEmail=!account?.orbitUserId&&!linked.length?directory?.parents.filter(row=>parent.email&&row.email?.toLowerCase()===parent.email.toLowerCase())??[]:[];const official=linked.length===1?linked[0]:byEmail.length===1?byEmail[0]:undefined;if(directory&&account?.orbitUserId&&!official){if(skipUnavailable){result.set(parent.id,[]);continue}throw new ApiError(409,'A selected family is no longer in the official registry. Refresh before sending.');}result.set(parent.id,registeredFamilyEmailTargets(parent,official))}
 return result
}
