import { createFileRoute } from "@tanstack/react-router";

import {
  buildClearGoogleAuthStateCookie,
  buildSessionValueCookie,
  GOOGLE_OAUTH_STATE,
  SESSION_MAX_AGE_SEC,
} from "@backend/auth/cookie-header";
import { parseCookies } from "@backend/auth/token";
import { signSessionToken } from "@backend/auth/token";
import {
  exchangeGoogleUserAuthCode,
  fetchGoogleUserInfo,
} from "@backend/google-user-auth.api";
import { prisma } from "@backend/prisma";
import { bootstrapWorkspaceForUser } from "@backend/workspace-bootstrap";

/**
 * Retorno do Google após o consentimento. Cria/associa utilizador e define sessão.
 * GET /hooks/auth-google/callback
 */
export const Route = createFileRoute("/hooks/auth-google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const baseUrl = new URL(request.url);
        const errParam = baseUrl.searchParams.get("error");
        const errDesc = baseUrl.searchParams.get("error_description");
        const code = baseUrl.searchParams.get("code");
        const state = baseUrl.searchParams.get("state");

        const redirectBase =
          process.env.GOOGLE_AUTH_REDIRECT_URL?.replace(/\/$/, "") ||
          `${baseUrl.origin}/hooks/auth-google/callback`;

        const hErr = (msg: string) => {
          const h = new Headers();
          h.set(
            "Location",
            `/auth/sign-in?google_error=${encodeURIComponent(msg.slice(0, 200))}`,
          );
          h.append("Set-Cookie", buildClearGoogleAuthStateCookie());
          return new Response(null, { status: 302, headers: h });
        };

        if (errParam) {
          return hErr(
            errDesc || errParam || "Autorização Google recusada ou cancelada.",
          );
        }

        const cookies = parseCookies(request.headers.get("cookie"));
        const wantState = state ?? "";
        const haveState = cookies[GOOGLE_OAUTH_STATE] ?? "";
        if (!wantState || wantState !== haveState) {
          return hErr("Sessão de login expirou ou o pedido é inválido. Tente de novo.");
        }
        if (!code) {
          return hErr("Resposta do Google sem código. Tente de novo.");
        }

        let info: Awaited<ReturnType<typeof fetchGoogleUserInfo>>;
        try {
          const { access_token } = await exchangeGoogleUserAuthCode(code, redirectBase);
          info = await fetchGoogleUserInfo(access_token);
        } catch (e) {
          return hErr(e instanceof Error ? e.message : "Falha no login com Google.");
        }

        if (info.email_verified === false) {
          return hErr("Confirme o e-mail na conta Google antes de continuar.");
        }

        const email = info.email;
        const full = (info.name?.trim() || email.split("@")[0] || "Utilizador").slice(0, 100);

        const existingBySub = await prisma.user.findUnique({ where: { googleSub: info.sub } });
        let user = existingBySub;

        if (!user) {
          const byEmail = await prisma.user.findUnique({ where: { email } });
          if (byEmail) {
            user = await prisma.user.update({
              where: { id: byEmail.id },
              data: { googleSub: info.sub, fullName: byEmail.fullName ?? full },
            });
          } else {
            user = await prisma.user.create({
              data: {
                email,
                fullName: full,
                googleSub: info.sub,
                passwordHash: null,
              },
            });
            const hasMember = await prisma.organizationMember.findFirst({
              where: { userId: user.id },
            });
            if (!hasMember) {
              await bootstrapWorkspaceForUser(user.id, user.email, user.fullName ?? full);
            }
          }
        }

        const token = await signSessionToken({ sub: user.id, email: user.email });
        const h = new Headers();
        h.set("Location", "/app?google=signed_in");
        h.append("Set-Cookie", buildSessionValueCookie(token, SESSION_MAX_AGE_SEC));
        h.append("Set-Cookie", buildClearGoogleAuthStateCookie());
        return new Response(null, { status: 302, headers: h });
      },
    },
  },
});
