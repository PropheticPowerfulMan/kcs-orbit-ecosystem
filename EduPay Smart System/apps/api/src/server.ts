import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/router";
import { parentRouter } from "./modules/parents/router";
import { studentRouter } from "./modules/students/router";
import { paymentRouter } from "./modules/payments/router";
import { bankTransferRouter } from "./modules/bank-transfers/router";
import { notificationRouter } from "./modules/notifications/router";
import { analyticsRouter } from "./modules/analytics/router";
import { aiRouter } from "./modules/ai/router";
import { classRouter } from "./modules/classes/router";
import { exportRouter } from "./modules/exports/router";
import { financeRouter } from "./modules/finance/router";
import { expenseRouter } from "./modules/expenses/router";
import { sharedDirectoryRouter } from "./modules/shared-directory/router";
import { startOrbitOutboxWorker } from "./integrations/orbit";
import { prisma } from "./prisma";
import { createCorsOptions } from "./cors";

const app = express();

type ExpressLayer = { handle?: (...args: any[]) => any; route?: { stack?: ExpressLayer[] }; name?: string };

function protectAsyncHandlers(router: { stack?: ExpressLayer[] }) {
  const protect = (layer: ExpressLayer) => {
    if (layer.route?.stack) layer.route.stack.forEach(protect);
    if (!layer.handle || layer.handle.length === 4 || layer.name === 'router') return;
    const original = layer.handle;
    layer.handle = function protectedHandler(req: express.Request, res: express.Response, next: express.NextFunction) {
      try {
        const result = original.call(this, req, res, next);
        if (result && typeof result.catch === 'function') result.catch(next);
        return result;
      } catch (error) {
        return next(error);
      }
    };
  };
  router.stack?.forEach(protect);
}

[authRouter, parentRouter, studentRouter, paymentRouter, bankTransferRouter, notificationRouter, analyticsRouter, aiRouter, classRouter, exportRouter, financeRouter, expenseRouter, sharedDirectoryRouter]
  .forEach(protectAsyncHandlers);

if (env.NODE_ENV === "production") {
  const weakJwtSecret = !env.JWT_SECRET || env.JWT_SECRET.includes("CHANGE_ME") || env.JWT_SECRET.includes("dev-secret");
  const missingDatabase = !env.DATABASE_URL;
  if (weakJwtSecret || missingDatabase || env.ENABLE_DEMO_AUTH_FALLBACK === "true" || env.ENABLE_DEMO_DATA_FALLBACK === "true") {
    throw new Error("EduPay production configuration is unsafe. Set DATABASE_URL/JWT_SECRET and disable demo fallbacks.");
  }
}

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "https://edupay-web.onrender.com"
]);

if (env.FRONTEND_URL) {
  allowedOrigins.add(env.FRONTEND_URL.replace(/\/$/, ""));
}

app.use(helmet());
app.use(cors(createCorsOptions(allowedOrigins)));
app.use(express.json({ limit: "3mb" }));
app.use(morgan("combined"));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250
}));

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", service: "api", databaseReady: true });
  } catch {
    res.status(503).json({ status: "degraded", service: "api", databaseReady: false });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/parents", parentRouter);
app.use("/api/students", studentRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/bank-transfer-requests", bankTransferRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/classes", classRouter);
app.use("/api/export", exportRouter);
app.use("/api/finance", financeRouter);
app.use("/api/expenses", expenseRouter);
app.use("/api/shared-directory", sharedDirectoryRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[EDUPAY_API_ERROR]', error);
  if (res.headersSent) return;
  const status = typeof (error as { status?: unknown })?.status === 'number' ? Number((error as { status: number }).status) : 500;
  const message = error instanceof Error ? error.message : 'Erreur interne EduPay.';
  res.status(status).json({ message });
});

const stopOrbitOutboxWorker = startOrbitOutboxWorker();

const server = app.listen(Number(process.env.PORT ?? env.API_PORT), "0.0.0.0", () => {
  console.log(`API running on port ${process.env.PORT ?? env.API_PORT}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down EduPay API`);
  stopOrbitOutboxWorker();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
