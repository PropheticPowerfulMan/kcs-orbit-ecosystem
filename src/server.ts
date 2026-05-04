import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import coreRoutes from "./routes/core.routes";
import integrationIngestRoutes from "./routes/integration.ingest.routes";
import integrationRoutes from "./routes/integration.routes";

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
app.use("/api/integration/ingest", integrationIngestRoutes);

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`KCS Orbit API running on port ${port}`);
});
