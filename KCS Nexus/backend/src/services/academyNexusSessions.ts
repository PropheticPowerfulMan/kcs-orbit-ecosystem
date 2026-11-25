import {createAcademyNexusSessions} from '../utils/academyNexusSessions.js'
import {prisma} from '../config/prisma.js'
import {env} from '../config/env.js'
import {assertAccountAccess} from './accountAccess.service.js'
export const academyNexusSessions=createAcademyNexusSessions()
export async function readNexusAcademySession(token:unknown){
 const session=academyNexusSessions.read(token);if(!session)return null;
 const user=await prisma.user.findUnique({where:{id:session.id}}),root=(process.env.SUPERADMIN_EMAIL||'').trim().toLowerCase();
 if(!root||!user||user.role!=='ADMIN'||user.email.toLowerCase()!==root)return null;
 await assertAccountAccess(user.id);
 return{userId:user.id,nexusUserId:user.id,orbitId:'',organizationId:env.KCS_ORBIT_ORGANIZATION_ID,role:'SUPER_ADMIN',email:user.email,displayName:[user.lastName,user.middleName,user.firstName].filter(Boolean).join(' '),expiresAt:new Date(session.expiresAt).toISOString(),nexusWorkspace:'superadmin',nexusReturnPath:'/admin'}
}
