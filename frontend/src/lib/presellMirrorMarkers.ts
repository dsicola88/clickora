/** Deve coincidir com `CLICKORA_MIRROR_TRACK_MARKER` no backend (`presellMirrorSnapshot.ts`). */
export const CLICKORA_MIRROR_TRACK_MARKER = "https://clickora.invalid/__TRACK_OFFER__";

export function escapeHtmlAttrHref(href: string): string {
  return href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Deve coincidir com o backend (`presellMirrorSnapshot.ts`). */
export const MIRROR_RESPONSIVE_STYLE_IN_HEAD = `<style data-clickora="responsive-base">html,body{margin:0;}</style>`;

/**
 * CTAs /track/ no corpo: texto escuro (evita branco sobre branco).
 * Header/nav e CTAs vindos de #order-now: mantêm botão visível (o CSS original usava href="#…").
 */
export const MIRROR_CTA_READABILITY_STYLE = `<style data-clickora="cta-readability">main a[href*="/track/"],section a[href*="/track/"],article a[href*="/track/"],footer a[href*="/track/"]{color:#0f172a!important;-webkit-text-fill-color:#0f172a!important;font-size:max(12px,0.8125rem)!important;text-indent:0!important;letter-spacing:normal!important;line-height:1.3!important;opacity:1!important;visibility:visible!important}header a[href*="/track/"],nav a[href*="/track/"],a[data-clickora-hash-cta="1"]{display:inline-block!important;padding:.5rem 1.15rem!important;border-radius:.375rem!important;background:linear-gradient(180deg,#2dd4bf 0%,#0f766e 100%)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;font-size:max(12px,0.8125rem)!important;font-weight:600!important;text-decoration:none!important;text-indent:0!important;letter-spacing:.02em!important;line-height:1.25!important;opacity:1!important;visibility:visible!important;box-shadow:0 1px 2px rgba(0,0,0,.15)!important}a[href*="/track/"] *,a[href*="clickora.invalid/__TRACK"] *{color:inherit!important;-webkit-text-fill-color:inherit!important;font-size:inherit!important;opacity:1!important;visibility:visible!important}</style>`;

/** Presells antigas sem este bloco — injeta no cliente. */
export function ensureMirrorResponsiveBaseHtml(html: string): string {
  if (html.includes("data-clickora=\"responsive-base\"")) return html;
  return html.replace(/<head\b[^>]*>/i, (open) => `${open}${MIRROR_RESPONSIVE_STYLE_IN_HEAD}`);
}

/** A primeira imagem do clone entra já; as seguintes só quando se aproximam do ecrã. */
export function deferMirrorImagesBelowFold(html: string): string {
  let seen = 0;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    seen += 1;
    if (/\bloading\s*=/i.test(tag)) return tag;
    const attrs =
      seen === 1
        ? ' loading="eager" fetchpriority="high" decoding="async"'
        : ' loading="lazy" decoding="async"';
    return tag.replace(/<img\b/i, `<img${attrs}`);
  });
}

export function ensureMirrorCtaReadabilityHtml(html: string): string {
  if (html.includes("data-clickora=\"cta-readability\"")) return html;
  return html.replace(/<head\b[^>]*>/i, (open) => `${open}${MIRROR_CTA_READABILITY_STYLE}`);
}

export function buildMirrorSrcDocWithTrackHref(srcDoc: string, trackHref: string): string {
  const escaped = escapeHtmlAttrHref(trackHref);
  const filled = srcDoc.split(CLICKORA_MIRROR_TRACK_MARKER).join(escaped);
  return preconnectMirrorImageHost(
    deferMirrorImagesBelowFold(ensureMirrorCtaReadabilityHtml(ensureMirrorResponsiveBaseHtml(filled))),
  );
}

function preconnectMirrorImageHost(html: string): string {
  const match = html.match(/<img\b[^>]*\bsrc=["'](https:\/\/[^/"']+)/i);
  const origin = match?.[1];
  if (!origin || html.includes(`rel="preconnect" href="${origin}"`)) return html;
  const tag = `<link rel="preconnect" href="${origin}" crossorigin>`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (open) => `${open}${tag}`);
  }
  return html;
}
