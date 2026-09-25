/**
 * Parse simples de User-Agent para relatórios (nível BuyGoods: OS + browser).
 * Não inventa dados — se o UA não der sinal, devolve null.
 */

export type ParsedUserAgent = {
  /** mobile | tablet | desktop | bot | unknown */
  device: string;
  browser: string | null;
  os: string | null;
};

export function parseUserAgent(uaRaw: string | null | undefined): ParsedUserAgent {
  const ua = (uaRaw || "").trim();
  if (!ua) return { device: "unknown", browser: null, os: null };

  let os: string | null = null;
  if (/android/i.test(ua)) os = "Android";
  else if (/iPhone|iPod/i.test(ua)) os = "iOS";
  else if (/iPad/i.test(ua)) os = "iPadOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "Mac OS X";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/CrOS/i.test(ua)) os = "Chrome OS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser: string | null = null;
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/CriOS\//i.test(ua)) browser = "Chrome";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome|CriOS|Chromium/i.test(ua)) browser = "Safari";
  else if (/MSIE |Trident\//i.test(ua)) browser = "IE";

  let device = "desktop";
  if (/bot|crawl|spider|slurp|facebookexternalhit|preview/i.test(ua)) device = "bot";
  else if (/iPad|tablet|Kindle|Silk/i.test(ua)) device = "tablet";
  else if (/Mobile|Android.*Mobile|iPhone|iPod|webOS|BlackBerry|IEMobile/i.test(ua)) device = "mobile";

  return { device, browser, os };
}

/** Rótulo curto para coluna Dispositivo nos relatórios. */
export function formatDeviceLabel(p: ParsedUserAgent): string {
  const parts = [p.os, p.browser].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return p.device || "—";
}
