/** Cursor estável para ordenação (created_at DESC, id DESC). */
export type TimeIdCursor = { t: string; id: string };

export function encodeTimeIdCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), id }), "utf8").toString("base64url");
}

export function decodeTimeIdCursor(raw: string | undefined): TimeIdCursor | null {
  if (!raw || typeof raw !== "string" || raw.length > 4096) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const o = JSON.parse(json) as { t?: string; id?: string };
    if (!o.t || !o.id || typeof o.t !== "string" || typeof o.id !== "string") return null;
    if (Number.isNaN(new Date(o.t).getTime())) return null;
    if (o.id.length > 80) return null;
    return { t: o.t, id: o.id };
  } catch {
    return null;
  }
}

/**
 * Próxima página na ordenação created_at DESC, id DESC (registos mais antigos que o cursor).
 */
export function whereOlderThanTimeIdCursor(cursor: TimeIdCursor): {
  OR: [{ createdAt: { lt: Date } }, { AND: [{ createdAt: { equals: Date } }, { id: { lt: string } }] }];
} {
  const d = new Date(cursor.t);
  return {
    OR: [
      { createdAt: { lt: d } },
      { AND: [{ createdAt: { equals: d } }, { id: { lt: cursor.id } }] },
    ],
  };
}
