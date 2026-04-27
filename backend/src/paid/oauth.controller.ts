import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";

import {
  buildGoogleOAuthAuthUrl,
  exchangeGoogleAuthorizationCode,
  fetchCustomerName,
  isGoogleAdsOAuthConfigured,
  listFirstAccessibleCustomerId,
} from "./google-ads.api";
import { prisma } from "./paidPrisma";
import { getPaidActor, canAdminProject } from "./permissions";
import {
  getPaidOAuthFrontendBase,
  googleOAuthRedirectUri,
  metaOAuthRedirectUri,
  tiktokOAuthRedirectUri,
} from "./paidOauthEnv";

const TIKTOK_TOKEN_URL = "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";
const DEFAULT_TIKTOK_AUTH_BASE = "https://ads.tiktok.com/marketing_api/auth";

function redirectToFrontend(
  res: Response,
  projectId: string,
  query: Record<string, string | undefined>,
  pathSegment: "google" | "meta" | "tiktok",
) {
  const base = getPaidOAuthFrontendBase();
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  const q = sp.toString();
  return res.redirect(302, `${base}/tracking/dpilot/p/${projectId}/${pathSegment}${q ? `?${q}` : ""}`);
}

export const oauthController = {
  async oauthConfig(req: Request, res: Response) {
    return res.json({
      google: { available: isGoogleAdsOAuthConfigured() },
      meta: {
        available: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
        appId: process.env.META_APP_ID ? "configured" : null,
      },
      tiktok: {
        available: Boolean(process.env.TIKTOK_APP_ID && process.env.TIKTOK_APP_SECRET),
        appId: process.env.TIKTOK_APP_ID ? "configured" : null,
      },
    });
  },

  async googleStart(req: Request, res: Response) {
    const body = z.object({ projectId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "projectId inválido." });
    }
    const a = getPaidActor(req);
    if (!a) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    if (!(await canAdminProject(body.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão para gerir a ligação Google Ads." });
    }
    if (!isGoogleAdsOAuthConfigured()) {
      return res.status(503).json({
        error:
          "Google Ads OAuth em falta. Defina GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET e GOOGLE_ADS_DEVELOPER_TOKEN.",
      });
    }
    const project = await prisma.paidAdsProject.findFirst({
      where: { id: body.data.projectId, userId: a.tenantUserId },
      select: { id: true, userId: true },
    });
    if (!project) {
      return res.status(404).json({ error: "Projeto não encontrado." });
    }
    const stateValue = `state:${randomUUID()}`;
    const redirectUri = googleOAuthRedirectUri();
    await prisma.paidAdsGoogleAdsConnection.upsert({
      where: { projectId: project.id },
      create: {
        userId: project.userId,
        projectId: project.id,
        status: "disconnected",
        tokenRef: `${stateValue}|project:${project.id}`,
      },
      update: { tokenRef: `${stateValue}|project:${project.id}` },
    });
    const url = buildGoogleOAuthAuthUrl(redirectUri, stateValue);
    return res.json({ url });
  },

  async googleCallback(req: Request, res: Response) {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const errParam = req.query.error as string | undefined;
    const errDesc = (req.query.error_description as string | undefined) ?? req.query.error;

    const redirectUri = googleOAuthRedirectUri();
    if (!state) {
      return res.status(400).send("Missing state");
    }
    const conn = await prisma.paidAdsGoogleAdsConnection.findFirst({
      where: { tokenRef: { startsWith: `${state}|project:` } },
    });
    if (!conn) {
      return res.status(400).send("State inválido ou expirado. Inicie a ligação novamente.");
    }
    const projectId = conn.projectId;
    if (errParam) {
      await prisma.paidAdsGoogleAdsConnection.update({
        where: { id: conn.id },
        data: {
          status: "error",
          errorMessage: `${errParam}: ${String(errDesc ?? "")}`.slice(0, 500),
          tokenRef: null,
        },
      });
      return redirectToFrontend(res, projectId, { google: "error" }, "google");
    }
    if (!code) {
      return res.status(400).send("Missing code");
    }
    try {
      const { refresh_token, access_token: access } = await exchangeGoogleAuthorizationCode(code, redirectUri);
      const { customerId } = await listFirstAccessibleCustomerId(access);
      const name = (await fetchCustomerName(access, customerId)) ?? `Conta ${customerId}`;

      await prisma.paidAdsGoogleAdsConnection.update({
        where: { id: conn.id },
        data: {
          status: "connected",
          tokenRef: refresh_token,
          googleCustomerId: customerId,
          accountName: name,
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
      return redirectToFrontend(res, projectId, { google: "connected" }, "google");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await prisma.paidAdsGoogleAdsConnection.update({
        where: { id: conn.id },
        data: {
          status: "error",
          errorMessage: message.slice(0, 500),
          tokenRef: null,
        },
      });
      return redirectToFrontend(res, projectId, { google: "error" }, "google");
    }
  },

  async metaStart(req: Request, res: Response) {
    const body = z.object({ projectId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "projectId inválido." });
    }
    const a = getPaidActor(req);
    if (!a) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    if (!(await canAdminProject(body.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão." });
    }
    if (!process.env.META_APP_ID) {
      return res.status(503).json({ error: "Meta OAuth não configurado (META_APP_ID, META_APP_SECRET)." });
    }
    const project = await prisma.paidAdsProject.findFirst({
      where: { id: body.data.projectId, userId: a.tenantUserId },
      select: { id: true, userId: true },
    });
    if (!project) {
      return res.status(404).json({ error: "Projeto não encontrado." });
    }
    const stateValue = `state:${randomUUID()}`;
    const redirectUrl = metaOAuthRedirectUri();
    await prisma.paidAdsMetaConnection.upsert({
      where: { projectId: project.id },
      create: {
        userId: project.userId,
        projectId: project.id,
        status: "disconnected",
        tokenRef: `${stateValue}|project:${project.id}`,
      },
      update: { tokenRef: `${stateValue}|project:${project.id}` },
    });
    const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    oauthUrl.searchParams.set("client_id", process.env.META_APP_ID!);
    oauthUrl.searchParams.set("redirect_uri", redirectUrl);
    oauthUrl.searchParams.set("state", stateValue);
    oauthUrl.searchParams.set("scope", "ads_management,ads_read,business_management");
    oauthUrl.searchParams.set("response_type", "code");
    return res.json({ url: oauthUrl.toString() });
  },

  async metaCallback(req: Request, res: Response) {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;
    const errorParam = req.query.error as string | undefined;
    const errorDesc = req.query.error_description as string | undefined;
    const META_APP_ID = process.env.META_APP_ID;
    const META_APP_SECRET = process.env.META_APP_SECRET;
    const redirectUrl = metaOAuthRedirectUri();
    if (!state) {
      return res.status(400).send("Missing state");
    }
    const conn = await prisma.paidAdsMetaConnection.findFirst({
      where: { tokenRef: { startsWith: `${state}|project:` } },
    });
    if (!conn) {
      return res.status(400).send("Invalid or expired state");
    }
    const projectId = conn.projectId;
    if (errorParam) {
      await prisma.paidAdsMetaConnection.update({
        where: { id: conn.id },
        data: {
          status: "error",
          errorMessage: `${errorParam}: ${String(errorDesc ?? "")}`.slice(0, 500),
          tokenRef: null,
        },
      });
      return redirectToFrontend(res, projectId, { meta: "error" }, "meta");
    }
    if (!code) {
      return res.status(400).send("Missing code");
    }
    if (!META_APP_ID || !META_APP_SECRET) {
      return res.status(503).send("Meta app credentials missing");
    }
    try {
      const shortRes = await fetch(
        "https://graph.facebook.com/v21.0/oauth/access_token?" +
          new URLSearchParams({
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            redirect_uri: redirectUrl,
            code,
          }).toString(),
      );
      const shortJson = (await shortRes.json()) as { access_token?: string; error?: { message?: string } };
      if (!shortRes.ok || !shortJson.access_token) {
        throw new Error(shortJson.error?.message ?? `Token exchange failed (${shortRes.status})`);
      }
      const longRes = await fetch(
        "https://graph.facebook.com/v21.0/oauth/access_token?" +
          new URLSearchParams({
            grant_type: "fb_exchange_token",
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            fb_exchange_token: shortJson.access_token,
          }).toString(),
      );
      const longJson = (await longRes.json()) as { access_token?: string };
      const finalToken = longJson.access_token ?? shortJson.access_token;

      let adAccountId: string | null = null;
      let accountName: string | null = null;
      let businessId: string | null = null;
      try {
        const acctRes = await fetch(
          `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,account_id,name,business&limit=1&access_token=${encodeURIComponent(finalToken)}`,
        );
        const acctJson = (await acctRes.json()) as {
          data?: Array<{
            id?: string;
            account_id?: string;
            name?: string;
            business?: { id?: string };
          }>;
        };
        const first = acctJson.data?.[0];
        if (first) {
          adAccountId = first.id ?? (first.account_id ? `act_${first.account_id}` : null);
          accountName = first.name ?? null;
          businessId = first.business?.id ?? null;
        }
      } catch {
        // non-fatal
      }
      await prisma.paidAdsMetaConnection.update({
        where: { id: conn.id },
        data: {
          status: "connected",
          tokenRef: finalToken,
          adAccountId,
          accountName,
          businessId,
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
      return redirectToFrontend(res, projectId, { meta: "connected" }, "meta");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await prisma.paidAdsMetaConnection.update({
        where: { id: conn.id },
        data: {
          status: "error",
          errorMessage: message.slice(0, 500),
          tokenRef: null,
        },
      });
      return redirectToFrontend(res, projectId, { meta: "error" }, "meta");
    }
  },

  async tiktokStart(req: Request, res: Response) {
    const body = z.object({ projectId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "projectId inválido." });
    }
    const a = getPaidActor(req);
    if (!a) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    if (!(await canAdminProject(body.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão." });
    }
    if (!process.env.TIKTOK_APP_ID) {
      return res.status(503).json({ error: "TikTok OAuth não configurado (TIKTOK_APP_ID, TIKTOK_APP_SECRET)." });
    }
    const project = await prisma.paidAdsProject.findFirst({
      where: { id: body.data.projectId, userId: a.tenantUserId },
      select: { id: true, userId: true },
    });
    if (!project) {
      return res.status(404).json({ error: "Projeto não encontrado." });
    }
    const stateValue = `state:${randomUUID()}`;
    const redirectUrl = tiktokOAuthRedirectUri();
    const authBase = (process.env.TIKTOK_OAUTH_AUTH_BASE?.trim() || DEFAULT_TIKTOK_AUTH_BASE).split("?")[0] || DEFAULT_TIKTOK_AUTH_BASE;
    await prisma.paidAdsTikTokConnection.upsert({
      where: { projectId: project.id },
      create: {
        userId: project.userId,
        projectId: project.id,
        status: "disconnected",
        tokenRef: `${stateValue}|project:${project.id}`,
      },
      update: { tokenRef: `${stateValue}|project:${project.id}` },
    });
    const oauthUrl = new URL(authBase);
    oauthUrl.searchParams.set("app_id", process.env.TIKTOK_APP_ID!);
    oauthUrl.searchParams.set("state", stateValue);
    oauthUrl.searchParams.set("redirect_uri", redirectUrl);
    return res.json({ url: oauthUrl.toString() });
  },

  async tiktokCallback(req: Request, res: Response) {
    const authCode = (req.query.auth_code as string | undefined) ?? (req.query.code as string | undefined);
    const state = req.query.state as string | undefined;
    const errorParam = req.query.error as string | undefined;
    const errorDesc = (req.query.error_description as string | undefined) ?? (req.query.message as string | undefined);
    const TIKTOK_APP_ID = process.env.TIKTOK_APP_ID;
    const TIKTOK_APP_SECRET = process.env.TIKTOK_APP_SECRET;
    if (!state) {
      return res.status(400).send("Missing state");
    }
    const conn = await prisma.paidAdsTikTokConnection.findFirst({
      where: { tokenRef: { startsWith: `${state}|project:` } },
    });
    if (!conn) {
      return res.status(400).send("Invalid or expired state");
    }
    const projectId = conn.projectId;
    if (errorParam) {
      await prisma.paidAdsTikTokConnection.update({
        where: { id: conn.id },
        data: {
          status: "error",
          errorMessage: `${errorParam}: ${String(errorDesc ?? "")}`.slice(0, 500),
          tokenRef: null,
          refreshTokenRef: null,
        },
      });
      return redirectToFrontend(res, projectId, { tiktok: "error" }, "tiktok");
    }
    if (!authCode) {
      return res.status(400).send("Missing auth_code");
    }
    if (!TIKTOK_APP_ID || !TIKTOK_APP_SECRET) {
      return res.status(503).send("TikTok app credentials missing");
    }
    try {
      const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: TIKTOK_APP_ID,
          secret: TIKTOK_APP_SECRET,
          auth_code: authCode,
        }),
      });
      const tokenJson = (await tokenRes.json()) as {
        code?: number;
        message?: string;
        data?: { access_token?: string; refresh_token?: string; advertiser_ids?: string[] };
      };
      if (!tokenRes.ok || tokenJson.code !== 0 || !tokenJson.data?.access_token) {
        const msg =
          tokenJson.message ??
          (typeof tokenJson.code === "number" ? `TikTok API code ${tokenJson.code}` : null) ??
          `Token exchange failed (${tokenRes.status})`;
        throw new Error(msg);
      }
      const { access_token: accessToken, refresh_token: refreshToken, advertiser_ids: advIds } = tokenJson.data;
      const advertiserId = advIds?.[0] ?? null;
      const accountName = advertiserId ? `Advertiser ${advertiserId}` : "TikTok Ads";
      await prisma.paidAdsTikTokConnection.update({
        where: { id: conn.id },
        data: {
          status: "connected",
          tokenRef: accessToken!,
          refreshTokenRef: refreshToken ?? null,
          advertiserId,
          accountName,
          lastSyncAt: new Date(),
          errorMessage: null,
        },
      });
      return redirectToFrontend(res, projectId, { tiktok: "connected" }, "tiktok");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await prisma.paidAdsTikTokConnection.update({
        where: { id: conn.id },
        data: {
          status: "error",
          errorMessage: message.slice(0, 500),
          tokenRef: null,
          refreshTokenRef: null,
        },
      });
      return redirectToFrontend(res, projectId, { tiktok: "error" }, "tiktok");
    }
  },

  async disconnectGoogle(req: Request, res: Response) {
    const body = z.object({ projectId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "projectId inválido." });
    }
    const a = getPaidActor(req);
    if (!a) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    if (!(await canAdminProject(body.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão." });
    }
    const project = await prisma.paidAdsProject.findFirst({
      where: { id: body.data.projectId, userId: a.tenantUserId },
    });
    if (!project) {
      return res.status(404).json({ error: "Projeto não encontrado." });
    }
    await prisma.paidAdsGoogleAdsConnection.upsert({
      where: { projectId: body.data.projectId },
      create: {
        userId: project.userId,
        projectId: body.data.projectId,
        status: "disconnected",
        tokenRef: null,
        googleCustomerId: null,
        accountName: null,
        errorMessage: null,
        lastSyncAt: null,
      },
      update: {
        status: "disconnected",
        tokenRef: null,
        googleCustomerId: null,
        accountName: null,
        errorMessage: null,
        lastSyncAt: null,
      },
    });
    return res.json({ ok: true });
  },

  async disconnectMeta(req: Request, res: Response) {
    const body = z.object({ projectId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "projectId inválido." });
    }
    const a = getPaidActor(req);
    if (!a) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    if (!(await canAdminProject(body.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão." });
    }
    const conn = await prisma.paidAdsMetaConnection.findUnique({
      where: { projectId: body.data.projectId },
      select: { id: true, tokenRef: true },
    });
    if (conn?.tokenRef && !conn.tokenRef.startsWith("state:")) {
      try {
        await fetch(
          `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(conn.tokenRef)}`,
          { method: "DELETE" },
        );
      } catch {
        // ignore
      }
    }
    if (conn) {
      await prisma.paidAdsMetaConnection.update({
        where: { id: conn.id },
        data: {
          status: "disconnected",
          tokenRef: null,
          adAccountId: null,
          accountName: null,
          businessId: null,
          errorMessage: null,
          lastSyncAt: null,
        },
      });
    } else {
      const p = await prisma.paidAdsProject.findFirst({
        where: { id: body.data.projectId, userId: a.tenantUserId },
        select: { id: true, userId: true },
      });
      if (p) {
        await prisma.paidAdsMetaConnection.upsert({
          where: { projectId: p.id },
          create: { userId: p.userId, projectId: p.id, status: "disconnected" },
          update: {
            status: "disconnected",
            tokenRef: null,
            adAccountId: null,
            accountName: null,
            businessId: null,
            errorMessage: null,
            lastSyncAt: null,
          },
        });
      }
    }
    return res.json({ ok: true });
  },

  async disconnectTiktok(req: Request, res: Response) {
    const body = z.object({ projectId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ error: "projectId inválido." });
    }
    const a = getPaidActor(req);
    if (!a) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    if (!(await canAdminProject(body.data.projectId, a.userId, a.tenantUserId))) {
      return res.status(403).json({ error: "Sem permissão." });
    }
    const project = await prisma.paidAdsProject.findFirst({
      where: { id: body.data.projectId, userId: a.tenantUserId },
    });
    if (!project) {
      return res.status(404).json({ error: "Projeto não encontrado." });
    }
    await prisma.paidAdsTikTokConnection.upsert({
      where: { projectId: body.data.projectId },
      create: {
        userId: project.userId,
        projectId: body.data.projectId,
        status: "disconnected",
      },
      update: {
        status: "disconnected",
        tokenRef: null,
        refreshTokenRef: null,
        advertiserId: null,
        accountName: null,
        errorMessage: null,
        lastSyncAt: null,
      },
    });
    return res.json({ ok: true });
  },
};
