import { AppSlug } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        organizationId?: string | null;
      };
      integration?: {
        appSlug: AppSlug;
      };
    }
  }
}

const integrationKeyByApp: Record<AppSlug, string | undefined> = {
  [AppSlug.KCS_NEXUS]: process.env.KCS_NEXUS_INTEGRATION_KEY,
  [AppSlug.EDUPAY]: process.env.EDUPAY_INTEGRATION_KEY,
  [AppSlug.EDUSYNCAI]: process.env.EDUSYNCAI_INTEGRATION_KEY,
  [AppSlug.SAVANEX]: process.env.SAVANEX_INTEGRATION_KEY
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: missing token" });
  }

  try {
    const token = header.replace("Bearer ", "");
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}

export function requireIntegrationAccess(appSlug: AppSlug) {
  return (req: Request, res: Response, next: NextFunction) => {
    const providedKey = req.header("x-api-key");
    const expectedKey = integrationKeyByApp[appSlug];

    if (!expectedKey) {
      return res.status(503).json({ message: `Integration key not configured for ${appSlug}` });
    }

    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({ message: "Unauthorized integration request" });
    }

    req.integration = { appSlug };
    next();
  };
}
