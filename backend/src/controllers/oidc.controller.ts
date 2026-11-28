import { Request, Response } from "express";
import crypto from "node:crypto";
import { systemPrisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { resolveWorkspaceSessionForLogin } from "../lib/workspaceSession";
import { evaluateSubscriptionAccess } from "../lib/subscription";
import { findUserIdByEmail } from "../lib/userEmailLookup";

type OidcUserinfo = { sub?: string; email?: string; email_verified?: unknown; name?: string };

/** Sem e-mail verificado pelo IdP, qualquer conta lá criada com o e-mail da vítima entraria. Alguns IdPs enviam "true". */
export function oidcEmailVerified(ui: Pick<OidcUserinfo, "email_verified">): boolean {
  return ui.email_verified === true || ui.email_verified === "true";
}

/** Conta já ligada a outro `sub` não aceita outra identidade só por coincidir o e-mail. */
export function oidcEmailLinkDecision(
  linkedSubject: string | null,
  sub: string,
): "link" | "linked" | "conflict" {
  if (!linkedSubject) return "link";
  return linkedSubject === sub ? "linked" : "conflict";
}

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

function frontendAuthOrigin(): string {
  const raw =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.FRONTEND_URL?.trim().split(",")[0]?.trim() ||
    "https://www.dclickora.com";
  return raw.replace(/\/$/, "");
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
      const accept = String(req.get("accept") || "");
      if (accept.includes("application/json") && !accept.includes("text/html")) {
        return res.status(503).json({
          error:
            "SSO OIDC não configurado. Defina OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI.",
          code: "OIDC_NOT_CONFIGURED",
        });
      }
      return res.redirect(302, `${frontendAuthOrigin()}/auth?error=sso_unavailable`);
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
    const ui = (await uiRes.json()) as OidcUserinfo;
    const sub = ui.sub?.trim();
    if (!sub) return res.status(401).send("OIDC sem email/sub");

    const include = { roles: true, subscription: { include: { plan: true } } } as const;
    let user = await systemPrisma.user.findUnique({ where: { oidcSubject: sub }, include });
    if (!user) {
      const email = ui.email?.trim();
      if (!email) return res.status(401).send("OIDC sem email/sub");
      if (!oidcEmailVerified(ui)) {
        return res.status(403).send("O e-mail tem de estar verificado no fornecedor de SSO.");
      }
      const userId = await findUserIdByEmail(email);
      user = userId ? await systemPrisma.user.findUnique({ where: { id: userId }, include }) : null;
      if (!user) {
        return res.status(403).send(
          "Conta não encontrada. O SSO só entra em contas já registadas com o mesmo e-mail.",
        );
      }
      const link = oidcEmailLinkDecision(user.oidcSubject, sub);
      if (link === "conflict") {
        return res.status(403).send("Esta conta já está associada a outra identidade SSO.");
      }
      if (link === "link") {
        await systemPrisma.user.update({ where: { id: user.id }, data: { oidcSubject: sub } });
      }
    }

    const sess = await resolveWorkspaceSessionForLogin(user.id);
    const billing = await systemPrisma.user.findUnique({
      where: { id: sess.tenantUserId },
      include: { subscription: { include: { plan: true } }, roles: true },
    });
    if (!billing) return res.status(401).send("Conta inválida");
    const isPlatformAdmin = user.roles.some((r) => r.role === "admin" || r.role === "super_admin");
    // Não bloquear OIDC por assinatura — FE usa subscription_allowed no JWT/session.
    let subRow = isPlatformAdmin ? user.subscription : billing.subscription;
    const accessEval = evaluateSubscriptionAccess(subRow);
    if (accessEval.shouldMarkExpired && subRow && subRow.status !== "expired") {
      await systemPrisma.subscription.update({
        where: { id: subRow.id },
        data: { status: "expired" },
      });
    }

    const frontend =
      process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
      process.env.FRONTEND_URL?.replace(/\/$/, "") ||
      "https://www.dclickora.com";

    if (user.mfaEnabled) {
      const { signMfaPendingToken } = await import("../lib/mfa");
      const mfa_token = signMfaPendingToken({
        userId: user.id,
        email: user.email,
        tenantUserId: sess.tenantUserId,
        workspaceId: sess.workspaceId,
        workspaceRole: sess.workspaceRole,
        workspacePermissions: sess.workspacePermissions,
      });
      const q = new URLSearchParams({
        mfa_required: "1",
        mfa_token,
        email: user.email,
      });
      return res.redirect(`${frontend}/auth#${q.toString()}`);
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      tenantUserId: sess.tenantUserId,
      workspaceId: sess.workspaceId,
      workspaceRole: sess.workspaceRole,
      workspacePermissions: sess.workspacePermissions,
      purpose: "session",
    });

    // Entrega token via hash (não fica em logs de servidor como query longa em alguns proxies)
    res.redirect(`${frontend}/auth#oidc_token=${encodeURIComponent(token)}`);
  },
};
