import type { PresellConfigSettings } from "@/lib/presellConfigDefaults";

export type TrackingHealthStatus = "ok" | "warn" | "info";

export interface TrackingHealthItem {
  id: string;
  label: string;
  status: TrackingHealthStatus;
  detail?: string;
}

function isValidOfferUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function hasAnyNetworkTag(s: PresellConfigSettings): boolean {
  const g = String(s.googleTrackingCode ?? "").trim();
  const c = String(s.googleConversionEvent ?? "").trim();
  const f = String(s.fbPixelId ?? "").trim();
  const fbT = String(s.fbTrackName ?? "").trim();
  const conv = String(s.conversionTrackingScript ?? "").trim();
  return Boolean(g || c || f || fbT || conv);
}

const AW_CONV = /^AW-[0-9]+\/.+/i;

/**
 * Checklist por presell — só usa dados desta página (multi-tenant).
 */
export function computePresellTrackingHealth(input: {
  configSettings: PresellConfigSettings;
  hasTrackingEmbedScript: boolean;
  affiliateLinkTrimmed: string;
  hasPublishedPageId: boolean;
}): { items: TrackingHealthItem[]; readyScore: number } {
  const items: TrackingHealthItem[] = [];
  const { configSettings, hasTrackingEmbedScript, affiliateLinkTrimmed, hasPublishedPageId } = input;

  const offer = affiliateLinkTrimmed;
  if (!offer) {
    items.push({
      id: "offer",
      label: "Link da oferta (afiliado)",
      status: "warn",
      detail: "Obrigatório para rastrear cliques até à rede de afiliados.",
    });
  } else if (!isValidOfferUrl(offer)) {
    items.push({
      id: "offer",
      label: "Link da oferta (afiliado)",
      status: "warn",
      detail: "Usa um URL completo com https://",
    });
  } else {
    items.push({
      id: "offer",
      label: "Link da oferta (afiliado)",
      status: "ok",
      detail: "URL válido para redirecionamento rastreado.",
    });
  }

  if (hasTrackingEmbedScript) {
    items.push({
      id: "clickora",
      label: "Rastreamento Clickora",
      status: "ok",
      detail: "O script da conta será fundido no head ao guardar.",
    });
  } else {
    items.push({
      id: "clickora",
      label: "Rastreamento Clickora",
      status: "warn",
      detail: "Inicia sessão para incluir o script de cliques no head.",
    });
  }

  if (hasAnyNetworkTag(configSettings)) {
    items.push({
      id: "networks",
      label: "Tags de anúncios (Google / Meta / conversão)",
      status: "ok",
      detail: "Há IDs ou snippet de conversão configurados.",
    });
  } else {
    items.push({
      id: "networks",
      label: "Tags de anúncios (opcional)",
      status: "info",
      detail: "Podes adicionar GA4, conversão Google Ads ou Pixel Meta nos campos abaixo.",
    });
  }

  const gce = String(configSettings.googleConversionEvent ?? "").trim();
  if (gce && !AW_CONV.test(gce)) {
    items.push({
      id: "aw-format",
      label: "Formato conversão Google Ads",
      status: "warn",
      detail: "Recomendado: AW-123456789/AbCdEfGh (ID de conversão / etiqueta).",
    });
  }

  if (hasPublishedPageId) {
    items.push({
      id: "published",
      label: "Página publicada",
      status: "ok",
      detail: "Usa o link de teste abaixo para validar UTMs e pixels antes de escalar tráfego.",
    });
  } else {
    items.push({
      id: "published",
      label: "Link público",
      status: "info",
      detail: "Após guardar, copia o URL /p/… para testar no depurador de tags.",
    });
  }

  const weights: Record<TrackingHealthStatus, number> = { ok: 1, info: 0.75, warn: 0.4 };
  const readyScore = Math.round(
    (items.reduce((a, it) => a + weights[it.status], 0) / items.length) * 100,
  );

  return { items, readyScore };
}

/** Query string sugerida para testes sem poluir atribuição real. */
export const PRESELL_QA_UTM = "utm_source=clickora_qa&utm_medium=presell_preview&utm_campaign=tag_check";
