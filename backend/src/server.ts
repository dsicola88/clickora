import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
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
import { repairPlanSchemaColumns } from "./lib/schemaRepair";

const app = express();
/** Railway / Vercel / proxies — necessário para `x-forwarded-proto` e URLs `https` corretas (webhooks). */
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

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

/**
 * Origens mínimas em produção se o env falhar — evita CORS vazio (só localhost) e login impossível desde o site.
 * FRONTEND_URL na Railway deve mesmo listar o site; isto é rede de segurança.
 */
function defaultProductionCorsOrigins(): string[] {
  if (process.env.NODE_ENV !== "production") return [];
  return ["https://www.dclickora.com", "https://dclickora.com"];
}

function allAllowedOrigins(): string[] {
  return [
    ...new Set([
      ...defaultProductionCorsOrigins(),
      ...expandFrontendOriginsFromEnv(),
      ...corsAllowedOriginsFromEnv(),
    ]),
  ];
}

/** Domínio de produção do site — sempre permitir (evita CORS quebrado se FRONTEND_URL/NODE_ENV falharem no deploy). */
function isDclickoraSiteOrigin(origin: string): boolean {
  return /^https:\/\/(www\.)?dclickora\.com$/i.test(origin.trim());
}

/** Origem do browser em máquina local — independente de NODE_ENV (muitos .env locais usam production por engano). */
function isLocalMachineOrigin(origin: string): boolean {
  try {
    const u = new URL(origin.trim());
    const h = u.hostname.toLowerCase();
    if (h !== "localhost" && h !== "127.0.0.1") return false;
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (isDclickoraSiteOrigin(origin)) return true;
  if (isLocalMachineOrigin(origin)) return true;
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
    optionsSuccessStatus: 204,
  }),
);

/**
 * Garante `Access-Control-Allow-Origin` em respostas JSON/handlers onde o pacote `cors`
 * por vezes não aplica (ex.: alguns caminhos de erro). Se a Railway devolver 502 antes do Node,
 * não há cabeçalhos — aí o problema é upstream/timeout.
 */
function ensureCorsHeadersOnResponseEnd(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (!origin || !isAllowedOrigin(origin)) {
    return next();
  }
  const origEnd = res.end.bind(res);
  res.end = function (chunk?: unknown, encoding?: unknown, cb?: unknown) {
    if (!res.getHeader("Access-Control-Allow-Origin")) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    return origEnd(chunk as never, encoding as never, cb as never);
  };
  next();
}
app.use(ensureCorsHeadersOnResponseEnd);

/** Presells após import podem ter JSON > 1MB (texto + imagens); 1MB fazia falhar o POST com 502 no proxy. */
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(
  express.json({
    limit: "12mb",
    verify: (req, _res, buf) => {
      (req as Request).rawBody = buf;
    },
  }),
);

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

// Evita "Cannot GET /api" ao abrir a base da API no browser — não há lista de rotas em GET /api.
app.get("/api", (_req, res) => {
  res.json({
    service: "dclickora API",
    message: "Base /api — rotas sob /api/auth, /api/plans, /api/health, etc.",
    health: "/api/health",
    root: "/",
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
// Escutar **antes** do repair: se ALTER falhar ou a BD estiver lenta, o processo ainda responde
// (health + rotas com fallback P2022). Esperar repair antes de listen causava process.exit(1) → 502 no Railway/Vercel.
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 dclickora API listening on 0.0.0.0:${PORT}`);
});

void repairPlanSchemaColumns();

export default app;
