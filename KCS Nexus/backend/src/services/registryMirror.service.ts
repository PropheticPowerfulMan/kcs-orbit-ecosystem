import {normalizeClassParts} from '../utils/className.js'
import {prisma} from '../config/prisma.js'
import {env} from '../config/env.js'
import {getOrbitSharedDirectory,type OrbitSharedDirectory,type OrbitDeletedIdentity} from './orbitSharedDirectory.js'
import {resolveEmployeeUserRole,synchronizeOrbitEntityToNexus,type OrbitRegistryEntitySnapshot,type OrbitRegistryEntityType} from './orbitEntitySynchronization.js'
const clean=(v:unknown)=>typeof v==='string'?v.trim():v??null
const inactive=(v:unknown)=>['ARCHIVED','GRADUATED','DISMISSED','EXPELLED','DELETED','INACTIVE'].includes(String(v??'').toUpperCase())
export function canonicalIdentityPatch(entity:OrbitRegistryEntitySnapshot,user:any,type:OrbitRegistryEntityType){
 const patch:Record<string,unknown>={}
 // An unchanged, uniquely matched legacy account still needs its stable Orbit binding.
 if(!user.orbitUserId&&entity.id)patch.id=entity.id
 for(const field of ['firstName','middleName','lastName','phone'] as const)if(Object.prototype.hasOwnProperty.call(entity,field)&&clean(entity[field])!==clean(user[field]))patch[field]=entity[field]
 if(entity.email&&entity.email.trim().toLowerCase()!==String(user.email).toLowerCase())patch.email=entity.email
 if(type==='student'&&user.studentProfile&&!user.studentProfile.archive){
  const profile=user.studentProfile
  const c=normalizeClassParts(entity.className??''),l=normalizeClassParts(profile.grade,profile.section)
  if(entity.className&&(c.grade.toLowerCase()!==l.grade.toLowerCase()||c.section.toLowerCase()!==l.section.toLowerCase()))patch.className=entity.className
  if(entity.status&&!inactive(profile.status)&&String(entity.status).toLowerCase()!==String(profile.status).toLowerCase())patch.status=entity.status
  const links=profile.parentLinks??[]
  if(Object.prototype.hasOwnProperty.call(entity,'parentId') && (entity.parentId ? !links.some((link:any)=>link.parent?.orbitUserId===entity.parentId&&link.relation==='Official parent') : links.some((link:any)=>link.relation==='Official parent')))patch.parentId=entity.parentId
  if(Object.prototype.hasOwnProperty.call(entity,'photoData')&&clean(entity.photoData)!==clean(profile.officialAvatar))patch.photoData=entity.photoData
 }
 if(type==='teacher'&&entity.employeeType&&resolveEmployeeUserRole(entity.employeeType,user.role)!==user.role)patch.employeeType=entity.employeeType
 if(type==='teacher')for(const field of ['department','jobTitle'] as const){const old=field==='department'?user.staffProfile?.department:user.staffProfile?.function;if(entity[field]&&clean(entity[field])!==clean(old))patch[field]=entity[field]}
 return patch as OrbitRegistryEntitySnapshot
}
export function matchCanonicalMirror(entity:OrbitRegistryEntitySnapshot,users:any[],type:OrbitRegistryEntityType){
 const exact=users.filter(user=>user.orbitUserId===entity.id);if(exact.length===1)return exact[0];if(exact.length)return null
 const keys=new Set([entity.studentNumber,entity.employeeId,...(entity.externalIds??[]).map(link=>link.externalId)].filter(Boolean))
 const compatible=users.filter(user=>!user.orbitUserId&&(type==='student'?user.studentProfile&&keys.has(user.studentProfile.studentNumber):type==='teacher'?[user.teacherProfile?.employeeNumber,user.staffProfile?.employeeNumber].some(key=>key&&keys.has(key)):user.role==='PARENT'&&entity.email&&String(user.email).toLowerCase()===entity.email.toLowerCase()))
 return compatible.length===1?compatible[0]:null
}
async function archiveDeletedMirror(identity:OrbitDeletedIdentity,users:any[]){
 const user=matchCanonicalMirror(identity,users,identity.entityType);if(!user||user.id==='configured-superadmin')return false
 if(user.accountBlockedAt&&(!user.studentProfile||user.studentProfile.archive))return false
 const actor=await prisma.user.findUnique({where:{email:env.SUPERADMIN_EMAIL},select:{id:true}})
 await prisma.$transaction(async tx=>{
  await tx.user.update({where:{id:user.id},data:{accountBlockedAt:user.accountBlockedAt??new Date(),accountBlockedReason:'Identity removed from official Orbit registry'}})
  await tx.refreshToken.deleteMany({where:{userId:user.id}})
  if(user.studentProfile){const p=user.studentProfile;const name=[user.lastName,user.middleName,user.firstName].filter(Boolean).join(' ');if(!p.archive){if(!actor)throw Error('Archive audit authority unavailable');await tx.studentArchive.create({data:{studentId:p.id,userId:user.id,studentNumber:p.studentNumber,orbitUserId:user.orbitUserId,fullName:name,grade:p.grade,section:p.section,reason:'Identity removed from official Orbit registry',effectiveDate:new Date(),archivedById:actor.id,archivedSnapshot:{archiveType:'ORBIT_REGISTRY_REMOVAL',identity:{orbitUserId:user.orbitUserId,fullName:name,studentNumber:p.studentNumber},academicPlacement:{grade:p.grade,section:p.section},preservedRecords:true}}})}await tx.enrollment.deleteMany({where:{studentId:p.id}});await tx.studentProfile.update({where:{id:p.id},data:{status:'archived'}})}
  await tx.auditLog.create({data:{actorId:actor?.id??null,action:'ORBIT_REGISTRY_DELETION_APPLIED',targetType:identity.entityType,targetId:user.id,metadata:{orbitId:identity.id,recordsPreserved:true}}})
 })
 return true
}
let flight:Promise<{updated:number;archived:number;failed:number}>|null=null
export function reconcileRegistryMirrors(directory?:OrbitSharedDirectory){
 if(flight)return flight
 flight=(async()=>{
  const fetchStartedAt=Date.now()
  const snapshot=directory??await getOrbitSharedDirectory(true,true)
  const users=await prisma.user.findMany({include:{studentProfile:{include:{archive:{select:{id:true}},parentLinks:{select:{parentId:true,relation:true,parent:{select:{orbitUserId:true}}}}}},teacherProfile:true,staffProfile:true}})
  let updated=0,archived=0,failed=0
  for(const identity of snapshot.deletedEntities??[]){try{if(await archiveDeletedMirror(identity,users))archived++}catch(error){failed++;console.error('[registry-mirror] Confirmed deletion could not be applied',{id:identity.id,error:error instanceof Error?error.message:'unknown'})}}
  for(const[type,rows]of [['parent',snapshot.parents],['student',snapshot.students],['teacher',snapshot.teachers]] as const){
   for(const entity of rows){if(snapshot.deletedEntities?.some(row=>row.entityType===type&&row.id===entity.id))continue;const user=matchCanonicalMirror(entity,users,type);if(!user||user.studentProfile?.archive||user.updatedAt.getTime()>fetchStartedAt)continue;const patch=canonicalIdentityPatch(entity,user,type);if(!Object.keys(patch).length)continue
    try{const canonical:OrbitRegistryEntitySnapshot={...entity};delete canonical.accessCode;delete canonical.dateOfBirth;await synchronizeOrbitEntityToNexus({entityType:type,entity:canonical,patch,identifier:entity.id,preserveAdditionalParentLinks:true,expectedUpdatedAt:user.updatedAt,expectedStudentClass:user.studentProfile?{grade:user.studentProfile.grade,section:user.studentProfile.section}:undefined});updated++}catch(error){failed++;console.error('[registry-mirror] Canonical update could not be applied',{id:entity.id,error:error instanceof Error?error.message:'unknown'})}
   }
  }
  return {updated,archived,failed}
 })().finally(()=>{flight=null});return flight
}
let started=false
export function startRegistryMirrorReconciliation(){
 if(started||!env.KCS_ORBIT_API_URL||!env.KCS_ORBIT_API_KEY||!env.KCS_ORBIT_ORGANIZATION_ID)return
 started=true;const tick=()=>{void reconcileRegistryMirrors().then(result=>{if(result.updated||result.archived||result.failed)console.info('[registry-mirror]',result)}).catch(error=>console.warn('[registry-mirror] Live registry unavailable; local records preserved',error instanceof Error?error.message:'unknown'))}
 tick();setInterval(tick,30_000).unref()
}
