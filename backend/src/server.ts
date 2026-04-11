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

/**
 * Origens permitidas para CORS a partir de FRONTEND_URL.
 * - Usa só o origin (protocolo + host + porta), sem path — o header Origin do browser nunca inclui `/auth` etc.
 * - Inclui par www/apex para o mesmo domínio.
 */
function expandFrontendOriginsFromEnv(): string[] {
  const raw = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = new Set<string>();
  for (const u of raw) {
    try {
      const parsed = new URL(u);
      const base = parsed.origin;
      out.add(base);
      if (!parsed.hostname || parsed.hostname === "localhost") continue;
      if (parsed.hostname.startsWith("www.")) {
        const apex = `${parsed.protocol}//${parsed.hostname.slice(4)}${parsed.port ? `:${parsed.port}` : ""}`;
        out.add(apex);
      } else {
        out.add(`${parsed.protocol}//www.${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`);
      }
    } catch {
      // ignore invalid URL
    }
  }
  return [...out];
}

/** Origens explícitas (ex.: https://www.dclickora.com) — útil se FRONTEND_URL estiver mal formatado. */
function corsAllowedOriginsFromEnv(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function allAllowedOrigins(): string[] {
  return [...new Set([...expandFrontendOriginsFromEnv(), ...corsAllowedOriginsFromEnv()])];
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (isDev) {
    // Vite pode usar 8080, 8081, 5173, etc. se a porta padrão estiver ocupada
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return true;
  }
  const fromEnv = allAllowedOrigins();
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
        console.warn(`[CORS] origin not allowed: ${origin}`);
        callback(null, false);
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
// Raiz: evita "Cannot GET /" no browser ao abrir o URL da Railway (só API; o site está no Vercel).
app.get("/", (_req, res) => {
  res.json({
    service: "dclickora API",
    hint: "Frontend (site) é servido na Vercel; este host só expõe rotas em /api/*.",
    health: "/api/health",
  });
});

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
// 0.0.0.0 — necessário em Docker/Railway para o proxy alcançar o processo (evita 502 se só escutasse em localhost).
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 dclickora API listening on 0.0.0.0:${PORT}`);
});

export default app;
