import { createFileRoute, redirect } from "@tanstack/react-router";

import { prisma } from "@backend/prisma";

const TOKEN_URL = "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";

export const Route = createFileRoute("/hooks/tiktok-oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const authCode = url.searchParams.get("auth_code") ?? url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        const errorDesc =
          url.searchParams.get("error_description") ?? url.searchParams.get("message");

        const TIKTOK_APP_ID = process.env.TIKTOK_APP_ID;
        const TIKTOK_APP_SECRET = process.env.TIKTOK_APP_SECRET;

        if (!state) {
          return new Response("Missing state", { status: 400 });
        }

        const conn = await prisma.tikTokConnection.findFirst({
          where: { tokenRef: { startsWith: `${state}|project:` } },
        });

        if (!conn) {
          return new Response("Invalid or expired state", { status: 400 });
        }

        const projectId = conn.projectId;
        const back = `/app/projects/${projectId}/paid/tiktok`;

        if (errorParam) {
          await prisma.tikTokConnection.update({
            where: { id: conn.id },
            data: {
              status: "error",
              errorMessage: `${errorParam}: ${errorDesc ?? ""}`.slice(0, 500),
              tokenRef: null,
              refreshTokenRef: null,
            },
          });
          throw redirect({ href: `${back}?tiktok=error` });
        }

        if (!authCode) {
          return new Response("Missing auth_code", { status: 400 });
        }
        if (!TIKTOK_APP_ID || !TIKTOK_APP_SECRET) {
          return new Response("TikTok app credentials missing", { status: 503 });
        }

        try {
          const tokenRes = await fetch(TOKEN_URL, {
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
            data?: {
              access_token?: string;
              refresh_token?: string;
              advertiser_ids?: string[];
            };
          };

          if (!tokenRes.ok || tokenJson.code !== 0 || !tokenJson.data?.access_token) {
            const msg =
              tokenJson.message ??
              (typeof tokenJson.code === "number" ? `TikTok API code ${tokenJson.code}` : null) ??
              `Token exchange failed (${tokenRes.status})`;
            throw new Error(msg);
          }

          const {
            access_token: accessToken,
            refresh_token: refreshToken,
            advertiser_ids: advIds,
          } = tokenJson.data;
          const advertiserId = advIds?.[0] ?? null;
          const accountName = advertiserId ? `Advertiser ${advertiserId}` : "TikTok Ads";

          await prisma.tikTokConnection.update({
            where: { id: conn.id },
            data: {
              status: "connected",
              tokenRef: accessToken,
              refreshTokenRef: refreshToken ?? null,
              advertiserId,
              accountName,
              lastSyncAt: new Date(),
              errorMessage: null,
            },
          });

          throw redirect({ href: `${back}?tiktok=connected` });
        } catch (err) {
          if (err instanceof Response || (err as { isRedirect?: boolean })?.isRedirect) {
            throw err;
          }
          const message = err instanceof Error ? err.message : "Unknown error";
          await prisma.tikTokConnection.update({
            where: { id: conn.id },
            data: {
              status: "error",
              errorMessage: message.slice(0, 500),
              tokenRef: null,
              refreshTokenRef: null,
            },
          });
          throw redirect({ href: `${back}?tiktok=error` });
        }
      },
    },
  },
});
