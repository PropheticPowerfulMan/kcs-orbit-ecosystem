export const ALLOWED_PROOF_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
export const ALLOWED_PROOF_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
export const MAX_PROOF_BYTES = 10 * 1024 * 1024;
export const REVIEWABLE_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW"]);
export type AllocationInput = { studentId: string; installmentId: string; feeLabel: string; amount: number };
export function safeOriginalName(value: string) { return value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(-120) || "proof"; }
export function validateProofMetadata(input: { originalName: string; mimeType: string; size: number }) {
  const dot=input.originalName.lastIndexOf("."); const ext=dot>=0?input.originalName.slice(dot).toLowerCase():"";
  if(!ALLOWED_PROOF_MIME_TYPES.has(input.mimeType)||!ALLOWED_PROOF_EXTENSIONS.has(ext)) throw new Error("Only PDF, JPG, JPEG and PNG payment proofs are accepted.");
  if(input.size<=0||input.size>MAX_PROOF_BYTES) throw new Error("Payment proof exceeds the 10 MB limit.");
  const expected=input.mimeType==="application/pdf"?[".pdf"]:input.mimeType==="image/png"?[".png"]:[".jpg",".jpeg"];
  if(!expected.includes(ext)) throw new Error("Payment proof extension does not match its MIME type.");
}
export function validateProofSignature(buffer: Buffer,mimeType:string) {
  const pdf=buffer.subarray(0,5).toString("ascii")==="%PDF-";
  const png=buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=buffer.length>=3&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255;
  if((mimeType==="application/pdf"&&!pdf)||(mimeType==="image/png"&&!png)||(mimeType==="image/jpeg"&&!jpg)) throw new Error("Payment proof content does not match its declared type.");
}
export function validateAllocations(amount:number,allocations:AllocationInput[]) {
  if(!allocations.length) throw new Error("At least one student fee allocation is required.");
  if(allocations.some(x=>!x.studentId||!x.installmentId||!x.feeLabel.trim()||x.amount<=0)) throw new Error("Every allocation must identify a student, fee and positive amount.");
  if(Math.abs(allocations.reduce((s,x)=>s+x.amount,0)-amount)>0.005) throw new Error("Allocation total must equal the bank transfer amount.");
}
export function assertReviewable(status:string,paymentId?:string|null) {
  if(status==="APPROVED"&&paymentId)return "ALREADY_PROCESSED" as const;
  if(!REVIEWABLE_STATUSES.has(status))throw new Error("Bank transfer request is not reviewable.");
  return "REVIEWABLE" as const;
}
