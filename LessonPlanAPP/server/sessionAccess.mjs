export async function verifiedSessionAccess(bearer,admin) {
 if(!bearer)return {status:401,body:{allowed:false}};
 const {data,error}=await admin.auth.getUser(bearer);
 if(error||!data.user)return {status:401,body:{allowed:false}};
 const {data:identity,error:lookupError}=await admin.auth.admin.getUserById(data.user.id);
 if(lookupError||!identity.user||identity.user.id!==data.user.id)throw lookupError||new Error('Session identity mismatch');
 const user=identity.user;
 const blocked=Boolean(user.app_metadata?.kcs_orbit_access?.blocked)||Boolean(user.banned_until&&Date.parse(user.banned_until)>Date.now());
 const linked=user.app_metadata?.kcs_nexus_identity?.id;
 return {status:blocked?403:200,body:{allowed:!blocked,...(!blocked&&typeof linked==='string'&&/^[A-Za-z0-9-]{1,128}$/.test(linked)?{nexusUserId:linked}:{})}};
}
