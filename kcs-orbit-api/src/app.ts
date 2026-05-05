import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import coreRoutes from "./routes/core.routes";
import integrationIngestRoutes from "./routes/integration.ingest.routes";
import integrationRegistryRoutes from "./routes/integration.registry.routes";
import integrationReadRoutes from "./routes/integration.read.routes";
import integrationRoutes from "./routes/integration.routes";

export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());
  app.use(express.json());
  app.use(morgan("dev"));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
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

  app.use("/api/auth", authRoutes);
  app.use("/api", coreRoutes);
  app.use("/api/integration", integrationRoutes);
  app.use("/api/integration/read", integrationReadRoutes);
  app.use("/api/integration/registry", integrationRegistryRoutes);
  app.use("/api/integration/ingest", integrationIngestRoutes);

  return app;
}