import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

type PostbackPayload = {
  userId: string;
  purpose: "postback";
};

export function createPostbackToken(userId: string): string {
  return jwt.sign({ userId, purpose: "postback" } satisfies PostbackPayload, JWT_SECRET, {
    expiresIn: "365d",
  });
}

export function verifyPostbackToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as Partial<PostbackPayload>;
    if (payload?.purpose !== "postback" || !payload.userId) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
