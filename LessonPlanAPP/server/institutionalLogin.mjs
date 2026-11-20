const denied=(message,status=401)=>Object.assign(new Error(message),{status})
// Institutional authentication creates a session; it never changes a local password.
export async function institutionalLogin({identifier,password},deps){
 const local=await deps.findLocal(identifier)
 if(local){const session=await deps.signInLocal(local.email,password);if(session)return session}
 const identity=await deps.verifyInstitutional(identifier,password)
 const email=String(identity.email||'').trim().toLowerCase()
 if(!email||!identity.id)throw denied('The institutional identity is incomplete.',403)
 const target=local&&String(local.email).toLowerCase()===email?local:await deps.findLocal(email)
 if(target&&target.app_metadata?.kcs_nexus_identity?.id!==identity.id)throw denied('Use this EduPlanner account’s own password, or open EduPlanner from Nexus to link the correct institutional account.',403)
 await deps.ensureProfile(identity)
 return deps.createSession(email)
}
