/**
 * Assistente de decisão de palavra-chave (Dopilot Search).
 * Métricas: Google Ads Keyword Ideas quando a conta está ligada; senão modelo estimado.
 */
import { z } from "zod";

import type { PlannerSnapshot } from "./google-keyword-planner";

export const googleKeywordInsightInputSchema = z.object({
  keyword: z.string().trim().min(2).max(80),
  /** País principal (segmentação, copy local, decisão CPC/volume heurístico). */
  countryCode: z.string().length(2).transform((s) => s.toUpperCase()),
  /** Opcional: vários países ISO (máx. 10). Quando enviado, o Keyword Ideas usa todos — como no Planner com várias localizações. */
  countryCodes: z
    .array(z.string().length(2).transform((s) => s.toUpperCase()))
    .max(10)
    .optional(),
  languageCode: z.string().min(2).max(8).transform((s) => s.toLowerCase()),
  userCpcUsd: z.number().positive().max(1000).optional(),
  /** Orçamento diário (USD) do wizard — só entra no motor de decisão / orçamento (dados do projecto autenticado). */
  dailyBudgetUsd: z.number().min(1).max(100_000).optional(),
  /** Cliques alvo/dia do wizard — cruza com orçamento e CPC médio. */
  desiredClicksPerDay: z.number().int().min(1).max(50_000).optional(),
  offerContext: z.string().trim().max(500).optional(),
  /**
   * Janela temporal das métricas no Keyword Ideas (só Google).
   * Se `keywordMetricsRange` existir, tem precedência sobre `keywordMetricsTimeframe`.
   */
  keywordMetricsTimeframe: z.enum(["default", "last_24", "last_36"]).optional(),
  keywordMetricsRange: z
    .object({
      startYear: z.number().int().min(2000).max(2100),
      startMonth: z.number().int().min(1).max(12),
      endYear: z.number().int().min(2000).max(2100),
      endMonth: z.number().int().min(1).max(12),
    })
    .optional(),
})
  .superRefine((val, ctx) => {
    const r = val.keywordMetricsRange;
    if (!r) return;
    const a = r.startYear * 100 + r.startMonth;
    const b = r.endYear * 100 + r.endMonth;
    if (a > b) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Intervalo inválido: início deve ser anterior ou igual ao fim.",
        path: ["keywordMetricsRange"],
      });
    }
    const months = (r.endYear - r.startYear) * 12 + (r.endMonth - r.startMonth);
    if (months > 48) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Intervalo máximo: 48 meses (limite prático alinhado à API).",
        path: ["keywordMetricsRange"],
      });
    }
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    const cur = curY * 100 + curM;
    if (a > cur || b > cur) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Métricas históricas só até ao mês corrente; ajuste início e fim.",
        path: ["keywordMetricsRange"],
      });
    }
  });
export type GoogleKeywordInsightInput = z.infer<typeof googleKeywordInsightInputSchema>;

export const googleKeywordSuggestInputSchema = z.object({
  offer: z.string().trim().min(3).max(500),
  languageCode: z.string().min(2).max(8).transform((s) => s.toLowerCase()),
  landingHostname: z.string().trim().max(200).optional(),
});

export type GoogleKeywordSuggestInput = z.infer<typeof googleKeywordSuggestInputSchema>;

export type KeywordCompetition = "low" | "medium" | "high";

/** Origem das métricas principais (volume/concorrência); CPC pode ser complementado internamente. */
export type KeywordMetricsSource = "estimated" | "google_ads";

export type KeywordDecisionStatus = "recommended" | "caution" | "avoid";

/** Camada de decisão: transforma métricas em acção (sem estado partilhado entre tenants — usa só o input deste pedido). */
export type KeywordDecisionLayer = {
  keyword_score: number;
  score_breakdown_pt: Array<{ text: string; tone: "positive" | "warning" | "neutral" }>;
  decision_status: KeywordDecisionStatus;
  decision_label_pt: string;
  next_action_pt: string;
  budget_insight_pt: string | null;
};

/** Ponto da série de volume (mensal vindo da API ou sintético). */
export type KeywordVolumeTrendPoint = {
  year: number;
  month: number;
  /** Reservado — o servidor envia null; granularidade diária é derivada no cliente. */
  day: number | null;
  volume: number;
};

export type KeywordVolumeTrend = {
  points: KeywordVolumeTrendPoint[];
  point_source: "google_monthly" | "synthetic_from_average" | "estimated_model";
  disclaimer_pt: string;
};

export type GoogleKeywordInsightOk = {
  ok: true;
  keyword: string;
  country_code: string;
  language_code: string;
  monthly_search_volume: number;
  avg_cpc_usd: number;
  competition: KeywordCompetition;
  competition_label_pt: string;
  analysis_bullets_pt: string[];
  related_keywords: string[];
  user_cpc_verdict_pt: string | null;
  user_cpc_status: "below" | "competitive" | "above" | null;
  data_provenance_pt: string;
  generated_at: string;
  local_cpc_display: { amount: number; suffix: string; disclaimer_pt: string } | null;
  metrics_source: KeywordMetricsSource;
  /** Se false, o CPC médio mostrado foi preenchido por heurística (a API não devolveu averageCpc). */
  cpc_from_google_ads: boolean;
  decision: KeywordDecisionLayer;
  /** Série temporal para o gráfico (mensal na API; diário = granularidade derivada no cliente). */
  volume_trend: KeywordVolumeTrend;
};

function fnv1a32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function countryVolumeFactor(iso: string): { factor: number; label: string } {
  const tier1 = new Set([
    "US",
    "GB",
    "DE",
    "FR",
    "CA",
    "AU",
    "JP",
    "IN",
    "BR",
    "MX",
    "IT",
    "ES",
  ]);
  const tier2 = new Set(["PT", "NL", "BE", "CH", "AT", "SE", "NO", "PL", "NZ", "IE", "SG"]);
  if (tier1.has(iso)) return { factor: 2.6, label: "mercado elevado" };
  if (tier2.has(iso)) return { factor: 1.35, label: "mercado médio-alto" };
  if (iso === "AO" || iso === "MZ" || iso === "CV" || iso === "GW" || iso === "ST" || iso === "TL") {
    return { factor: 0.55, label: "mercado lusófono regional" };
  }
  return { factor: 0.85, label: "mercado médio" };
}

const HIGH_INTENT = /\b(compr|buy|best|melhor|pre[cç]o|cheap|barat|where|onde|review|cupom|discount|descont)\b/i;

function scoreCompetition(keyword: string, wordCount: number): KeywordCompetition {
  const k = keyword.toLowerCase();
  let score = 0;
  if (wordCount <= 2) score += 2;
  else if (wordCount <= 4) score += 1;
  if (HIGH_INTENT.test(k)) score += 1;
  if (k.length <= 12) score += 1;
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function competitionLabelPt(c: KeywordCompetition): string {
  if (c === "high") return "Alta";
  if (c === "medium") return "Média";
  return "Baixa";
}

function roundNice(n: number): number {
  if (n < 500) return Math.round(n / 50) * 50;
  if (n < 5000) return Math.round(n / 100) * 100;
  if (n < 20000) return Math.round(n / 500) * 500;
  return Math.round(n / 1000) * 1000;
}

function baseCpcUsd(comp: KeywordCompetition, iso: string): number {
  const { factor } = countryVolumeFactor(iso);
  const market = factor >= 2 ? 1.15 : factor >= 1.2 ? 0.95 : 0.55;
  if (comp === "high") return 0.55 * market + 0.85 * Math.min(factor, 2) * 0.25;
  if (comp === "medium") return 0.32 * market + 0.45 * Math.min(factor, 2) * 0.18;
  return 0.18 * market + 0.22 * Math.min(factor, 2) * 0.12;
}

function jitter(seed: number, lo: number, hi: number): number {
  const x = (seed % 10_000) / 10_000;
  return lo + (hi - lo) * x;
}

function localDisplay(
  iso: string,
  cpcUsd: number,
  seed: number,
): { amount: number; suffix: string; disclaimer_pt: string } | null {
  if (iso === "AO") {
    const aoaPerUsd = 850 + (seed % 80);
    const amt = Math.max(50, Math.round(cpcUsd * aoaPerUsd));
    return {
      amount: amt,
      suffix: "Kz",
      disclaimer_pt:
        "Valor aproximado em kwanzas (taxa de referência interna só para leitura; não é cotação oficial).",
    };
  }
  if (iso === "BR") {
    const brl = 5.2 + jitter(seed, -0.2, 0.2);
    const amt = Math.max(0.5, Math.round(cpcUsd * brl * 100) / 100);
    return {
      amount: amt,
      suffix: "R$",
      disclaimer_pt: "CPC aproximado em reais (taxa de referência interna).",
    };
  }
  if (iso === "PT") {
    const eur = 0.92 + jitter(seed + 1, -0.03, 0.03);
    const amt = Math.max(0.05, Math.round(cpcUsd * eur * 100) / 100);
    return {
      amount: amt,
      suffix: "€",
      disclaimer_pt: "CPC aproximado em euros (taxa de referência interna).",
    };
  }
  return null;
}

function compareUserCpc(user: number, market: number): { status: "below" | "competitive" | "above"; pt: string } {
  const ratio = user / market;
  if (ratio < 0.72) {
    return {
      status: "below",
      pt: "O teu CPC está abaixo do estimado para esta palavra-chave — podes ter menos impressões/cliques do que esperas. Considera subir o lance ou rever cliques alvo.",
    };
  }
  if (ratio > 1.28) {
    return {
      status: "above",
      pt: "O teu CPC está acima da estimativa média — boas hipóteses de ganhar leilão, mas vigia o retorno e o orçamento diário.",
    };
  }
  return {
    status: "competitive",
    pt: "O teu CPC alinha-se com a faixa estimada — bom ponto de partida para testar a palavra-chave.",
  };
}

/**
 * Motor de decisão final: score 0–100, estado e próxima acção.
 * Stateless e determinístico — adequado a multi-tenant (só consome números deste request).
 */
export function generateKeywordDecision(input: {
  monthly_volume: number;
  avg_cpc_usd: number;
  competition: KeywordCompetition;
  user_cpc_usd: number | null;
  daily_budget_usd: number | null;
  desired_clicks_per_day: number | null;
  metrics_source: KeywordMetricsSource;
  local_cpc: { amount: number; suffix: string } | null;
}): KeywordDecisionLayer {
  const { monthly_volume: vol, avg_cpc_usd: market, competition: comp } = input;
  const userC = input.user_cpc_usd;
  const budget = input.daily_budget_usd;
  const wantClicks = input.desired_clicks_per_day;
  const { metrics_source } = input;

  const breakdown: KeywordDecisionLayer["score_breakdown_pt"] = [];

  /** Bónus pequeno para reflectir maior confiança nas métricas; permite atingir ~100 no melhor caso. */
  let sourceTrustPts = 0;
  if (metrics_source === "google_ads") {
    sourceTrustPts = 5;
    breakdown.push({
      text: "Volume e concorrência vêm do Google Ads (oficial) para este pedido.",
      tone: "positive",
    });
  } else {
    breakdown.push({
      text: "Volume e concorrência são estimativa inteligente — liga a conta ao projeto para dados oficiais.",
      tone: "neutral",
    });
  }

  let demandPts = 0;
  if (vol >= 15_000) {
    demandPts = 40;
    breakdown.push({ text: "Boa procura de pesquisa (volume elevado).", tone: "positive" });
  } else if (vol >= 8000) {
    demandPts = 34;
    breakdown.push({ text: "Procura sólida.", tone: "positive" });
  } else if (vol >= 3000) {
    demandPts = 28;
    breakdown.push({ text: "Procura moderada.", tone: "neutral" });
  } else if (vol >= 800) {
    demandPts = 18;
    breakdown.push({ text: "Procura limitada — nicho ou mercado menor.", tone: "warning" });
  } else {
    demandPts = 10;
    breakdown.push({ text: "Volume baixo — cuidado com expectativas de tráfego.", tone: "warning" });
  }

  let compPts = 0;
  if (comp === "low") {
    compPts = 25;
    breakdown.push({ text: "Concorrência mais baixa (oportunidade de destacar).", tone: "positive" });
  } else if (comp === "medium") {
    compPts = 15;
    breakdown.push({ text: "Concorrência moderada.", tone: "neutral" });
  } else {
    compPts = 7;
    breakdown.push({ text: "Concorrência alta — anúncios e lances têm de ser fortes.", tone: "warning" });
  }

  let cpcPts = 15;
  let ratio = 1;
  if (userC != null && market > 0) {
    ratio = userC / market;
    if (ratio >= 0.85 && ratio <= 1.15) {
      cpcPts = 20;
      breakdown.push({ text: "CPC do plano alinhado com o mercado para esta keyword.", tone: "positive" });
    } else if (ratio < 0.72) {
      cpcPts = 6;
      breakdown.push({ text: "CPC do plano abaixo do típico — risco de poucos cliques.", tone: "warning" });
    } else if (ratio < 0.85) {
      cpcPts = 12;
      breakdown.push({ text: "CPC do plano um pouco abaixo da média.", tone: "neutral" });
    } else if (ratio <= 1.35) {
      cpcPts = 17;
      breakdown.push({ text: "CPC do plano razoável (ligeiramente acima da média).", tone: "neutral" });
    } else {
      cpcPts = 14;
      breakdown.push({ text: "CPC do plano alto face à média — gasto por clique pode subir.", tone: "warning" });
    }
  } else {
    breakdown.push({
      text: "Preenche orçamento e cliques alvo para calcular o CPC do plano e comparar com o mercado.",
      tone: "neutral",
    });
  }

  let budgetPts = 10;
  let clicksAtMarket: number | null = null;
  let neededBudget: number | null = null;

  if (budget != null && budget > 0 && market > 0) {
    clicksAtMarket = budget / market;
    if (wantClicks != null && wantClicks > 0) {
      neededBudget = wantClicks * market;
      const frac = clicksAtMarket / wantClicks;
      /** Limiares alinhados com `budgetBlock` / `budgetTight` (evitar só cenários muito défice). */
      if (frac < 0.4) {
        budgetPts = 2;
        breakdown.push({
          text: `Com o orçamento diário actual, cabem ~${Math.max(0, Math.floor(clicksAtMarket))} cliques/dia ao CPC médio — muito abaixo da meta de ${wantClicks}.`,
          tone: "warning",
        });
      } else if (frac < 0.88) {
        budgetPts = 6;
        breakdown.push({
          text: `O orçamento permite ~${Math.floor(clicksAtMarket)} cliques/dia; a meta é ${wantClicks} — ainda apertado.`,
          tone: "warning",
        });
      } else {
        budgetPts = 10;
        breakdown.push({
          text: `Orçamento compatível com ~${Math.floor(clicksAtMarket)} cliques/dia ao CPC médio (meta ${wantClicks}).`,
          tone: "positive",
        });
      }
    } else {
      budgetPts = clicksAtMarket >= 5 ? 10 : clicksAtMarket >= 2 ? 7 : 5;
      breakdown.push({
        text: `À volta de ${Math.max(0, Math.floor(clicksAtMarket!))} cliques/dia cabem no orçamento ao CPC médio (ordem de grandeza).`,
        tone: clicksAtMarket >= 3 ? "neutral" : "warning",
      });
    }
  } else {
    breakdown.push({
      text: "Preenche orçamento diário no formulário para fechar o plano com números de cliques.",
      tone: "neutral",
    });
  }

  let rawScore = demandPts + compPts + cpcPts + budgetPts + sourceTrustPts;
  if (comp === "high" && vol < 1500) rawScore -= 8;
  if (userC != null && market > 0 && ratio < 0.6 && comp === "high") rawScore -= 10;
  const keyword_score = Math.max(0, Math.min(100, Math.round(rawScore)));

  /** Evitar: orçamento cobre < ~35% dos cliques desejados ao CPC médio (cenário francamente inviável). */
  const budgetBlock =
    budget != null &&
    market > 0 &&
    wantClicks != null &&
    wantClicks > 0 &&
    budget / market < wantClicks * 0.35;

  /** Cautela: ainda falta margem face à meta (< ~88% dos cliques), mas não tão grave quanto `budgetBlock`. */
  const budgetTight =
    budget != null &&
    market > 0 &&
    wantClicks != null &&
    wantClicks > 0 &&
    clicksAtMarket != null &&
    clicksAtMarket < wantClicks * 0.88;

  const cpcBlock =
    userC != null && market > 0 && ratio < 0.58 && (comp === "high" || comp === "medium");

  let decision_status: KeywordDecisionStatus;
  if (keyword_score < 38 || budgetBlock) {
    decision_status = "avoid";
  } else if (keyword_score < 66 || budgetTight || cpcBlock) {
    decision_status = "caution";
  } else {
    decision_status = "recommended";
  }

  let decision_label_pt: string;
  if (decision_status === "recommended") {
    decision_label_pt = "Recomendado usar esta keyword";
  } else if (decision_status === "caution") {
    decision_label_pt = "Usar com cautela";
  } else {
    decision_label_pt = "Não recomendado com este orçamento / lance";
  }

  const suggestedCpcUsd = market > 0 ? Math.round(market * 0.95 * 100) / 100 : 0;
  let localHint = "";
  if (input.local_cpc && suggestedCpcUsd > 0 && market > 0) {
    const scale = input.local_cpc.amount / market;
    const locAmt = Math.max(1, Math.round(suggestedCpcUsd * scale));
    localHint = ` (~${new Intl.NumberFormat("pt-PT").format(locAmt)} ${input.local_cpc.suffix})`;
  }

  let next_action_pt: string;
  if (decision_status === "recommended") {
    next_action_pt =
      "Avança: aplica esta keyword ao plano, gera os anúncios e rever CTR nas primeiras 48–72 h.";
  } else if (decision_status === "caution") {
    next_action_pt =
      market > 0 && userC != null && ratio < 0.85
        ? `Sobe o CPC indicativo para ~$${suggestedCpcUsd.toFixed(2)}${localHint}, ou testa uma variação long-tail menos genérica.`
        : "Ajusta orçamento ou cliques alvo, ou escolhe keyword com menos concorrência antes de escalar.";
  } else {
    next_action_pt =
      neededBudget != null && budget != null && wantClicks != null && wantClicks > 0 && neededBudget > budget
        ? `Para ~${wantClicks} cliques/dia ao CPC médio, o orçamento diário deveria rondar ~$${Math.ceil(neededBudget)} USD (tens $${Math.round(budget)}). Alternativa: keyword menos competitiva ou menos cliques alvo.`
        : market > 0 && userC != null && ratio < 0.72
          ? `Não é provável ganhares leilão com o CPC actual; tenta ~$${suggestedCpcUsd.toFixed(2)}${localHint} ou muda de keyword.`
          : "Considera aumentar orçamento, subir o CPC do plano ou escolher outra palavra-chave antes de investir.";
  }

  let budget_insight_pt: string | null = null;
  if (budget != null && market > 0) {
    const c = Math.max(0, Math.floor(budget / market));
    budget_insight_pt = `Com orçamento diário de $${Number(budget.toFixed(2))} USD e CPC médio ~$${market.toFixed(2)}, cabem por volta de ${c} cliques/dia (estimativa).`;
    if (wantClicks != null && wantClicks > 0) {
      if (c < wantClicks) {
        budget_insight_pt += ` A meta de ${wantClicks} cliques/dia exige mais orçamento ou CPC mais baixo (ex.: long-tail).`;
      }
    }
  }

  return {
    keyword_score,
    score_breakdown_pt: breakdown,
    decision_status,
    decision_label_pt,
    next_action_pt,
    budget_insight_pt,
  };
}

function geoContextLine(iso: string): string {
  const { label } = countryVolumeFactor(iso);
  return `País ${iso} — ${label}.`;
}

function analysisBullets(vol: number, comp: KeywordCompetition, iso: string): string[] {
  const bullets: string[] = [];
  if (vol >= 8000) {
    bullets.push("Volume mensal estimado elevado — há procura de pesquisa para este tema.");
  } else if (vol >= 1500) {
    bullets.push("Volume mensal estimado moderado — nicho pode ser trabalhável com boa relevância do anúncio.");
  } else {
    bullets.push("Volume mensal estimado mais baixo — pode ser nicho específico ou mercado com menos dados públicos.");
  }

  if (comp === "high") {
    bullets.push("Concorrência estimada alta — licitações e qualidade do anúncio importam muito.");
  } else if (comp === "medium") {
    bullets.push("Concorrência estimada média — equilíbrio razoável entre custo e oportunidade.");
  } else {
    bullets.push("Concorrência estimada mais baixa — pode ser mais fácil destacar-se, mas valida sempre intenção comercial.");
  }

  bullets.push(geoContextLine(iso));
  if (comp === "high" && vol >= 5000) {
    bullets.push("Sugestão: testa variações long-tail mais específicas para reduzir CPC e melhorar taxa de clique.");
  }
  return bullets;
}

function analysisBulletsGoogle(vol: number, comp: KeywordCompetition, iso: string): string[] {
  const bullets: string[] = [];
  if (vol >= 8000) {
    bullets.push("Volume mensal segundo o Google (média 12 meses) — forte interesse de pesquisa.");
  } else if (vol >= 1500) {
    bullets.push("Volume mensal segundo o Google — nível moderado; combina com criativos relevantes.");
  } else if (vol > 0) {
    bullets.push("Volume mensal segundo o Google — mais baixo; pode ser nicho específico ou dados limitados.");
  } else {
    bullets.push("Volume: Google não reportou pesquisas médias para este critério — interpreta com cautela.");
  }

  if (comp === "high") {
    bullets.push("Concorrência (nível Google): alta.");
  } else if (comp === "medium") {
    bullets.push("Concorrência (nível Google): média.");
  } else {
    bullets.push("Concorrência (nível Google): baixa.");
  }
  bullets.push(geoContextLine(iso));
  if (comp === "high" && vol >= 5000) {
    bullets.push("Sugestão: testa variações long-tail para diluir CPC e melhorar relevância.");
  }
  return bullets;
}

function sortVolumePoints(pts: KeywordVolumeTrendPoint[]): KeywordVolumeTrendPoint[] {
  return [...pts].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    const da = a.day ?? 0;
    const db = b.day ?? 0;
    return da - db;
  });
}

function buildSyntheticMonthlyFromAverage(
  avgMonthly: number,
  monthsBack: number,
  seed: number,
): KeywordVolumeTrendPoint[] {
  const out: KeywordVolumeTrendPoint[] = [];
  const now = new Date();
  const base = Math.max(1, avgMonthly);
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const j = jitter(seed + i * 97, 0.88, 1.14);
    const seasonal = 1 + 0.08 * Math.sin(((monthsBack - 1 - i) / 12) * Math.PI * 2);
    const v = Math.max(0, Math.round(base * j * seasonal));
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1, day: null, volume: v });
  }
  return sortVolumePoints(out);
}

function buildKeywordVolumeTrend(args: {
  monthlyAvg: number;
  planner: PlannerSnapshot | null;
  metrics_source: KeywordMetricsSource;
  seed: number;
}): KeywordVolumeTrend {
  const { monthlyAvg, planner, metrics_source, seed } = args;
  const safeAvg = Math.max(0, monthlyAvg);

  if (planner != null && planner.monthly_search_volumes.length > 0) {
    const pts: KeywordVolumeTrendPoint[] = planner.monthly_search_volumes.map((r) => ({
      year: r.year,
      month: r.month,
      day: null,
      volume: Math.max(0, Math.round(r.monthly_searches)),
    }));
    return {
      points: sortVolumePoints(pts),
      point_source: "google_monthly",
      disclaimer_pt:
        "Valores mensais segundo o Google Ads (Keyword Ideas). Podem diferir da média exibida para o conjunto do período.",
    };
  }

  if (metrics_source === "google_ads") {
    return {
      points: buildSyntheticMonthlyFromAverage(safeAvg > 0 ? safeAvg : 100, 12, seed),
      point_source: "synthetic_from_average",
      disclaimer_pt:
        "A API não devolveu histórico mês a mês — a curva foi repartida a partir da média mensal (apenas para leitura visual).",
    };
  }

  const base = safeAvg > 0 ? safeAvg : 500;
  return {
    points: buildSyntheticMonthlyFromAverage(base, 24, seed + 11),
    point_source: "estimated_model",
    disclaimer_pt: "Tendência gerada pelo modelo interno. Ligue a conta Google Ads ao projeto para dados oficiais.",
  };
}

function keywordMetricsTemporalNotePt(input: GoogleKeywordInsightInput): string {
  const r = input.keywordMetricsRange;
  if (r) {
    const sm = String(r.startMonth).padStart(2, "0");
    const em = String(r.endMonth).padStart(2, "0");
    return ` Janela temporal: intervalo personalizado (${r.startYear}-${sm} a ${r.endYear}-${em}) pedido à API Google.`;
  }
  if (input.keywordMetricsTimeframe === "last_24") {
    return " Janela temporal: últimos 24 meses até ao mês corrente (pedido explícito à API).";
  }
  if (input.keywordMetricsTimeframe === "last_36") {
    return " Janela temporal: últimos 36 meses até ao mês corrente (pedido explícito à API).";
  }
  return " Janela temporal: predefinição da API (~12 meses em média). Para outro período — como no Keyword Planner — use 24/36 meses ou intervalo personalizado (até 48 meses).";
}

export async function runGoogleKeywordInsight(
  raw: GoogleKeywordInsightInput,
  opts?: { planner?: PlannerSnapshot | null },
): Promise<GoogleKeywordInsightOk> {
  const input = googleKeywordInsightInputSchema.parse(raw);
  const kw = input.keyword.trim();
  const iso = input.countryCode;
  const words = kw.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const seed = fnv1a32(`${kw.toLowerCase()}\n${iso}`);
  const planner = opts?.planner ?? null;

  let monthly: number;
  let comp: KeywordCompetition;
  let avgCpcUsd: number;
  let metrics_source: KeywordMetricsSource;
  let cpc_from_google_ads: boolean;
  let dataNote: string;

  if (planner) {
    monthly = planner.monthly_volume;
    comp = planner.competition;
    metrics_source = "google_ads";
    if (planner.avg_cpc_units > 0) {
      avgCpcUsd = planner.avg_cpc_units;
      cpc_from_google_ads = true;
      dataNote =
        "Volume e concorrência: Google Ads API (Keyword Ideas), conta ligada ao projeto — não usamos Semrush nem terceiros para estes números. CPC médio: dados da API (moeda da conta Google). Variações de keywords: IA/heurística.";
    } else {
      cpc_from_google_ads = false;
      avgCpcUsd =
        Math.round(
          (baseCpcUsd(comp, iso) * jitter(seed + 17, 0.85, 1.15) + Number.EPSILON) * 100,
        ) / 100;
      dataNote =
        "Volume e concorrência: Google Ads (Keyword Ideas); CPC completado por modelo interno quando a API não devolve averageCpc — sem Semrush. Variações de keywords: IA/heurística.";
    }
  } else {
    const compHeur = scoreCompetition(kw, wc);
    comp = compHeur;
    const { factor, label: geoLabel } = countryVolumeFactor(iso);
    const volRaw =
      400 +
      jitter(seed, 0.25, 0.95) *
        12_000 *
        factor *
        (comp === "high" ? 1.35 : comp === "medium" ? 1.05 : 0.78) *
        Math.min(1.4, 1 + wc * 0.07);
    monthly = Math.max(120, roundNice(volRaw));
    avgCpcUsd =
      Math.round((baseCpcUsd(comp, iso) * jitter(seed + 17, 0.85, 1.15) + Number.EPSILON) * 100) / 100;
    metrics_source = "estimated";
    cpc_from_google_ads = false;
    dataNote =
      "Dados estimados por modelo interno (sem Keyword Ideas neste pedido — liga Google Ads ao projeto para métricas oficiais). Não usamos Semrush nem outros fornecedores externos para estes números. Variações: IA/heurística quando disponível.";
  }

  if (metrics_source === "google_ads") {
    dataNote += keywordMetricsTemporalNotePt(input);
  }

  const multiGeo =
    planner != null && input.countryCodes != null && input.countryCodes.length > 1;
  if (multiGeo) {
    const list = [...new Set(input.countryCodes!.map((c) => c.toUpperCase()))].join(", ");
    dataNote += ` Métricas agregadas para ${input.countryCodes!.length} países (${list}), como no Planner com várias localizações.`;
  }

  let user_cpc_verdict_pt: string | null = null;
  let user_cpc_status: "below" | "competitive" | "above" | null = null;
  if (input.userCpcUsd != null && avgCpcUsd > 0) {
    const cmp = compareUserCpc(input.userCpcUsd, avgCpcUsd);
    user_cpc_verdict_pt = cmp.pt;
    user_cpc_status = cmp.status;
  }

  let related = heuristicRelatedKeywords(kw, input.languageCode, 5);
  if (process.env.OPENAI_API_KEY) {
    const llm = await fetchRelatedKeywordsLlm(kw, iso, input.languageCode, input.offerContext);
    if (llm.length) {
      related = [...new Set([...llm, ...related])].slice(0, 8);
      if (metrics_source === "estimated") {
        dataNote =
          "Estimativas internas + sugestões de variações assistidas por IA. Métricas permanecem indicativas até ligares Google Ads.";
      } else {
        dataNote += " Sugestões de variações refinadas com IA.";
      }
    }
  }

  const local = localDisplay(iso, avgCpcUsd, seed);
  const bullets =
    metrics_source === "google_ads"
      ? analysisBulletsGoogle(monthly, comp, iso)
      : analysisBullets(monthly, comp, iso);

  const decision = generateKeywordDecision({
    monthly_volume: monthly,
    avg_cpc_usd: avgCpcUsd,
    competition: comp,
    user_cpc_usd: input.userCpcUsd ?? null,
    daily_budget_usd: input.dailyBudgetUsd ?? null,
    desired_clicks_per_day: input.desiredClicksPerDay ?? null,
    metrics_source,
    local_cpc: local ? { amount: local.amount, suffix: local.suffix } : null,
  });

  const volume_trend = buildKeywordVolumeTrend({
    monthlyAvg: monthly,
    planner,
    metrics_source,
    seed,
  });

  return {
    ok: true,
    keyword: kw,
    country_code: iso,
    language_code: input.languageCode,
    monthly_search_volume: monthly,
    avg_cpc_usd: avgCpcUsd,
    competition: comp,
    competition_label_pt: competitionLabelPt(comp),
    analysis_bullets_pt: bullets,
    related_keywords: related,
    user_cpc_verdict_pt,
    user_cpc_status,
    data_provenance_pt: dataNote,
    generated_at: new Date().toISOString(),
    local_cpc_display: local,
    metrics_source,
    cpc_from_google_ads,
    decision,
    volume_trend,
  };
}

function heuristicRelatedKeywords(keyword: string, lang: string, max: number): string[] {
  const k = keyword.trim().toLowerCase();
  const out: string[] = [];
  const isPt = lang.startsWith("pt");
  if (isPt) {
    if (!k.includes("comprar")) out.push(`comprar ${k}`);
    if (!k.includes("melhor")) out.push(`melhor ${k}`);
    out.push(`${k} em casa`.slice(0, 80));
    out.push(`${k} natural`.slice(0, 80));
    out.push(`como escolher ${k}`.slice(0, 80));
  } else {
    if (!k.includes("buy")) out.push(`buy ${k}`);
    out.push(`${k} online`.slice(0, 80));
    out.push(`best ${k}`.slice(0, 80));
    out.push(`cheap ${k}`.slice(0, 80));
  }
  return [...new Set(out.map((s) => s.replace(/\s+/g, " ").trim()))]
    .filter((s) => s.length > 2 && s !== k)
    .slice(0, max);
}

async function fetchRelatedKeywordsLlm(
  keyword: string,
  country: string,
  lang: string,
  offerContext?: string,
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];
  const ctx = offerContext ? `\nContext (offer): ${offerContext.slice(0, 400)}` : "";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'Return JSON only: {"keywords": string[]} — 5 to 7 search keyword variations (long-tail where useful), same language as the user keyword context, lowercase where natural, no duplicates, max 80 chars each. No markdown.',
        },
        {
          role: "user",
          content: `Country: ${country}. Language code: ${lang}. Primary keyword: ${keyword}.${ctx}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  try {
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { keywords?: unknown };
    if (!Array.isArray(parsed.keywords)) return [];
    return parsed.keywords
      .map((x) => String(x).trim())
      .filter((s) => s.length >= 3 && s.length <= 80)
      .slice(0, 7);
  } catch {
    return [];
  }
}

export function runKeywordSuggestionsHeuristic(raw: GoogleKeywordSuggestInput): string[] {
  const { offer, languageCode } = googleKeywordSuggestInputSchema.parse(raw);
  const t = offer.replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim();
  const chunks = t
    .split(/[.;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
  const head = chunks[0] ?? t;
  const words = head.split(/\s+/).filter((w) => w.length > 1);
  const out: string[] = [];
  const take = (n: number) =>
    words
      .slice(0, n)
      .join(" ")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim();
  if (words.length >= 3) out.push(take(4));
  if (words.length >= 5) out.push(take(6));
  if (words.length >= 2) out.push(take(3));
  const joined = words.slice(0, 8).join(" ").toLowerCase();
  if (languageCode.startsWith("pt")) {
    if (joined.length > 6) out.push(`${joined.split(/\s+/).slice(0, 3).join(" ")} preço`);
  }
  return [...new Set(out.map((s) => s.replace(/\s+/g, " ").trim()))].filter((s) => s.length >= 3).slice(0, 6);
}

export async function runGoogleKeywordSuggest(raw: GoogleKeywordSuggestInput): Promise<{ suggestions: string[] }> {
  const input = googleKeywordSuggestInputSchema.parse(raw);
  let list = runKeywordSuggestionsHeuristic(input);
  if (process.env.OPENAI_API_KEY) {
    const extra = await fetchOfferSeedKeywordsLlm(input.offer, input.languageCode, input.landingHostname);
    if (extra.length) {
      list = [...new Set([...extra, ...list])].slice(0, 8);
    }
  }
  return { suggestions: list };
}

async function fetchOfferSeedKeywordsLlm(offer: string, lang: string, host?: string): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'Return JSON only: {"keywords": string[]} — 4 to 6 Google Search keyword ideas a user might bid on, commercial intent, matching the offer, in the language indicated by lang code. Lowercase phrases, 3-60 chars, no brand names unless in offer. No markdown.',
        },
        {
          role: "user",
          content: `lang=${lang}\nhost=${host ?? ""}\nOffer:\n${offer.slice(0, 480)}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  try {
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { keywords?: unknown };
    if (!Array.isArray(parsed.keywords)) return [];
    return parsed.keywords
      .map((x) => String(x).trim())
      .filter((s) => s.length >= 3 && s.length <= 80)
      .slice(0, 6);
  } catch {
    return [];
  }
}
