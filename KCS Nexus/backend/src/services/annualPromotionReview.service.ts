import {prisma} from '../config/prisma.js'
import {academicCalendars} from './reportAttendance.service.js'
import {academicPeriodAccess} from './academicPeriodAccess.service.js'
/** Automatically prepares a supervised year-end review; student placement changes only on approval. */
export async function prepareAnnualPromotionReviews(){
 const calendars=await academicCalendars(),current=calendars.find(c=>c.isCurrent);if(!current)return
 const baselineId='annual-promotion-review-baseline'
 const baseline=await prisma.auditLog.upsert({where:{id:baselineId},create:{id:baselineId,action:'ANNUAL_PROMOTION_REVIEW_ENABLED',targetType:'AcademicYear',targetId:current.name,metadata:{firstAcademicYear:current.name,threshold:70,earlyYearsManual:true}},update:{},select:{targetId:true}})
 const access=await academicPeriodAccess(),root=await prisma.user.findUnique({where:{email:(process.env.SUPERADMIN_EMAIL||'').toLowerCase()},select:{id:true}});if(!root)return
 for(const calendar of calendars){
  if(calendar.name<baseline.targetId!||calendar.endDate.slice(0,10)>=new Date().toISOString().slice(0,10)||!access.closedPeriods.some(p=>p.academicYear===calendar.name&&p.term==='Annual final'))continue
  const key='annual-promotion-review-ready:'+calendar.name
  if(await prisma.auditLog.findUnique({where:{id:'annual-rollover-result:'+calendar.name},select:{id:true}}))continue
  await prisma.$transaction(async tx=>{const created=await tx.auditLog.createMany({data:[{id:key,action:'ANNUAL_PROMOTION_REVIEW_READY',targetType:'AcademicYear',targetId:calendar.name,metadata:{threshold:70,manualKindergarten:true}}],skipDuplicates:true});if(created.count)await tx.notification.create({data:{userId:root.id,title:'Annual promotion review · Passage annuel · '+calendar.name,message:'Official annual results are ready for the supervised 70% promotion review. K3–K5 require your explicit decisions. / Les résultats annuels peuvent être examinés pour le passage à 70 %. Les décisions K3–K5 vous reviennent entièrement.',type:'INFO',link:'/admin/academic-calendar'}})})
 }
}
