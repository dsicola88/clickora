/** Deteta URL do YouTube (watch, embed, short, nocookie). Exportado para UI (ex.: escudo de cliques no embed). */
export function isYoutubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|youtube-nocookie/i.test(url);
}

/**
 * Converte qualquer link de vídeo do YouTube para embed em youtube-nocookie.com
 * com parâmetros que reduzem marca e vídeos relacionados (menos saídas para o site do YouTube).
 */
export function buildYoutubeEmbedUrlForPresell(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let id: string | null = null;
  const embed = trimmed.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]+)/i);
  if (embed?.[1]) id = embed[1];
  if (!id) {
    const v = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (v?.[1]) id = v[1];
  }
  if (!id) {
    const short = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]+)/i);
    if (short?.[1]) id = short[1];
  }
  if (!id && /^[a-zA-Z0-9_-]{11}$/.test(trimmed)) id = trimmed;
  if (!id) return null;

  const params = new URLSearchParams({
    modestbranding: "1",
    rel: "0",
    iv_load_policy: "3",
    playsinline: "1",
    fs: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

/** Usado na página pública: YouTube → embed controlado; outros URLs inalterados. */
export function resolveVideoEmbedSrc(url: string): string {
  if (!url.trim()) return url;
  if (isYoutubeUrl(url)) {
    return buildYoutubeEmbedUrlForPresell(url) || url;
  }
  return url;
}
