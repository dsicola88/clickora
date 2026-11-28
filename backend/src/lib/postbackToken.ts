import jwt from "jsonwebtoken";

function postbackJwtSecret(): string | null {
  const secret = (process.env.JWT_SECRET || "").trim();
  if (!secret || secret === "changeme") {
    if (process.env.NODE_ENV === "production") return null;
    return "changeme";
  }
  return secret;
}

const JWT_SECRET = postbackJwtSecret();

type PostbackPayload = {
  userId: string;
  purpose: "postback";
};

/**
 * O URL de postback é colado uma vez na rede de afiliados: não pode expirar em silêncio
 * (vendas recusadas com 401 sem aviso). Tokens antigos com `exp` continuam aceites.
 */
export function createPostbackToken(userId: string): string | null {
  if (!JWT_SECRET) return null;
  return jwt.sign({ userId, purpose: "postback" } satisfies PostbackPayload, JWT_SECRET);
}

export function verifyPostbackToken(token: string): { userId: string } | null {
  if (!JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as Partial<PostbackPayload>;
    if (payload?.purpose !== "postback" || !payload.userId) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
