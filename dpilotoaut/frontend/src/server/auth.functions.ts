import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

import {
  buildClearSessionCookie,
  buildSessionValueCookie,
  SESSION_MAX_AGE_SEC,
} from "@backend/auth/cookie-header";
import { SESSION_COOKIE } from "@backend/auth/constants";
import { jwtVerify } from "jose";
import { parseCookies, signSessionToken, verifySessionToken } from "@backend/auth/token";
import { isGoogleUserAuthConfigured } from "@backend/google-user-auth.api";
import { prisma } from "@backend/prisma";
import { bootstrapWorkspaceForUser } from "@backend/workspace-bootstrap";
import { isPlatformAdmin } from "@backend/platform-admin";

const DB_UNREACHABLE =
  "Não foi possível ligar à base de dados. Inicie o PostgreSQL (ex.: `docker compose up -d` na raiz do projeto), confirme `DATABASE_URL` no `.env`, e execute: `npm run db:push` e, para a conta de teste, `npm run db:seed` (e-mail: daniel@gmail.com).";

const signUpSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  fullName: z.string().trim().min(1).max(100),
  /** true quando o registo vem de um link de convite: não cria workspace próprio (só após aceitar o convite). */
  skipBootstrap: z.boolean().optional(),
});

const signInSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
});

const exchangeClickoraSsoSchema = z.object({
  token: z.string().min(20),
});

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signUpSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        return { ok: false as const, error: "Este e-mail já está cadastrado." };
      }

      const passwordHash = await bcrypt.hash(data.password, 12);
      const user = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          fullName: data.fullName,
        },
      });

      if (!data.skipBootstrap) {
        await bootstrapWorkspaceForUser(user.id, user.email, data.fullName);
      }

      const token = await signSessionToken({ sub: user.id, email: user.email });
      setResponseHeader("Set-Cookie", buildSessionValueCookie(token, SESSION_MAX_AGE_SEC));

      return {
        ok: true as const,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isPlatformAdmin: isPlatformAdmin({
            isPlatformAdmin: user.isPlatformAdmin,
            email: user.email,
          }),
        },
      };
    } catch (e) {
      console.error("[auth.signUp]", e);
      if (isPrismaConnectionError(e)) {
        return { ok: false as const, error: DB_UNREACHABLE };
      }
      return { ok: false as const, error: "Não foi possível criar a conta. Tente novamente." };
    }
  });

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signInSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const user = await prisma.user.findUnique({ where: { email: data.email } });
      if (!user) {
        return { ok: false as const, error: "E-mail ou senha incorretos." };
      }

      if (user.passwordHash == null) {
        return {
          ok: false as const,
          error: "Esta conta usa o Google. Utilize «Continuar com Google» abaixo.",
        };
      }

      const valid = await bcrypt.compare(data.password, user.passwordHash);
      if (!valid) {
        return { ok: false as const, error: "E-mail ou senha incorretos." };
      }

      const token = await signSessionToken({ sub: user.id, email: user.email });
      setResponseHeader("Set-Cookie", buildSessionValueCookie(token, SESSION_MAX_AGE_SEC));

      return {
        ok: true as const,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isPlatformAdmin: isPlatformAdmin({
            isPlatformAdmin: user.isPlatformAdmin,
            email: user.email,
          }),
        },
      };
    } catch (e) {
      console.error("[auth.signIn]", e);
      if (isPrismaConnectionError(e)) {
        return { ok: false as const, error: DB_UNREACHABLE };
      }
      return { ok: false as const, error: "Não foi possível entrar. Tente novamente." };
    }
  });

export const getAuthConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    googleSignIn: isGoogleUserAuthConfigured(),
  };
});

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Set-Cookie", buildClearSessionCookie());
  return { ok: true as const };
});

/** Login único: valida JWT emitido pela API Clickora e abre sessão cookie no Dpiloto. */
export const exchangeClickoraSso = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => exchangeClickoraSsoSchema.parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.CLICKORA_DPILOT_SSO_SECRET?.trim();
    if (!secret || secret.length < 32) {
      return { ok: false as const, error: "Login unificado não configurado no servidor." };
    }

    try {
      const { payload } = await jwtVerify(data.token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
        issuer: "clickora",
        audience: "dpilot-sso",
      });

      const emailRaw = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
      const fullName = typeof payload.name === "string" ? payload.name.trim() : null;
      if (!emailRaw || !sub) {
        return { ok: false as const, error: "Sessão inválida ou expirada." };
      }

      let user = await prisma.user.findUnique({ where: { email: emailRaw } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: emailRaw,
            fullName: fullName || null,
            passwordHash: null,
          },
        });
        await bootstrapWorkspaceForUser(user.id, user.email, user.fullName ?? user.email);
      } else if (fullName && fullName !== (user.fullName ?? "")) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { fullName },
        });
      }

      const sessionTok = await signSessionToken({ sub: user.id, email: user.email });
      setResponseHeader("Set-Cookie", buildSessionValueCookie(sessionTok, SESSION_MAX_AGE_SEC));

      return {
        ok: true as const,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isPlatformAdmin: isPlatformAdmin({
            isPlatformAdmin: user.isPlatformAdmin,
            email: user.email,
          }),
        },
      };
    } catch (e) {
      console.error("[auth.exchangeClickoraSso]", e);
      return {
        ok: false as const,
        error: "Não foi possível sincronizar a sessão. Atualize a página ou entre com e-mail e palavra-passe.",
      };
    }
  });

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    return { user: null };
  }
  try {
    const { sub } = await verifySessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true, fullName: true, isPlatformAdmin: true },
    });
    if (!user) return { user: null };
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isPlatformAdmin: isPlatformAdmin({
          isPlatformAdmin: user.isPlatformAdmin,
          email: user.email,
        }),
      },
    };
  } catch (e) {
    if (isPrismaConnectionError(e)) {
      console.error("[auth.getSession] base de dados inacessível", e);
    }
    return { user: null };
  }
});

function isPrismaConnectionError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P1001" || e.code === "P1017";
  }
  return false;
}
