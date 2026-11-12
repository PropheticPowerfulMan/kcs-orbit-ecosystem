import { createHmac, timingSafeEqual } from "node:crypto";
export type GraduationApproval = { payload: string; signature: string };
export type GraduationClaims = { organizationId: string; academicYear: string; closed: boolean; expiresAt: number; students: Array<{ id: string; average: number }> };
export function verifyGraduationApproval(proof: GraduationApproval | undefined, organizationId: string, secret = process.env.KCS_NEXUS_INTEGRATION_KEY): GraduationClaims | null {
  if (!proof || !secret || typeof proof.payload !== 'string' || proof.payload.length > 200000 || !/^[a-f0-9]{64}$/.test(proof.signature ?? '')) return null;
  const expected = createHmac('sha256', secret).update(proof.payload).digest();
  if (!timingSafeEqual(expected, Buffer.from(proof.signature, 'hex'))) return null;
  try {
    const data = JSON.parse(proof.payload) as GraduationClaims;
    if (data.organizationId !== organizationId || !/^\d{4}-\d{4}$/.test(data.academicYear) || !Number.isFinite(data.expiresAt) || data.expiresAt < Date.now() || data.expiresAt > Date.now()+120000 || typeof data.closed !== 'boolean' || !Array.isArray(data.students)) return null;
    if (data.students.some(s => typeof s.id !== 'string' || !s.id || !Number.isFinite(s.average) || s.average < 70 || s.average > 100)) return null;
    if (new Set(data.students.map(s=>s.id)).size !== data.students.length) return null;
    return data;
  } catch { return null; }
}
