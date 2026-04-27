import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { SESSION_COOKIE } from "@backend/auth/constants";
import { parseCookies, verifySessionToken } from "@backend/auth/token";
import { isPlatformAdmin } from "@backend/platform-admin";
import { prisma } from "@backend/prisma";

export const requireSession = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const headers = request.headers;

  let token: string | undefined;
  const authHeader = headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookies(headers.get("cookie"));
    token = cookies[SESSION_COOKIE];
  }

  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }

  try {
    const { sub, email } = await verifySessionToken(token);
    return next({
      context: {
        userId: sub,
        userEmail: email,
      },
    });
  } catch {
    throw new Response("Unauthorized", { status: 401 });
  }
});

export const requirePlatformAdmin = createMiddleware({ type: "function" })
  .middleware([requireSession])
  .server(async ({ next, context }) => {
    const { userId, userEmail } = context;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true, email: true },
    });
    if (
      !isPlatformAdmin({
        isPlatformAdmin: user?.isPlatformAdmin ?? false,
        email: user?.email ?? userEmail,
      })
    ) {
      throw new Response("Forbidden", { status: 403 });
    }
    return next();
  });
