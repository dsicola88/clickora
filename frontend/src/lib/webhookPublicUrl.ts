/**
 * Garante `https:` para URLs da API em produção quando o browser está em HTTPS
 * (evita mostrar `http://` se o proxy ainda reportar http).
 */
export function ensureHttpsWebhookUrl(url: string): string {
  if (typeof window === "undefined") return url;
  if (window.location.protocol !== "https:") return url;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:") return url;
    const h = u.hostname.toLowerCase();
    if (
      h === "dclickora.com" ||
      h.endsWith(".dclickora.com") ||
      h.endsWith(".up.railway.app") ||
      h.endsWith(".railway.app") ||
      h.endsWith(".vercel.app")
    ) {
      u.protocol = "https:";
      return u.toString();
    }
  } catch {
    return url;
  }
  return url;
}
