/**
 * Cabeçalho `Set-Cookie` do sticky de rotador (1.º partido, só lido no servidor).
 *
 * - `HttpOnly`: nenhum JS da página precisa deste cookie (o servidor lê-o em `/track/r/`).
 * - `Secure`: só em HTTPS (pedido seguro ou `x-forwarded-proto: https` atrás de proxy), para
 *   não quebrar `http://localhost` em desenvolvimento.
 * - `SameSite=Lax`: o clique de anúncio chega por navegação top-level (GET), que o Lax permite.
 */
export function buildStickyRotatorSetCookie(args: {
  name: string;
  value: string;
  maxAgeSeconds: number;
  secure: boolean;
}): string {
  const parts = [
    `${args.name}=${encodeURIComponent(args.value)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(args.maxAgeSeconds))}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (args.secure) parts.push("Secure");
  return parts.join("; ");
}

/** HTTPS directo ou terminado no proxy (Railway/Vercel enviam `x-forwarded-proto`). */
export function isSecureRequest(req: {
  secure?: boolean;
  get(name: string): string | undefined;
}): boolean {
  if (req.secure === true) return true;
  const xfp = (req.get("x-forwarded-proto") || "").split(",")[0]?.trim().toLowerCase();
  return xfp === "https";
}
