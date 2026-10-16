import { canonicalProductName } from "./adText";
import { htmlToPlainText } from "./productPageFacts";

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const OG_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const OG_RE_REV = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i;
const H1_RE = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i;

const TITLE_JUNK =
  /\b(official\s+site|buy\s+now|order\s+now|special\s+offer|limited\s+time|discount|free\s+shipping|homepage|home\s+page|welcome)\b/gi;

const SEGMENT_SPLIT = /\s*[|–—]\s*|\s+-\s+/;

function normalizeKey(s: string): string {
  return canonicalProductName(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalizeKey(s)
    .split(" ")
    .filter((t) => t.length >= 2);
}

/** Sobrepõe tokens significativos (>=3 chars) entre nome do formulário e candidato da página. */
export function productAlignmentScore(userProduct: string, candidate: string): number {
  const a = tokens(userProduct);
  const b = tokens(candidate);
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let hit = 0;
  for (const t of a) {
    if (t.length >= 3 && setB.has(t)) hit += 1;
  }
  const denom = Math.max(a.filter((t) => t.length >= 3).length, 1);
  const overlap = hit / denom;
  const na = normalizeKey(userProduct);
  const nb = normalizeKey(candidate);
  if (na && nb && (na === nb || na.includes(nb) || nb.includes(na))) return Math.max(overlap, 0.95);
  const compactA = na.replace(/\s/g, "");
  const compactB = nb.replace(/\s/g, "");
  if (compactA.length >= 4 && compactB.length >= 4 && (compactA.includes(compactB) || compactB.includes(compactA))) {
    return Math.max(overlap, 0.88);
  }
  return overlap;
}

export function deriveProductNameFromPageTitle(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const parts = t.split(SEGMENT_SPLIT).map((p) => p.trim()).filter(Boolean);
  const scored = (parts.length ? parts : [t]).map((part) => {
    let s = part.replace(TITLE_JUNK, " ").replace(/\s+/g, " ").trim();
    s = s.replace(/^\d+\.\s*/, "").trim();
    return s;
  });
  scored.sort((x, y) => {
    const tx = tokens(x).length;
    const ty = tokens(y).length;
    if (tx !== ty) return ty - tx;
    return y.length - x.length;
  });
  const best = scored[0] ?? t;
  return canonicalProductName(best).slice(0, 200);
}

export function parsePageHeadIdentity(html: string): {
  pageTitle: string | null;
  ogTitle: string | null;
  h1: string | null;
} {
  const og = html.match(OG_RE)?.[1] || html.match(OG_RE_REV)?.[1];
  const titleRaw = html.match(TITLE_RE)?.[1];
  const h1Raw = html.match(H1_RE)?.[1];
  const clean = (s: string | undefined) => {
    if (!s) return null;
    const t = htmlToPlainText(s).replace(/\s+/g, " ").trim();
    return t.length >= 2 ? t.slice(0, 240) : null;
  };
  return {
    pageTitle: clean(titleRaw ?? undefined),
    ogTitle: clean(og ?? undefined),
    h1: clean(h1Raw ?? undefined),
  };
}

function rankCandidates(head: ReturnType<typeof parsePageHeadIdentity>): string[] {
  const raw = [head.h1, head.ogTitle, head.pageTitle].filter(Boolean) as string[];
  const derived = raw.map(deriveProductNameFromPageTitle).filter(Boolean);
  const unique: string[] = [];
  for (const d of derived) {
    const k = normalizeKey(d);
    if (!k || unique.some((u) => normalizeKey(u) === k)) continue;
    unique.push(d);
  }
  return unique;
}

export type ProductNameSource = "form" | "page" | "auto" | "merged";

export type ProductIdentityResult = {
  effectiveProduct: string;
  suggestedFromPage: string | null;
  pageTitle: string | null;
  pageH1: string | null;
  aligned: boolean;
  alignmentScore: number;
  source: ProductNameSource;
};

/**
 * Escolhe o nome que alinha keywords, factos da página e RSA.
 * `auto`: usa a página quando o match é fraco ou o formulário está vazio; mantém o formulário quando já coincide.
 */
export function resolveCampaignProductName(input: {
  userProduct: string;
  html: string;
  productNameSource?: ProductNameSource;
}): ProductIdentityResult {
  const user = canonicalProductName(input.userProduct.trim());
  const head = parsePageHeadIdentity(input.html);
  const candidates = rankCandidates(head);
  const suggested = candidates[0] ?? null;
  const mode = input.productNameSource ?? "auto";

  if (!suggested) {
    return {
      effectiveProduct: user || input.userProduct.trim(),
      suggestedFromPage: null,
      pageTitle: head.pageTitle,
      pageH1: head.h1,
      aligned: true,
      alignmentScore: 1,
      source: "form",
    };
  }

  const score = user ? productAlignmentScore(user, suggested) : 0;
  const aligned = score >= 0.82;

  if (mode === "page") {
    return {
      effectiveProduct: suggested,
      suggestedFromPage: suggested,
      pageTitle: head.pageTitle,
      pageH1: head.h1,
      aligned: user ? aligned : true,
      alignmentScore: score,
      source: "page",
    };
  }

  if (mode === "form") {
    return {
      effectiveProduct: user || suggested,
      suggestedFromPage: suggested,
      pageTitle: head.pageTitle,
      pageH1: head.h1,
      aligned,
      alignmentScore: score,
      source: "form",
    };
  }

  // auto
  if (!user || user.length < 2) {
    return {
      effectiveProduct: suggested,
      suggestedFromPage: suggested,
      pageTitle: head.pageTitle,
      pageH1: head.h1,
      aligned: true,
      alignmentScore: 1,
      source: "page",
    };
  }

  if (aligned) {
    const effective = adDisplayNamePick(user, suggested);
    return {
      effectiveProduct: effective,
      suggestedFromPage: suggested,
      pageTitle: head.pageTitle,
      pageH1: head.h1,
      aligned: true,
      alignmentScore: score,
      source: score >= 0.95 ? "form" : "merged",
    };
  }

  if (score < 0.45) {
    return {
      effectiveProduct: suggested,
      suggestedFromPage: suggested,
      pageTitle: head.pageTitle,
      pageH1: head.h1,
      aligned: false,
      alignmentScore: score,
      source: "page",
    };
  }

  return {
    effectiveProduct: user,
    suggestedFromPage: suggested,
    pageTitle: head.pageTitle,
    pageH1: head.h1,
    aligned: false,
    alignmentScore: score,
    source: "form",
  };
}

/** Prefer the candidate that matches page branding when scores tie. */
function adDisplayNamePick(user: string, suggested: string): string {
  const u = canonicalProductName(user);
  const s = canonicalProductName(suggested);
  if (u.toLowerCase() === s.toLowerCase()) return u;
  if (s.length > u.length && productAlignmentScore(u, s) >= 0.82) return s;
  return u;
}
