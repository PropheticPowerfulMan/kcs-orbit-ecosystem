const denied=message=>Object.assign(new Error(message),{status:403});
export function academicProfileScope(identity){
 const role=String(identity.role||'').toUpperCase(),permissions=Array.isArray(identity.permissions)?identity.permissions:[];
 if(permissions.includes('nexus:media-only')||!['ADMIN','STAFF','TEACHER'].includes(role))return null;
 const verified={superadmin:'administrator',principal:'principal',senior:'vice-principal',teacher:'teacher'};
 if(identity.workspace&&Object.hasOwn(verified,identity.workspace))return{workspace:identity.workspace,role:verified[identity.workspace]};
 if(identity.id==='configured-superadmin'&&role==='ADMIN')return{workspace:'superadmin',role:'administrator'};
 if(permissions.includes('nexus:principal-workspace'))return{workspace:'principal',role:'principal'};
 if(permissions.includes('nexus:senior-teacher-workspace'))return{workspace:'senior',role:'vice-principal'};
 if(role==='ADMIN')return{workspace:'principal',role:'principal'};
 return role==='TEACHER'||identity.accessRoles?.includes('teacher')?{workspace:'teacher',role:'teacher'}:null;
}
/** Only the role column of an already provisioned, verified app profile can change. */
export async function synchronizeAcademicProfile(identity,profile,{readBinding,updateRole}){
 const scope=academicProfileScope(identity);
 if(!scope||!identity.userId||!profile?.id||profile.status!=='active')throw denied('An active, linked institutional profile is required.');
 const user=await readBinding(profile.id);
 if(!user||user.app_metadata?.kcs_nexus_identity?.id!==identity.userId||user.app_metadata?.kcs_orbit_access?.blocked||user.banned_until&&Date.parse(user.banned_until)>Date.now())throw denied('The Eduplanner profile is not linked to this active institutional identity.');
 if(profile.role!==scope.role)await updateRole(profile.id,scope.role);
 return scope;
}
