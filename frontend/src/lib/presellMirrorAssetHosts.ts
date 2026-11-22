/**
 * Alguns funis (ex. Trimoryn / funnels webhook) servem CSS no CDN do `<base>`,
 * mas o HTML referencia `http://merchant.com/assets/...` → mixed-content + layout partido no iframe.
 */

function hostKey(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

function tryOrigin(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    return new URL(t).origin;
  } catch {
    return null;
  }
}

/** Host da landing real (ex. yourtrimoryn.com) após hop mwebkivo. */
function merchantOriginFromPageUrl(pageUrl: string): string | null {
  return tryOrigin(pageUrl);
}

/** Origem do CDN/funnel quando o `<base>` aponta para outro host que o merchant. */
function captureBaseOrigin(html: string): string | null {
  const m = html.match(/<base\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1/i);
  if (!m?.[2]) return null;
  return tryOrigin(m[2]);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function alignMirrorAssetUrlsToCaptureBase(html: string, pageUrl: string): string {
  if (!html || html.length < 80) return html;
  const merchantOrigin = merchantOriginFromPageUrl(pageUrl);
  const captureOrigin = captureBaseOrigin(html);
  if (!merchantOrigin || !captureOrigin) return upgradeMirrorHttpToHttps(html);

  const merchantHost = hostKey(new URL(merchantOrigin).hostname);
  const captureHost = hostKey(new URL(captureOrigin).hostname);
  if (merchantHost === captureHost) return upgradeMirrorHttpToHttps(html);

  let out = html;
  const pathRe = new RegExp(
    `https?:\\/\\/(?:www\\.)?${escapeRegExp(merchantHost)}(\\/[^"'\\s>]+)`,
    "gi",
  );
  out = out.replace(pathRe, `${captureOrigin}$1`);
  out = out.replace(
    /<base\b[^>]*>/gi,
    `<base href="${captureOrigin}/">`,
  );
  return upgradeMirrorHttpToHttps(out);
}

/** Stylesheets `http://` falham no iframe HTTPS da presell. */
export function upgradeMirrorHttpToHttps(html: string): string {
  if (!html) return html;
  return html.replace(/\bhttp:\/\//gi, "https://");
}