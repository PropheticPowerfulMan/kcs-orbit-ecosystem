import {createAcademyNexusSessions} from '../utils/academyNexusSessions.js'
import {selectedAcademicWorkspace,academyRoleFor,academicNexusHome}from'../utils/academicApplicationAccess.js'
import {prisma} from '../config/prisma.js'
import {env} from '../config/env.js'
import {assertAccountAccess} from './accountAccess.service.js'
export const academyNexusSessions=createAcademyNexusSessions()
export async function readNexusAcademySession(token:unknown){
 const session=academyNexusSessions.read(token);if(!session)return null;
 const user=await prisma.user.findUnique({where:{id:session.id},include:{teacherProfile:true}}),root=(process.env.SUPERADMIN_EMAIL||'').trim().toLowerCase();
 if(!user)return null;
 await assertAccountAccess(user.id);
 const workspace=selectedAcademicWorkspace(user,Boolean(root&&user.email.toLowerCase()===root),session.workspace);if(!workspace)return null;
 return{userId:user.id,nexusUserId:user.id,orbitId:user.orbitUserId||'',organizationId:env.KCS_ORBIT_ORGANIZATION_ID,role:academyRoleFor(workspace),email:user.email,displayName:[user.lastName,user.middleName,user.firstName].filter(Boolean).join(' '),expiresAt:new Date(session.expiresAt).toISOString(),nexusWorkspace:workspace,nexusReturnPath:academicNexusHome(workspace)}
}
