/**
 * HTML estático mínimo para landers Ads (LCP).
 * Tipos com gate interativo ficam na SPA `/p/:id`.
 */
import { affiliateLinkFromPresellPage } from "./trackOfferRedirectGuard";

/** Gates / builder / overlays — não servem como HTML lite por defeito. */
const LITE_BLOCKED_TYPES = new Set([
  "cookies",
  "idade",
  "sexo",
  "idade_sexo",
  "idade_pais",
  "sexo_pais",
  "pais",
  "captcha",
  "grupo_homem",
  "grupo_mulher",
  "builder",
  "desconto",
  "modelos",
]);

export function isPresellLiteHtmlEligible(type: string | null | undefined): boolean {
  const t = (type || "").trim().toLowerCase();
  if (!t) return false;
  return !LITE_BLOCKED_TYPES.has(t);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function firstImage(content: Record<string, unknown>): string {
  const direct =
    str(content.product_image_url, 2000) ||
    str(content.productImageUrl, 2000) ||
    str(content.image_url, 2000) ||
    str(content.hero_image, 2000);
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  const imgs = content.product_images ?? content.productImages ?? content.images;
  if (Array.isArray(imgs)) {
    for (const item of imgs) {
      if (typeof item === "string" && /^https?:\/\//i.test(item.trim())) return item.trim().slice(0, 2000);
      if (item && typeof item === "object") {
        const u = str((item as Record<string, unknown>).url, 2000);
        if (u && /^https?:\/\//i.test(u)) return u;
      }
    }
  }
  return "";
}

function articleBits(content: Record<string, unknown>): {
  headline: string;
  intro: string;
  cta: string;
} {
  const article = asRecord(content.article);
  const headline =
    str(article.headline, 160) ||
    str(content.articleHeadline, 160) ||
    str(content.title, 160) ||
    str(content.product_name, 120) ||
    str(content.productName, 120) ||
    "Oferta";
  const intro =
    str(article.intro, 800) ||
    str(content.articleIntro, 800) ||
    str(content.subtitle, 400) ||
    str(content.description, 400);
  const cta =
    str(article.cta_label, 80) ||
    str(article.ctaLabel, 80) ||
    str(content.cta_text, 80) ||
    str(content.ctaText, 80) ||
    "Ver oferta";
  return { headline, intro, cta };
}

export type PresellLiteHtmlInput = {
  id: string;
  title: string;
  type: string;
  language?: string | null;
  content: unknown;
  tracking: unknown;
  /** Base absoluta da API de track, ex. https://go.exemplo.com/api ou https://api…/api */
  trackApiBase: string;
  /** Fallback SPA se o visitante precisar da experiência completa */
  spaPath?: string;
};

export type PresellLiteHtmlResult =
  | { ok: true; html: string; eligible: true }
  | { ok: false; eligible: false; reason: string };

/**
 * Gera documento HTML autónomo (sem React) para Ads LCP.
 * CTA aponta para `/track/r/:presellId` na base de tracking.
 */
export function buildPresellLiteHtml(input: PresellLiteHtmlInput): PresellLiteHtmlResult {
  if (!isPresellLiteHtmlEligible(input.type)) {
    return { ok: false, eligible: false, reason: `type_not_lite:${input.type}` };
  }
  const content = asRecord(input.content);
  const offer = affiliateLinkFromPresellPage(input.content, input.tracking);
  if (!offer) {
    return { ok: false, eligible: false, reason: "missing_offer" };
  }

  const trackBase = input.trackApiBase.replace(/\/+$/, "");
  const trackHref = `${trackBase}/track/r/${encodeURIComponent(input.id)}`;
  const { headline, intro, cta } = articleBits(content);
  const title = str(input.title, 160) || headline;
  const img = firstImage(content);
  const lang = (input.language || "pt").trim().slice(0, 8) || "pt";
  const spa = input.spaPath || `/p/${input.id}`;
  const mirror = str(content.mirror_html ?? content.mirrorHtml, 0);
  // mirror pode ser enorme — se existir e for curto o suficiente, embute; senão artigo
  const useMirror = mirror.length > 200 && mirror.length < 450_000;

  const hero = img
    ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(headline)}" width="1200" height="630" fetchpriority="high" decoding="async" style="width:100%;max-height:420px;object-fit:cover;border-radius:12px" />`
    : "";

  const body = useMirror
    ? `<div class="mirror">${mirror}</div>
       <p style="text-align:center;margin:24px 0">
         <a class="cta" href="${escapeHtml(trackHref)}">${escapeHtml(cta)}</a>
       </p>`
    : `<article>
         ${hero}
         <h1>${escapeHtml(headline)}</h1>
         ${intro ? `<p class="intro">${escapeHtml(intro)}</p>` : ""}
         <p><a class="cta" href="${escapeHtml(trackHref)}">${escapeHtml(cta)}</a></p>
       </article>`;

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${escapeHtml(title)}</title>
${img ? `<link rel="preload" as="image" href="${escapeHtml(img)}"/>` : ""}
<style>
  :root{color-scheme:light}
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;color:#111;background:#fafafa}
  main{max-width:720px;margin:0 auto;padding:20px 16px 48px}
  h1{font-size:clamp(1.35rem,3vw,1.85rem);line-height:1.25;margin:16px 0 12px}
  .intro{color:#333;font-size:1.05rem}
  .cta{display:inline-block;background:#0f766e;color:#fff!important;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:10px}
  .cta:hover{filter:brightness(1.05)}
  .mirror img{max-width:100%;height:auto}
  .spa{margin-top:28px;font-size:12px;color:#666}
  .spa a{color:#555}
</style>
</head>
<body>
<main>
${body}
<p class="spa"><a href="${escapeHtml(spa)}">Versão completa</a></p>
</main>
</body>
</html>`;

  return { ok: true, eligible: true, html };
}
