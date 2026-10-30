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
  const tk = String(s.tiktokPixelId ?? "").trim();
  const bing = String(s.bingUetTagId ?? "").trim();
  const conv = String(s.conversionTrackingScript ?? "").trim();
  return Boolean(g || c || f || fbT || tk || bing || conv);
}

const AW_CONV = /^AW-[0-9]+\/.+/i;

/**
 * Checklist por presell — linguagem simples (multi-tenant).
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
      label: "Link da oferta",
      status: "warn",
      detail: "Falta o link da rede de afiliados. Sem ele a venda não é atribuída.",
    });
  } else if (!isValidOfferUrl(offer)) {
    items.push({
      id: "offer",
      label: "Link da oferta",
      status: "warn",
      detail: "Usa um endereço completo com https://",
    });
  } else {
    items.push({
      id: "offer",
      label: "Link da oferta",
      status: "ok",
      detail: "O botão da página envia o visitante para este link (com rastreamento).",
    });
  }

  if (hasTrackingEmbedScript) {
    items.push({
      id: "clickora",
      label: "Rastreamento Clickora",
      status: "ok",
      detail: "O script da conta será incluído ao guardar.",
    });
  } else {
    items.push({
      id: "clickora",
      label: "Rastreamento Clickora",
      status: "warn",
      detail: "Inicia sessão para incluir o rastreamento de cliques.",
    });
  }

  if (hasAnyNetworkTag(configSettings)) {
    items.push({
      id: "networks",
      label: "Pixels de anúncios",
      status: "ok",
      detail: "Há pixels configurados nesta página (Meta, TikTok, Google ou Bing).",
    });
  } else {
    items.push({
      id: "networks",
      label: "Pixels de anúncios (opcional)",
      status: "info",
      detail: "Podes colar IDs ou o script completo de Meta, TikTok, Google Ads ou Bing.",
    });
  }

  const gce = String(configSettings.googleConversionEvent ?? "").trim();
  if (gce && !AW_CONV.test(gce)) {
    items.push({
      id: "aw-format",
      label: "Conversão Google Ads",
      status: "warn",
      detail: "Formato esperado: AW-123456789/AbCdEfGh (código que o Google te dá).",
    });
  }

  if (hasPublishedPageId) {
    items.push({
      id: "published",
      label: "Página publicada",
      status: "ok",
      detail: "Usa o link de teste abaixo antes de aumentar o orçamento.",
    });
  } else {
    items.push({
      id: "published",
      label: "Link público",
      status: "info",
      detail: "Depois de guardar, copia o link público para testar.",
    });
  }

  items.push({
    id: "e2e-postback",
    label: "Aviso de venda da rede",
    status: "info",
    detail:
      "Antes de escalar: cola o URL de aviso de venda no painel da rede. Sem isto a venda não aparece na Clickora.",
  });
  items.push({
    id: "e2e-smoke",
    label: "Teste com anúncio pequeno",
    status: "info",
    detail:
      "Orçamento baixo → 1 clique real → Relatórios (Situação Real) → confirmar a venda. Só depois aumenta o budget.",
  });
  items.push({
    id: "e2e-funnel",
    label: "Funil e lucro",
    status: "info",
    detail:
      "Em Resultados → Funil: visitas → cliques → checkout → vendas; confere Pago vs Orgânico e lucro com custo do período.",
  });
  items.push({
    id: "e2e-ads-upload",
    label: "Envios às redes e custos",
    status: "info",
    detail:
      "Em Integrações / Relatórios: sem falhas de envio, vendas sem ID do clique revistas, custos actualizados.",
  });

  const weights: Record<TrackingHealthStatus, number> = { ok: 1, info: 0.75, warn: 0.4 };
  const readyScore = Math.round(
    (items.reduce((a, it) => a + weights[it.status], 0) / items.length) * 100,
  );

  return { items, readyScore };
}

/** Query string sugerida para testes sem poluir atribuição real. */
export const PRESELL_QA_UTM = "utm_source=clickora_qa&utm_medium=presell_preview&utm_campaign=tag_check";
