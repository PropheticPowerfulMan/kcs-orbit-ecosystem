import {prisma} from './database.js'
import {JuryError} from './security.js'
import type {Actor} from './policy.js'
import {assertAcademicVisible} from '../services/academicVisibility.service.js'
import {getParentAcademicClearance} from '../routes/finance.routes.js'
/** Family access is separate from judge/organizer access and never returns another child's work. */
export async function familyProjects(actor:Actor){
 if(!actor.userId||actor.user?.role!=='PARENT')throw new JuryError('FAMILY_ACCESS_DENIED','Parent account required. / Compte parent requis.',403)
 const links=await prisma.parentStudentLink.findMany({where:{parentId:actor.userId,student:{status:{equals:'active',mode:'insensitive'}}},select:{studentId:true}})
 if(!links.length)return []
 const participants=await prisma.juryParticipant.findMany({where:{studentId:{in:links.map(l=>l.studentId)},status:'ACTIVE'},select:{id:true,studentId:true,displayNameSnapshot:true,gradeSnapshot:true,project:{select:{id:true,title:true,description:true,instructions:true,academicYear:true,term:true,status:true,presentationAt:true,submissionDeadline:true,venue:true,maximum:true,resultVersion:true}}},orderBy:{registeredAt:'desc'},take:500})
 const clearance=await getParentAcademicClearance(actor.userId)
 return Promise.all(participants.map(async p=>{
  let result:null|{percentage:string|null;score:string|null;maximum:string;feedback:string}=null
  let released=false
  if(clearance.allowed&&p.studentId&&p.project.status==='PUBLISHED'){
   try{await assertAcademicVisible(actor.userId!,'parent',p.studentId,'grades',{academicYear:p.project.academicYear,term:p.project.term});released=true}catch(error){if((error as any).statusCode!==403&&(error as any).status!==403)throw error}
   if(released){const found=await prisma.juryStudentResult.findFirst({where:{participantId:p.id,run:{projectId:p.project.id,version:p.project.resultVersion,status:'APPROVED'}},select:{percentage:true,score:true,maximum:true,feedback:true}});if(found)result={percentage:found.percentage?.toString()??null,score:found.score?.toString()??null,maximum:found.maximum.toString(),feedback:found.feedback}}
  }
  return{participantId:p.id,learner:p.displayNameSnapshot,grade:p.gradeSnapshot,project:p.project,result,released:Boolean(released&&result)}
 }))
}
