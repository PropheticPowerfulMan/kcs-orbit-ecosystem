import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import academicYearRoutes from "./routes/academic-year.routes";
import coreRoutes from "./routes/core.routes";
import integrationIngestRoutes from "./routes/integration.ingest.routes";
import integrationRegistryRoutes from "./routes/integration.registry.routes";
import integrationReadRoutes from "./routes/integration.read.routes";
import integrationRoutes from "./routes/integration.routes";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { prisma } from "./db";

const authAttempts = new Map<string, { count: number; resetAt: number }>();

function authRateLimit(windowMs: number, maxAttempts: number): express.RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const identifier = String(req.body?.email || req.body?.identifier || "").toLowerCase();
    const key = `${req.ip}:${req.path}:${identifier}`;
    const current = authAttempts.get(key);

    if (!current || current.resetAt <= now) {
      authAttempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= maxAttempts) {
      return res.status(429).json({ message: "Too many authentication attempts. Please wait and try again." });
    }

    current.count += 1;
    authAttempts.set(key, current);
    return next();
  };
}

export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
    throw new Error("KCS Orbit production configuration is unsafe. Set CORS_ORIGIN.");
  }

  app.use(helmet());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || (process.env.NODE_ENV !== "production" && allowedOrigins.length === 0) || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  }));

  app.get("/", (_req, res) => {
    res.json({
      name: "KCS Orbit API",
      status: "running",
      version: "1.0.0"
    });
  });

  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, service: "kcs-orbit-api", databaseReady: true });
    } catch {
      res.status(503).json({ ok: false, service: "kcs-orbit-api", databaseReady: false });
    }
  });

  app.use("/api/auth", authRateLimit(15 * 60 * 1000, 20), authRoutes);
  app.use("/api", coreRoutes);
  app.use("/api/integration/academic-year", academicYearRoutes);
  app.use("/api/integration", integrationRoutes);
  app.use("/api/integration/read", integrationReadRoutes);
  app.use("/api/integration/registry", integrationRegistryRoutes);
  app.use("/api/integration/ingest", integrationIngestRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
