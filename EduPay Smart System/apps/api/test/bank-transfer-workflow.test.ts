import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { assertReviewable, MAX_PROOF_BYTES, safeOriginalName, validateAllocations, validateProofMetadata, validateProofSignature } from "../src/modules/bank-transfers/core";
import { LocalPersistentProofStorage } from "../src/modules/bank-transfers/storage";
const pdf=Buffer.from("%PDF-1.4 fictitious");
const png=Buffer.from([137,80,78,71,13,10,26,10,0]);
const jpg=Buffer.from([255,216,255,0]);
describe("bank transfer proof workflow",()=>{
 it("requires supported proof metadata and signatures",()=>{for(const x of [["proof.pdf","application/pdf",pdf],["proof.jpg","image/jpeg",jpg],["proof.png","image/png",png]] as const){expect(()=>validateProofMetadata({originalName:x[0],mimeType:x[1],size:x[2].length})).not.toThrow();expect(()=>validateProofSignature(x[2],x[1])).not.toThrow();}});
 it("rejects invalid MIME, mismatch and oversized files",()=>{expect(()=>validateProofMetadata({originalName:"x.exe",mimeType:"application/octet-stream",size:1})).toThrow();expect(()=>validateProofMetadata({originalName:"x.pdf",mimeType:"application/pdf",size:MAX_PROOF_BYTES+1})).toThrow();expect(()=>validateProofSignature(jpg,"application/pdf")).toThrow();});
 it("sanitizes file names",()=>expect(safeOriginalName("../../bank receipt.pdf")).toBe(".._.._bank_receipt.pdf"));
 it("supports multi-student and partial allocations while requiring exact request total",()=>{expect(()=>validateAllocations(300,[{studentId:"a",installmentId:"i1",feeLabel:"Tuition",amount:200},{studentId:"b",installmentId:"i2",feeLabel:"Transport",amount:100}])).not.toThrow();expect(()=>validateAllocations(301,[{studentId:"a",installmentId:"i1",feeLabel:"Tuition",amount:300}])).toThrow();});
 it("guards approval idempotence and review state",()=>{expect(assertReviewable("SUBMITTED")).toBe("REVIEWABLE");expect(assertReviewable("APPROVED","pay-1")).toBe("ALREADY_PROCESSED");expect(()=>assertReviewable("REJECTED")).toThrow();});
 it("persists private bytes behind an opaque storage key",async()=>{const root=await mkdtemp(path.join(tmpdir(),"edupay-proof-"));try{const storage=new LocalPersistentProofStorage(root);const saved=await storage.put({schoolId:"school",requestId:"request",originalName:"proof.pdf",bytes:pdf});expect(saved.storageKey).not.toContain("proof.pdf");expect(await storage.get(saved.storageKey)).toEqual(pdf);expect(saved.sha256).toHaveLength(64);await storage.delete(saved.storageKey);await expect(storage.get(saved.storageKey)).rejects.toMatchObject({code:"ENOENT"});await expect(storage.delete(saved.storageKey)).resolves.toBeUndefined();}finally{await rm(root,{recursive:true,force:true});}});
});
