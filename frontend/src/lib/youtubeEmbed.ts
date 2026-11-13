import { resolvePageBuilderVideoUrl } from "@/page-builder/videoEmbed";

/** Deteta URL do YouTube (watch, embed, short, nocookie). Exportado para UI (ex.: escudo de cliques no embed). */
export function isYoutubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be|youtube-nocookie/i.test(url);
}

/**
 * Iframe de plataforma (YouTube/Bunny/Vimeo/…) vs ficheiro .mp4/.webm.
 * Usado na VSL pública e no export HTML — Bunny/mediadelivery têm de ser iframe.
 */
export function isEmbedPlayerVideoUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (/\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(u)) return false;
  return (
    /youtube\.com|youtu\.be|youtube-nocookie/.test(u) ||
    /vimeo\.com|player\.vimeo/.test(u) ||
    /wistia\.|wi\.st|fast\.wistia/.test(u) ||
    /loom\.com\/embed/.test(u) ||
    /dailymotion\.com|dai\.ly/.test(u) ||
    /cloudflarestream|videodelivery\.net/.test(u) ||
    /bunnycdn\.com|bunny\.net|b-cdn\.net|mediadelivery\.net/.test(u) ||
    /brightcove|jwplatform/.test(u)
  );
}

/** Extrai `src` se o utilizador colar o HTML completo do iframe (painel Bunny/YouTube). */
function extractPastedVideoCandidate(raw: string): string {
  const trimmed = raw.trim();
  if (!/<iframe/i.test(trimmed)) return trimmed;
  const src = trimmed.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  return src?.[1]?.trim() || trimmed;
}

/** Aceita YouTube, Bunny play/embed, MP4, etc. — campo manual do wizard/dashboard. */
export function resolveManualPresellVideoUrl(raw: string): string | null {
  const trimmed = extractPastedVideoCandidate(raw);
  if (!trimmed) return null;
  const yt = buildYoutubeEmbedUrlForPresell(trimmed);
  if (yt) return yt;
  const resolved = resolvePageBuilderVideoUrl(trimmed);
  if (resolved) return resolved.embedUrl;
  return null;
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

/**
 * Página pública / VSL combo: YouTube → nocookie; Bunny play → iframe.mediadelivery;
 * MP4 fica directo. Alinhado com o page-builder (`resolvePageBuilderVideoUrl`).
 */
export function resolveVideoEmbedSrc(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (isYoutubeUrl(trimmed)) {
    return buildYoutubeEmbedUrlForPresell(trimmed) || trimmed;
  }
  const resolved = resolvePageBuilderVideoUrl(trimmed);
  if (resolved) return resolved.embedUrl;
  return trimmed;
}
