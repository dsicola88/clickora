import { createHash } from "node:crypto";
import { parse } from "node-html-parser";
import { getR2Config, isR2Configured, putR2Object } from "./r2Storage";

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MAX_IMAGES = 36;
const MAX_BYTES = 2_500_000;
const FETCH_TIMEOUT_MS = 12_000;

function guessContentType(url: string, headerCt: string | null): string {
  const h = (headerCt || "").split(";")[0]?.trim().toLowerCase() || "";
  if (h.startsWith("image/")) return h;
  const path = url.split("?")[0]?.toLowerCase() || "";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("svg")) return "svg";
  if (ct.includes("avif")) return "avif";
  return "jpg";
}

/** Já no nosso CDN / rehost anterior — não voltar a descarregar. */
export function isAlreadyRehostedMirrorUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (/\/presell-mirror\//i.test(u)) return true;
  const cfg = getR2Config();
  if (cfg?.publicBaseUrl && u.startsWith(cfg.publicBaseUrl)) return true;
  return false;
}

/**
 * Rehost imagens do espelho no R2 (quando configurado) e reescreve `src`/`srcset`.
 * Se R2 estiver off ou falhar, devolve o HTML original — sem mentir fidelidade.
 */
export async function rehostMirrorImagesToR2(args: {
  srcDoc: string;
  userId: string;
  pageHint?: string;
}): Promise<{ html: string; rehosted: number; skipped: boolean }> {
  if (!isR2Configured()) {
    return { html: args.srcDoc, rehosted: 0, skipped: true };
  }
  const root = parse(args.srcDoc, { comment: true });
  const imgs = root.querySelectorAll("img");
  if (imgs.length === 0) return { html: args.srcDoc, rehosted: 0, skipped: false };

  const cache = new Map<string, string>();
  let rehosted = 0;
  const hint = (args.pageHint || "mirror").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "mirror";

  for (const img of imgs.slice(0, MAX_IMAGES)) {
    const src = (img.getAttribute("src") || "").trim();
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;
    if (isAlreadyRehostedMirrorUrl(src)) {
      img.removeAttribute("srcset");
      continue;
    }
    let abs: string;
    try {
      abs = new URL(src, "https://example.invalid").href;
      if (!/^https?:\/\//i.test(abs)) continue;
    } catch {
      continue;
    }

    if (cache.has(abs)) {
      img.setAttribute("src", cache.get(abs)!);
      img.removeAttribute("srcset");
      continue;
    }

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(abs, {
        signal: ctrl.signal,
        headers: { "User-Agent": DEFAULT_UA, Accept: "image/*,*/*" },
        redirect: "follow",
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 32 || buf.length > MAX_BYTES) continue;
      const ct = guessContentType(abs, res.headers.get("content-type"));
      if (!ct.startsWith("image/")) continue;
      const hash = createHash("sha1").update(buf).digest("hex").slice(0, 16);
      const key = `presell-mirror/${args.userId}/${hint}/${hash}.${extFromContentType(ct)}`;
      const { url } = await putR2Object({ key, body: buf, contentType: ct });
      cache.set(abs, url);
      img.setAttribute("src", url);
      img.removeAttribute("srcset");
      rehosted += 1;
    } catch {
      /* keep original src */
    }
  }

  return { html: root.toString(), rehosted, skipped: false };
}

/**
 * Reconciliação no Save do editor / update: rehost `content.importMirrorSrcDoc` se R2 estiver activo.
 */
export async function reconcileMirrorInPresellContent(args: {
  content: Record<string, unknown>;
  userId: string;
  pageHint?: string;
}): Promise<{ content: Record<string, unknown>; rehosted: number; skipped: boolean }> {
  const raw = args.content.importMirrorSrcDoc;
  if (typeof raw !== "string" || raw.trim().length < 200) {
    return { content: args.content, rehosted: 0, skipped: true };
  }
  try {
    const rh = await rehostMirrorImagesToR2({
      srcDoc: raw,
      userId: args.userId,
      pageHint: args.pageHint,
    });
    if (rh.skipped) {
      return { content: args.content, rehosted: 0, skipped: true };
    }
    if (rh.rehosted === 0 && rh.html === raw) {
      return { content: args.content, rehosted: 0, skipped: false };
    }
    return {
      content: { ...args.content, importMirrorSrcDoc: rh.html },
      rehosted: rh.rehosted,
      skipped: false,
    };
  } catch (err) {
    console.warn("[reconcileMirrorInPresellContent] skipped", err);
    return { content: args.content, rehosted: 0, skipped: true };
  }
}
