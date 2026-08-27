import { Router } from "express";
import { env } from "../config/env.js";
import { authenticate, requireRoles, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler, ApiError, success } from "../utils/api.js";
import { prisma } from "../config/prisma.js";

export const academyRouter = Router();
academyRouter.post("/launch", authenticate, requireRoles("teacher"), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!env.KCS_ORBIT_API_URL || !env.ACADEMY_INTEGRATION_KEY || !env.ACADEMY_PUBLIC_URL) throw new ApiError(503, "Academy integration is not configured");
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { orbitUserId: true, orbitOrganizationId: true, role: true } });
  if (!user || !["TEACHER", "ADMIN"].includes(user.role)) throw new ApiError(403, "Academy access is not enabled for this role");
  if (!user.orbitUserId || user.orbitOrganizationId !== env.KCS_ORBIT_ORGANIZATION_ID) throw new ApiError(409, "This account is not linked to a verified Orbit identity");
  const response = await fetch(env.KCS_ORBIT_API_URL.replace(/\/$/, "") + "/api/academy/sso/service-tickets", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": env.ACADEMY_INTEGRATION_KEY },
    body: JSON.stringify({ userId: user.orbitUserId }), signal: AbortSignal.timeout(10_000)
  });
  const payload = await response.json().catch(() => ({})) as { ticket?: string; message?: string };
  if (!response.ok || !payload.ticket) throw new ApiError(response.status, payload.message || "Academy launch failed");
  const url = new URL("/api/auth/callback", env.ACADEMY_PUBLIC_URL);
  url.searchParams.set("ticket", payload.ticket);
  return success(res, { url: url.toString() });
}));
