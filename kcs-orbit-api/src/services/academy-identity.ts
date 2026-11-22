/** The service-ticket audit binds a registry entity to its separate Academy login user. */
export function academySourceIdentity(userId:string,metadata:unknown):string{
 const source=metadata&&typeof metadata==='object'&&!Array.isArray(metadata)?(metadata as Record<string,unknown>).sourceIdentityId:null;
 return typeof source==='string'&&source.length>0&&source.length<=128?source:userId;
}
