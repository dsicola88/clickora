/**
 * Núcleo partilhado do assistente Google Search (`google-campaign-plan`):
 * SYSTEM_PROMPT, chamada OpenAI e fallback determinístico.
 */
import { buildDeterministicRsa } from "./google-rsa-deterministic";
import type { GoogleCampaignAssetExtensionsStored } from "./google-campaign-asset-extensions";

/** Extensões que a IA pode preencher (parciais são completadas em `finalizeGoogleCampaignAssetExtensions`). */
export type GoogleCampaignAiExtensionsPartial = Partial<GoogleCampaignAssetExtensionsStored>;

export interface GoogleCampaignAiPlan {
  campaign: { name: string; objective_summary: string };
  ad_groups: Array<{
    name: string;
    keywords: Array<{ text: string; match_type: "exact" | "phrase" | "broad" }>;
    rsa: { headlines: string[]; descriptions: string[] };
  }>;
  /** Opcional — sitelinks, callouts e um structured snippet ao nível da campanha. */
  extensions?: GoogleCampaignAiExtensionsPartial;
}

export type DeterministicPlanInput = {
  landingUrl: string;
  offer: string;
  objective: string;
  geoTargets: string[];
  languageTargets: string[];
};

/** Igual ao modelo usado pela API oficial `POST …/google-campaign-plan`. */
export const GOOGLE_SEARCH_CAMPAIGN_AI_SYSTEM_PROMPT = `You are an expert Google Ads Search strategist. Generate a COMPACT, high-quality campaign plan as JSON only.

Rules:
- Return JSON ONLY, matching the schema exactly. No prose, no markdown.
- 2-3 ad groups, each tightly themed.
- 5-10 keywords per ad group across exact/phrase/broad mix.
- RSA: Exactly 12 headlines and 4 descriptions per ad group whenever possible (Google RSA limits: each headline MAX 30 characters including spaces/punctuation — count carefully; each description MAX 90 characters). Headlines must be persuasive and SPECIFIC to the Offer and Landing URL (benefits, outcomes, reassurance, urgency only if truthful). Each headline should ideally use 18-30 characters — avoid bare brand-only headlines, single words, or tepid filler; weave in concrete benefits, differentiators or commercial keywords. Across the 12 headlines, vary the angle: at least one CTA, one benefit, one proof/quality cue, one urgency/availability cue, and one branded headline naming the offer. Do NOT repeat the same stem (e.g. "Try X / Discover X / Buy X / Best X") more than once.
- KEYWORD DENSITY (critical for Google Quality Score): at least 9 of the 12 headlines MUST contain the offer brand/keyword (the exact "Offer" string from the user prompt, or its first 1-2 words). The remaining 2-3 headlines may omit the keyword for variety, but never make them the majority. Never produce a set where the keyword appears in fewer than 9 headlines.
- Descriptions must be full persuasive sentences up to ~90 chars: clear value proposition, proof angle, delivery/trust cues when appropriate; align tightly with the Offer and what the Landing URL actually delivers. At least 2 of the 4 descriptions should mention the offer brand/keyword.
- Promotional claims (price, discount, free shipping, money-back guarantee, free trial, limited stock): include them ONLY if they appear explicitly in the user prompt (Offer or Objective text). NEVER fabricate prices, percentages, time-limits or guarantees that are not provided.
- Keywords must be commercial-intent, not brand-only.
- Never include the user's blocked keywords.

LANGUAGE COMPLIANCE (critical):
- The "Advertising languages" line in the user message lists ISO codes; the FIRST code is the PRIMARY language. Write EVERY headline and EVERY description in that primary language ONLY. Do not mix languages within an ad. Do not switch language across the 12 headlines. The hostname or product brand can stay as-is, but every other word must be in the primary language.
- Use native, idiomatic phrasing — never machine-translated stems. Do NOT use generic SaaS clichés (e.g. "built for teams", "free trial") unless they exactly match the product.

OBJECTIVE HANDLING (critical):
- The "Objective" field is INTERNAL briefing context for the campaign strategist. NEVER copy it verbatim into a headline or description. NEVER prefix any headline/description with internal labels such as "Goal:", "Objetivo:", "Objective:", "Ziel:", "Objectif:", "Briefing:", "Details:".
- Use the Objective only to set tone and intent (e.g. lead-gen, e-commerce, sign-ups). The user-facing copy must read like a polished ad, not a brief.

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
  }
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
  );

  const cleanedAdGroups = (plan.ad_groups ?? []).map((ag) => {
    const headlines = (ag.rsa?.headlines ?? [])
      .map((h) => cleanCopyLine(h, ctx.objective).slice(0, 30))
      .filter((h) => h.length > 0);
    const descriptions = (ag.rsa?.descriptions ?? [])
      .map((d) => cleanCopyLine(d, ctx.objective).slice(0, 90))
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

  return { ...plan, ad_groups: cleanedAdGroups };
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
  );
  return {
    campaign: {
      name: `${slug} — Search`,
      objective_summary: `${input.objective} for ${input.landingUrl} across ${input.geoTargets.join(", ")}`,
    },
    ad_groups: [
      {
        name: "Core intent",
        keywords: [
          { text: slug.toLowerCase(), match_type: "exact" as const },
          { text: `buy ${slug}`.toLowerCase(), match_type: "phrase" as const },
          { text: `best ${slug}`.toLowerCase(), match_type: "phrase" as const },
          { text: `${slug} pricing`.toLowerCase(), match_type: "phrase" as const },
          { text: `${slug} review`.toLowerCase(), match_type: "broad" as const },
        ],
        rsa,
      },
    ],
  };
}
