import {createHash} from 'node:crypto';
import {prisma} from '../db';
export const accessHash=(value:unknown)=>createHash('sha256').update(String(value??'').normalize('NFKC').trim().toLowerCase()).digest('hex');
export const accessPolicyId=(organizationId:string,identityId:string)=>'ecosystem-access-'+accessHash(organizationId+'::'+identityId);
export async function accessSnapshot(organizationId:string,db:any=prisma){
 const rows=await db.auditLog.findMany({where:{organizationId,action:'ECOSYSTEM_ACCOUNT_ACCESS_POLICY'},select:{metadata:true},orderBy:{id:'asc'}});
 const blockedHashes=[...new Set(rows.flatMap((row:any)=>row.metadata?.blocked===true&&Array.isArray(row.metadata?.identifierHashes)?row.metadata.identifierHashes:[]))];
 return {blockedHashes,version:createHash('sha256').update(JSON.stringify(blockedHashes)).digest('hex')};
}
export async function identifiersAreAllowed(identifiers:unknown[],organizationId:string,db:any=prisma){const {blockedHashes}=await accessSnapshot(organizationId,db);const blocked=new Set(blockedHashes);return !identifiers.filter(Boolean).some(value=>blocked.has(accessHash(value)))}
export async function saveAccessPolicy(input:{organizationId:string;identityId:string;identifiers:string[];blocked:boolean;reason:string;actor:string;expectedBlocked?:boolean},db:any=prisma){
 const id=accessPolicyId(input.organizationId,input.identityId),metadata={blocked:input.blocked,identifierHashes:[...new Set(input.identifiers.filter(Boolean).map(accessHash))],reason:input.reason,actor:input.actor,updatedAt:new Date().toISOString()};
 return db.$transaction(async(tx:any)=>{await tx.$queryRawUnsafe('SELECT 1 FROM pg_advisory_xact_lock(hashtext($1))',id);const old=await tx.auditLog.findUnique({where:{id},select:{metadata:true}});if(typeof input.expectedBlocked==='boolean'&&Boolean(old?.metadata?.blocked)!==input.expectedBlocked)throw Object.assign(new Error('Access policy changed in another session'),{code:'ACCESS_POLICY_STALE'});await tx.auditLog.upsert({where:{id},create:{id,organizationId:input.organizationId,action:'ECOSYSTEM_ACCOUNT_ACCESS_POLICY',entityType:'IdentityAccess',entityId:input.identityId,metadata},update:{metadata}});await tx.auditLog.create({data:{organizationId:input.organizationId,action:input.blocked?'ECOSYSTEM_ACCOUNT_BLOCKED':'ECOSYSTEM_ACCOUNT_UNBLOCKED',entityType:'IdentityAccess',entityId:input.identityId,metadata:{previous:old?.metadata??null,next:metadata}}});return {blocked:input.blocked,audited:true}});
}
