import { createFileRoute, redirect } from "@tanstack/react-router";

import { SESSION_COOKIE } from "@backend/auth/constants";
import { parseCookies, verifySessionToken } from "@backend/auth/token";
import { prisma } from "@backend/prisma";
import { canAdminProject } from "@backend/permissions";

export const Route = createFileRoute("/hooks/meta-oauth/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const projectId = url.searchParams.get("projectId");

        const META_APP_ID = process.env.META_APP_ID;
        const REDIRECT_URL =
          process.env.META_OAUTH_REDIRECT_URL ?? `${url.origin}/hooks/meta-oauth/callback`;

        if (!projectId) {
          return new Response("Missing projectId", { status: 400 });
        }

        if (!META_APP_ID) {
          return new Response(
            "Meta OAuth não configurado. Defina META_APP_ID e META_APP_SECRET nos secrets.",
            { status: 503 },
          );
        }

        const cookies = parseCookies(request.headers.get("cookie"));
        const token = cookies[SESSION_COOKIE];
        if (!token) {
          return new Response("Unauthorized", { status: 401 });
        }

        let userId: string;
        try {
          const t = await verifySessionToken(token);
          userId = t.sub;
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        if (!(await canAdminProject(projectId, userId))) {
          return new Response("Forbidden", { status: 403 });
        }

        const stateValue = `state:${crypto.randomUUID()}`;
        await prisma.metaConnection.update({
          where: { projectId },
          data: { tokenRef: `${stateValue}|project:${projectId}` },
        });

        const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
        oauthUrl.searchParams.set("client_id", META_APP_ID);
        oauthUrl.searchParams.set("redirect_uri", REDIRECT_URL);
        oauthUrl.searchParams.set("state", stateValue);
        oauthUrl.searchParams.set("scope", "ads_management,ads_read,business_management");
        oauthUrl.searchParams.set("response_type", "code");

        throw redirect({ href: oauthUrl.toString() });
      },
    },
  },
});
