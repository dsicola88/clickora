/**
 * Resolve URLs de vídeo do page builder para um `<iframe src>` seguro.
 * Suporta YouTube (vários formatos) e Bunny Stream / Bunny.net (play + embed).
 */

export type ResolvedVideoEmbed =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "iframe"; embedUrl: string }
  /** MP4/WebM directo da sales page — o iframe YouTube/Bunny não cobre. */
  | { kind: "html5"; embedUrl: string };

function youtubeEmbedFromUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (u.includes("youtube.com/shorts/")) {
    const m = u.match(/shorts\/([\w-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }
  const watch = u.match(/[?&]v=([\w-]{11})/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
  // Wizard/dashboard gravam youtube-nocookie.com/embed/… — o VideoWidget público
  // tem de aceitar esse host (não só youtube.com/embed).
  const embed = u.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/i);
  if (embed?.[1]) {
    const host = /youtube-nocookie/i.test(u) ? "www.youtube-nocookie.com" : "www.youtube.com";
    return `https://${host}/embed/${embed[1]}`;
  }
  const short = u.match(/youtu\.be\/([\w-]{11})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  return null;
}

function cleanBunnyPathSegment(raw: string): string {
  return raw.split(/[?#]/)[0]?.replace(/\/+$/, "").trim() || "";
}

/** Bunny play (bunnycdn/bunny.net) ou mediadelivery /play|/embed → iframe embed estável. */
function bunnyToEmbed(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host.includes("mediadelivery.net")) {
    const kind = parts[0];
    if ((kind === "embed" || kind === "play") && parts.length >= 3) {
      const libraryId = cleanBunnyPathSegment(parts[1] || "");
      const videoId = cleanBunnyPathSegment(parts[2] || "");
      if (!libraryId || !videoId) return null;
      return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
    }
    return null;
  }

  const isBunnyHost =
    host.includes("bunnycdn.com") ||
    host.includes("bunny.net") ||
    host.includes("b-cdn.net");
  if (!isBunnyHost) return null;
  const pi = parts.indexOf("play");
  if (pi < 0 || parts.length < pi + 3) return null;
  const libraryId = cleanBunnyPathSegment(parts[pi + 1] || "");
  const videoId = cleanBunnyPathSegment(parts[pi + 2] || "");
  if (!libraryId || !videoId) return null;
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
}

/**
 * Aceita:
 * - YouTube: watch?v=, youtu.be/, embed/, youtube-nocookie embed/, /shorts/
 * - Bunny: `iframe.mediadelivery.net/embed|play/{library}/{video}`
 * - Bunny: página Play `https://video.bunnycdn.com/play/{libraryId}/{videoId}` (e variantes bunny.net)
 */
export function resolvePageBuilderVideoUrl(raw: string): ResolvedVideoEmbed | null {
  const url = raw.trim();
  if (!url) return null;

  const yt = youtubeEmbedFromUrl(url);
  if (yt) return { kind: "youtube", embedUrl: yt };

  // Ficheiro directo (muitas VSLs / Melara-style) — tem de abrir com <video controls>.
  if (/^https?:\/\//i.test(url) && /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url)) {
    return { kind: "html5", embedUrl: url };
  }

  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();

    if (/\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(parsed.pathname)) {
      return { kind: "html5", embedUrl: parsed.toString() };
    }

    const bunnyEmbed = bunnyToEmbed(parsed);
    if (bunnyEmbed) return { kind: "iframe", embedUrl: bunnyEmbed };

    // Colar src Bunny sem esquema (ou host mediadelivery em texto)
    if (/mediadelivery\.net\/(?:embed|play)\//i.test(url)) {
      const fixed = url.startsWith("http") ? url : `https://${url}`;
      const again = bunnyToEmbed(new URL(fixed));
      if (again) return { kind: "iframe", embedUrl: again };
    }

    // Vimeo player
    if (host.includes("player.vimeo.com") && parsed.pathname.includes("/video/")) {
      return { kind: "iframe", embedUrl: parsed.toString() };
    }
  } catch {
    return null;
  }

  return null;
}

/** Aplica autoplay (sempre mudo) e controlos ao iframe do widget de vídeo. */
export function embedUrlWithPlayback(
  resolved: ResolvedVideoEmbed,
  opts: { autoplay?: boolean; controls?: boolean },
): string {
  const autoplay = opts.autoplay === true;
  const controls = opts.controls !== false;
  if (resolved.kind === "html5") {
    return resolved.embedUrl;
  }
  if (resolved.kind === "youtube") {
    const q = new URLSearchParams();
    q.set("rel", "0");
    q.set("modestbranding", "1");
    q.set("controls", controls ? "1" : "0");
    if (autoplay) {
      q.set("autoplay", "1");
      q.set("mute", "1");
      q.set("playsinline", "1");
    }
    const base = resolved.embedUrl.split("?")[0];
    return `${base}?${q}`;
  }
  try {
    const url = new URL(resolved.embedUrl);
    if (autoplay) {
      url.searchParams.set("autoplay", "true");
      url.searchParams.set("muted", "true");
    }
    url.searchParams.set("controls", controls ? "true" : "false");
    return url.toString();
  } catch {
    return resolved.embedUrl;
  }
}

/** Parâmetros de autoplay/loop/mudo para vídeo de fundo de secção (sem controlos). */
export function embedUrlForSectionBackground(resolved: ResolvedVideoEmbed): string {
  const base = resolved.embedUrl;
  if (resolved.kind === "youtube") {
    const idMatch = base.match(/\/embed\/([\w-]{11})/);
    const vid = idMatch?.[1];
    const q = new URLSearchParams();
    q.set("autoplay", "1");
    q.set("mute", "1");
    q.set("controls", "0");
    q.set("playsinline", "1");
    q.set("modestbranding", "1");
    q.set("rel", "0");
    if (vid) {
      q.set("loop", "1");
      q.set("playlist", vid);
    }
    return base.includes("?") ? `${base}&${q}` : `${base}?${q}`;
  }
  try {
    const url = new URL(base);
    url.searchParams.set("autoplay", "true");
    url.searchParams.set("muted", "true");
    url.searchParams.set("loop", "true");
    return url.toString();
  } catch {
    return base;
  }
}
