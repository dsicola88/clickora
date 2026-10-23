import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
/** Express 4 não captura rejeições em handlers `async` — sem isto, erros podem derrubar o processo (502 na Railway). */
import "express-async-errors";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./routes/auth.routes";
import { presellRouter } from "./routes/presell.routes";
import { analyticsRouter } from "./routes/analytics.routes";
import { plansRouter } from "./routes/plans.routes";
import { adminRouter } from "./routes/admin.routes";
import { trackRouter } from "./routes/track.routes";
import { webhookRouter } from "./routes/webhook.routes";
import { campaignsRouter } from "./routes/campaigns.routes";
import { publicRouter } from "./routes/public.routes";
import { integrationsRouter } from "./routes/integrations.routes";
import { customDomainRouter } from "./routes/customDomain.routes";
import { trafficRotatorsRouter } from "./routes/trafficRotators.routes";
import { workspaceRouter } from "./routes/workspace.routes";
import { paidOauthPublicRouter } from "./routes/paidOauthPublic.routes";
import { paidRouter } from "./routes/paid.routes";
import { enterpriseRouter } from "./routes/enterprise.routes";
import { keywordResearchRouter } from "./routes/keywordResearch.routes";
import { lessonsRouter } from "./routes/lessons.routes";
import { errorHandler } from "./middleware/errorHandler";
import { isVerifiedCustomDomainOrigin, refreshCustomDomainCache } from "./lib/customDomainCache";
import { refreshCloudIpRanges } from "./lib/cloudIpRanges";
import {
  corsCredentialsForPath,
  isAllowedOrigin as corsOriginAllowed,
  isPublicTrackingPath,
} from "./lib/corsPolicy";
import { repairPlanSchemaColumns } from "./lib/schemaRepair";
import { initWebPushFromEnv } from "./lib/webPush";
import { logPaidEnvStatus } from "./paid/paidEnvCheck";
import { logR2EnvStatus } from "./lib/r2Storage";
import { optimizerEnabled } from "./paid/optimizer/config";
import { registerPaidOptimizerScheduler } from "./paid/optimizer/scheduler";
import { registerAffiliateOpsScheduler } from "./modules/affiliateOps/scheduler";
import { registerKeepAlivePing } from "./modules/affiliateOps/keepAlive";
import {
  getOpsSnapshot,
  getRequestId,
  initOpsObservability,
  requestIdMiddleware,
} from "./lib/opsObservability";

initWebPushFromEnv();
logR2EnvStatus();
initOpsObservability();

const app = express();
/** Railway / Vercel / proxies — necessário para `x-forwarded-proto` e URLs `https` corretas (webhooks). */
/** Vercel → Railway: vários hops; `X-Forwarded-Host` deve refletir o domínio do visitante (presells em domínio próprio). */
app.set("trust proxy", true);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);
app.use(requestIdMiddleware);
const PORT = process.env.PORT || 3001;

/**
 * Lista de URLs (vírgula) → origins únicos; inclui par www/apex quando não é localhost.
 * Usado para FRONTEND_URL e, opcionalmente, DPILOTO_PUBLIC_ORIGINS (legado / compat.).
 */
function expandOriginsWithWwwApex(rawEnv: string): string[] {
  const raw = (rawEnv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = new Set<string>();
  for (const u of raw) {
    try {
      const parsed = new URL(u);
      const base = parsed.origin;
      out.add(base);
      if (!parsed.hostname || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") continue;
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

/** Origens permitidas para CORS a partir de FRONTEND_URL. */
function expandFrontendOriginsFromEnv(): string[] {
  return expandOriginsWithWwwApex(process.env.FRONTEND_URL || "");
}

/** CORS extra via `DPILOTO_PUBLIC_ORIGINS` (legado; nome da env mantido por compat.). */
function expandOptionalExtraCorsOriginsFromEnv(): string[] {
  return expandOriginsWithWwwApex(process.env.DPILOTO_PUBLIC_ORIGINS || "");
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
      ...expandOptionalExtraCorsOriginsFromEnv(),
      ...corsAllowedOriginsFromEnv(),
    ]),
  ];
}

function isAllowedOrigin(origin: string | undefined, path: string): boolean {
  return corsOriginAllowed(origin, {
    path,
    isVerifiedCustomDomainOrigin,
    envAllowedOrigins: allAllowedOrigins(),
  });
}

// ========================
// Middleware
// ========================
/**
 * CORS por caminho:
 * - `/api/track/*` — qualquer origem http(s) (landers/oferta; embed com credentials omit).
 * - resto — allowlist (site, domínio verificado, FRONTEND_URL) com credentials.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const path = req.path || "";
  if (isPublicTrackingPath(path)) {
    return cors({
      origin: true,
      credentials: false,
      optionsSuccessStatus: 204,
      methods: ["GET", "HEAD", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Accept"],
      exposedHeaders: ["X-Next-Cursor", "Content-Disposition"],
    })(req, res, next);
  }
  return cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin, path)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] origin not allowed: ${origin} path=${path}`);
        callback(null, false);
      }
    },
    credentials: true,
    optionsSuccessStatus: 204,
    exposedHeaders: ["X-Next-Cursor", "Content-Disposition"],
  })(req, res, next);
});

/**
 * Garante `Access-Control-Allow-Origin` em respostas JSON/handlers onde o pacote `cors`
 * por vezes não aplica (ex.: alguns caminhos de erro). Se a Railway devolver 502 antes do Node,
 * não há cabeçalhos — aí o problema é upstream/timeout.
 */
function ensureCorsHeadersOnResponseEnd(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (!origin) return next();
  const path = req.path || "";
  if (!isAllowedOrigin(origin, path)) {
    return next();
  }
  const withCreds = corsCredentialsForPath(path);
  const origEnd = res.end.bind(res);
  res.end = function (chunk?: unknown, encoding?: unknown, cb?: unknown) {
    if (!res.getHeader("Access-Control-Allow-Origin")) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      if (withCreds) res.setHeader("Access-Control-Allow-Credentials", "true");
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
app.use("/api/enterprise", enterpriseRouter);
app.use("/api/presells", presellRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/keyword-researches", keywordResearchRouter);
app.use("/api/lessons", lessonsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/plans", plansRouter);
app.use("/api/admin", adminRouter);
app.use("/api/track", trackRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api/integrations", integrationsRouter);
app.use("/api/custom-domain", customDomainRouter);
app.use("/api/traffic-rotators", trafficRotatorsRouter);
app.use("/api/workspaces", workspaceRouter);
app.use("/api/paid", paidOauthPublicRouter);
app.use("/api/paid", paidRouter);
app.use("/api/public", publicRouter);

// Health check (+ ops snapshot Fase 0)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    request_id: getRequestId(req),
    ops: getOpsSnapshot(),
  });
});

// ========================
// Error Handler
// ========================
app.use(errorHandler);

// ========================
// Start
// ========================
void refreshCustomDomainCache();
setInterval(() => {
  void refreshCustomDomainCache();
}, 120_000);

void refreshCloudIpRanges();
setInterval(() => {
  void refreshCloudIpRanges();
}, 6 * 60 * 60 * 1000);

if (optimizerEnabled()) {
  registerPaidOptimizerScheduler();
}
registerAffiliateOpsScheduler();
registerKeepAlivePing();

// Escutar **antes** do repair: se ALTER falhar ou a BD estiver lenta, o processo ainda responde
// (health + rotas com fallback P2022). Esperar repair antes de listen causava process.exit(1) → 502 no Railway/Vercel.
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`🚀 dclickora API listening on 0.0.0.0:${PORT}`);
  logPaidEnvStatus();
});

void repairPlanSchemaColumns();

export default app;
