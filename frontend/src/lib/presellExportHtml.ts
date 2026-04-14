import { resolveApiUrl } from "@/lib/apiOrigin";
import { resolveVideoEmbedSrc } from "@/lib/youtubeEmbed";
import type { Presell } from "@/types/api";
import {
  getInteractiveGateKind,
  getPresellGateKind,
  isDiscountPresellType,
  isGhostPresellType,
  isVideoPresellType,
  isVslOnlyPresellType,
} from "@/lib/presellTypeMeta";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, "&#10;");
}

function langNorm(language: string) {
  const raw = (language || "pt").toLowerCase();
  if (raw === "us" || raw.startsWith("en")) return "en";
  return raw;
}

function copyMidCta(language: string) {
  const lang = langNorm(language);
  if (lang === "en") return "Continue to the official page for current pricing and secure checkout.";
  if (lang === "es") return "Continúa en la página oficial para precios y pago seguro.";
  return "Continue na página oficial para preços atualizados e checkout seguro.";
}

function copyFooter(language: string) {
  const lang = langNorm(language);
  if (lang === "en") return "You will be taken to the product link with affiliate tracking.";
  if (lang === "es") return "Serás enviado al enlace del producto con seguimiento de afiliado.";
  return "Ao clicar, você será direcionado ao link do produto com rastreamento do afiliado.";
}

function discountUrgencyCopy(language: string): string {
  const lang = langNorm(language);
  if (lang === "en") return "You have little time to take advantage of the offer.";
  if (lang === "es") return "Tienes poco tiempo para aprovechar la oferta.";
  return "Você tem pouco tempo para aproveitar a oferta.";
}

function discountSocialFallback(language: string): string {
  const lang = langNorm(language);
  if (lang === "en") return "8 out of 10 people prefer our product";
  if (lang === "es") return "8 de cada 10 personas prefieren nuestro producto";
  return "8 em cada 10 pessoas preferem o nosso produto";
}

function looksLikeSectionHeading(block: string): boolean {
  const t = block.trim();
  if (/^#{2,3}\s/.test(t)) return true;
  if (t.includes("\n")) return false;
  if (t.endsWith(".") || t.endsWith("!") || t.endsWith("?")) return false;
  if (t.length < 28 || t.length > 130) return false;
  const words = t.split(/\s+/).filter(Boolean).length;
  return words >= 4 && words <= 14;
}

function isEmbedPlayerVideoUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(u)) return false;
  return (
    /youtube\.com|youtu\.be|youtube-nocookie/.test(u) ||
    /vimeo\.com|player\.vimeo/.test(u) ||
    /wistia\.|wi\.st|fast\.wistia/.test(u) ||
    /loom\.com\/embed/.test(u) ||
    /dailymotion\.com|dai\.ly/.test(u) ||
    /cloudflarestream|videodelivery\.net/.test(u) ||
    /brightcove|jwplatform/.test(u)
  );
}

/** URL de clique com rastreamento (mesma base que a página pública; medium html_export). */
function buildPresellTrackClickUrl(apiBase: string, pageId: string, affiliateLink: string): string {
  const toUrl = affiliateLink.trim();
  const clickUrl = resolveApiUrl(apiBase, `/track/r/${pageId}`);
  clickUrl.searchParams.set("to", toUrl);
  clickUrl.searchParams.set("source", "direct");
  clickUrl.searchParams.set("medium", "html_export");
  clickUrl.searchParams.set("campaign", "");
  clickUrl.searchParams.set("referrer", "");
  return clickUrl.toString();
}

function blockToHtml(block: string): string {
  const t = block.trim();
  if (looksLikeSectionHeading(t)) {
    const clean = escapeHtml(t.replace(/^#{2,3}\s*/, ""));
    return `<h3 class="pe-h3">${clean}</h3>`;
  }
  return `<p class="pe-p">${escapeHtml(t).replace(/\n/g, "<br>")}</p>`;
}

function ctaButton(href: string, label: string, variant: "light" | "dark"): string {
  const bg = variant === "dark" ? "#7c3aed" : "#7c3aed";
  const color = "#ffffff";
  return `<a class="pe-cta" href="${escapeAttr(href)}" rel="noopener noreferrer" style="display:inline-block;margin:12px 0;padding:14px 28px;border-radius:12px;background:${bg};color:${color};font-weight:700;text-decoration:none;font-size:1.05rem;">${escapeHtml(label)}</a>`;
}

const BASE_STYLES = `
.pe-root{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.6;color:#1e1b4b;background:#faf5ff;margin:0;padding:0;}
.pe-inner{max-width:min(100%,72rem);margin:0 auto;padding:24px 16px 48px;}
.pe-hero-vsl{background:linear-gradient(180deg,#0f172a 0%,#1e293b 40%,#faf5ff 100%);color:#f8fafc;padding:32px 16px 40px;border-bottom:1px solid rgba(255,255,255,.08);}
.pe-hero-light{background:linear-gradient(180deg,#ede9fe 0%,#faf5ff 50%,#ffffff 100%);color:#1e1b4b;padding:32px 16px 40px;border-bottom:1px solid rgba(0,0,0,.06);}
.pe-h1{font-size:clamp(1.5rem,4vw,2.65rem);font-weight:800;line-height:1.12;margin:0 0 12px;}
.pe-subtitle{font-size:1.05rem;opacity:.88;margin:0 0 20px;}
.pe-img-wrap{max-width:42rem;margin:0 auto 20px;padding:16px;background:rgba(255,255,255,.65);border-radius:16px;border:1px solid rgba(0,0,0,.08);}
.pe-img-wrap img{width:100%;max-height:min(420px,55vh);object-fit:contain;border-radius:8px;}
.pe-video{position:relative;width:100%;max-width:min(1200px,96vw);margin:16px auto;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.1);}
.pe-video iframe,.pe-video video{position:absolute;inset:0;width:100%;height:100%;border:0;}
.pe-gallery{max-width:64rem;margin:0 auto;padding:32px 16px;display:grid;grid-template-columns:1fr;gap:16px;}
@media(min-width:640px){.pe-gallery{grid-template-columns:1fr 1fr;}}
.pe-gallery img{width:100%;max-height:20rem;object-fit:cover;border-radius:12px;border:1px solid rgba(0,0,0,.08);}
.pe-letter{max-width:48rem;margin:0 auto;padding:24px 16px;}
.pe-letter-box{border-radius:16px;border:1px solid rgba(0,0,0,.1);background:rgba(255,255,255,.6);padding:28px 20px 36px;}
.pe-h3{font-size:1.35rem;font-weight:700;margin:20px 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(0,0,0,.08);}
.pe-p{font-size:1.02rem;line-height:1.75;margin:0 0 16px;color:#334155;}
.pe-mid{border-radius:16px;border:1px solid rgba(0,0,0,.1);background:linear-gradient(180deg,#f4f4f5,#fafafa);padding:28px;margin:24px 0;text-align:center;}
.pe-footer-box{max-width:48rem;margin:0 auto;padding:24px 16px 40px;text-align:center;}
.pe-footer-inner{border-radius:16px;border:1px solid rgba(0,0,0,.1);background:rgba(255,255,255,.55);padding:28px 20px;}
.pe-footnote{font-size:.85rem;color:#64748b;margin:12px 0 0;max-width:36rem;margin-left:auto;margin-right:auto;}
.pe-note{font-size:.9rem;color:#64748b;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px;margin:16px 0;}
.pe-discount-bar{background:#db2777;color:#fff;text-align:center;padding:10px 12px;font-weight:600;font-size:.95rem;}
.pe-discount-modal{background:#fff;color:#1e1b4b;border-radius:16px;border:2px solid #f472b6;padding:20px;margin:16px auto;max-width:28rem;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.12);}
.pe-stars{letter-spacing:2px;color:#fbbf24;font-size:1.1rem;}
`;

export type PresellExportOptions = {
  apiBase: string;
  /** URL público da presell (mesmo que na lista) para link «ver online». */
  publicPageUrl: string;
};

/**
 * Documento HTML completo (copiável para Elementor → widget HTML, ou ficheiro .html).
 * Conteúdo alinhado à página pública; gates interativos e modal de desconto são simplificados (nota + link).
 */
export function buildPresellStandaloneHtml(page: Presell, opts: PresellExportOptions): string {
  const content = (page.content || {}) as Record<string, unknown>;
  const settings = (page.settings || {}) as Record<string, unknown>;
  const affiliateLink = (content.affiliateLink as string) || "#";
  const href = buildPresellTrackClickUrl(opts.apiBase, page.id, affiliateLink);

  const title = (content.title as string) || page.title;
  const subtitle = (content.subtitle as string) || "";
  const salesText = (content.salesText as string) || "";
  const ctaText = (content.ctaText as string) || "Quero Aproveitar Agora";
  const productImages = Array.isArray(content.productImages)
    ? (content.productImages as string[]).filter((u) => typeof u === "string" && u.length > 0)
    : [];

  const cookiePolicyUrl = typeof settings.cookiePolicyUrl === "string" ? settings.cookiePolicyUrl : "";
  const customCss = typeof settings.customCss === "string" ? settings.customCss.trim() : "";

  const heroImage = productImages[0];
  const galleryImages = productImages.slice(1, 10);
  const textBlocks = salesText
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const vslExcerpt = (() => {
    const first = textBlocks[0] || "";
    if (!first) return "";
    return first.length > 300 ? `${first.slice(0, 297)}…` : first;
  })();

  const videoEmbedSrc = page.video_url ? resolveVideoEmbedSrc(page.video_url) : "";
  const showVideo = isVideoPresellType(page.type) && !!page.video_url;
  const showVslFallback = isVideoPresellType(page.type) && !page.video_url;
  const hideHeroImageForVslFallback = showVslFallback;
  const isVslLayout = isVideoPresellType(page.type);
  const showSalesLetterSection = textBlocks.length > 0 && !isVslOnlyPresellType(page.type);

  const isDiscount = isDiscountPresellType(page.type);
  const discountHeadline = (content.discountHeadline as string) || title;
  const socialProofLine =
    typeof content.socialProofLine === "string" ? content.socialProofLine : discountSocialFallback(page.language);
  const ratingValue = typeof content.ratingValue === "string" ? content.ratingValue : "4.9";
  const ratingStars = typeof content.ratingStars === "number" ? content.ratingStars : 5;
  const urgencyTimerSeconds =
    typeof content.urgencyTimerSeconds === "number" ? content.urgencyTimerSeconds : 649;
  const mm = Math.floor(Math.max(0, urgencyTimerSeconds) / 60);
  const ss = Math.max(0, urgencyTimerSeconds) % 60;
  const timerLabel = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  const gateKind = getPresellGateKind(page.type);
  const interactiveKind = getInteractiveGateKind(page.type);
  const isGhost = isGhostPresellType(page.type);

  const parts: string[] = [];

  parts.push(`<!-- Presell Clickora — export estático. Oferta: rastreamento nos botões. Página ao vivo: ${escapeHtml(opts.publicPageUrl)} -->`);

  if (interactiveKind) {
    parts.push(
      `<div class="pe-note"><strong>Nota:</strong> Este tipo de presell tem validação (formulário) na versão alojada no Clickora. Aqui tens o conteúdo e o botão; para o fluxo completo usa o link público abaixo.</div>`,
    );
  }

  if (gateKind === "cookies") {
    parts.push(
      `<div class="pe-note">${escapeHtml(cookiePolicyUrl ? `Cookies / privacidade: ${cookiePolicyUrl}` : "Ao continuar, aceitas cookies conforme a política do anunciante.")} Os cliques usam rastreamento de afiliado.</div>`,
    );
  }

  if (isGhost) {
    parts.push(
      `<div class="pe-note">Tipo «fantasma»: na página publicada o visitante é redirecionado ao mover o rato. Aqui: usa o botão para ir à oferta.</div>`,
    );
  }

  if (isDiscount) {
    const stars = Math.min(5, Math.max(1, Math.round(ratingStars || 5)));
    const starStr = "★".repeat(stars);
    parts.push(`<div class="pe-discount-bar">${escapeHtml(discountUrgencyCopy(page.language))} · <span>${escapeHtml(timerLabel)}</span></div>`);
    parts.push(`<div class="pe-discount-modal">
  <div style="font-weight:800;font-size:1.35rem;margin-bottom:8px;">${escapeHtml(discountHeadline)}</div>
  <div style="font-size:.95rem;margin-bottom:10px;">${escapeHtml(socialProofLine)}</div>
  <div class="pe-stars" aria-hidden="true">${escapeHtml(starStr)} <span style="color:#64748b;font-weight:600;">${escapeHtml(ratingValue)}</span></div>
  <div style="margin-top:16px;">${ctaButton(href, ctaText, "light")}</div>
</div>`);
  }

  const heroClass = isVslLayout ? "pe-hero-vsl" : "pe-hero-light";
  parts.push(`<section class="${heroClass}"><div class="pe-inner" style="text-align:center;">`);

  if (heroImage && !hideHeroImageForVslFallback) {
    parts.push(`<div class="pe-img-wrap"><img src="${escapeAttr(heroImage)}" alt="" loading="eager" decoding="async" /></div>`);
  }

  parts.push(`<h1 class="pe-h1" style="${isVslLayout ? "color:#fff;" : ""}">${escapeHtml(title)}</h1>`);
  if (subtitle) {
    parts.push(`<p class="pe-subtitle" style="${isVslLayout ? "color:#e2e8f0;" : ""}">${escapeHtml(subtitle)}</p>`);
  }

  if (isVslLayout) {
    if (showVideo && videoEmbedSrc) {
      parts.push(`<div class="pe-video">`);
      if (isEmbedPlayerVideoUrl(videoEmbedSrc)) {
        parts.push(
          `<iframe title="Vídeo" src="${escapeAttr(videoEmbedSrc)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>`,
        );
      } else {
        parts.push(`<video title="Vídeo" src="${escapeAttr(videoEmbedSrc)}" controls playsinline preload="metadata"></video>`);
      }
      parts.push(`</div>`);
    } else if (showVslFallback) {
      parts.push(
        `<p class="pe-p" style="color:#e2e8f0;max-width:40rem;margin:0 auto;">${escapeHtml(vslExcerpt || subtitle || copyMidCta(page.language))}</p>`,
      );
    }
    parts.push(`<div>${ctaButton(href, ctaText, "dark")}</div>`);
  } else {
    parts.push(`<div>${ctaButton(href, ctaText, "light")}</div>`);
    if (showVideo && videoEmbedSrc) {
      parts.push(`<div class="pe-video" style="max-width:48rem;margin-top:16px;">`);
      if (isEmbedPlayerVideoUrl(videoEmbedSrc)) {
        parts.push(
          `<iframe title="Vídeo" src="${escapeAttr(videoEmbedSrc)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe>`,
        );
      } else {
        parts.push(`<video title="Vídeo" src="${escapeAttr(videoEmbedSrc)}" controls playsinline preload="metadata"></video>`);
      }
      parts.push(`</div>`);
    }
  }

  parts.push(`</div></section>`);

  if (galleryImages.length > 0 && !showVslFallback) {
    parts.push(`<section class="pe-gallery">`);
    for (const src of galleryImages) {
      parts.push(`<div><img src="${escapeAttr(src)}" alt="" loading="lazy" decoding="async" /></div>`);
    }
    parts.push(`</section>`);
  }

  if (showSalesLetterSection) {
    const mid = Math.max(4, Math.min(Math.floor(textBlocks.length / 2), 12));
    const first = textBlocks.slice(0, mid);
    const rest = textBlocks.slice(mid);

    parts.push(`<section class="pe-letter"><div class="pe-letter-box">`);
    for (const b of first) parts.push(blockToHtml(b));
    if (rest.length > 0) {
      parts.push(`<div class="pe-mid">
  <p class="pe-p" style="margin-bottom:12px;">${escapeHtml(copyMidCta(page.language))}</p>
  ${ctaButton(href, ctaText, "light")}
</div>`);
      for (const b of rest) parts.push(blockToHtml(b));
    }
    parts.push(`</div></section>`);
  }

  parts.push(`<section class="pe-footer-box"><div class="pe-footer-inner">
  ${ctaButton(href, ctaText, "light")}
  <p class="pe-footnote">${escapeHtml(copyFooter(page.language))}</p>
  <p class="pe-footnote"><a href="${escapeAttr(opts.publicPageUrl)}">Ver página publicada (Clickora)</a></p>
</div></section>`);

  const bodyInner = parts.join("\n");

  const styleBlock = `<style>${BASE_STYLES}${customCss ? `\n/* CSS personalizado da presell */\n${customCss}` : ""}</style>`;

  const htmlLang =
    langNorm(page.language) === "en" ? "en" : langNorm(page.language) === "es" ? "es" : "pt-BR";

  return `<!DOCTYPE html>
<html lang="${escapeAttr(htmlLang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Clickora Presell Export">
<title>${escapeHtml(title)}</title>
${styleBlock}
</head>
<body class="pe-root">
${bodyInner}
</body>
</html>`;
}
