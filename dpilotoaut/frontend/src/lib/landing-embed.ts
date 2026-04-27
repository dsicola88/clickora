/**
 * URLs de YouTube / Vimeo e iframes genéricos para widgets de mídia na landing.
 */
export function embedVideoFromUrl(
  input: string,
): { type: "youtube" | "vimeo" | "iframe"; src: string } | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("<iframe")) {
    const m = /src=["']([^"']+)["']/i.exec(raw);
    if (m?.[1]) return { type: "iframe", src: m[1]! };
  }
  const yt = youTubeEmbedUrl(raw);
  if (yt) return { type: "youtube", src: yt };
  const vm = vimeoEmbedUrl(raw);
  if (vm) return { type: "vimeo", src: vm };
  if (/^https?:\/\//i.test(raw)) {
    if (raw.includes("youtube.com/embed/") || raw.includes("player.vimeo.com/")) {
      return { type: "iframe", src: raw };
    }
  }
  return null;
}

export function youTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url, "https://example.com");
    const h = u.hostname.replace("www.", "");
    if (h === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (h.includes("youtube.com") || h === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const p = u.pathname;
      if (p.startsWith("/embed/")) return `https://www.youtube.com${p}`;
      if (p.startsWith("/shorts/")) {
        const id = p.replace("/shorts/", "").split("/")[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function vimeoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url, "https://example.com");
    const h = u.hostname.replace("www.", "");
    if (!h.includes("vimeo.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts.find((p) => /^\d+$/.test(p));
    return id ? `https://player.vimeo.com/video/${id}` : null;
  } catch {
    return null;
  }
}

/** Apenas iframes https (conteúdo publicado por admins de confiança). */
export function isHttpsEmbeddableUrl(src: string): boolean {
  const s = String(src ?? "").trim();
  if (!s.startsWith("https://")) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}
