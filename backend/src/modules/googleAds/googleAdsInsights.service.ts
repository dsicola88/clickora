import { GoogleAdsApi } from "google-ads-api";
import type { User } from "@prisma/client";
import {
  buildGoogleAdsCredentialsForUser,
  formatGaqlDate,
  getGoogleAdsReportingUnavailability,
  type GoogleAdsReportingUnavailableCode,
  type GoogleAdsUserSettings,
} from "./googleAds.service";
import { humanizeGoogleAdsApiError } from "./googleAdsApiErrors";

const DIGITS_ONLY = /^\d+$/;

function onlyDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

function genderTypeLabel(t: unknown): string {
  const n = typeof t === "number" ? t : Number(t);
  switch (n) {
    case 10:
      return "Masculino";
    case 11:
      return "Feminino";
    case 20:
      return "Indeterminado";
    case 0:
    case 1:
    default:
      return Number.isFinite(n) && n !== 0 && n !== 1 ? `Género (${n})` : "Desconhecido";
  }
}

function ageRangeTypeLabel(t: unknown): string {
  const n = typeof t === "number" ? t : Number(t);
  const map: Record<number, string> = {
    503001: "18–24",
    503002: "25–34",
    503003: "35–44",
    503004: "45–54",
    503005: "55–64",
    503006: "65+",
    503999: "Indeterminado",
  };
  if (map[n]) return map[n];
  if (n === 0 || n === 1) return "Desconhecido";
  return `Idade (${n})`;
}

async function adsCustomer(user: GoogleAdsUserSettings) {
  const creds = buildGoogleAdsCredentialsForUser(user);
  if (!creds) {
    return {
      ok: false as const,
      error:
        "Faltam credenciais para a Google Ads API (OAuth ou variáveis GOOGLE_ADS_* no servidor). Consulte «Resumo e guia» ou o administrador do sistema.",
    };
  }
  const customerId = onlyDigits(user.googleAdsCustomerId);
  if (!customerId || !DIGITS_ONLY.test(customerId)) {
    return {
      ok: false as const,
      error: "O Customer ID não é válido. Utilize apenas números, sem hífenes, tal como na Google Ads.",
    };
  }
  const login = onlyDigits(user.googleAdsLoginCustomerId);
  const client = new GoogleAdsApi({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    developer_token: creds.developerToken,
  });
  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: creds.refreshToken,
    ...(login ? { login_customer_id: login } : {}),
  });
  return { ok: true as const, customer };
}

export type GoogleAdsKeywordRow = {
  campaign: string;
  ad_group: string;
  keyword: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  /** Conversões com atribuição do modelo da conta (soma no período). */
  conversions: number;
};

export type GoogleAdsSearchTermRow = {
  campaign: string;
  ad_group: string;
  search_term: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
};

export type GoogleAdsDemoRow = {
  campaign: string;
  ad_group: string;
  segment_label: string;
  impressions: number;
  clicks: number;
  conversions: number;
};

function runQuery(customer: { query: (gaql: string) => Promise<unknown> }, gaql: string) {
  return customer.query(gaql);
}

/** Agrega linhas diárias GAQL num intervalo num único registo por dimensão. */
function mergeMetricRows(
  rows: unknown[],
  keyParts: (row: Record<string, unknown>) => string[],
  readMetrics: (row: Record<string, unknown>) => { im: number; cl: number; co: number; cv: number },
): Map<string, { impressions: number; clicks: number; cost_micros: number; conversions: number }> {
  const acc = new Map<string, { impressions: number; clicks: number; cost_micros: number; conversions: number }>();
  const list = Array.isArray(rows) ? rows : [];
  for (const raw of list) {
    const row = raw as Record<string, unknown>;
    const k = keyParts(row).join("\t");
    const { im, cl, co, cv } = readMetrics(row);
    const cur = acc.get(k) || { impressions: 0, clicks: 0, cost_micros: 0, conversions: 0 };
    cur.impressions += im;
    cur.clicks += cl;
    cur.cost_micros += co;
    cur.conversions += cv;
    acc.set(k, cur);
  }
  return acc;
}

export async function fetchGoogleAdsKeywordInsights(input: {
  user: GoogleAdsUserSettings;
  from: Date;
  to: Date;
}): Promise<{ ok: true; rows: GoogleAdsKeywordRow[] } | { ok: false; error: string }> {
  const block = getGoogleAdsReportingUnavailability(input.user);
  if (block) return { ok: false, error: block.message };
  const c = await adsCustomer(input.user);
  if (!c.ok) return { ok: false, error: c.error };
  const fromStr = formatGaqlDate(input.from);
  const toStr = formatGaqlDate(input.to);
  const gaql = `
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_criterion.keyword.text,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE segments.date BETWEEN '${fromStr}' AND '${toStr}'
    ORDER BY metrics.impressions DESC
    LIMIT 10000
  `;
  try {
    const rows = await runQuery(c.customer, gaql);
    const list = Array.isArray(rows) ? rows : [];
    const merged = mergeMetricRows(
      list,
      (row) => {
        const camp = (row.campaign as { name?: string } | undefined)?.name ?? "";
        const ag = (row.ad_group as { name?: string } | undefined)?.name ?? "";
        const kw =
          (row.ad_group_criterion as { keyword?: { text?: string } } | undefined)?.keyword?.text ?? "";
        return [camp, ag, kw];
      },
      (row) => {
        const m = row.metrics as {
          impressions?: unknown;
          clicks?: unknown;
          cost_micros?: unknown;
          conversions?: unknown;
        } | undefined;
        return {
          im: Number(m?.impressions ?? 0),
          cl: Number(m?.clicks ?? 0),
          co: Number(m?.cost_micros ?? 0),
          cv: Number(m?.conversions ?? 0),
        };
      },
    );
    const out: GoogleAdsKeywordRow[] = [];
    for (const [key, met] of merged) {
      const [campaign, ad_group, keyword] = key.split("\t");
      out.push({
        campaign: campaign || "—",
        ad_group: ad_group || "—",
        keyword: keyword || "—",
        impressions: met.impressions,
        clicks: met.clicks,
        cost_micros: met.cost_micros,
        conversions: met.conversions,
      });
    }
    out.sort((a, b) => b.impressions - a.impressions);
    return { ok: true, rows: out.slice(0, 2000) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: humanizeGoogleAdsApiError(msg) };
  }
}

export async function fetchGoogleAdsSearchTermInsights(input: {
  user: GoogleAdsUserSettings;
  from: Date;
  to: Date;
}): Promise<{ ok: true; rows: GoogleAdsSearchTermRow[] } | { ok: false; error: string }> {
  const block = getGoogleAdsReportingUnavailability(input.user);
  if (block) return { ok: false, error: block.message };
  const c = await adsCustomer(input.user);
  if (!c.ok) return { ok: false, error: c.error };
  const fromStr = formatGaqlDate(input.from);
  const toStr = formatGaqlDate(input.to);
  const gaql = `
    SELECT
      campaign.name,
      ad_group.name,
      search_term_view.search_term,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${fromStr}' AND '${toStr}'
    ORDER BY metrics.impressions DESC
    LIMIT 10000
  `;
  try {
    const rows = await runQuery(c.customer, gaql);
    const list = Array.isArray(rows) ? rows : [];
    const merged = mergeMetricRows(
      list,
      (row) => {
        const camp = (row.campaign as { name?: string } | undefined)?.name ?? "";
        const ag = (row.ad_group as { name?: string } | undefined)?.name ?? "";
        const st = (row.search_term_view as { search_term?: string } | undefined)?.search_term ?? "";
        return [camp, ag, st];
      },
      (row) => {
        const m = row.metrics as {
          impressions?: unknown;
          clicks?: unknown;
          cost_micros?: unknown;
          conversions?: unknown;
        } | undefined;
        return {
          im: Number(m?.impressions ?? 0),
          cl: Number(m?.clicks ?? 0),
          co: Number(m?.cost_micros ?? 0),
          cv: Number(m?.conversions ?? 0),
        };
      },
    );
    const out: GoogleAdsSearchTermRow[] = [];
    for (const [key, met] of merged) {
      const [campaign, ad_group, search_term] = key.split("\t");
      out.push({
        campaign: campaign || "—",
        ad_group: ad_group || "—",
        search_term: search_term || "—",
        impressions: met.impressions,
        clicks: met.clicks,
        cost_micros: met.cost_micros,
        conversions: met.conversions,
      });
    }
    out.sort((a, b) => b.impressions - a.impressions);
    return { ok: true, rows: out.slice(0, 2000) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: humanizeGoogleAdsApiError(msg) };
  }
}

export async function fetchGoogleAdsDemographicInsights(input: {
  user: GoogleAdsUserSettings;
  from: Date;
  to: Date;
}): Promise<
  | {
      ok: true;
      gender: GoogleAdsDemoRow[];
      age: GoogleAdsDemoRow[];
    }
  | { ok: false; error: string }
> {
  const block = getGoogleAdsReportingUnavailability(input.user);
  if (block) return { ok: false, error: block.message };
  const c = await adsCustomer(input.user);
  if (!c.ok) return { ok: false, error: c.error };
  const fromStr = formatGaqlDate(input.from);
  const toStr = formatGaqlDate(input.to);

  const gaqlGender = `
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_criterion.gender.type,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM gender_view
    WHERE segments.date BETWEEN '${fromStr}' AND '${toStr}'
    ORDER BY metrics.impressions DESC
    LIMIT 10000
  `;
  const gaqlAge = `
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_criterion.age_range.type,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM age_range_view
    WHERE segments.date BETWEEN '${fromStr}' AND '${toStr}'
    ORDER BY metrics.impressions DESC
    LIMIT 10000
  `;

  try {
    const [gRows, aRows] = await Promise.all([
      runQuery(c.customer, gaqlGender),
      runQuery(c.customer, gaqlAge),
    ]);
    const gList = Array.isArray(gRows) ? gRows : [];
    const aList = Array.isArray(aRows) ? aRows : [];

    const gMerged = mergeMetricRows(
      gList,
      (row) => {
        const camp = (row.campaign as { name?: string } | undefined)?.name ?? "";
        const ag = (row.ad_group as { name?: string } | undefined)?.name ?? "";
        const typ = (row.ad_group_criterion as { gender?: { type?: unknown } } | undefined)?.gender?.type;
        return [camp, ag, String(typ ?? "")];
      },
      (row) => {
        const m = row.metrics as { impressions?: unknown; clicks?: unknown; conversions?: unknown } | undefined;
        return {
          im: Number(m?.impressions ?? 0),
          cl: Number(m?.clicks ?? 0),
          co: 0,
          cv: Number(m?.conversions ?? 0),
        };
      },
    );
    const aMerged = mergeMetricRows(
      aList,
      (row) => {
        const camp = (row.campaign as { name?: string } | undefined)?.name ?? "";
        const ag = (row.ad_group as { name?: string } | undefined)?.name ?? "";
        const typ = (row.ad_group_criterion as { age_range?: { type?: unknown } } | undefined)?.age_range?.type;
        return [camp, ag, String(typ ?? "")];
      },
      (row) => {
        const m = row.metrics as { impressions?: unknown; clicks?: unknown; conversions?: unknown } | undefined;
        return {
          im: Number(m?.impressions ?? 0),
          cl: Number(m?.clicks ?? 0),
          co: 0,
          cv: Number(m?.conversions ?? 0),
        };
      },
    );

    const gender: GoogleAdsDemoRow[] = [];
    for (const [key, met] of gMerged) {
      const [campaign, ad_group, typStr] = key.split("\t");
      const typ = typStr === "" ? null : Number(typStr);
      gender.push({
        campaign: campaign || "—",
        ad_group: ad_group || "—",
        segment_label: genderTypeLabel(typ),
        impressions: met.impressions,
        clicks: met.clicks,
        conversions: met.conversions,
      });
    }
    gender.sort((a, b) => b.impressions - a.impressions);

    const age: GoogleAdsDemoRow[] = [];
    for (const [key, met] of aMerged) {
      const [campaign, ad_group, typStr] = key.split("\t");
      const typ = typStr === "" ? null : Number(typStr);
      age.push({
        campaign: campaign || "—",
        ad_group: ad_group || "—",
        segment_label: ageRangeTypeLabel(typ),
        impressions: met.impressions,
        clicks: met.clicks,
        conversions: met.conversions,
      });
    }
    age.sort((a, b) => b.impressions - a.impressions);

    return {
      ok: true,
      gender: gender.slice(0, 2000),
      age: age.slice(0, 2000),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: humanizeGoogleAdsApiError(msg) };
  }
}

export type GoogleAdsInsightsBundle = {
  period: { from: string; to: string };
  synced_at: string;
  keywords: { ok: true; rows: GoogleAdsKeywordRow[] } | { ok: false; error: string };
  search_terms: { ok: true; rows: GoogleAdsSearchTermRow[] } | { ok: false; error: string };
  demographics: { ok: true; gender: GoogleAdsDemoRow[]; age: GoogleAdsDemoRow[] } | { ok: false; error: string };
};

export async function fetchGoogleAdsInsightsBundle(input: {
  user: Pick<
    User,
    "googleAdsCustomerId" | "googleAdsLoginCustomerId" | "googleAdsRefreshToken"
  >;
  from: Date;
  to: Date;
}): Promise<
  | { ok: true; data: GoogleAdsInsightsBundle }
  | { ok: false; error: string; code: GoogleAdsReportingUnavailableCode }
> {
  const user = input.user as GoogleAdsUserSettings;
  const block = getGoogleAdsReportingUnavailability(user);
  if (block) {
    return { ok: false, error: block.message, code: block.code };
  }
  const [kw, st, demo] = await Promise.all([
    fetchGoogleAdsKeywordInsights({ user, from: input.from, to: input.to }),
    fetchGoogleAdsSearchTermInsights({ user, from: input.from, to: input.to }),
    fetchGoogleAdsDemographicInsights({ user, from: input.from, to: input.to }),
  ]);

  const data: GoogleAdsInsightsBundle = {
    period: {
      from: input.from.toISOString().slice(0, 10),
      to: input.to.toISOString().slice(0, 10),
    },
    synced_at: new Date().toISOString(),
    keywords: kw.ok ? { ok: true, rows: kw.rows } : { ok: false, error: kw.error },
    search_terms: st.ok ? { ok: true, rows: st.rows } : { ok: false, error: st.error },
    demographics: demo.ok
      ? { ok: true, gender: demo.gender, age: demo.age }
      : { ok: false, error: demo.error },
  };
  return { ok: true, data };
}
