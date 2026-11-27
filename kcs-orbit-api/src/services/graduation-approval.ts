import { createHmac, timingSafeEqual } from "node:crypto";
export type GraduationApproval = { payload: string; signature: string };
export type GraduationClaims = { organizationId: string; academicYear: string; closed: boolean; expiresAt: number; students: Array<{ id: string; average: number }>; annualResults?:Array<{id:string;average:number;grade:string}>; endDate?:string; earlyYearsDecisions?:Array<{studentId:string;decision:string;targetClassId?:string;targetClassName?:string;reason?:string}> };
export function verifyGraduationApproval(proof: GraduationApproval | undefined, organizationId: string, secret = process.env.KCS_NEXUS_INTEGRATION_KEY): GraduationClaims | null {
  if (!proof || !secret || typeof proof.payload !== 'string' || proof.payload.length > 200000 || !/^[a-f0-9]{64}$/.test(proof.signature ?? '')) return null;
  const expected = createHmac('sha256', secret).update(proof.payload).digest();
  if (!timingSafeEqual(expected, Buffer.from(proof.signature, 'hex'))) return null;
  try {
    const data = JSON.parse(proof.payload) as GraduationClaims;
    if (data.organizationId !== organizationId || !/^\d{4}-\d{4}$/.test(data.academicYear) || !Number.isFinite(data.expiresAt) || data.expiresAt < Date.now() || data.expiresAt > Date.now()+120000 || typeof data.closed !== 'boolean' || !Array.isArray(data.students)) return null;
    if (data.students.some(s => typeof s.id !== 'string' || !s.id || !Number.isFinite(s.average) || s.average < 70 || s.average > 100)) return null;
    if (new Set(data.students.map(s=>s.id)).size !== data.students.length) return null;
    if(data.annualResults!==undefined&&(!Array.isArray(data.annualResults)||data.annualResults.some(s=>!s||typeof s.id!=='string'||!s.id||!Number.isFinite(s.average)||s.average<0||s.average>100||typeof s.grade!=='string'||!/^grade\s*(?:[1-9]|1[0-2])(?:\s|$)/i.test(s.grade))||new Set(data.annualResults.map(s=>s.id)).size!==data.annualResults.length))return null;
    if(data.endDate!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(data.endDate)||!Number.isFinite(Date.parse(data.endDate))))return null;
    if(data.earlyYearsDecisions!==undefined&&(!Array.isArray(data.earlyYearsDecisions)||data.earlyYearsDecisions.some(d=>!d||typeof d.studentId!=='string'||typeof d.decision!=='string'||(d.reason||'').trim().length<8)))return null;
    return data;
  } catch { return null; }
}

/** Select only the signed annual result for the learner's current numerical grade. */
export function officialAnnualAverage(claims:GraduationClaims|null,studentId:string,className:string|null|undefined){
 const grade=(value:string)=>Number(value.match(/\bgrade\s*(1[0-2]|[1-9])\b/i)?.[1]||0)
 const current=grade(className||'');if(!current)return null
 const annual=claims?.annualResults?.find(row=>row.id===studentId&&grade(row.grade)===current)
 if(annual)return annual.average
 return current===12?(claims?.students.find(row=>row.id===studentId)?.average??null):null
}
