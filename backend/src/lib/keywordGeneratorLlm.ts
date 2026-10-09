import {
  buildDeterministicKeywords,
  keywordGenerateSystemPrompt,
  keywordGenerateUserPrompt,
  parseLlmKeywordPayload,
  type KeywordGenerateInput,
  type KeywordItem,
  type KeywordLanguageCode,
  marketName,
} from "./keywordGenerator";

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const OG_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const OG_RE_REV = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fetch real page title if URL is public http(s). Failures are ignored — never fake analysis. */
export async function fetchPublicPageTitle(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  try {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; dclickora-keyword-gen/1.0)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") || "";
    if (ctype && !/html|xml|text\/plain/i.test(ctype)) return null;
    const html = (await res.text()).slice(0, 80_000);
    const og = html.match(OG_RE)?.[1] || html.match(OG_RE_REV)?.[1];
    const title = og || html.match(TITLE_RE)?.[1];
    if (!title) return null;
    const clean = decodeEntities(title).slice(0, 240);
    return clean.length >= 3 ? clean : null;
  } catch {
    return null;
  }
}

async function fetchOpenAiKeywords(args: {
  product: string;
  language: KeywordLanguageCode;
  market: string;
  marketName: string;
  productUrl?: string;
  urlTitle?: string | null;
}): Promise<KeywordItem[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: keywordGenerateSystemPrompt() },
        { role: "user", content: keywordGenerateUserPrompt(args) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseLlmKeywordPayload(json.choices?.[0]?.message?.content ?? "{}");
}

export async function generateKeywordsForInput(input: KeywordGenerateInput): Promise<{
  keywords: KeywordItem[];
  urlTitle: string | null;
  source: "llm" | "deterministic";
  llmFailed: boolean;
}> {
  const urlTitle = input.product_url ? await fetchPublicPageTitle(input.product_url) : null;
  const ctx = {
    product: input.product,
    language: input.language,
    market: input.market,
    marketName: marketName(input.market),
    productUrl: input.product_url,
    urlTitle,
  };
  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      const keywords = await fetchOpenAiKeywords(ctx);
      return { keywords, urlTitle, source: "llm", llmFailed: false };
    } catch {
      const keywords = buildDeterministicKeywords(input.product, input.language);
      if (keywords.length < 8) {
        throw new Error("Não encontramos sugestões suficientes. Tente outro produto ou nicho.");
      }
      return { keywords, urlTitle, source: "deterministic", llmFailed: true };
    }
  }
  const keywords = buildDeterministicKeywords(input.product, input.language);
  if (keywords.length < 8) {
    throw new Error("Não encontramos sugestões suficientes. Tente outro produto ou nicho.");
  }
  return { keywords, urlTitle, source: "deterministic", llmFailed: false };
}
