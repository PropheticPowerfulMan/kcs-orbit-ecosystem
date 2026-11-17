import { prisma } from '../config/prisma.js'
export async function deliveryRecipientUnavailable(row:{studentId?:string|null;recipientEmail?:string|null;metadata:unknown}) {
 const m=(row.metadata&&typeof row.metadata==='object'?row.metadata:{}) as Record<string,unknown>
 if(typeof m.recipientId==='string') {
  const u=await prisma.user.findUnique({where:{id:m.recipientId},select:{accountBlockedAt:true}})
  if(!u||u.accountBlockedAt)return true
 }else if(row.recipientEmail&&await prisma.user.count({where:{email:{equals:row.recipientEmail,mode:'insensitive'},accountBlockedAt:{not:null}}}))return true
 if(row.studentId) {
  const learner=await prisma.studentProfile.findUnique({where:{id:row.studentId},select:{status:true,archive:{select:{id:true}},user:{select:{accountBlockedAt:true}}}})
  if(!learner||learner.archive||learner.user.accountBlockedAt||['archived','dismissed','expelled','deleted','graduated','inactive'].includes(learner.status.toLowerCase()))return true
 }
 return false
}
