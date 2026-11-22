import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
/** A shared Academy server IP is not a person. Verified service calls retain both per-session and global ceilings. */
export function academyRateLimit(options: {
  serviceKey: () => string | undefined;
  now?: () => number;
  serviceLimit?: number;
  identityLimit?: number;
  publicLimit?: number;
}) {
  const now = options.now || Date.now,
    buckets = new Map<string, { count: number; until: number }>();
  let operations = 0;
  const servicePaths = new Set([
    "/service-tickets",
    "exchange",
    "/exchange",
    "/validate",
    "/revoke",
  ]);
  const take = (key: string, max: number) => {
    const time = now();
    let item = buckets.get(key);
    if (!item || item.until <= time) {
      if (buckets.size >= 50000) return false;
      item = { count: 0, until: time + 60000 };
      buckets.set(key, item);
    }
    if (item.count >= max) return false;
    item.count++;
    return true;
  };
  const handler: RequestHandler = (req, res, next) => {
    if (++operations % 100 === 0)
      for (const [k, v] of buckets) if (v.until <= now()) buckets.delete(k);
    const expected = options.serviceKey() || "",
      provided = req.header("x-api-key") || "";
    const verified =
      Boolean(expected) &&
      Buffer.byteLength(expected) === Buffer.byteLength(provided) &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(provided)) &&
      servicePaths.has(req.path);
    let allowed: boolean;
    if (verified) {
      const raw =
        req.path === "/service-tickets"
          ? req.body?.userId
          : req.body?.token || req.body?.ticket;
      const identity = createHash("sha256")
        .update(typeof raw === "string" ? raw.slice(0, 256) : "missing")
        .digest("hex");
      allowed =
        take("service", options.serviceLimit || 6000) &&
        take(req.path + ":" + identity, options.identityLimit || 120);
    } else allowed = take("public:" + req.ip, options.publicLimit || 30);
    if (!allowed) {
      res.setHeader("Retry-After", "60");
      res
        .status(429)
        .json({
          message: "Too many Academy requests. Please try again in 1 minute.",
          retryAfterSeconds: 60,
        });
      return;
    }
    next();
  };
  return handler;
}
