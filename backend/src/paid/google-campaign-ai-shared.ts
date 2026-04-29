/**
 * Núcleo partilhado entre o backend Clickora (`google-campaign-plan`) e o embed dpiloto (`ai-plan.functions`):
 * um único SYSTEM_PROMPT, uma chamada OpenAI e o fallback determinístico — evita drift de copy/stratagem entre stacks.
 *
 * Persistência da campanha (Prisma paid vs paidAds*) continua separada por produto.
 */
import { buildDeterministicRsa } from "./google-rsa-deterministic";

export interface GoogleCampaignAiPlan {
  campaign: { name: string; objective_summary: string };
  ad_groups: Array<{
    name: string;
    keywords: Array<{ text: string; match_type: "exact" | "phrase" | "broad" }>;
    rsa: { headlines: string[]; descriptions: string[] };
  }>;
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
- RSA: Exactly 12 headlines and 4 descriptions per ad group whenever possible (Google RSA limits: each headline MAX 30 characters including spaces/punctuation — count carefully; each description MAX 90 characters). Headlines must be persuasive and SPECIFIC to the Offer and Landing URL (benefits, outcomes, reassurance, urgency only if truthful). Prefer headlines that use almost the full 30-character budget — avoid tepid micro-copy like single words or obvious filler; weave in product-relevant phrases and commercial keywords where natural.
- Descriptions must be full persuasive sentences up to ~90 chars: clear value proposition, proof angle, delivery/trust cues when appropriate; align tightly with Objective and Offer.
- Keywords must be commercial-intent, not brand-only.
- Never include the user's blocked keywords.
- RSA copy (headlines + descriptions): write EVERY string in the user's advertising languages given in the prompt (ISO codes; primary language first). Use native, idiomatic phrasing — one language per string; do not mix unrelated languages in the same headline/description. Do NOT use generic SaaS phrases (e.g. "built for teams", "free trial") unless they exactly match the product.

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
