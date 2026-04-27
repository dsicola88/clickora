import { createFileRoute, redirect } from "@tanstack/react-router";

import { prisma } from "@backend/prisma";

export const Route = createFileRoute("/hooks/meta-oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description");

        const META_APP_ID = process.env.META_APP_ID;
        const META_APP_SECRET = process.env.META_APP_SECRET;
        const REDIRECT_URL =
          process.env.META_OAUTH_REDIRECT_URL ?? `${url.origin}/hooks/meta-oauth/callback`;

        if (!state) {
          return new Response("Missing state", { status: 400 });
        }

        const conn = await prisma.metaConnection.findFirst({
          where: { tokenRef: { startsWith: `${state}|project:` } },
        });

        if (!conn) {
          return new Response("Invalid or expired state", { status: 400 });
        }

        const projectId = conn.projectId;
        const back = `/app/projects/${projectId}/paid/meta`;

        if (errorParam) {
          await prisma.metaConnection.update({
            where: { id: conn.id },
            data: {
              status: "error",
              errorMessage: `${errorParam}: ${errorDesc ?? ""}`.slice(0, 500),
              tokenRef: null,
            },
          });
          throw redirect({ href: `${back}?meta=error` });
        }

        if (!code) {
          return new Response("Missing code", { status: 400 });
        }
        if (!META_APP_ID || !META_APP_SECRET) {
          return new Response("Meta app credentials missing", { status: 503 });
        }

        try {
          const shortRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?` +
              new URLSearchParams({
                client_id: META_APP_ID,
                client_secret: META_APP_SECRET,
                redirect_uri: REDIRECT_URL,
                code,
              }).toString(),
          );
          const shortJson = (await shortRes.json()) as {
            access_token?: string;
            error?: { message?: string };
          };
          if (!shortRes.ok || !shortJson.access_token) {
            throw new Error(
              shortJson.error?.message ?? `Token exchange failed (${shortRes.status})`,
            );
          }

          const longRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?` +
              new URLSearchParams({
                grant_type: "fb_exchange_token",
                client_id: META_APP_ID,
                client_secret: META_APP_SECRET,
                fb_exchange_token: shortJson.access_token,
              }).toString(),
          );
          const longJson = (await longRes.json()) as {
            access_token?: string;
            error?: { message?: string };
          };
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

          await prisma.metaConnection.update({
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

          throw redirect({ href: `${back}?meta=connected` });
        } catch (err) {
          if (err instanceof Response || (err as { isRedirect?: boolean })?.isRedirect) {
            throw err;
          }
          const message = err instanceof Error ? err.message : "Unknown error";
          await prisma.metaConnection.update({
            where: { id: conn.id },
            data: {
              status: "error",
              errorMessage: message.slice(0, 500),
              tokenRef: null,
            },
          });
          throw redirect({ href: `${back}?meta=error` });
        }
      },
    },
  },
});
