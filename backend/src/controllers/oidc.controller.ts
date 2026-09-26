import { Request, Response } from "express";
import crypto from "node:crypto";
import { systemPrisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { resolveWorkspaceSessionForLogin } from "../lib/workspaceSession";
import { evaluateSubscriptionAccess } from "../lib/subscription";
import { serializeUser } from "./auth.controller";

type OidcConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
};

function getOidcConfig(): OidcConfig | null {
  const issuer = (process.env.OIDC_ISSUER || "").replace(/\/$/, "");
  const clientId = process.env.OIDC_CLIENT_ID || "";
  const clientSecret = process.env.OIDC_CLIENT_SECRET || "";
  const redirectUri = process.env.OIDC_REDIRECT_URI || "";
  if (!issuer || !clientId || !clientSecret || !redirectUri) return null;
  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    scopes: process.env.OIDC_SCOPES || "openid email profile",
  };
}

const pendingStates = new Map<string, { exp: number }>();

function pruneStates() {
  const now = Date.now();
  for (const [k, v] of pendingStates) {
    if (v.exp < now) pendingStates.delete(k);
  }
}

/**
 * SSO enterprise via OIDC genérico (Okta / Azure AD / Keycloak / Auth0).
 * Env: OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI
 */
export const oidcController = {
  async loginRedirect(req: Request, res: Response) {
    const cfg = getOidcConfig();
    if (!cfg) {
      return res.status(503).json({
        error: "SSO OIDC não configurado. Defina OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI.",
        code: "OIDC_NOT_CONFIGURED",
      });
    }
    pruneStates();
    const state = crypto.randomBytes(16).toString("hex");
    pendingStates.set(state, { exp: Date.now() + 10 * 60_000 });
    const authUrl = new URL(`${cfg.issuer}/authorize`);
    // Alguns IdPs usam discovery — tenta /.well-known
    let authorize = `${cfg.issuer}/oauth/authorize`;
    try {
      const disc = await fetch(`${cfg.issuer}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(8000),
      });
      if (disc.ok) {
        const j = (await disc.json()) as { authorization_endpoint?: string };
        if (j.authorization_endpoint) authorize = j.authorization_endpoint;
      }
    } catch {
      /* fallback paths */
      authorize = authUrl.toString().includes("authorize")
        ? `${cfg.issuer}/authorize`
        : `${cfg.issuer}/oauth/authorize`;
    }
    const u = new URL(authorize);
    u.searchParams.set("client_id", cfg.clientId);
    u.searchParams.set("redirect_uri", cfg.redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", cfg.scopes);
    u.searchParams.set("state", state);
    res.redirect(u.toString());
  },

  async callback(req: Request, res: Response) {
    const cfg = getOidcConfig();
    if (!cfg) return res.status(503).send("OIDC não configurado");
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state || !pendingStates.has(state)) {
      return res.status(400).send("State/code inválido");
    }
    pendingStates.delete(state);

    let tokenEndpoint = `${cfg.issuer}/oauth/token`;
    try {
      const disc = await fetch(`${cfg.issuer}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(8000),
      });
      if (disc.ok) {
        const j = (await disc.json()) as { token_endpoint?: string; userinfo_endpoint?: string };
        if (j.token_endpoint) tokenEndpoint = j.token_endpoint;
      }
    } catch {
      /* */
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    });
    const tokRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokRes.ok) {
      return res.status(401).send("Falha no token OIDC");
    }
    const tok = (await tokRes.json()) as { access_token?: string; id_token?: string };
    const access = tok.access_token;
    if (!access) return res.status(401).send("Sem access_token");

    let userinfoUrl = `${cfg.issuer}/userinfo`;
    try {
      const disc = await fetch(`${cfg.issuer}/.well-known/openid-configuration`, {
        signal: AbortSignal.timeout(8000),
      });
      if (disc.ok) {
        const j = (await disc.json()) as { userinfo_endpoint?: string };
        if (j.userinfo_endpoint) userinfoUrl = j.userinfo_endpoint;
      }
    } catch {
      /* */
    }

    const uiRes = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${access}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!uiRes.ok) return res.status(401).send("Falha no userinfo");
    const ui = (await uiRes.json()) as { sub?: string; email?: string; name?: string };
    const sub = ui.sub?.trim();
    const email = ui.email?.trim().toLowerCase();
    if (!sub || !email) return res.status(401).send("OIDC sem email/sub");

    let user = await systemPrisma.user.findFirst({
      where: { OR: [{ oidcSubject: sub }, { email }] },
      include: { roles: true, subscription: { include: { plan: true } } },
    });
    if (!user) {
      return res.status(403).send(
        "Conta não encontrada. O SSO só entra em contas já registadas com o mesmo e-mail.",
      );
    }
    if (!user.oidcSubject) {
      await systemPrisma.user.update({ where: { id: user.id }, data: { oidcSubject: sub } });
    }

    const sess = await resolveWorkspaceSessionForLogin(user.id);
    const billing = await systemPrisma.user.findUnique({
      where: { id: sess.tenantUserId },
      include: { subscription: { include: { plan: true } }, roles: true },
    });
    if (!billing) return res.status(401).send("Conta inválida");
    const isPlatformAdmin = user.roles.some((r) => r.role === "admin" || r.role === "super_admin");
    const subRow = isPlatformAdmin ? user.subscription : billing.subscription;
    const accessEval = evaluateSubscriptionAccess(subRow);
    if (!accessEval.allowed) return res.status(403).send("Assinatura inválida");

    const token = signToken({
      userId: user.id,
      email: user.email,
      tenantUserId: sess.tenantUserId,
      workspaceId: sess.workspaceId,
      workspaceRole: sess.workspaceRole,
      workspacePermissions: sess.workspacePermissions,
      purpose: "session",
    });

    const frontend =
      process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
      process.env.FRONTEND_URL?.replace(/\/$/, "") ||
      "https://www.dclickora.com";
    // Entrega token via hash (não fica em logs de servidor como query longa em alguns proxies)
    res.redirect(`${frontend}/auth#oidc_token=${encodeURIComponent(token)}`);
  },
};
