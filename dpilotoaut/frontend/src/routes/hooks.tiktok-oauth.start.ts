import { createFileRoute, redirect } from "@tanstack/react-router";

import { SESSION_COOKIE } from "@backend/auth/constants";
import { parseCookies, verifySessionToken } from "@backend/auth/token";
import { prisma } from "@backend/prisma";
import { canAdminProject } from "@backend/permissions";

/** URL de autorização do TikTok Marketing API (ajuste com TIKTOK_OAUTH_AUTH_BASE se o portal usar outro host). */
const DEFAULT_TIKTOK_AUTH_BASE = "https://ads.tiktok.com/marketing_api/auth";

export const Route = createFileRoute("/hooks/tiktok-oauth/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const projectId = url.searchParams.get("projectId");

        const TIKTOK_APP_ID = process.env.TIKTOK_APP_ID;
        const REDIRECT_URL =
          process.env.TIKTOK_OAUTH_REDIRECT_URL ?? `${url.origin}/hooks/tiktok-oauth/callback`;
        const authBase = process.env.TIKTOK_OAUTH_AUTH_BASE ?? DEFAULT_TIKTOK_AUTH_BASE;

        if (!projectId) {
          return new Response("Missing projectId", { status: 400 });
        }

        if (!TIKTOK_APP_ID) {
          return new Response(
            "TikTok OAuth não configurado. Defina TIKTOK_APP_ID e TIKTOK_APP_SECRET.",
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

        const project = await prisma.project.findFirst({
          where: { id: projectId },
          select: { organizationId: true },
        });
        if (!project) {
          return new Response("Project not found", { status: 404 });
        }

        const stateValue = `state:${crypto.randomUUID()}`;

        await prisma.tikTokConnection.upsert({
          where: { projectId },
          create: {
            organizationId: project.organizationId,
            projectId,
            status: "disconnected",
            tokenRef: `${stateValue}|project:${projectId}`,
          },
          update: {
            tokenRef: `${stateValue}|project:${projectId}`,
          },
        });

        const base = authBase.split("?")[0] ?? authBase;
        const oauthUrl = new URL(base);
        oauthUrl.searchParams.set("app_id", TIKTOK_APP_ID);
        oauthUrl.searchParams.set("state", stateValue);
        oauthUrl.searchParams.set("redirect_uri", REDIRECT_URL);

        throw redirect({ href: oauthUrl.toString() });
      },
    },
  },
});
