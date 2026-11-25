import {createHash} from 'node:crypto'
import {prisma} from '../config/prisma.js'
import {familyEmailRecipients} from './familyEmailRecipients.js'
import {reportCardDeliveryEvidence} from '../utils/reportCardDeliveryEvidence.js'
/** Read-only projection: a delivery log is never fabricated for an uncontacted parent. */
export async function reportCardDeliveryInventory(ids:string[],deliveries:any[]){
 const cards=await prisma.reportCard.findMany({where:{id:{in:ids}},select:{id:true,updatedAt:true,student:{select:{parentLinks:{select:{parent:{select:{id:true,firstName:true,middleName:true,lastName:true,email:true,phone:true}}}}}}}})
 const parents=[...new Map(cards.flatMap(c=>c.student.parentLinks.map(l=>[l.parent.id,l.parent]as const))).values()]
 let complete=true,timer:ReturnType<typeof setTimeout>|undefined,targets:Awaited<ReturnType<typeof familyEmailRecipients>>
 try{targets=await Promise.race([familyEmailRecipients(parents,undefined,true),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Contact inventory timed out')),5000)})])}catch{complete=false;targets=await familyEmailRecipients(parents,null,true)}finally{if(timer)clearTimeout(timer)}
 const rows=deliveries.map(({metadata,...row})=>({...row,...reportCardDeliveryEvidence({...row,metadata}),expected:false,hasDeliveryLog:true})),key=(card:string,email:string)=>card+':'+email.trim().toLowerCase(),known=new Map(rows.map(row=>[key(row.reportCardId,row.recipientEmail),row]))
 for(const card of cards){const expected=new Map(card.student.parentLinks.flatMap(link=>(targets.get(link.parent.id)||[]).map(target=>[target.email,target]as const)))
  for(const target of expected.values()){const existing=known.get(key(card.id,target.email));if(existing){existing.expected=true;continue}const row={id:'not-sent-'+createHash('sha256').update(key(card.id,target.email)).digest('hex').slice(0,24),reportCardId:card.id,recipientName:target.name,recipientEmail:target.email,status:'NOT_SENT',sentAt:null,deliveredAt:null,failureReason:null,createdAt:card.updatedAt,deliveryCount:0,...reportCardDeliveryEvidence({status:'NOT_SENT',sentAt:null,deliveredAt:null,metadata:{}}),expected:true,hasDeliveryLog:false};rows.push(row as any)}
 }
 return{rows,complete}
}
