import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes";
import { presellRouter } from "./routes/presell.routes";
import { analyticsRouter } from "./routes/analytics.routes";
import { plansRouter } from "./routes/plans.routes";
import { adminRouter } from "./routes/admin.routes";
import { trackRouter } from "./routes/track.routes";
import { webhookRouter } from "./routes/webhook.routes";
import { publicRouter } from "./routes/public.routes";
import { integrationsRouter } from "./routes/integrations.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT || 3001;

const isDev = process.env.NODE_ENV !== "production";

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (isDev) {
    // Vite pode usar 8080, 8081, 5173, etc. se a porta padrão estiver ocupada
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
  }
  const fromEnv = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv.includes(origin);
  return ["http://localhost:8080", "http://localhost:5173"].includes(origin);
}

// ========================
// Middleware
// ========================
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origem não permitida: ${origin}`));
      }
    },
    credentials: true,
  }),
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));

// ========================
// Routes
// ========================
app.use("/api/auth", authRouter);
app.use("/api/presells", presellRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/plans", plansRouter);
app.use("/api/admin", adminRouter);
app.use("/api/track", trackRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/public", publicRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ========================
// Error Handler
// ========================
app.use(errorHandler);

// ========================
// Start
// ========================
app.listen(PORT, () => {
  console.log(`🚀 dclickora API running on http://localhost:${PORT}`);
});

export default app;
