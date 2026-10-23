/**
 * Historicamente auto-blacklisted IPs AWS/GCP/CDN77.
 * Bloqueios passam a ser só manuais (painel do afiliado) — esta função é no-op.
 */
export async function rememberDatacenterBlacklist(_args: {
  userId: string;
  ip: string | null | undefined;
  network?: string | null;
  /** Ignorado — nunca grava blacklist automática. */
  eligible?: boolean;
  userAgent?: string | null;
}): Promise<{ blacklisted: boolean; reason: string }> {
  return { blacklisted: false, reason: "manual_only" };
}
