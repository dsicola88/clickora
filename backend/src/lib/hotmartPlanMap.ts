import type { PlanType } from "@prisma/client";

const VALID_PLAN_TYPES: PlanType[] = ["free_trial", "monthly", "quarterly", "annual"];

export type HotmartPlanResolution = {
  planType: PlanType;
  /** true quando offer/product bateu em HOTMART_PLAN_MAP */
  matched: boolean;
  lookupKey: string | null;
  source: "map" | "fallback";
};

export type HotmartPlanMapInspection = {
  map_configured: boolean;
  map_entry_count: number;
  map_keys: string[];
  default_plan_type: PlanType;
  default_from_env: boolean;
  parse_error: string | null;
  hint: string;
};

function parseMap(raw: string): { map: Record<string, PlanType>; error: string | null } {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { map: {}, error: "HOTMART_PLAN_MAP deve ser um objecto JSON" };
    }
    const map: Record<string, PlanType> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && VALID_PLAN_TYPES.includes(v as PlanType)) {
        map[k] = v as PlanType;
      }
    }
    return { map, error: null };
  } catch (e) {
    return { map: {}, error: e instanceof Error ? e.message : "JSON inválido" };
  }
}

function resolveFallback(): { planType: PlanType; fromEnv: boolean } {
  const fallbackRaw = (process.env.HOTMART_DEFAULT_PLAN_TYPE as PlanType | undefined) || "monthly";
  if (VALID_PLAN_TYPES.includes(fallbackRaw)) {
    return { planType: fallbackRaw, fromEnv: Boolean(process.env.HOTMART_DEFAULT_PLAN_TYPE) };
  }
  return { planType: "monthly", fromEnv: false };
}

/**
 * Mapeia oferta/produto Hotmart → PlanType.
 * Miss no mapa (com código presente) → fallback + warning operacional (não falha o webhook).
 */
export function resolvePlanType(
  productCode: string | null,
  offerCode: string | null,
): HotmartPlanResolution {
  const { map, error } = parseMap(process.env.HOTMART_PLAN_MAP || "{}");
  const { planType: fallback } = resolveFallback();
  const lookupKey = offerCode || productCode || null;

  if (error) {
    console.warn(`[hotmart-webhook] HOTMART_PLAN_MAP JSON inválido — a usar fallback (${error})`);
  }

  if (lookupKey && map[lookupKey]) {
    return { planType: map[lookupKey], matched: true, lookupKey, source: "map" };
  }

  if (lookupKey) {
    console.warn(
      `[hotmart-webhook] HOTMART_PLAN_MAP miss offer=${offerCode ?? "-"} product=${productCode ?? "-"} → fallback=${fallback}. ` +
        "Confirme o mapa em produção para não sub-entregar (ex.: anual → mensal).",
    );
  }

  return { planType: fallback, matched: false, lookupKey, source: "fallback" };
}

/** Vista ops (admin): estado do mapa sem secrets. */
export function inspectHotmartPlanMapConfig(): HotmartPlanMapInspection {
  const raw = process.env.HOTMART_PLAN_MAP || "";
  const { map, error } = parseMap(raw || "{}");
  const { planType: defaultPlan, fromEnv } = resolveFallback();
  const keys = Object.keys(map).sort();
  const mapConfigured = keys.length > 0 && !error;
  return {
    map_configured: mapConfigured,
    map_entry_count: keys.length,
    map_keys: keys,
    default_plan_type: defaultPlan,
    default_from_env: fromEnv,
    parse_error: error,
    hint: mapConfigured
      ? "Mapa presente. Compras com offer/product nestas chaves activam o PlanType correspondente."
      : "Sem mapa válido: todas as compras caem no default (risco anual→mensal). Defina HOTMART_PLAN_MAP.",
  };
}
