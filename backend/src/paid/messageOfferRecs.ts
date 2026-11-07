/**
 * Recomendações de mensagem/oferta (MVP Copilot):
 * — só reutiliza copy já existente na campanha + URL de destino;
 * — não inventa preço, garantia, funil nem nova oferta;
 * — fallback determinístico sempre; LLM opcional (OPENAI_API_KEY).
 */

export type MessageOfferSeed = {
  headline: string;
  body: string;
  destination_url: string;
};

export type MessageOfferVariant = {
  headline: string;
  body: string;
  note: string;
  source: "deterministic" | "llm";
};

function clean(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Host da URL — âncora neutra, sem claims. */
function hostHint(url: string): string | null {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h || null;
  } catch {
    return null;
  }
}

/** Variantes só a partir de seeds existentes — sem factos novos nem CTAs noutra língua. */
export function buildDeterministicMessageVariants(
  seeds: MessageOfferSeed[],
  opts?: { max?: number },
): MessageOfferVariant[] {
  const max = opts?.max ?? 3;
  if (seeds.length === 0) return [];

  const out: MessageOfferVariant[] = [];
  const primary = seeds[0]!;
  const secondary = seeds[1] ?? seeds[0]!;

  // 1) Troca headline ↔ body do melhor seed (se body curto o suficiente).
  if (primary.body.length >= 8 && primary.body.length <= 40) {
    out.push({
      headline: clean(primary.body, 40),
      body: clean(primary.headline, 125),
      note: "Inversão headline/corpo a partir do copy existente.",
      source: "deterministic",
    });
  }

  // 2) Combina headline do 1.º com corpo do 2.º (mesma oferta/URL).
  if (secondary && secondary.body !== primary.body) {
    out.push({
      headline: clean(primary.headline, 40),
      body: clean(secondary.body, 125),
      note: "Headline do vencedor + corpo de outra variante já publicada/rascunho.",
      source: "deterministic",
    });
  }

  // 3) Headline = host do destino (já na campanha) + corpo existente — sem copy inventado.
  const host = hostHint(primary.destination_url);
  if (host && host.length >= 3 && host.length <= 40) {
    out.push({
      headline: clean(host, 40),
      body: clean(primary.body || primary.headline, 125),
      note: "Headline = hostname do destino já usado na campanha.",
      source: "deterministic",
    });
  }

  // 4) Headline do 2.º + corpo do 1.º
  if (secondary && secondary.headline !== primary.headline) {
    out.push({
      headline: clean(secondary.headline, 40),
      body: clean(primary.body || primary.headline, 125),
      note: "Recombinação de peças já existentes na campanha.",
      source: "deterministic",
    });
  }

  // Dedup por headline+body
  const seen = new Set<string>();
  const unique: MessageOfferVariant[] = [];
  for (const v of out) {
    const k = `${v.headline}||${v.body}`;
    if (seen.has(k)) continue;
    if (!v.headline || !v.body) continue;
    // Evitar clone exacto do seed
    if (seeds.some((s) => s.headline === v.headline && s.body === v.body)) continue;
    seen.add(k);
    unique.push(v);
    if (unique.length >= max) break;
  }
  return unique;
}

export function buildMessageRecUserPrompt(args: {
  platform: string;
  campaignName: string;
  destinationUrl: string;
  seeds: MessageOfferSeed[];
  rankingNote?: string | null;
}): string {
  const seedLines = args.seeds
    .slice(0, 6)
    .map((s, i) => `${i + 1}. headline="${s.headline}" body="${s.body}"`)
    .join("\n");
  return [
    `Platform: ${args.platform}`,
    `Campaign: ${args.campaignName}`,
    `Destination URL (MUST keep same offer/host): ${args.destinationUrl}`,
    args.rankingNote ? `Network ranking note: ${args.rankingNote}` : null,
    "Existing ad copy (ONLY source of product facts):",
    seedLines || "(none)",
    "Return JSON: { \"variants\": [ { \"headline\": string, \"body\": string, \"note\": string } ] } with 1–3 variants.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const MESSAGE_OFFER_RECS_SYSTEM = `You suggest paid-ad message variants for an EXISTING campaign.
Hard rules:
- Use ONLY facts present in the provided existing headlines/bodies and the destination URL/host.
- Do NOT invent prices, discounts, guarantees, shipping, bonuses, certifications, new products, or funnel steps.
- Do NOT change the offer or destination — same product, same URL intent.
- Keep headlines short; body is primary text (Meta) or a short RSA-style line.
- Prefer rephrasing and recombining existing wording over new claims.
- note: one short sentence explaining the change (language of the ads).
- Output JSON only.`;

export function parseLlmMessageVariants(raw: unknown): MessageOfferVariant[] {
  if (!raw || typeof raw !== "object") return [];
  const variants = (raw as { variants?: unknown }).variants;
  if (!Array.isArray(variants)) return [];
  const out: MessageOfferVariant[] = [];
  for (const v of variants) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const headline = clean(String(o.headline ?? ""), 40);
    const body = clean(String(o.body ?? ""), 125);
    const note = clean(String(o.note ?? "Variante LLM a partir do copy existente."), 160);
    if (!headline || !body) continue;
    out.push({ headline, body, note, source: "llm" });
  }
  return out.slice(0, 3);
}
