import type { Presell } from "@/types/api";
import { getResolvedPublicApiBaseUrl } from "@/config/publicApiUrl";
import { resolveApiUrl } from "@/lib/apiOrigin";
import { resolvePublicPresellOgImageUrl, toAbsolutePageUrl } from "@/lib/publicPresellSeo";
import { isPresellUuidParam } from "@/lib/publicPresellOrigin";

const inflight = new Map<string, Promise<Presell | null>>();

function upsertMeta(attrName: "name" | "property", key: string, value: string) {
  const sel = attrName === "name" ? `meta[name="${key}"]` : `meta[property="${key}"]`;
  let el = document.querySelector(sel) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrName, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

/** Antes do React: evita o cartão genérico /placeholder.svg e ajuda o browser a pré-carregar a hero. */
function applyEarlyPresellShareImageHints(page: Presell) {
  if (typeof document === "undefined") return;
  const raw = resolvePublicPresellOgImageUrl(page)?.trim();
  if (!raw) return;
  const href = toAbsolutePageUrl(raw);
  if (!href) return;
  upsertMeta("property", "og:image", href);
  upsertMeta("name", "twitter:image", href);

  let already = false;
  for (const link of document.querySelectorAll('link[rel="preload"][as="image"]')) {
    if (link.getAttribute("href") === href) {
      already = true;
      break;
    }
  }
  if (already) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = href;
  link.setAttribute("data-presell-early-preload", "1");
  document.head.appendChild(link);
}

function extractPublicPresellRouteParam(pathname: string): string {
  const m = pathname.match(/^\/p\/([^/]+)/);
  if (!m?.[1]) return "";
  try {
    return decodeURIComponent(m[1]).replace(/\/+$/, "");
  } catch {
    return m[1].replace(/\/+$/, "");
  }
}

function buildPublicPresellFetchUrl(param: string): string {
  const base = getResolvedPublicApiBaseUrl();
  const path = isPresellUuidParam(param)
    ? `/public/presells/id/${encodeURIComponent(param)}`
    : `/public/presells/slug/${encodeURIComponent(param)}`;
  return resolveApiUrl(base, path).toString();
}

async function fetchPublicPresellJson(param: string): Promise<Presell | null> {
  const url = buildPublicPresellFetchUrl(param);
  const delaysMs = [0, 800, 2000];
  for (let i = 0; i < delaysMs.length; i++) {
    if (delaysMs[i] > 0) {
      await new Promise((r) => setTimeout(r, delaysMs[i]));
    }
    try {
      const res = await fetch(url, {
        credentials: "omit",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        if (res.status >= 500 && i < delaysMs.length - 1) continue;
        return null;
      }
      const data = (await res.json()) as Presell;
      try {
        applyEarlyPresellShareImageHints(data);
      } catch {
        /* ignore */
      }
      return data;
    } catch {
      if (i < delaysMs.length - 1) continue;
      return null;
    }
  }
  return null;
}

/** Dispara GET público o mais cedo possível (carregamento completo da página em /p/…). */
export function startPublicPresellPrefetchFromLocation(): void {
  if (typeof window === "undefined") return;
  const param = extractPublicPresellRouteParam(window.location.pathname);
  startPublicPresellPrefetchForParam(param);
}

/** Idempotente: regista o mesmo pedido se ainda não existir (primeiro render de PublicPresell). */
export function startPublicPresellPrefetchForParam(param: string): void {
  const p = param.trim();
  if (!p || inflight.has(p)) return;
  inflight.set(p, fetchPublicPresellJson(p));
}

/**
 * Aguarda o prefetch iniciado para este parâmetro. `undefined` = não há prefetch;
 * `null` = pedido falhou (4xx/rede); aí o queryFn pode repetir com o cliente habitual.
 */
export async function getPublicPresellPrefetchResult(param: string): Promise<Presell | null | undefined> {
  const p = inflight.get(param);
  if (!p) return undefined;
  return p;
}
