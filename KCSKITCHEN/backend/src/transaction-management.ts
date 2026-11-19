import crypto from 'node:crypto'
import {Prisma,type KitchenRole} from '@prisma/client'
import {prisma} from './db.js'
import {calculateSchoolSubsidy} from './staff-subsidy.js'
import {runWithTransactionRetry} from './transaction-retry.js'
import {getUsdCdfRate} from './exchange-rate.js'
type Actor={id:string;role:KitchenRole;ip?:string}
type Line={productId:string;quantity:number;unitPriceCdf:number}
type Mutation={requestId:string;revision:string;reason:string;items?:Line[];refundMode?:'KEEP_CREDIT'|'REFUND_CONFIRMED';confirmedRefundAmount?:number;settlementConfirmed?:boolean}
type RevisionRecord={id:string;status:string;subtotal:unknown;schoolSubsidy:unknown;total:unknown;paymentMode:string;paymentStatus:string;items?:Array<{id:string;productId:string;quantity:unknown;unitPriceAtPurchase:unknown;subtotal:unknown}>}
export function transactionRevision(row:RevisionRecord){return crypto.createHash('sha256').update(JSON.stringify([row.id,row.status,String(row.subtotal),String(row.schoolSubsidy),String(row.total),row.paymentMode,row.paymentStatus,(row.items||[]).map(i=>[i.id,i.productId,String(i.quantity),String(i.unitPriceAtPurchase),String(i.subtotal)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))])).digest('hex')}
export async function lockKitchenPerson(tx:Prisma.TransactionClient,id:string){await tx.$queryRaw(Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'kitchen-person:'+id}))`)}
const fail=(statusCode:number,fr:string,en:string,language:string):never=>{throw Object.assign(new Error(language==='fr'?fr:en),{statusCode})}
const include={items:true,discounts:true,disputes:true,ledgerEntries:true,payments:true,reversals:true} as const
const serial=<T>(operation:(tx:Prisma.TransactionClient)=>Promise<T>)=>runWithTransactionRetry(()=>prisma.$transaction(operation,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5000,timeout:15000}))
const personBalance=async(tx:Prisma.TransactionClient,id:string)=>Number((await tx.kitchenLedgerEntry.aggregate({where:{orbitPersonId:id},_sum:{amount:true}}))._sum.amount||0)
const refundFor=(total:number,mode:string,balance:number)=>mode==='CREDIT'?Math.min(total,Math.max(0,total-balance)):total
export async function transactionManagementSnapshot(id:string){
 const transaction=await prisma.kitchenTransaction.findUnique({where:{id},include})
 if(!transaction)return null
 const [menu,balance]=await Promise.all([prisma.dailyMenuItem.findMany({where:{menuId:transaction.dailyMenuId},include:{product:true},orderBy:{displayOrder:'asc'}}),personBalance(prisma,transaction.orbitPersonId)])
 let rate:number|null=1
 if(menu.some(i=>i.currency==='USD')){try{rate=(await getUsdCdfRate()).rate}catch{rate=null}}
 const options=menu.map(item=>({productId:item.productId,name:item.product.name,unitPriceCdf:item.currency==='USD'?(rate===null?null:Number(item.unitPrice)*rate):Number(item.unitPrice),available:item.isAvailable&&item.product.isAvailable&&!item.product.archivedAt,stockQuantity:Number(item.product.stockQuantity),trackInventory:item.product.trackInventory,category:item.product.category,discountEligible:item.product.discountEligible}))
 const missing=transaction.items.filter(i=>!options.some(p=>p.productId===i.productId))
 if(missing.length){const historical=await prisma.product.findMany({where:{id:{in:missing.map(i=>i.productId)}}});for(const item of missing){const product=historical.find(p=>p.id===item.productId);if(product)options.push({productId:product.id,name:item.productNameSnapshot,unitPriceCdf:Number(item.unitPriceAtPurchase),available:false,stockQuantity:Number(product.stockQuantity),trackInventory:product.trackInventory,category:product.category,discountEligible:product.discountEligible})}}
 return{transaction,balance,revision:transactionRevision(transaction),refundableAmount:refundFor(Number(transaction.total),transaction.paymentMode,balance),menuItems:options}
}

async function invalidateDocuments(tx:Prisma.TransactionClient,personId:string,date:Date){
 const now=new Date()
 await tx.kitchenStatementVerification.updateMany({where:{orbitPersonId:personId,revokedAt:null},data:{revokedAt:now}})
 await tx.kitchenTransactionReportVerification.updateMany({where:{revokedAt:null,periodFrom:{lte:date},periodTo:{gte:date}},data:{revokedAt:now}})
}
export async function manageTransaction(id:string,input:Mutation,action:'EDIT'|'VOID',actor:Actor,language='en'){
 const target=await prisma.kitchenTransaction.findUnique({where:{id},select:{orbitPersonId:true}})
 if(!target)return fail(404,'Transaction introuvable.','Transaction not found.',language)
 const requestHash=crypto.createHash('sha256').update(JSON.stringify({id,action,...input})).digest('hex'),auditId='kitchen-transaction:'+input.requestId
 return serial(async tx=>{
  await lockKitchenPerson(tx,target.orbitPersonId)
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "KitchenTransaction" WHERE id=${id} FOR UPDATE`)
  const replay=await tx.auditLog.findUnique({where:{id:auditId}})
  if(replay){const value=replay.newValue as any;if(replay.actorId!==actor.id||value?.requestHash!==requestHash)return fail(409,'Cette requête a déjà été utilisée pour une autre opération.','This request was already used for a different operation.',language);return{...value.response,replayed:true}}
  const original=await tx.kitchenTransaction.findUniqueOrThrow({where:{id},include})
  if(original.status!=='CONFIRMED'||original.reversals.length)return fail(409,'Cette transaction est déjà annulée ou n’est pas encore finalisée.','This transaction was already voided or is not finalized.',language)
  if(input.revision!==transactionRevision(original))return fail(409,'Cette transaction a été modifiée. Actualisez puis vérifiez les dernières informations.','This transaction changed. Refresh and review its latest details.',language)
  const balanceBefore=await personBalance(tx,original.orbitPersonId)
  let response:any
  if(action==='EDIT'){
   const lines=input.items!,ids=[...new Set([...lines.map(i=>i.productId),...original.items.map(i=>i.productId)])].sort()
   const [products,menu]=await Promise.all([tx.product.findMany({where:{id:{in:ids}},orderBy:{id:'asc'}}),tx.dailyMenuItem.findMany({where:{menuId:original.dailyMenuId}})])
   const productsById=new Map(products.map(p=>[p.id,p])),menuById=new Map(menu.map(i=>[i.productId,i])),previousById=new Map(original.items.map(i=>[i.productId,i]))
   const corrected=lines.map(line=>{const product=productsById.get(line.productId),item=menuById.get(line.productId),prior=previousById.get(line.productId)
    if(!product||(!item&&!prior)||(!prior&&(!item?.isAvailable||!product.isAvailable||product.archivedAt)))return fail(409,'Un article choisi n’est plus disponible dans le menu de cette transaction.','A selected item is no longer available in this transaction’s menu.',language)
    const keepExact=Boolean(prior?.amountBased&&Number(prior.quantity)===line.quantity&&Number(prior.unitPriceAtPurchase)===line.unitPriceCdf)
    return{product,quantity:new Prisma.Decimal(line.quantity),price:new Prisma.Decimal(line.unitPriceCdf),amountBased:keepExact,subtotal:keepExact?new Prisma.Decimal(prior!.subtotal):new Prisma.Decimal(line.quantity).mul(line.unitPriceCdf).toDecimalPlaces(2)}
   })
   const subtotal=corrected.reduce((s,i)=>s.plus(i.subtotal),new Prisma.Decimal(0)),eligible=corrected.filter(i=>i.product.discountEligible&&i.product.category!=='DRINK').reduce((s,i)=>s.plus(i.subtotal),new Prisma.Decimal(0))
   if(subtotal.greaterThan('999999999999.99'))return fail(400,'Le montant dépasse la limite autorisée.','The total exceeds the supported amount.',language)
   const subsidy=calculateSchoolSubsidy(Number(eligible),original.personType),total=Number(subtotal)-subsidy
   for(const product of products){if(!product.trackInventory)continue;const old=original.items.filter(i=>i.productId===product.id).reduce((s,i)=>s.plus(i.quantity),new Prisma.Decimal(0)),next=corrected.filter(i=>i.product.id===product.id).reduce((s,i)=>s.plus(i.quantity),new Prisma.Decimal(0)),delta=old.minus(next)
    if(delta.isZero())continue
    const changed=await tx.product.updateMany({where:{id:product.id,...(delta.lessThan(0)?{stockQuantity:{gte:delta.abs()}}:{})},data:{stockQuantity:{increment:delta}}})
    if(changed.count!==1)return fail(409,'Stock insuffisant pour '+product.name+'.','Insufficient inventory for '+product.name+'.',language)
    await tx.stockMovement.create({data:{productId:product.id,type:delta.greaterThan(0)?'RETURN':'SALE',quantity:delta,reason:'Correction '+original.transactionNumber+': '+input.reason,actor:actor.id}})
   }
   const difference = new Prisma.Decimal(total).minus(original.total).toNumber()
   if (original.paymentMode !== 'CREDIT' && Math.abs(difference) > .005) {
    if (original.paymentStatus !== 'PAID' || !input.settlementConfirmed) return fail(409,'Confirmez l’encaissement ou le remboursement réel de la différence avant de corriger cette vente payée.','Confirm the actual collection or refund of the difference before correcting this paid sale.',language)
    // Preserve the original receipt of money. Record the explicitly confirmed
    // difference separately; changing an item price cannot invent a payment.
    if (difference > 0) {
     await tx.kitchenPayment.create({data:{orbitPersonId:original.orbitPersonId,transactionId:id,amount:new Prisma.Decimal(difference),method:original.paymentMode,notes:input.reason,receivedBy:actor.id,ledgerEntries:{create:{orbitPersonId:original.orbitPersonId,transactionId:id,type:'PAYMENT',amount:new Prisma.Decimal(-difference),description:'Confirmed correction payment '+original.transactionNumber,reason:input.reason,performedBy:actor.id}}}})
    } else {
     await tx.kitchenLedgerEntry.create({data:{orbitPersonId:original.orbitPersonId,transactionId:id,type:'REFUND',amount:new Prisma.Decimal(-difference),description:'Confirmed correction refund '+original.transactionNumber,reason:input.reason,performedBy:actor.id}})
    }
   }
   const specs=[{type:'PURCHASE' as const,amount:Number(subtotal)},{type:'DISCOUNT' as const,amount:-subsidy}]
   for(const spec of specs){const base=original.ledgerEntries.filter(e=>e.type===spec.type&&!e.paymentId)
    if(base.length>1)return fail(409,'Le journal de cette transaction nécessite une vérification avant correction.','This transaction’s ledger needs review before correction.',language)
    const data={amount:new Prisma.Decimal(spec.amount),description:'Corrected '+spec.type+' '+original.transactionNumber,reason:input.reason,performedBy:actor.id}
    if(base[0])await tx.kitchenLedgerEntry.update({where:{id:base[0].id},data})
    else if(spec.amount!==0)await tx.kitchenLedgerEntry.create({data:{...data,transactionId:id,orbitPersonId:original.orbitPersonId,type:spec.type}})
   }
   await tx.kitchenTransactionItem.deleteMany({where:{transactionId:id}})
   await tx.kitchenTransactionItem.createMany({data:corrected.map(i=>({transactionId:id,productId:i.product.id,productNameSnapshot:i.product.name,quantity:i.quantity,unitPriceAtPurchase:i.price,amountBased:i.amountBased,subtotal:i.subtotal}))})
   await tx.kitchenTransaction.update({where:{id},data:{subtotal,eligibleSubtotal:eligible,schoolSubsidy:new Prisma.Decimal(subsidy),discount:new Prisma.Decimal(subsidy),total:new Prisma.Decimal(total),creditAmount:new Prisma.Decimal(original.paymentMode==='CREDIT'?total:0)}})
   if(original.discounts.length)await tx.discountApplication.updateMany({where:{transactionId:id},data:{originalAmount:eligible,discountAmount:new Prisma.Decimal(0),finalAmount:new Prisma.Decimal(total),reason:'Superseded by audited correction',approvedBy:actor.id}})
   if(original.discounts[0])await tx.discountApplication.update({where:{id:original.discounts[0].id},data:{discountAmount:new Prisma.Decimal(subsidy),reason:'Corrected KCS school subsidy'}})
   else if(subsidy>0)await tx.discountApplication.create({data:{transactionId:id,originalAmount:eligible,discountAmount:new Prisma.Decimal(subsidy),finalAmount:new Prisma.Decimal(total),reason:'Corrected KCS school subsidy',approvedBy:actor.id}})
   response={previousTotal:Number(original.total),correctedTotal:total}
  }else{
   const total=Number(original.total),refundable=refundFor(total,original.paymentMode,balanceBefore),refund=input.refundMode==='REFUND_CONFIRMED'?refundable:0
   if(input.refundMode==='REFUND_CONFIRMED'&&Math.abs((input.confirmedRefundAmount??-1)-refund)>.005)return fail(409,'Le montant remboursable a changé. Actualisez avant de confirmer.','The refundable amount changed. Refresh before confirming.',language)
   const counter=await tx.kitchenCounter.upsert({where:{name:'REVERSAL-'+new Date().getUTCFullYear()},create:{name:'REVERSAL-'+new Date().getUTCFullYear(),value:1},update:{value:{increment:1}}})
   const reversal=await tx.kitchenTransaction.create({data:{transactionNumber:'KITCHEN-REV-'+new Date().getUTCFullYear()+'-'+String(counter.value).padStart(6,'0'),dailyMenuId:original.dailyMenuId,orbitPersonId:original.orbitPersonId,personType:original.personType,personNameSnapshot:original.personNameSnapshot,cashierOrbitPersonId:actor.id,cashierNameSnapshot:'Kitchen management',subtotal:0,discount:0,total:0,paymentMode:original.paymentMode,paymentStatus:'VOIDED',status:'REVERSED',creditAmount:0,notes:input.reason,originalTransactionId:id}})
   await tx.kitchenLedgerEntry.create({data:{transactionId:reversal.id,orbitPersonId:original.orbitPersonId,type:'REVERSAL',amount:new Prisma.Decimal(-total),description:'Voided consumption '+original.transactionNumber,reason:input.reason,performedBy:actor.id}})
   if(refund>0)await tx.kitchenLedgerEntry.create({data:{transactionId:reversal.id,orbitPersonId:original.orbitPersonId,type:'REFUND',amount:new Prisma.Decimal(refund),description:'Refund confirmed '+original.transactionNumber,reason:input.reason,performedBy:actor.id}})
   await tx.kitchenTransaction.update({where:{id},data:{status:'VOIDED',paymentStatus:'VOIDED'}})
   for(const item of [...original.items].sort((a,b)=>a.productId.localeCompare(b.productId))){const product=await tx.product.findUnique({where:{id:item.productId}});if(!product?.trackInventory)continue;await tx.product.update({where:{id:product.id},data:{stockQuantity:{increment:item.quantity}}});await tx.stockMovement.create({data:{productId:product.id,type:'RETURN',quantity:item.quantity,reason:'Void '+original.transactionNumber+': '+input.reason,actor:actor.id}})}
   response={reversal,refundAmount:refund,refundableAmount:refundable}
  }
  await invalidateDocuments(tx,original.orbitPersonId,original.createdAt)
  const transaction=await tx.kitchenTransaction.findUniqueOrThrow({where:{id},include:{items:true,discounts:true,disputes:true}}),balance=await personBalance(tx,original.orbitPersonId)
  response={...response,transaction,balance,availableCredit:Math.max(0,-balance)}
  await tx.auditLog.create({data:{id:auditId,actorId:actor.id,actorRole:actor.role,action:action==='EDIT'?'TRANSACTION_CORRECTED':'TRANSACTION_VOIDED',entityType:'KitchenTransaction',entityId:id,reason:input.reason,ipAddress:actor.ip,oldValue:JSON.parse(JSON.stringify(original)),newValue:JSON.parse(JSON.stringify({requestHash,response}))}})
  const access=await tx.kitchenAccess.findUnique({where:{orbitPersonId:original.orbitPersonId}})
  await tx.notificationOutbox.create({data:{orbitPersonId:original.orbitPersonId,eventType:action==='EDIT'?'KITCHEN_TRANSACTION_CORRECTED':'KITCHEN_TRANSACTION_VOIDED',channels:['IN_APP',...(access?.emailNotifications!==false?['EMAIL']:[]),...(access?.smsNotifications!==false?['SMS']:[])],payload:{transactionNumber:original.transactionNumber,reason:input.reason,previousTotal:Number(original.total),correctedTotal:Number(transaction.total),refundAmount:response.refundAmount??0,balance}}})
  return response
 })
}
