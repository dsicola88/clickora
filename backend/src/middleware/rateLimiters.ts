import rateLimit from "express-rate-limit";
import type { Request } from "express";

/** Rotas de credenciais (login, registo, recuperação) — por IP.
 * Staging/load: AUTH_RATE_LIMIT_MAX / AUTH_RATE_LIMIT_WINDOW_MS.
 */
export const authCredentialLimiter = rateLimit({
  windowMs: Math.max(60_000, Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000) || 15 * 60 * 1000),
  max: Math.max(10, Number(process.env.AUTH_RATE_LIMIT_MAX ?? 80) || 80),
  standardHeaders: true,
  legacyHeaders: false,
  /** trust proxy é intencional (Vercel/Railway); desactiva o throw ERR_ERL_PERMISSIVE_TRUST_PROXY. */
  validate: { trustProxy: false },
  message: { error: "Demasiadas tentativas. Tente novamente dentro de alguns minutos." },
});

/** Gerador de palavras-chave (IA) — por conta. */
export const keywordGenerateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const u = req.user;
    return u?.tenantUserId || u?.userId || req.ip || "anon";
  },
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  message: { error: "Demasiadas gerações. Tente novamente dentro de alguns minutos." },
});

/** Auditoria de conformidade (probe de destino) — por conta. */
export const complianceAuditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const u = req.user;
    return u?.tenantUserId || u?.userId || req.ip || "anon";
  },
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  message: { error: "Demasiadas auditorias. Tente novamente dentro de alguns minutos." },
});

/** Geração IA de review de presell — por conta (além da quota mensal). */
export const presellAiGenerateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const u = req.user;
    return u?.tenantUserId || u?.userId || req.ip || "anon";
  },
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  message: { error: "Demasiadas gerações de review. Tente novamente dentro de alguns minutos." },
});
