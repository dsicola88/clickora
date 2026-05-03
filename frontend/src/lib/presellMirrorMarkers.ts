/** Deve coincidir com `CLICKORA_MIRROR_TRACK_MARKER` no backend (`presellMirrorSnapshot.ts`). */
export const CLICKORA_MIRROR_TRACK_MARKER = "https://clickora.invalid/__TRACK_OFFER__";

export function escapeHtmlAttrHref(href: string): string {
  return href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Deve coincidir com o backend (`presellMirrorSnapshot.ts`). */
export const MIRROR_RESPONSIVE_STYLE_IN_HEAD = `<style data-clickora="responsive-base">html{-webkit-text-size-adjust:100%;text-size-adjust:100%;}body{margin:0;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;overflow-wrap:anywhere;word-wrap:break-word;}*,*::before,*::after{box-sizing:border-box;}img,picture,video,canvas,svg{max-width:100%;height:auto;}iframe{max-width:100%;}table{max-width:100%;}</style>`;

/** Presells antigas sem este bloco — injeta no cliente. */
export function ensureMirrorResponsiveBaseHtml(html: string): string {
  if (html.includes("data-clickora=\"responsive-base\"")) return html;
  return html.replace(/<head\b[^>]*>/i, (open) => `${open}${MIRROR_RESPONSIVE_STYLE_IN_HEAD}`);
}

export function buildMirrorSrcDocWithTrackHref(srcDoc: string, trackHref: string): string {
  const escaped = escapeHtmlAttrHref(trackHref);
  const filled = srcDoc.split(CLICKORA_MIRROR_TRACK_MARKER).join(escaped);
  return ensureMirrorResponsiveBaseHtml(filled);
}
