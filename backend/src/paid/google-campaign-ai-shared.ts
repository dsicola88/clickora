/**
 * Núcleo partilhado do assistente Google Search (`google-campaign-plan`):
 * SYSTEM_PROMPT, chamada OpenAI e fallback determinístico.
 */
import { buildDeterministicRsa, clipAtWord } from "./google-rsa-deterministic";
import type { GoogleCampaignAssetExtensionsStored } from "./google-campaign-asset-extensions";
import {
  mergeCampaignNegativeKeywordPlan,
  landingHostnameFromUrl,
  type CampaignNegativeKeywordEntry,
} from "./google-campaign-negative-keywords-defaults";

/** Extensões que a IA pode preencher (parciais são completadas em `finalizeGoogleCampaignAssetExtensions`). */
export type GoogleCampaignAiExtensionsPartial = Partial<GoogleCampaignAssetExtensionsStored>;

/**
 * Sinais reais do produto. **Apenas** dados que existam mesmo. Quando ausentes,
 * o copy nunca os menciona. Inspirado em copies vencedores (preço, desconto,
 * garantia, envio, bundles, bónus, certificações, atributos).
 */
export interface GoogleProductSignals {
  /** Preço actual de venda (já inclui símbolo/moeda). Ex.: "$49", "49 €". */
  price?: string;
  /** Preço cheio antes de desconto. Ex.: "$79". */
  price_full?: string;
  /** Texto do desconto. Ex.: "77% Off", "$120 Off". */
  discount?: string;
  /** Texto da garantia. Ex.: "180 Day Money Back", "30-Day Guarantee". */
  guarantee?: string;
  /** Texto do envio. Ex.: "Free US Shipping", "Fast Shipping". */
  shipping?: string;
  /** Bundles/packs já formatados. Ex.: ["1 Bottle $69", "3 Bottles $177", "6 Bottles $294"]. */
  bundles?: string[];
  /** Bónus incluídos. Ex.: "2 Free Bonuses", "Free e-book". */
  bonuses?: string;
  /** Certificações reais. Ex.: "FDA Approved & GMP Certified". */
  certifications?: string;
  /** Atributos do produto. Ex.: ["100% Organic", "100% Natural", "Vegan"]. */
  attributes?: string[];
}

export interface GoogleCampaignAiPlan {
  campaign: { name: string; objective_summary: string };
  ad_groups: Array<{
    name: string;
    keywords: Array<{ text: string; match_type: "exact" | "phrase" | "broad" }>;
    rsa: { headlines: string[]; descriptions: string[] };
  }>;
  /** Opcional — sitelinks, callouts e um structured snippet ao nível da campanha. */
  extensions?: GoogleCampaignAiExtensionsPartial;
  /**
   * Negativos adicionais da IA; o servidor funde com pacotes dinâmicos (EN + PT/ES/geo/TLD) e filtra colisões com semente/oferta.
   */
  campaign_negative_keywords?: CampaignNegativeKeywordEntry[];
}

export type DeterministicPlanInput = {
  landingUrl: string;
  offer: string;
  objective: string;
  geoTargets: string[];
  languageTargets: string[];
  /** Sinais reais do produto — usados para gerar copy verdadeiro (preço, desconto, garantia, etc.). */
  productSignals?: GoogleProductSignals;
  /** Palavra-chave principal confirmada no assistente de decisão. */
  campaignSeedKeyword?: string;
};

/** Igual ao modelo usado pela API oficial `POST …/google-campaign-plan`. */
export const GOOGLE_SEARCH_CAMPAIGN_AI_SYSTEM_PROMPT = `You are an expert Google Ads Search strategist. Generate a COMPACT, high-quality campaign plan as JSON only.

Rules:
- Return JSON ONLY, matching the schema exactly. No prose, no markdown.
- 2-3 ad groups, each tightly themed.
- 5-10 keywords per ad group across exact/phrase/broad mix.
- RSA: Exactly 12 headlines and 4 descriptions per ad group whenever possible (Google RSA limits: each headline MAX 30 characters including spaces/punctuation — count carefully; each description MAX 90 characters). Headlines must be persuasive and SPECIFIC to the Offer and Landing URL (benefits, outcomes, reassurance, urgency only if truthful). Each headline should ideally use 18-30 characters — avoid bare brand-only headlines, single words, or tepid filler; weave in concrete benefits, differentiators or commercial keywords. Across the 12 headlines, vary the angle: at least one CTA, one benefit, one proof/quality cue, one urgency/availability cue, and one branded headline naming the offer. Do NOT repeat the same stem (e.g. "Try X / Discover X / Buy X / Best X") more than once.
- KEYWORD DENSITY (critical for Google Quality Score): at least 9 of the 12 headlines MUST contain the offer brand/keyword (the exact "Offer" string from the user prompt, or its first 1-2 words). The remaining 2-3 headlines may omit the keyword for variety, but never make them the majority. Never produce a set where the keyword appears in fewer than 9 headlines.
- BRAND LENGTH HANDLING (critical — never produce mid-word truncation): If the brand/offer is long (≥ 18 chars), most "Verb + Brand + Suffix" templates will overflow 30 chars. NEVER let the system truncate a word — instead, choose templates that fit COMPLETELY in 30 chars before writing them. Strategies, in priority order: (1) prefer single-word brand reference ("Try BrandWord Today" instead of "Try Brand Full Name Today"); (2) prefer brand alone or brand + 1-2 chars suffix ("Brand — 30% Off"); (3) prefer benefit/CTA-first templates that put brand last ("Order Today: Brand"); (4) cut adjectives/articles before cutting the brand word; (5) NEVER ship a headline ending in a half-word like "Presentat" or "Presenta". Same rule applies to descriptions: if the full sentence exceeds 90 chars, rewrite it shorter rather than emitting truncated trailing text like "tonic.phytogree.n".
- Descriptions must be full persuasive sentences up to ~90 chars: clear value proposition, proof angle, delivery/trust cues when appropriate; align tightly with the Offer and what the Landing URL actually delivers. At least 2 of the 4 descriptions should mention the offer brand/keyword. Each description must explore a DIFFERENT angle (offer + price, risk-reversal/guarantee, social proof, urgency/CTA) — do not repeat the same phrase (e.g. the same guarantee/shipping line) across multiple descriptions.

PRODUCT SIGNALS HANDLING (most critical rule):
- A "Product signals" section MAY be included in the user message, listing TRUE facts about the product (price, full price, discount, guarantee, shipping, bundles, bonuses, certifications, attributes). USE THESE EXACT VALUES VERBATIM in headlines and descriptions whenever they fit (price/discount/guarantee/shipping are highest-value cues that lift CTR).
- If a Product signals section is **NOT** present, or a specific signal is missing, you MUST NOT mention or imply that signal. NEVER invent a price ("$49"), a percentage ("77% Off"), a guarantee duration ("180 day money back"), shipping ("free shipping"), bonuses, certifications ("FDA Approved") or any factual product claim. When in doubt, omit.
- Reference patterns drawn from validated affiliate copy (use them only with the actual signals provided):
  - Headlines: "{Offer} Just {price}", "{Offer} {discount} Today", "{Offer} + {shipping}", "{guarantee}", "Save {discount} on {Offer}", "{Offer} + {bonuses}", "{certifications}", bundle text verbatim ("6 Bottles For Only $294").
  - Descriptions: "Buy {Offer} now on the official site with {discount} + {shipping} today.", "{guarantee}. Take advantage of this offer and order {Offer} today.", "Get {Offer} with {shipping}. You have {guarantee}.", "Only {price}/unit + {shipping}. {certifications}".
- Compose every output (headlines, descriptions, sitelinks, callouts, structured snippet) using ONLY: the Offer text, the Landing URL/host, and the Product signals provided. No outside claims.
- Keywords must be commercial-intent, not brand-only.
- Never include the user's blocked keywords.

LANGUAGE COMPLIANCE (critical):
- The "Advertising languages" line in the user message lists ISO codes; the FIRST code is the PRIMARY language. Write EVERY headline and EVERY description in that primary language ONLY. Do not mix languages within an ad. Do not switch language across the 12 headlines. The hostname or product brand can stay as-is, but every other word must be in the primary language.
- Use native, idiomatic phrasing — never machine-translated stems. Do NOT use generic SaaS clichés (e.g. "built for teams", "free trial") unless they exactly match the product.

OBJECTIVE HANDLING (critical):
- The "Objective" field is INTERNAL briefing context for the campaign strategist. NEVER copy it verbatim into a headline or description. NEVER prefix any headline/description with internal labels such as "Goal:", "Objetivo:", "Objective:", "Ziel:", "Objectif:", "Briefing:", "Details:".
- Use the Objective only to set tone and intent (e.g. lead-gen, e-commerce, sign-ups). The user-facing copy must read like a polished ad, not a brief.

CAMPAIGN NEGATIVE KEYWORDS (critical):
- Include JSON array **campaign_negative_keywords**: array of objects with string field **text** (max 80 chars) and **match_type** one of phrase | exact | broad.
- Add **12 to 24 ADDITIONAL** negatives tuned to THIS Offer, Landing hostname/category, AND the geo/language hints in the user message (regional coupon wording, dominant marketplaces, forums/Q&A habits). Prefer **phrase** match.
- Do **not** duplicate ultra-generic DR starters (free, pdf, scam, amazon, ebay, reddit, reviews, youtube, tiktok, wiki, promo codes...) — the platform merges locale-aware starter packs automatically.
- Never negate the user's primary commercial seed/theme from the prompt nor distinctive branded tokens from the Offer text (the server also strips collisions).

Also output **campaign extensions** alongside RSA and keywords:
- **Sitelinks (2–6)**: texts max 25 characters; **final_urls** absolute https, same hostname as Landing URL preferentially (landing page with a URL hash fragment is OK — e.g. #faq, #buy). Optional description lines ≤35 characters (fields description1 and description2 optional).
- **Callouts (4–10)**, each max 25 characters — trust, clarity, urgency only if truthful; match the user's languages where possible but respect character limits over translation quality.
- **One structured snippet**: field "header" must be exactly one of: Brands, Services, Types, Models, Destinations (English enum required by Google). Field "values" must be 3–10 strings, each ≤25 characters, aligned with the Offer.

If generation runs without AI (fallback mode), RSA copy is composed deterministically from Offer, Objective, and Landing URL only — your JSON output matches that principle when AI is enabled: always tether headlines and descriptions to those three inputs.

Schema:
{
  "campaign": { "name": string, "objective_summary": string },
  "ad_groups": [
    {
      "name": string,
      "keywords": [{ "text": string, "match_type": "exact" | "phrase" | "broad" }],
      "rsa": { "headlines": string[], "descriptions": string[] }
    }
  ],
  "extensions": {
    "sitelinks": [
      {
        "link_text": string,
        "final_url": string,
        "description1"?: string,
        "description2"?: string
      }
    ],
    "callouts": string[],
    "structured_snippet": {
      "header": "Brands Services Types Models Destinations (pick one literal string)",
      "values": string[]
    } | null
  },
  "campaign_negative_keywords": [
    { "text": string, "match_type": "exact" | "phrase" | "broad" }
  ]
}`;

export async function fetchOpenAiGoogleCampaignPlan(userPrompt: string): Promise<{
  plan: GoogleCampaignAiPlan;
  tokensIn: number;
  tokensOut: number;
  model: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const model = "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: GOOGLE_SEARCH_CAMPAIGN_AI_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as {
    choices: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const plan = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as GoogleCampaignAiPlan;
  return {
    plan,
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
    model: `openai/${model}`,
  };
}

/**
 * Limpa o copy do RSA para garantir qualidade publicável:
 * - Remove prefixos internos tipo `Goal:`, `Objetivo:`, `Objective:`, `Ziel:`, `Objectif:`, `Details:`.
 * - Descarta strings que sejam essencialmente o objective verbatim.
 * - Garante mínimos (≥3 headlines, ≥2 descriptions) recorrendo ao gerador determinístico.
 */
const INTERNAL_LABEL_RE = /^\s*(?:goal|objetivo|objective|ziel|objectif|briefing|details)\s*[:\-—]\s*/i;

function looksLikeObjective(text: string, objective: string): boolean {
  const a = text.replace(/\s+/g, " ").trim().toLowerCase();
  const b = objective.replace(/\s+/g, " ").trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  /** Considera "verbatim" se ≥80 % do objective aparece na string. */
  if (b.length >= 24 && a.includes(b.slice(0, Math.min(b.length, 60)))) return true;
  return false;
}

function cleanCopyLine(s: string, objective: string): string {
  const stripped = s.replace(INTERNAL_LABEL_RE, "").trim();
  if (looksLikeObjective(stripped, objective)) return "";
  return stripped;
}

export function sanitizeAiPlanCopy(
  plan: GoogleCampaignAiPlan,
  ctx: DeterministicPlanInput,
): GoogleCampaignAiPlan {
  const fallbackPrimary = ctx.languageTargets[0] ?? "en";
  const fallbackRsa = buildDeterministicRsa(
    { landingUrl: ctx.landingUrl, offer: ctx.offer, objective: ctx.objective },
    fallbackPrimary,
    ctx.productSignals,
  );

  const cleanedAdGroups = (plan.ad_groups ?? []).map((ag) => {
    /** Usar `clipAtWord` em vez de hard slice evita publicar headlines como
     *  "TonicGreens Presentation You C" ou descrições terminadas em "tonic.phytogree.n".
     *  Quando a IA produz copy >30/90 chars, recortamos por fronteira de palavra; se isso
     *  perderia >40 % do conteúdo (return null), descartamos e o gerador determinístico
     *  preenche os mínimos. */
    const headlines = (ag.rsa?.headlines ?? [])
      .map((h) => clipAtWord(cleanCopyLine(h, ctx.objective), 30) ?? "")
      .filter((h) => h.length > 0);
    const descriptions = (ag.rsa?.descriptions ?? [])
      .map((d) => clipAtWord(cleanCopyLine(d, ctx.objective), 90) ?? "")
      .filter((d) => d.length > 0);

    /** Mínimos publicáveis: complementa do fallback determinístico (mesmo idioma) sem duplicar. */
    const seenH = new Set(headlines.map((h) => h.toLowerCase()));
    for (const h of fallbackRsa.headlines) {
      if (headlines.length >= 12) break;
      if (h && !seenH.has(h.toLowerCase())) {
        headlines.push(h);
        seenH.add(h.toLowerCase());
      }
    }

    const seenD = new Set(descriptions.map((d) => d.toLowerCase()));
    for (const d of fallbackRsa.descriptions) {
      if (descriptions.length >= 4) break;
      if (d && !seenD.has(d.toLowerCase())) {
        descriptions.push(d);
        seenD.add(d.toLowerCase());
      }
    }

    return { ...ag, rsa: { headlines, descriptions } };
  });

  const mergedNeg = mergeCampaignNegativeKeywordPlan(
    {
      languageTargets: ctx.languageTargets,
      geoTargets: ctx.geoTargets,
      landingHostname: landingHostnameFromUrl(ctx.landingUrl),
      campaignSeedKeyword: ctx.campaignSeedKeyword ?? null,
      offer: ctx.offer,
    },
    plan.campaign_negative_keywords,
  );

  return { ...plan, ad_groups: cleanedAdGroups, campaign_negative_keywords: mergedNeg };
}

/** Fallback sem IA — RSA alinhados com `buildDeterministicRsa`. */
export function buildDeterministicGoogleCampaignPlan(input: DeterministicPlanInput): GoogleCampaignAiPlan {
  const slug = input.offer.split(/\s+/).slice(0, 3).join(" ");
  const primaryLang = input.languageTargets[0] ?? "en";
  const rsa = buildDeterministicRsa(
    {
      landingUrl: input.landingUrl,
      offer: input.offer,
      objective: input.objective,
    },
    primaryLang,
    input.productSignals,
  );
  const seed = input.campaignSeedKeyword?.trim().toLowerCase();
  const isPt = primaryLang.startsWith("pt");
  const coreKeywords: Array<{ text: string; match_type: "exact" | "phrase" | "broad" }> = seed
    ? isPt
      ? [
          { text: seed, match_type: "exact" },
          { text: seed, match_type: "phrase" },
          { text: `comprar ${seed}`.slice(0, 80), match_type: "phrase" },
          { text: `melhor ${seed}`.slice(0, 80), match_type: "phrase" },
          { text: `${seed} preço`.slice(0, 80), match_type: "phrase" },
          { text: `${seed} opiniões`.slice(0, 80), match_type: "phrase" },
          { text: seed, match_type: "broad" },
          { text: `onde comprar ${seed}`.slice(0, 80), match_type: "broad" },
        ]
      : [
          { text: seed, match_type: "exact" },
          { text: seed, match_type: "phrase" },
          { text: `buy ${seed}`.slice(0, 80), match_type: "phrase" },
          { text: `best ${seed}`.slice(0, 80), match_type: "phrase" },
          { text: `${seed} price`.slice(0, 80), match_type: "phrase" },
          { text: `${seed} reviews`.slice(0, 80), match_type: "phrase" },
          { text: seed, match_type: "broad" },
          { text: `where to buy ${seed}`.slice(0, 80), match_type: "broad" },
        ]
    : [
        { text: slug.toLowerCase(), match_type: "exact" as const },
        { text: `buy ${slug}`.toLowerCase(), match_type: "phrase" as const },
        { text: `best ${slug}`.toLowerCase(), match_type: "phrase" as const },
        { text: `${slug} reviews`.toLowerCase(), match_type: "phrase" as const },
        { text: `${slug} official site`.toLowerCase(), match_type: "phrase" as const },
        { text: `${slug} discount`.toLowerCase(), match_type: "broad" as const },
        { text: `where to buy ${slug}`.toLowerCase(), match_type: "broad" as const },
        { text: `${slug} for sale`.toLowerCase(), match_type: "broad" as const },
      ];
  return {
    campaign: {
      name: `${slug} — Search`,
      objective_summary: `${input.objective} for ${input.landingUrl} across ${input.geoTargets.join(", ")}`,
    },
    ad_groups: [
      {
        name: "Core intent",
        keywords: coreKeywords,
        rsa,
      },
    ],
  };
}
