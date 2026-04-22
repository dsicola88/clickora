/**
 * Sub-IDs "de caminho" (estilo ClickMagick): /track/r/{presellId}/fonte/campanha/anuncio?to=…
 * Segmentos vão para tráfego/relatórios: preenchem sub1–sub3 se estes estiverem vazios na query;
 * o caminho completo fica em metadata.sub_path e path_segments.
 */
const MAX_SEGMENTS = 10;
const MAX_SEGMENT_LEN = 64;
const MAX_PATH_LEN = 240;
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

export type PathSubParsed = {
  sub_path: string;
  path_segments: string[];
};

/**
 * O Express entrega o sufixo em `req.params[0]` para a rota `/r/:id/*`.
 */
export function parsePublicPathSubTail(tail: string | undefined | null): PathSubParsed | null {
  if (tail == null || typeof tail !== "string") return null;
  const norm = tail.trim().replace(/^\/+|\/+$/g, "");
  if (!norm) return null;
  const parts = norm.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const out: string[] = [];
  for (const p of parts.slice(0, MAX_SEGMENTS)) {
    if (p.length > MAX_SEGMENT_LEN) return null;
    if (!SEGMENT_RE.test(p)) return null;
    if (p.includes("..") || p.toLowerCase() === ".." || p.toLowerCase() === ".") return null;
    out.push(p);
  }
  const sub_path = out.join("/");
  if (sub_path.length > MAX_PATH_LEN) return null;
  return { sub_path, path_segments: out };
}

export function mergeSubIdsWithPath(
  q: { sub1?: string | null; sub2?: string | null; sub3?: string | null },
  path: PathSubParsed | null,
): {
  sub1: string | undefined;
  sub2: string | undefined;
  sub3: string | undefined;
  pathMeta: PathSubParsed | null;
} {
  if (!path) {
    return {
      sub1: q.sub1?.trim() || undefined,
      sub2: q.sub2?.trim() || undefined,
      sub3: q.sub3?.trim() || undefined,
      pathMeta: null,
    };
  }
  const [a0, a1, a2] = path.path_segments;
  return {
    sub1: (q.sub1?.trim() || a0) || undefined,
    sub2: (q.sub2?.trim() || a1) || undefined,
    sub3: (q.sub3?.trim() || a2) || undefined,
    pathMeta: path,
  };
}

export function pathSubForMetadata(
  pathMeta: PathSubParsed | null,
): Record<string, string | string[]> {
  if (!pathMeta) return {};
  return {
    sub_path: pathMeta.sub_path,
    path_segments: pathMeta.path_segments,
  };
}
