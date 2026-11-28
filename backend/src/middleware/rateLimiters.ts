import crypto from "crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { extractClientIp, normalizeClientIp } from "../lib/clientIp";

const AUTH_LIMIT_MESSAGE = { error: "Demasiadas tentativas. Tente novamente dentro de alguns minutos." };

/** IP do visitante sem o XFF escrito pelo browser (mesma regra do tracking). */
export function authClientIpKey(req: Request): string {
  const ip = extractClientIp(req) || normalizeClientIp(req.socket?.remoteAddress || "");
  return ip ? ipKeyGenerator(ip) : "anon";
}

function shortHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 40);
}

/** Conta visada: token MFA pendente ou e-mail (minúsculas). `null` = sem tecto por conta. */
export function authAccountKey(req: Request): string | null {
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const mfaToken = typeof body.mfa_token === "string" ? body.mfa_token.trim() : "";
  if (mfaToken) return `mfa:${shortHash(mfaToken)}`;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email) return `email:${shortHash(email)}`;
  return null;
}

export type AuthCredentialLimiterOptions = {
  windowMs: number;
  ipMax: number;
  accountMax: number;
};

export function resolveAuthCredentialLimiterOptions(
  env: NodeJS.ProcessEnv = process.env,
): AuthCredentialLimiterOptions {
  return {
    windowMs: Math.max(60_000, Number(env.AUTH_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000) || 15 * 60 * 1000),
    ipMax: Math.max(10, Number(env.AUTH_RATE_LIMIT_MAX ?? 80) || 80),
    accountMax: Math.max(5, Number(env.AUTH_ACCOUNT_RATE_LIMIT_MAX ?? 10) || 10),
  };
}

/**
 * Por IP (todas as tentativas) e por conta (só falhas: e-mail ou token MFA).
 * Staging/load: AUTH_RATE_LIMIT_MAX / AUTH_RATE_LIMIT_WINDOW_MS / AUTH_ACCOUNT_RATE_LIMIT_MAX.
 */
export function createAuthCredentialLimiter(opts: AuthCredentialLimiterOptions): RequestHandler {
  const byIp = rateLimit({
    windowMs: opts.windowMs,
    max: opts.ipMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: authClientIpKey,
    validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
    message: AUTH_LIMIT_MESSAGE,
  });
  const byAccount = rateLimit({
    windowMs: opts.windowMs,
    max: opts.accountMax,
    standardHeaders: false,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: (req) => authAccountKey(req) === null,
    keyGenerator: (req) => authAccountKey(req) ?? "none",
    validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
    message: AUTH_LIMIT_MESSAGE,
  });
  return (req: Request, res: Response, next: NextFunction) => {
    byIp(req, res, (err?: unknown) => {
      if (err) return next(err);
      byAccount(req, res, next);
    });
  };
}

/** Rotas de credenciais (login, registo, recuperação, MFA). */
export const authCredentialLimiter = createAuthCredentialLimiter(resolveAuthCredentialLimiterOptions());

function accountKey(req: Request): string {
  const u = req.user;
  return u?.tenantUserId || u?.userId || req.ip || "anon";
}

/** Gerador de palavras-chave (IA) — por conta. */
export const keywordGenerateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: accountKey,
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  message: { error: "Demasiadas gerações. Tente novamente dentro de alguns minutos." },
});

/** Auditoria de conformidade (probe / analyze) — por conta. Não partilhar com create. */
export const complianceAuditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: accountKey,
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  message: { error: "Demasiadas auditorias. Tente novamente dentro de alguns minutos." },
});

/** Defaults do tecto de create/status (testável; env só em staging/load). */
export function resolvePresellWriteLimitMax(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(20, Number(env.PRESELL_CREATE_RATE_LIMIT_MAX ?? 120) || 120);
}

export function resolvePresellWriteLimitWindowMs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.max(
    60_000,
    Number(env.PRESELL_CREATE_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000) || 15 * 60 * 1000,
  );
}

/**
 * Criar / alterar status de presell — bucket próprio (não gasta o tecto de auditorias).
 * Staging/load: PRESELL_CREATE_RATE_LIMIT_MAX / PRESELL_CREATE_RATE_LIMIT_WINDOW_MS.
 * Quota de plano (`max_pages`) continua a aplicar-se no controller.
 */
export const presellWriteLimiter = rateLimit({
  windowMs: resolvePresellWriteLimitWindowMs(),
  max: resolvePresellWriteLimitMax(),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: accountKey,
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  message: {
    error: "Demasiadas criações ou alterações de páginas. Tente novamente dentro de alguns minutos.",
  },
});

/** Geração IA de review de presell — por conta (além da quota mensal). */
export const presellAiGenerateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: accountKey,
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  message: { error: "Demasiadas gerações de review. Tente novamente dentro de alguns minutos." },
});
