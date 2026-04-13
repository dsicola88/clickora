/**
 * Converte URL de vídeo (YouTube, Vimeo, ficheiro .mp4/.webm) para iframe ou elemento video nativo.
 */

export type VideoEmbedResult =
  | { mode: "iframe"; src: string }
  | { mode: "native"; src: string };

export function resolveVideoEmbedUrl(url: string): VideoEmbedResult | null {
  const u = url.trim();
  if (!u) return null;

  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u.split("#")[0] ?? "")) {
    return { mode: "native", src: u };
  }

  try {
    const parsed = new URL(u);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (id) return { mode: "iframe", src: `https://www.youtube.com/embed/${id}` };
    }

    if (host.includes("youtube.com") || host === "youtube-nocookie.com") {
      const v = parsed.searchParams.get("v");
      if (v) return { mode: "iframe", src: `https://www.youtube.com/embed/${v}` };
      const paths = ["embed", "shorts", "live"];
      for (const p of paths) {
        const m = parsed.pathname.match(new RegExp(`/${p}/([^/?]+)`));
        if (m?.[1]) return { mode: "iframe", src: `https://www.youtube.com/embed/${m[1]}` };
      }
    }

    if (host.includes("vimeo.com")) {
      const m = parsed.pathname.match(/\/(?:video\/)?(\d+)/);
      if (m?.[1]) return { mode: "iframe", src: `https://player.vimeo.com/video/${m[1]}` };
    }

    if (u.includes("youtube.com/embed") || u.includes("youtube-nocookie.com/embed")) {
      return { mode: "iframe", src: u };
    }
    if (u.includes("player.vimeo.com/video")) {
      return { mode: "iframe", src: u };
    }
  } catch {
    return null;
  }

  return null;
}
