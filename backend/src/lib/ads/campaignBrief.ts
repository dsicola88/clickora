import { z } from "zod";
import type { KeywordItem } from "../keywordGenerator";
import { safeImportFetch } from "../presellSafeFetch";
import { PresellImportBlockedError } from "../presellImportSsrf";
import type { AdGenerateInput } from "./adBundle";
import { extractProductPageFacts, htmlToPlainText, type PageFact } from "./productPageFacts";

export const AFFILIATE_PLATFORMS = [
  "digistore24",
  "buygoods",
  "hotmart",
  "clickbank",
  "maxweb",
  "smartadv",
  "braip",
  "monetizze",
  "kiwify",
  "other",
] as const;

export const AFFILIATE_PLATFORM_LABELS: Record<(typeof AFFILIATE_PLATFORMS)[number], string> = {
  digistore24: "Digistore24",
  buygoods: "BuyGoods",
  hotmart: "Hotmart",
  clickbank: "ClickBank",
  maxweb: "MaxWeb",
  smartadv: "SmartAdv",
  braip: "Braip",
  monetizze: "Monetizze",
  kiwify: "Kiwify",
  other: "Outra",
};

export const CAMPAIGN_FUNNELS = ["BOTTOM", "MIDDLE", "TOP"] as const;
export type CampaignFunnel = (typeof CAMPAIGN_FUNNELS)[number];

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

export const campaignBriefSchema = z.object({
  product: z.string().trim().min(2).max(200),
  language: z.enum(["en", "pt", "es", "fr", "de", "it"]),
  affiliate_platform: z.enum(AFFILIATE_PLATFORMS),
  product_url: z.string().trim().url().max(2000),
  funnel: z.enum(CAMPAIGN_FUNNELS),
  page_text: z.preprocess(emptyToUndef, z.string().trim().min(40).max(8000).optional()),
});

export type CampaignBrief = z.infer<typeof campaignBriefSchema>;

export class CampaignPageUnavailableError extends Error {
  readonly code = "PAGE_UNAVAILABLE" as const;
  constructor() {
    super(
      "Não foi possível consultar o link do produto. Cole o texto visível da página de vendas para continuar. Nada foi gerado a partir de uma análise simulada.",
    );
    this.name = "CampaignPageUnavailableError";
  }
}

const MARKET_BY_LANGUAGE: Record<CampaignBrief["language"], string> = {
  en: "US",
  pt: "BR",
  es: "MX",
  fr: "FR",
  de: "DE",
  it: "IT",
};

export function marketForLanguage(language: CampaignBrief["language"]): string {
  return MARKET_BY_LANGUAGE[language];
}

export function objectiveForFunnel(funnel: CampaignFunnel): AdGenerateInput["objective"] {
  if (funnel === "MIDDLE") return "comparison";
  if (funnel === "TOP") return "commercial";
  return "purchase";
}

const FUNNEL_INTENTS: Record<CampaignFunnel, Array<KeywordItem["intent"]>> = {
  BOTTOM: ["BUY", "BRAND"],
  MIDDLE: ["COMMERCIAL", "COMPARISON"],
  TOP: ["INFORMATIONAL"],
};

export function keywordsForFunnel(items: KeywordItem[], funnel: CampaignFunnel): KeywordItem[] {
  const allow = new Set(FUNNEL_INTENTS[funnel]);
  return items.filter((item) => item.intent === "NEGATIVE" || allow.has(item.intent));
}

export function adGroupsForFunnel(funnel: CampaignFunnel): Array<{ name: string; intent: string; hint: string }> {
  if (funnel === "BOTTOM") {
    return [
      { name: "Compra", intent: "BUY", hint: "Quem pesquisa para comprar ou encomendar." },
      { name: "Marca", intent: "BRAND", hint: "Quem procura a página ou o nome do produto." },
    ];
  }
  if (funnel === "MIDDLE") {
    return [
      { name: "Avaliação", intent: "COMMERCIAL", hint: "Quem compara ofertas, preço e opiniões." },
      { name: "Comparação", intent: "COMPARISON", hint: "Quem ainda avalia alternativas." },
    ];
  }
  return [{ name: "Descoberta", intent: "INFORMATIONAL", hint: "Quem ainda está a perceber o tema." }];
}

export type CampaignAnalysis = {
  pageStatus: "fetched" | "pasted";
  affiliatePlatform: CampaignBrief["affiliate_platform"];
  affiliatePlatformLabel: string;
  funnel: CampaignFunnel;
  facts: PageFact[];
  missing: string[];
  adGroups: Array<{ name: string; intent: string; hint: string }>;
};

function isHtml(contentType: string | undefined, body: Buffer): boolean {
  if (contentType && /html|xml|text\/plain/i.test(contentType)) return true;
  const start = body.subarray(0, 200).toString("utf8");
  return /<html|<!doctype|<title/i.test(start);
}

async function readPage(url: string): Promise<string> {
  try {
    const res = await safeImportFetch({
      url,
      timeoutMs: 12_000,
      maxBytes: 400_000,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; dclickora-campaign/1.0)",
      },
    });
    if (res.status < 200 || res.status >= 300 || !isHtml(res.contentType, res.body)) {
      throw new CampaignPageUnavailableError();
    }
    const text = htmlToPlainText(res.body.toString("utf8"));
    if (text.length < 40) throw new CampaignPageUnavailableError();
    return res.body.toString("utf8").slice(0, 400_000);
  } catch (error) {
    if (error instanceof CampaignPageUnavailableError) throw error;
    if (error instanceof PresellImportBlockedError) throw new CampaignPageUnavailableError();
    throw new CampaignPageUnavailableError();
  }
}

export async function prepareCampaignInput(brief: CampaignBrief): Promise<{ input: AdGenerateInput; analysis: CampaignAnalysis }> {
  let html = "";
  let pageStatus: CampaignAnalysis["pageStatus"] = "fetched";
  if (brief.page_text) {
    html = brief.page_text;
    pageStatus = "pasted";
  } else {
    html = await readPage(brief.product_url);
  }
  const extracted = extractProductPageFacts(html);
  const input: AdGenerateInput = {
    product: brief.product,
    language: brief.language,
    market: marketForLanguage(brief.language),
    product_url: brief.product_url,
    final_url: brief.product_url,
    platform: "both",
    objective: objectiveForFunnel(brief.funnel),
    funnel: brief.funnel,
    ...(extracted.priceNote ? { price_note: extracted.priceNote } : {}),
    ...(extracted.guaranteeNote ? { guarantee_note: extracted.guaranteeNote } : {}),
    ...(extracted.description ? { description: extracted.description } : {}),
    ...(extracted.promotionPercent
      ? {
          promotion: {
            kind: "percent" as const,
            value: extracted.promotionPercent,
            item: brief.product.slice(0, 40),
            url: brief.product_url,
          },
        }
      : {}),
  };
  return {
    input,
    analysis: {
      pageStatus,
      affiliatePlatform: brief.affiliate_platform,
      affiliatePlatformLabel: AFFILIATE_PLATFORM_LABELS[brief.affiliate_platform],
      funnel: brief.funnel,
      facts: extracted.facts,
      missing: extracted.missing,
      adGroups: adGroupsForFunnel(brief.funnel),
    },
  };
}

export function isCampaignBrief(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && "funnel" in body);
}
