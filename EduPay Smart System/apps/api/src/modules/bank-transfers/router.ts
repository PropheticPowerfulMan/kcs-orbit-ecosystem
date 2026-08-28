import { Router } from "express";
import multer from "multer";
import PDFDocument from "pdfkit";
import { PNG } from "pngjs";
import { z } from "zod";
import { prisma } from "../../prisma";
import { authGuard, authorize, AuthenticatedRequest } from "../../middlewares/auth";
import { amountToWords } from "../../utils/amount-words";
import { enqueuePaymentOrbitEvent } from "../../integrations/orbit";
import { assertReviewable, MAX_PROOF_BYTES, validateAllocations, validateProofMetadata, validateProofSignature } from "./core";
import { proofStorage } from "./storage";

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_PROOF_BYTES,files:1}});
const financeRoles=["SUPER_ADMIN","OWNER","ADMIN","FINANCIAL_MANAGER","ACCOUNTANT"] as const;
const inputSchema=z.object({
  amount:z.coerce.number().positive(),bankName:z.string().trim().min(2),referenceNumber:z.string().trim().min(2),
  paymentDate:z.coerce.date(),payerName:z.string().trim().min(2),comment:z.string().max(1000).optional(),
  allocations:z.preprocess(v=>typeof v==="string"?JSON.parse(v):v,z.array(z.object({
    studentId:z.string().min(1),installmentId:z.string().min(1),feeLabel:z.string().trim().min(1),amount:z.coerce.number().positive()
  })).min(1))
});
const include={parent:true,allocations:{include:{student:true,installment:true}},proofs:{orderBy:{version:"desc" as const}},payment:{include:{receipt:true}},reviewedBy:{select:{id:true,fullName:true}}};

async function parentFor(req:AuthenticatedRequest){
  if(req.user!.role!=="PARENT")return null;
  return prisma.parent.findFirst({where:{schoolId:req.user!.schoolId,userId:req.user!.sub}});
}
function canFinance(role:string){return (financeRoles as readonly string[]).includes(role);}
async function visibleRequest(req:AuthenticatedRequest,id:string){
  const parent=await parentFor(req);
  return prisma.bankTransferRequest.findFirst({where:{id,schoolId:req.user!.schoolId,...(parent?{parentId:parent.id}:canFinance(req.user!.role)?{}:{id:"__denied__"})},include});
}
async function audit(db:any,req:AuthenticatedRequest,action:string,request:any,paymentId?:string){
  await db.auditLog.create({data:{schoolId:req.user!.schoolId,userId:req.user!.sub,action,metadata:{
    actorRole:req.user!.role,requestId:request.id,paymentId:paymentId??request.paymentId??null,
    studentIds:request.allocations.map((x:any)=>x.studentId),amount:request.amount,status:request.status
  }}});
}
async function notifyParent(requestId:string,type:string,content:string){
  const request=await prisma.bankTransferRequest.findUnique({where:{id:requestId},include:{parent:true}});
  if(!request)return;
  await prisma.notificationLog.create({data:{schoolId:request.schoolId,parentId:request.parentId,type:"CONFIRMATION",language:request.parent.preferredLanguage,channel:"DASHBOARD",content,status:"OPEN"}});
}
function pdfReceipt(number:string,amount:number){return new Promise<Buffer>(resolve=>{const d=new PDFDocument();const chunks:Buffer[]=[];d.on("data",(c:Buffer)=>chunks.push(c));d.on("end",()=>resolve(Buffer.concat(chunks)));d.fontSize(18).text("EduPay official receipt").moveDown().fontSize(12).text(`Receipt: ${number}`).text(`Amount: USD ${amount.toFixed(2)}`);d.end();});}
function pngReceipt(){const p=new PNG({width:1,height:1});p.data.fill(255);return PNG.sync.write(p);}

export const bankTransferRouter=Router();
bankTransferRouter.use(authGuard);

bankTransferRouter.post("/",authorize("PARENT"),upload.single("proof"),async(req:AuthenticatedRequest,res)=>{
  const parent=await parentFor(req);if(!parent)return res.status(403).json({message:"Parent profile required."});
  if(!req.file)return res.status(400).json({message:"proofOfPayment is required for BANK_TRANSFER."});
  const payload=inputSchema.parse(req.body);validateAllocations(payload.amount,payload.allocations);
  validateProofMetadata({originalName:req.file.originalname,mimeType:req.file.mimetype,size:req.file.size});validateProofSignature(req.file.buffer,req.file.mimetype);
  const studentIds=[...new Set(payload.allocations.map(x=>x.studentId))];
  const owned=await prisma.student.count({where:{id:{in:studentIds},parentId:parent.id,schoolId:req.user!.schoolId}});
  if(owned!==studentIds.length)return res.status(403).json({message:"Every selected student must belong to this parent."});
  const duplicate=await prisma.bankTransferRequest.findFirst({where:{schoolId:req.user!.schoolId,parentId:parent.id,bankName:{equals:payload.bankName,mode:"insensitive"},referenceNumber:{equals:payload.referenceNumber,mode:"insensitive"},amount:payload.amount,paymentDate:payload.paymentDate}});
  const request=await prisma.bankTransferRequest.create({data:{schoolId:req.user!.schoolId,parentId:parent.id,amount:payload.amount,bankName:payload.bankName,referenceNumber:payload.referenceNumber,paymentDate:payload.paymentDate,payerName:payload.payerName,comment:payload.comment,possibleDuplicate:Boolean(duplicate),allocations:{create:payload.allocations}},include});
  try{
    const stored=await proofStorage.put({schoolId:req.user!.schoolId,requestId:request.id,originalName:req.file.originalname,bytes:req.file.buffer});
    const submitted=await prisma.$transaction(async tx=>{
      const proof=await tx.paymentProof.create({data:{schoolId:req.user!.schoolId,requestId:request.id,storageKey:stored.storageKey,originalFileName:req.file!.originalname,mimeType:req.file!.mimetype,fileSize:req.file!.size,sha256:stored.sha256,version:1,uploadedById:req.user!.sub}});
      const updated=await tx.bankTransferRequest.update({where:{id:request.id},data:{status:"SUBMITTED",submittedAt:new Date()},include});
      await audit(tx,req,"BANK_TRANSFER_CREATED",updated);await audit(tx,req,"PROOF_UPLOADED",updated);await audit(tx,req,"REQUEST_SUBMITTED",updated);
      return {...updated,proofs:[proof]};
    });
    void notifyParent(request.id,"SUBMISSION","Payment proof submitted and awaiting verification").catch(console.error);
    return res.status(201).json(submitted);
  }catch(error){await prisma.bankTransferRequest.delete({where:{id:request.id}}).catch(()=>undefined);throw error;}
});

bankTransferRouter.get("/",authorize("PARENT",...financeRoles),async(req:AuthenticatedRequest,res)=>{
  const parent=await parentFor(req);const status=typeof req.query.status==="string"?req.query.status:undefined;const search=typeof req.query.search==="string"?req.query.search.trim():undefined;
  const rows=await prisma.bankTransferRequest.findMany({
    where:{schoolId:req.user!.schoolId,...(parent?{parentId:parent.id}:{}),...(status?{status:status as any}:{}),
      ...(search?{OR:[{bankName:{contains:search,mode:"insensitive"}},{referenceNumber:{contains:search,mode:"insensitive"}},{parent:{fullName:{contains:search,mode:"insensitive"}}},{allocations:{some:{student:{fullName:{contains:search,mode:"insensitive"}}}}}]}:{})},
    include,orderBy:{createdAt:"desc"}
  });
  res.json(rows);
});
bankTransferRouter.get("/export.csv",authorize(...financeRoles),async(req:AuthenticatedRequest,res)=>{
  const rows=await prisma.bankTransferRequest.findMany({where:{schoolId:req.user!.schoolId},include,orderBy:{createdAt:"desc"}});
  const quote=(v:unknown)=>`"${String(v??"").replace(/"/g,'""')}"`;
  const lines=[["Date","Parent","Students","Fees","Amount","Bank","Reference","Status","Verified By","Verified At","Receipt Number"].map(quote).join(",")];
  for(const row of rows)lines.push([row.paymentDate.toISOString(),row.parent.fullName,row.allocations.map(x=>x.student.fullName).join(" | "),row.allocations.map(x=>x.feeLabel).join(" | "),row.amount,row.bankName,row.referenceNumber,row.status,row.reviewedBy?.fullName,row.reviewedAt?.toISOString(),row.payment?.receipt?.receiptNumber].map(quote).join(","));
  res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition","attachment; filename=bank-transfer-verification.csv");res.send("\ufeff"+lines.join("\n"));
});
bankTransferRouter.get("/:id",authorize("PARENT",...financeRoles),async(req:AuthenticatedRequest,res)=>{const row=await visibleRequest(req,req.params.id);return row?res.json(row):res.status(404).json({message:"Request not found."});});
bankTransferRouter.get("/:id/proofs/:proofId",authorize("PARENT",...financeRoles),async(req:AuthenticatedRequest,res)=>{
  const row=await visibleRequest(req,req.params.id);if(!row)return res.status(404).json({message:"Request not found."});
  const proof=row.proofs.find(x=>x.id===req.params.proofId);if(!proof)return res.status(404).json({message:"Proof not found."});
  const bytes=await proofStorage.get(proof.storageKey);res.setHeader("Content-Type",proof.mimeType);res.setHeader("Content-Disposition",`inline; filename="${proof.originalFileName.replace(/["\\\r\n]/g,"_")}"`);res.setHeader("X-Content-Type-Options","nosniff");res.send(bytes);
});
bankTransferRouter.post("/:id/proofs",authorize("PARENT"),upload.single("proof"),async(req:AuthenticatedRequest,res)=>{
  const row=await visibleRequest(req,req.params.id);if(!row)return res.status(404).json({message:"Request not found."});
  if(!["DRAFT","REJECTED","NEEDS_MORE_INFO"].includes(row.status))return res.status(409).json({message:"A replacement proof is not allowed now."});
  if(!req.file)return res.status(400).json({message:"proofOfPayment is required."});
  validateProofMetadata({originalName:req.file.originalname,mimeType:req.file.mimetype,size:req.file.size});validateProofSignature(req.file.buffer,req.file.mimetype);
  const version=(row.proofs[0]?.version??0)+1,stored=await proofStorage.put({schoolId:req.user!.schoolId,requestId:row.id,originalName:req.file.originalname,bytes:req.file.buffer});
  const proof=await prisma.$transaction(async tx=>{await tx.paymentProof.updateMany({where:{requestId:row.id,status:"PENDING"},data:{status:"SUPERSEDED"}});const p=await tx.paymentProof.create({data:{schoolId:req.user!.schoolId,requestId:row.id,storageKey:stored.storageKey,originalFileName:req.file!.originalname,mimeType:req.file!.mimetype,fileSize:req.file!.size,sha256:stored.sha256,version,uploadedById:req.user!.sub}});const updated=await tx.bankTransferRequest.update({where:{id:row.id},data:{status:"SUBMITTED",submittedAt:new Date(),reviewReason:null},include});await audit(tx,req,"PROOF_REPLACED",updated);await audit(tx,req,"REQUEST_SUBMITTED",updated);return p;});
  res.status(201).json(proof);
});
bankTransferRouter.post("/:id/review",authorize(...financeRoles),async(req:AuthenticatedRequest,res)=>{
  const row=await visibleRequest(req,req.params.id);if(!row)return res.status(404).json({message:"Request not found."});assertReviewable(row.status,row.paymentId);
  const updated=await prisma.bankTransferRequest.update({where:{id:row.id},data:{status:"UNDER_REVIEW",reviewedById:req.user!.sub},include});await audit(prisma,req,"REVIEW_STARTED",updated);res.json(updated);
});
bankTransferRouter.post("/:id/reject",authorize(...financeRoles),async(req:AuthenticatedRequest,res)=>{
  const reason=z.object({reason:z.string().trim().min(3).max(1000)}).parse(req.body).reason;const row=await visibleRequest(req,req.params.id);if(!row)return res.status(404).json({message:"Request not found."});assertReviewable(row.status,row.paymentId);
  const updated=await prisma.$transaction(async tx=>{const u=await tx.bankTransferRequest.update({where:{id:row.id},data:{status:"REJECTED",reviewReason:reason,reviewedById:req.user!.sub,reviewedAt:new Date()},include});await audit(tx,req,"REJECTED",u);return u;});void notifyParent(row.id,"REJECTED",`Bank transfer rejected: ${reason}`).catch(console.error);res.json(updated);
});
bankTransferRouter.post("/:id/request-more-info",authorize(...financeRoles),async(req:AuthenticatedRequest,res)=>{
  const reason=z.object({reason:z.string().trim().min(3).max(1000)}).parse(req.body).reason;const row=await visibleRequest(req,req.params.id);if(!row)return res.status(404).json({message:"Request not found."});assertReviewable(row.status,row.paymentId);
  const updated=await prisma.$transaction(async tx=>{const u=await tx.bankTransferRequest.update({where:{id:row.id},data:{status:"NEEDS_MORE_INFO",reviewReason:reason,reviewedById:req.user!.sub,reviewedAt:new Date()},include});await audit(tx,req,"MORE_INFO_REQUESTED",u);return u;});void notifyParent(row.id,"MORE_INFO",`More information requested: ${reason}`).catch(console.error);res.json(updated);
});
bankTransferRouter.post("/:id/approve",authorize(...financeRoles),async(req:AuthenticatedRequest,res)=>{
  const result=await prisma.$transaction(async tx=>{
    await tx.$queryRawUnsafe('SELECT "id" FROM "BankTransferRequest" WHERE "id" = $1 FOR UPDATE',req.params.id);
    const row=await tx.bankTransferRequest.findFirst({where:{id:req.params.id,schoolId:req.user!.schoolId},include});
    if(!row)throw Object.assign(new Error("Request not found."),{status:404});
    if(assertReviewable(row.status,row.paymentId)==="ALREADY_PROCESSED")return {alreadyProcessed:true,paymentId:row.paymentId,request:row};
    if(!row.proofs.length)throw new Error("A payment proof is required.");
    validateAllocations(row.amount,row.allocations);
    const approvedDuplicate=await tx.bankTransferRequest.findFirst({where:{id:{not:row.id},schoolId:row.schoolId,bankName:{equals:row.bankName,mode:"insensitive"},referenceNumber:{equals:row.referenceNumber,mode:"insensitive"},status:"APPROVED"}});
    if(approvedDuplicate)throw Object.assign(new Error("This bank reference has already been approved."),{status:409});
    const installments=await tx.paymentInstallment.findMany({where:{id:{in:row.allocations.map(x=>x.installmentId)},schoolId:row.schoolId,parentId:row.parentId}});
    if(installments.length!==row.allocations.length)throw new Error("One or more fee allocations are no longer valid.");
    const txNumber=`BT-${row.id.toUpperCase()}`,studentIds=[...new Set(row.allocations.map(x=>x.studentId))];
    const payment=await tx.payment.create({data:{schoolId:row.schoolId,transactionNumber:txNumber,parentId:row.parentId,reason:row.allocations.map(x=>x.feeLabel).join(", "),amount:row.amount,amountInWords:`${amountToWords(row.amount,"fr")} dollars americains`,method:"BANK_TRANSFER",status:"COMPLETED",createdById:req.user!.sub,notes:JSON.stringify({bankTransferRequestId:row.id,bankName:row.bankName,referenceNumber:row.referenceNumber}),students:{connect:studentIds.map(id=>({id}))}}});
    for(const line of row.allocations){const installment=installments.find(x=>x.id===line.installmentId)!;const paid=Number(installment.amountPaid)+line.amount;if(paid>Number(installment.amountDue)+0.005)throw new Error("Allocation exceeds the outstanding installment balance.");await tx.paymentAllocation.create({data:{paymentId:payment.id,installmentId:line.installmentId,amount:line.amount}});await tx.paymentInstallment.update({where:{id:line.installmentId},data:{amountPaid:paid,status:paid+0.005>=Number(installment.amountDue)?"PAID":"PARTIALLY_PAID"}});}
    const receiptNumber=`REC-${txNumber}`,pdf=await pdfReceipt(receiptNumber,row.amount),png=pngReceipt();
    await tx.receipt.create({data:{schoolId:row.schoolId,paymentId:payment.id,receiptNumber,pdfBase64:pdf.toString("base64"),pngBase64:png.toString("base64")}});
    await tx.paymentProof.update({where:{id:row.proofs[0].id},data:{status:"ACCEPTED",verifiedById:req.user!.sub,verifiedAt:new Date()}});
    const updated=await tx.bankTransferRequest.update({where:{id:row.id},data:{status:"APPROVED",paymentId:payment.id,reviewedById:req.user!.sub,reviewedAt:new Date()},include});
    await enqueuePaymentOrbitEvent(tx,{payment,studentExternalIds:[],localStudentIds:studentIds});
    await audit(tx,req,"APPROVED",updated,payment.id);await audit(tx,req,"PAYMENT_ALLOCATED",updated,payment.id);await audit(tx,req,"RECEIPT_GENERATED",updated,payment.id);
    return {alreadyProcessed:false,paymentId:payment.id,request:updated};
  },{isolationLevel:"Serializable"});
  void notifyParent(req.params.id,"APPROVED","Bank transfer approved. Your EduPay receipt is available.").catch(console.error);
  res.json(result);
});
