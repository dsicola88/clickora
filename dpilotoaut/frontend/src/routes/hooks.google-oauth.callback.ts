import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  exchangeGoogleAuthorizationCode,
  fetchCustomerName,
  listFirstAccessibleCustomerId,
} from "@backend/google-ads.api";
import { prisma } from "@backend/prisma";

export const Route = createFileRoute("/hooks/google-oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errParam = url.searchParams.get("error");
        const errDesc = url.searchParams.get("error_description") ?? url.searchParams.get("error");

        const REDIRECT_URL =
          process.env.GOOGLE_OAUTH_REDIRECT_URL ?? `${url.origin}/hooks/google-oauth/callback`;

        if (!state) {
          return new Response("Missing state", { status: 400 });
        }

        const conn = await prisma.googleAdsConnection.findFirst({
          where: { tokenRef: { startsWith: `${state}|project:` } },
        });
        if (!conn) {
          return new Response("State inválido ou expirado. Inicie a ligação novamente.", {
            status: 400,
          });
        }
        const projectId = conn.projectId;
        const backError = `/app/projects/${projectId}/paid?google=error`;

        if (errParam) {
          await prisma.googleAdsConnection.update({
            where: { id: conn.id },
            data: {
              status: "error",
              errorMessage: `${errParam}: ${errDesc ?? ""}`.slice(0, 500),
              tokenRef: null,
            },
          });
          throw redirect({ href: backError });
        }
        if (!code) {
          return new Response("Missing code", { status: 400 });
        }

        try {
          const { refresh_token, access_token: access } = await exchangeGoogleAuthorizationCode(
            code,
            REDIRECT_URL,
          );
          const { customerId } = await listFirstAccessibleCustomerId(access);
          const name = (await fetchCustomerName(access, customerId)) ?? `Conta ${customerId}`;

          await prisma.googleAdsConnection.update({
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
          throw redirect({ href: `/app/projects/${projectId}/paid?google=connected` });
        } catch (err) {
          if (err instanceof Response || (err as { isRedirect?: boolean })?.isRedirect) {
            throw err;
          }
          const message = err instanceof Error ? err.message : "Unknown error";
          await prisma.googleAdsConnection.update({
            where: { id: conn.id },
            data: {
              status: "error",
              errorMessage: message.slice(0, 500),
              tokenRef: null,
            },
          });
          throw redirect({ href: backError });
        }
      },
    },
  },
});
