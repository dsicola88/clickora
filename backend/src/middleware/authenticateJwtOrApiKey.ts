import { Request, Response, NextFunction } from "express";
import { systemPrisma } from "../lib/prisma";
import { verifyToken, type JwtPayload } from "../lib/jwt";
import { apiKeyMatches, looksLikeApiKey } from "../lib/apiKeys";
import { normalizeApiKeyScopes, type ApiKeyScope } from "../lib/apiKeyScopes";
import { resolveLiveWorkspaceClaims } from "../lib/workspaceSessionGuard";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      apiKeyId?: string;
      authVia?: "jwt" | "api_key";
      /** Scopes da API key (vazio se JWT). */
      apiKeyScopes?: ApiKeyScope[];
    }
  }
}

/**
 * Aceita JWT de sessão OU API key (`Authorization: Bearer ck_live_…`).
 * API key autentica como o dono da chave (tenant = userId).
 * Scopes são aplicados por `requireApiKeyScope` / `enforceApiKeyHttpScope`.
 */
export async function authenticateJwtOrApiKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }
  const token = header.slice(7).trim();
  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  if (looksLikeApiKey(token)) {
    const prefix = token.slice(0, 12);
    const candidates = await systemPrisma.apiKey.findMany({
      where: { keyPrefix: prefix, revokedAt: null },
      take: 20,
    });
    let matched: (typeof candidates)[0] | null = null;
    for (const row of candidates) {
      if (await apiKeyMatches(token, row.keyHash)) {
        matched = row;
        break;
      }
    }
    if (!matched) return res.status(401).json({ error: "API key inválida" });

    const scopes = normalizeApiKeyScopes(matched.scopes);
    if (scopes.length === 0) {
      return res.status(403).json({
        error: "API key sem scopes válidos",
        code: "api_key_scope_denied",
      });
    }

    const user = await systemPrisma.user.findUnique({
      where: { id: matched.userId },
      select: { id: true, email: true },
    });
    if (!user) return res.status(401).json({ error: "API key inválida" });

    void systemPrisma.apiKey
      .update({ where: { id: matched.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    req.user = {
      userId: user.id,
      email: user.email,
      tenantUserId: user.id,
      workspaceRole: "owner",
      workspacePermissions: [],
    };
    req.apiKeyId = matched.id;
    req.apiKeyScopes = scopes;
    req.authVia = "api_key";
    return next();
  }

  try {
    const raw = verifyToken(token);
    const live = await resolveLiveWorkspaceClaims(raw);
    req.user = {
      ...raw,
      tenantUserId: live.tenantUserId,
      workspaceId: live.workspaceId,
      workspaceRole: live.workspaceRole ?? "owner",
      workspacePermissions: live.workspacePermissions ?? [],
    };
    req.authVia = "jwt";
    req.apiKeyScopes = undefined;
    req.apiKeyId = undefined;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}
