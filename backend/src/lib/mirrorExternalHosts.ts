import { parse } from "node-html-parser";
import { CLICKORA_MIRROR_TRACK_MARKER, hostLooksLikeCommerceOrCheckout } from "./presellMirrorSnapshot";

/**
 * Transparência do espelho (P4 da auditoria «site comprometido»): lista os domínios externos para
 * onde o HTML espelhado liga (links, formulários, iframes) e que NÃO são a oferta, o site de origem,
 * um checkout conhecido nem um domínio comum e inofensivo (vídeo, mapas, redes sociais, .gov/.edu).
 *
 * Só leitura/diagnóstico: não altera o HTML servido (sem cloaking).
 */

const BENIGN_HOST_SUFFIXES = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "google.com",
  "gstatic.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "pinterest.com",
  "tiktok.com",
  "wikipedia.org",
  "nih.gov",
  "fda.gov",
  "ftc.gov",
  "clickora.com",
  "dclickora.com",
];

function stripWww(host: string): string {
  return host.replace(/^www\./, "").toLowerCase();
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function isBenignHost(host: string): boolean {
  if (BENIGN_HOST_SUFFIXES.some((d) => hostMatches(host, d))) return true;
  return /\.(gov|edu)(\.[a-z]{2})?$/.test(host);
}

export type MirrorExternalHostsReport = {
  /** Domínios externos não reconhecidos (ordenados, sem duplicados, máx. 25). */
  hosts: string[];
  /** Quantas ligações/elementos apontam para esses domínios. */
  count: number;
};

export function listUntrustedMirrorExternalHosts(
  html: string,
  trustedHosts: Iterable<string | null | undefined>,
): MirrorExternalHostsReport {
  const empty: MirrorExternalHostsReport = { hosts: [], count: 0 };
  if (!html || html.length < 20) return empty;

  const trusted = new Set<string>();
  for (const h of trustedHosts) {
    if (h && h.trim()) trusted.add(stripWww(h.trim()));
  }

  let root;
  try {
    root = parse(html, { comment: false });
  } catch {
    return empty;
  }

  const urls: string[] = [];
  root.querySelectorAll("a[href], area[href]").forEach((el) => {
    const v = el.getAttribute("href");
    if (v) urls.push(v);
  });
  root.querySelectorAll("form[action]").forEach((el) => {
    const v = el.getAttribute("action");
    if (v) urls.push(v);
  });
  root.querySelectorAll("[formaction]").forEach((el) => {
    const v = el.getAttribute("formaction");
    if (v) urls.push(v);
  });
  root.querySelectorAll("iframe[src]").forEach((el) => {
    const v = el.getAttribute("src");
    if (v) urls.push(v);
  });

  const found = new Map<string, number>();
  for (const raw of urls) {
    const v = raw.trim();
    if (!v || v.startsWith("#")) continue;
    const candidate = v.startsWith("//") ? `https:${v}` : v;
    if (!/^https?:\/\//i.test(candidate)) continue; // relativos, mailto:, tel:, javascript:, data:
    if (candidate.startsWith(CLICKORA_MIRROR_TRACK_MARKER)) continue;
    let u: URL;
    try {
      u = new URL(candidate);
    } catch {
      continue;
    }
    const host = stripWww(u.hostname);
    if (!host || host === "clickora.invalid") continue;
    if ([...trusted].some((t) => hostMatches(host, t))) continue;
    if (hostLooksLikeCommerceOrCheckout(host)) continue;
    if (isBenignHost(host)) continue;
    found.set(host, (found.get(host) || 0) + 1);
  }

  const hosts = [...found.keys()].sort().slice(0, 25);
  let count = 0;
  for (const n of found.values()) count += n;
  return { hosts, count };
}
