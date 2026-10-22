/** Deve coincidir com `CLICKORA_MIRROR_TRACK_MARKER` no backend (`presellMirrorSnapshot.ts`). */
export const CLICKORA_MIRROR_TRACK_MARKER = "https://clickora.invalid/__TRACK_OFFER__";

export function escapeHtmlAttrHref(href: string): string {
  return href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Deve coincidir com o backend (`presellMirrorSnapshot.ts`). */
export const MIRROR_RESPONSIVE_STYLE_IN_HEAD = `<style data-clickora="responsive-base">html,body{margin:0;}</style>`;

/** Legado — não injectar: alterava cores/forma dos CTAs da sales page. */
export const MIRROR_CTA_READABILITY_STYLE = "";

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
  void html;
  return html;
}

export function stripLegacyMirrorCtaReadabilityStyle(html: string): string {
  return html.replace(/<style\b[^>]*data-clickora="cta-readability"[^>]*>[\s\S]*?<\/style>/gi, "");
}

export function buildMirrorSrcDocWithTrackHref(srcDoc: string, trackHref: string): string {
  const escaped = escapeHtmlAttrHref(trackHref);
  const filled = stripLegacyMirrorCtaReadabilityStyle(
    srcDoc.split(CLICKORA_MIRROR_TRACK_MARKER).join(escaped),
  );
  /** Evita que CTAs relativos resolvam no lander do merchant (`tryvisivra.com/pv-v2…`). */
  const noMerchantBase = filled.replace(/<base\b[^>]*>/gi, '<base href="./">');
  return preconnectMirrorImageHost(
    deferMirrorImagesBelowFold(ensureMirrorResponsiveBaseHtml(noMerchantBase)),
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
