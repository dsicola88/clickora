import { createFileRoute, redirect } from "@tanstack/react-router";

import { buildGoogleOAuthAuthUrl, isGoogleAdsOAuthConfigured } from "@backend/google-ads.api";
import { SESSION_COOKIE } from "@backend/auth/constants";
import { parseCookies, verifySessionToken } from "@backend/auth/token";
import { prisma } from "@backend/prisma";
import { canAdminProject } from "@backend/permissions";

export const Route = createFileRoute("/hooks/google-oauth/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const projectId = url.searchParams.get("projectId");
        const REDIRECT_URL =
          process.env.GOOGLE_OAUTH_REDIRECT_URL ?? `${url.origin}/hooks/google-oauth/callback`;

        if (!projectId) {
          return new Response("Missing projectId", { status: 400 });
        }

        if (!isGoogleAdsOAuthConfigured()) {
          return new Response(
            "Google Ads OAuth em falta. Defina GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET e GOOGLE_ADS_DEVELOPER_TOKEN (ou DEVELOPER_TOKEN).",
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

        await prisma.googleAdsConnection.upsert({
          where: { projectId },
          create: {
            organizationId: project.organizationId,
            projectId,
            status: "disconnected",
            tokenRef: `${stateValue}|project:${projectId}`,
          },
          update: { tokenRef: `${stateValue}|project:${projectId}` },
        });

        const oauthUrl = buildGoogleOAuthAuthUrl(REDIRECT_URL, stateValue);
        throw redirect({ href: oauthUrl });
      },
    },
  },
});
