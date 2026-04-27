import { createFileRoute } from "@tanstack/react-router";

import { buildGoogleAuthStateCookie } from "@backend/auth/cookie-header";
import {
  buildGoogleUserSignInUrl,
  isGoogleUserAuthConfigured,
} from "@backend/google-user-auth.api";

/**
 * Inicia o fluxo "Sign in with Google" (não confundir com /hooks/google-oauth para contas de anúncios).
 * GET /hooks/auth-google/start
 */
export const Route = createFileRoute("/hooks/auth-google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isGoogleUserAuthConfigured()) {
          return new Response(
            "Login com Google não configurado. Defina GOOGLE_AUTH_CLIENT_ID e GOOGLE_AUTH_CLIENT_SECRET (ou GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) e o redirect no Google Cloud: …/hooks/auth-google/callback",
            { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
          );
        }
        const url = new URL(request.url);
        const state = crypto.randomUUID();
        const redirectBase =
          process.env.GOOGLE_AUTH_REDIRECT_URL?.replace(/\/$/, "") ||
          `${url.origin}/hooks/auth-google/callback`;
        const oauthUrl = buildGoogleUserSignInUrl(redirectBase, state);
        const h = new Headers();
        h.set("Location", oauthUrl);
        h.append("Set-Cookie", buildGoogleAuthStateCookie(state, 600));
        return new Response(null, { status: 302, headers: h });
      },
    },
  },
});
