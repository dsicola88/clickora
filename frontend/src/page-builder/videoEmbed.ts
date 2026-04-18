/**
 * Resolve URLs de vídeo do page builder para um `<iframe src>` seguro.
 * Suporta YouTube (vários formatos) e Bunny Stream / Bunny.net (play + embed).
 */

export type ResolvedVideoEmbed =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "iframe"; embedUrl: string };

function youtubeEmbedFromUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (u.includes("youtube.com/shorts/")) {
    const m = u.match(/shorts\/([\w-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  }
  const watch = u.match(/[?&]v=([\w-]{11})/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
  const embed = u.match(/youtube\.com\/embed\/([\w-]{11})/);
  if (embed) return `https://www.youtube.com/embed/${embed[1]}`;
  const short = u.match(/youtu\.be\/([\w-]{11})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  return null;
}

function bunnyPlayToEmbed(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const isBunnyHost =
    host.includes("bunnycdn.com") ||
    host.includes("bunny.net") ||
    host.includes("b-cdn.net") ||
    host === "video.bunnycdn.com";
  if (!isBunnyHost || !url.pathname.includes("/play/")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const pi = parts.indexOf("play");
  if (pi < 0 || parts.length < pi + 3) return null;
  const libraryId = parts[pi + 1];
  const videoId = parts[pi + 2];
  if (!libraryId || !videoId) return null;
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;
}

/**
 * Aceita:
 * - YouTube: watch?v=, youtu.be/, embed/, /shorts/
 * - Bunny: URL completa do iframe `iframe.mediadelivery.net/embed/...`
 * - Bunny: página Play `https://video.bunnycdn.com/play/{libraryId}/{videoId}` (e variantes bunny.net)
 */
export function resolvePageBuilderVideoUrl(raw: string): ResolvedVideoEmbed | null {
  const url = raw.trim();
  if (!url) return null;

  const yt = youtubeEmbedFromUrl(url);
  if (yt) return { kind: "youtube", embedUrl: yt };

  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("mediadelivery.net") && parsed.pathname.includes("/embed/")) {
      return { kind: "iframe", embedUrl: parsed.toString() };
    }

    const bunnyEmbed = bunnyPlayToEmbed(parsed);
    if (bunnyEmbed) return { kind: "iframe", embedUrl: bunnyEmbed };

    // Colar diretamente o src do iframe Bunny
    if (url.includes("iframe.mediadelivery.net/embed/")) {
      const fixed = url.startsWith("http") ? url : `https://${url}`;
      return { kind: "iframe", embedUrl: fixed };
    }
  } catch {
    return null;
  }

  return null;
}
