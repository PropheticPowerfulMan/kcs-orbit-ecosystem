import { prisma } from '../config/prisma.js'
export async function queueEmployeeChangeNotice(employee: Record<string,any>) {
 const source=employee.user||{},name=employee.full_name||[source.last_name,source.middle_name,source.first_name].filter(Boolean).join(' ')||'KCS employee'
 const work=employee.work_email||source.email||employee.user_email,personal=employee.personal_email,preference=employee.email_contact_preference||'work'
 const emails=[...new Set((preference==='both'?[work,personal]:preference==='personal'?[personal||work]:[work]).filter((v):v is string=>typeof v==='string'&&Boolean(v.trim())).map(v=>v.trim().toLowerCase()))]
 const phone=employee.phone||source.phone
 const primary=source.email||employee.user_email,number=employee.employee_id||employee.teacher_id
 const matches=await prisma.user.findMany({where:{OR:[...(number?[{teacherProfile:{employeeNumber:String(number)}},{staffProfile:{employeeNumber:String(number)}}]:[]),...(primary?[{email:String(primary).toLowerCase()}]:[])]},select:{id:true,accountBlockedAt:true},take:2})
 const account=matches.length===1?matches[0]:undefined
 if(account?.accountBlockedAt)return {queued:false,reason:'ACCOUNT_INACTIVE'}
 const subject='Mise à jour de votre dossier employé KCS',body='Votre dossier employé KCS a été mis à jour. Veuillez contacter l’administration si une information nécessite une correction.'
 const now=new Date().toISOString(),base={subject,body,recipientName:name,metadata:{kind:'EMPLOYEE_UPDATED',...(account?{recipientId:account.id}:{}),attempts:0,nextAttemptAt:now,priority:'NORMAL',language:'fr'}}
 await prisma.$transaction(async tx=>{
  if(emails.length||phone)await tx.correspondenceLog.createMany({data:[...emails.map(email=>({...base,channel:'EMAIL' as const,status:'QUEUED' as const,recipientEmail:email,metadata:{...base.metadata,mailQueueVersion:1}})),...(phone?[{...base,channel:'TEXT' as const,status:'QUEUED' as const,recipientPhone:phone,metadata:{...base.metadata,smsQueueVersion:1}}]:[])]})
  if(account)await tx.notification.create({data:{userId:account.id,title:subject,message:body,type:'MESSAGE',link:'/settings'}})
 })
 return {queued:true,email:emails.length,sms:phone?1:0}
}
