export type LessonProvider = "youtube" | "bunny";

export type ParsedLessonVideo = {
  provider: LessonProvider;
  videoId: string;
  bunnyLibraryId: string | null;
  embedUrl: string;
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const BUNNY_HOSTS = new Set([
  "iframe.mediadelivery.net",
  "player.mediadelivery.net",
  "video.bunnycdn.com",
]);

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;
const BUNNY_LIBRARY = /^\d{1,12}$/;
const BUNNY_VIDEO = /^[a-zA-Z0-9_-]{8,80}$/;

function extractCandidateUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iframe = trimmed.match(/src\s*=\s*["']([^"']+)["']/i);
  return (iframe?.[1] ?? trimmed).trim();
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let id = "";
  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else {
    const parts = url.pathname.split("/").filter(Boolean);
    const head = parts[0] ?? "";
    if (head === "embed" || head === "shorts" || head === "live" || head === "v") {
      id = parts[1] ?? "";
    } else {
      id = url.searchParams.get("v") ?? "";
    }
  }
  id = id.split(/[?&#]/)[0] ?? "";
  return YOUTUBE_ID.test(id) ? id : null;
}

export function lessonEmbedUrl(parsed: Pick<ParsedLessonVideo, "provider" | "videoId" | "bunnyLibraryId">): string | null {
  if (parsed.provider === "youtube" && YOUTUBE_ID.test(parsed.videoId)) {
    return `https://www.youtube-nocookie.com/embed/${parsed.videoId}?rel=0`;
  }
  if (
    parsed.provider === "bunny" &&
    parsed.bunnyLibraryId &&
    BUNNY_LIBRARY.test(parsed.bunnyLibraryId) &&
    BUNNY_VIDEO.test(parsed.videoId)
  ) {
    return `https://iframe.mediadelivery.net/embed/${parsed.bunnyLibraryId}/${parsed.videoId}`;
  }
  return null;
}

/** Aceita link YouTube ou embed Bunny Stream (também o HTML do iframe colado do painel Bunny). */
export function parseLessonVideoUrl(raw: string): ParsedLessonVideo | null {
  const candidate = extractCandidateUrl(raw);
  if (!candidate || candidate.length > 2000) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) {
    const videoId = youtubeId(url);
    if (!videoId) return null;
    const embedUrl = lessonEmbedUrl({ provider: "youtube", videoId, bunnyLibraryId: null });
    if (!embedUrl) return null;
    return { provider: "youtube", videoId, bunnyLibraryId: null, embedUrl };
  }

  if (BUNNY_HOSTS.has(host)) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 3) return null;
    if (parts[0] !== "embed" && parts[0] !== "play") return null;
    const bunnyLibraryId = parts[1] ?? "";
    const videoId = (parts[2] ?? "").split(/[?&#]/)[0] ?? "";
    if (!BUNNY_LIBRARY.test(bunnyLibraryId) || !BUNNY_VIDEO.test(videoId)) return null;
    const embedUrl = lessonEmbedUrl({ provider: "bunny", videoId, bunnyLibraryId });
    if (!embedUrl) return null;
    return { provider: "bunny", videoId, bunnyLibraryId, embedUrl };
  }

  return null;
}
