/** Deve coincidir com `CLICKORA_MIRROR_TRACK_MARKER` no backend (`presellMirrorSnapshot.ts`). */
export const CLICKORA_MIRROR_TRACK_MARKER = "https://clickora.invalid/__TRACK_OFFER__";

export function escapeHtmlAttrHref(href: string): string {
  return href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function buildMirrorSrcDocWithTrackHref(srcDoc: string, trackHref: string): string {
  const escaped = escapeHtmlAttrHref(trackHref);
  return srcDoc.split(CLICKORA_MIRROR_TRACK_MARKER).join(escaped);
}
