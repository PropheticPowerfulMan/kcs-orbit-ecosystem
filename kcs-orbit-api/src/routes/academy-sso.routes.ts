import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { isAcademyRole } from "../services/academy-access";
const router = Router();
const allowedRoles = new Set(["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"]);
const tokenSchema = z.object({ token: z.string().min(32).max(256) });
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
function validServiceKey(provided: string | undefined) {
  const expected = process.env.ACADEMY_INTEGRATION_KEY;
  if (!provided || !expected) return false;
  const left = Buffer.from(provided); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
function requireAcademyService(req: Request, res: Response) {
  if (!process.env.ACADEMY_INTEGRATION_KEY) { res.status(503).json({ message: "Academy integration is not configured" }); return false; }
  if (!validServiceKey(req.header("x-api-key"))) { res.status(401).json({ message: "Unauthorized Academy service" }); return false; }
  return true;
}
router.post("/tickets", requireAuth, requireRole("STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const identity = req.user!;
    if (!identity.organizationId) return res.status(403).json({ message: "Academy access requires an organization" });
    if (!isAcademyRole(identity.role)) return res.status(403).json({ message: "Academy role denied" });
    const ticket = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + 60_000);
    await prisma.academyLaunchTicket.create({ data: { tokenHash: hashToken(ticket), userId: identity.userId, organizationId: identity.organizationId, role: identity.role, expiresAt } });
    await prisma.auditLog.create({ data: { organizationId: identity.organizationId, userId: identity.userId, action: "ACADEMY_SSO_TICKET_CREATED", entityType: "AcademySession", metadata: { role: identity.role } } });
    return res.status(201).json({ ticket, expiresAt: expiresAt.toISOString() });
  } catch (error) { return next(error); }
});
router.post("/service-tickets", async (req, res, next) => {
  try {
    if (!requireAcademyService(req, res)) return;
    const parsed = z.object({ userId: z.string().min(1).max(128) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid Orbit user" });
    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!user || !user.organizationId) return res.status(404).json({ message: "Orbit user not found" });
    const role = user.role === "STUDENT" ? "STUDENT" : user.role === "TEACHER" ? "TEACHER" : user.role === "ADMIN" ? "ADMIN" : user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : null;
    if (!role || !isAcademyRole(role)) return res.status(403).json({ message: "Academy role denied" });
    const requiredOrganization = process.env.ACADEMY_ORGANIZATION_ID;
    if (requiredOrganization && user.organizationId !== requiredOrganization) return res.status(403).json({ message: "Academy organization denied" });
    const ticket = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + 60_000);
    await prisma.academyLaunchTicket.create({ data: { tokenHash: hashToken(ticket), userId: user.id, organizationId: user.organizationId, role, expiresAt } });
    await prisma.auditLog.create({ data: { organizationId: user.organizationId, userId: user.id, action: "ACADEMY_SERVICE_TICKET_CREATED", entityType: "AcademySession", metadata: { role } } });
    return res.status(201).json({ ticket, expiresAt: expiresAt.toISOString() });
  } catch (error) { return next(error); }
});

router.post("/exchange", async (req, res, next) => {
  try {
    if (!requireAcademyService(req, res)) return;
    const parsed = z.object({ ticket: tokenSchema.shape.token }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid launch ticket" });
    const record = await prisma.academyLaunchTicket.findUnique({ where: { tokenHash: hashToken(parsed.data.ticket) } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) return res.status(401).json({ message: "Launch ticket expired or already used" });
    if (!isAcademyRole(record.role)) return res.status(403).json({ message: "Academy role denied" });
    const requiredOrganization = process.env.ACADEMY_ORGANIZATION_ID;
    if (requiredOrganization && record.organizationId !== requiredOrganization) return res.status(403).json({ message: "Academy organization denied" });
    const consumed = await prisma.academyLaunchTicket.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) return res.status(401).json({ message: "Launch ticket already consumed" });
    const sessionToken = randomBytes(32).toString("base64url"); const sessionExpiresAt = new Date(Date.now() + 8 * 60 * 60_000);
    await prisma.academySession.create({ data: { tokenHash: hashToken(sessionToken), userId: record.userId, organizationId: record.organizationId, role: record.role, expiresAt: sessionExpiresAt } });
    await prisma.auditLog.create({ data: { organizationId: record.organizationId, userId: record.userId, action: "ACADEMY_LOGIN", entityType: "AcademySession", metadata: { role: record.role } } });
    return res.json({ sessionToken, expiresAt: sessionExpiresAt.toISOString(), identity: { userId: record.userId, orbitId: record.userId, organizationId: record.organizationId, role: record.role } });
  } catch (error) { return next(error); }
});
router.post("/validate", async (req, res, next) => {
  try {
    if (!requireAcademyService(req, res)) return;
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) return res.status(401).json({ message: "Invalid Academy session" });
    const session = await prisma.academySession.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) return res.status(401).json({ message: "Academy session expired or revoked" });
    if (!isAcademyRole(session.role)) return res.status(403).json({ message: "Academy role denied" });
    const requiredOrganization = process.env.ACADEMY_ORGANIZATION_ID;
    if (requiredOrganization && session.organizationId !== requiredOrganization) return res.status(403).json({ message: "Academy organization denied" });
    await prisma.academySession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return res.json({ userId: session.userId, orbitId: session.userId, organizationId: session.organizationId, role: session.role, expiresAt: session.expiresAt.toISOString() });
  } catch (error) { return next(error); }
});
router.post("/revoke", async (req, res, next) => {
  try {
    if (!requireAcademyService(req, res)) return;
    const parsed = tokenSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid Academy session" });
    const session = await prisma.academySession.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
    if (session && !session.revokedAt) {
      await prisma.academySession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      await prisma.auditLog.create({ data: { organizationId: session.organizationId, userId: session.userId, action: "ACADEMY_LOGOUT", entityType: "AcademySession", entityId: session.id } });
    }
    return res.status(204).send();
  } catch (error) { return next(error); }
});
export default router;
