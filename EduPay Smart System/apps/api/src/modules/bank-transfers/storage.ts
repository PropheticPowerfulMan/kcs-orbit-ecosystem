import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { safeOriginalName } from "./core";

export interface ProofStorage {
  put(input: { schoolId: string; requestId: string; originalName: string; bytes: Buffer }): Promise<{ storageKey: string; sha256: string }>;
  get(storageKey: string): Promise<Buffer>;
}
export class LocalPersistentProofStorage implements ProofStorage {
  constructor(private readonly root = process.env.EDUPAY_PROOF_STORAGE_ROOT || path.resolve("var/edupay/payment-proofs")) {}
  async put(input: { schoolId:string; requestId:string; originalName:string; bytes:Buffer }) {
    const extension=path.extname(safeOriginalName(input.originalName)).toLowerCase();
    const storedName=`${Date.now()}-${randomUUID()}${extension}`;
    const storageKey=path.posix.join(input.schoolId,input.requestId,storedName);
    const absolute=this.resolve(storageKey);
    await mkdir(path.dirname(absolute),{recursive:true,mode:0o700});
    const temporary=`${absolute}.tmp-${randomUUID()}`;
    await writeFile(temporary,input.bytes,{mode:0o600,flag:"wx"});
    await rename(temporary,absolute);
    return {storageKey,sha256:createHash("sha256").update(input.bytes).digest("hex")};
  }
  async get(storageKey:string){return readFile(this.resolve(storageKey));}
  private resolve(storageKey:string){
    const normalized=storageKey.replace(/\\/g,"/");
    if(normalized.startsWith("/")||normalized.includes("../"))throw new Error("Invalid proof storage key.");
    const absolute=path.resolve(this.root,normalized),root=path.resolve(this.root)+path.sep;
    if(!absolute.startsWith(root))throw new Error("Invalid proof storage key.");
    return absolute;
  }
}
export const proofStorage:ProofStorage=new LocalPersistentProofStorage();
