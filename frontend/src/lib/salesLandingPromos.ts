/**
 * Disparos de promo / desconto na landing de vendas (/planos).
 * 100% editável no SuperAdmin → Planos (landing_extras.promos).
 */

export type SalesPromoTrigger = "exit_intent" | "timed" | "scroll" | "manual";

export interface SalesPromoPopup {
  id: string;
  enabled: boolean;
  /** exit_intent | timed | scroll — manual só via API/admin preview */
  trigger: SalesPromoTrigger;
  /** Delay em ms (timed) ou % de scroll (scroll). */
  delay_ms: number;
  scroll_percent: number;
  badge: string | null;
  title: string;
  body: string;
  /** Código de desconto opcional (mostrado e copiável). */
  discount_code: string | null;
  discount_hint: string | null;
  cta_label: string;
  cta_href: string;
  secondary_label: string | null;
  secondary_href: string | null;
  /** Uma vez por sessão no browser. */
  once_per_session: boolean;
  /** Cor de destaque (hex). Vazio = accent do tema. */
  accent: string | null;
}

export interface SalesPromoStickyBar {
  enabled: boolean;
  text: string;
  cta_label: string | null;
  cta_href: string | null;
  discount_code: string | null;
  /** Fecha com X e grava sessão. */
  dismissible: boolean;
  accent: string | null;
  text_color: string | null;
  background: string | null;
}

export interface SalesLandingPromos {
  sticky_bar: SalesPromoStickyBar;
  popups: SalesPromoPopup[];
}

export const DEFAULT_SALES_LANDING_PROMOS: SalesLandingPromos = {
  sticky_bar: {
    enabled: true,
    text: "Oferta de lançamento — teste grátis sem cartão. Planos pagos com setup guiado.",
    cta_label: "Ver planos",
    cta_href: "#planos",
    discount_code: null,
    dismissible: true,
    accent: null,
    text_color: "#0b1220",
    background: "linear-gradient(90deg,#67e8f9 0%,#a78bfa 55%,#fb7185 100%)",
  },
  popups: [
    {
      id: "exit_launch",
      enabled: true,
      trigger: "exit_intent",
      delay_ms: 0,
      scroll_percent: 0,
      badge: "Antes de sair",
      title: "Leve o tracking e a presell no mesmo lugar",
      body: "Crie a conta grátis agora. Sem cartão nesta página. Quando estiver pronto, escolha o plano que acompanha as vendas da rede.",
      discount_code: null,
      discount_hint: null,
      cta_label: "Testar gratuitamente",
      cta_href: "/auth",
      secondary_label: "Ver planos",
      secondary_href: "#planos",
      once_per_session: true,
      accent: "#38bdf8",
    },
    {
      id: "timed_boost",
      enabled: false,
      trigger: "timed",
      delay_ms: 45000,
      scroll_percent: 0,
      badge: "Promoção",
      title: "Desconto especial para novos afiliados",
      body: "Active o código no checkout Hotmart (quando disponível no produto) ou fale com o suporte para aplicar o benefício.",
      discount_code: "DCLICKORA15",
      discount_hint: "Válido em planos pagos elegíveis — sujeito às regras do checkout.",
      cta_label: "Criar conta e usar",
      cta_href: "/auth",
      secondary_label: "Agora não",
      secondary_href: null,
      once_per_session: true,
      accent: "#a78bfa",
    },
    {
      id: "scroll_plans",
      enabled: true,
      trigger: "scroll",
      delay_ms: 0,
      scroll_percent: 55,
      badge: "Pronto para escalar?",
      title: "Compare os planos e comece hoje",
      body: "Presell, palavras-chave, anúncio e rastreio num só painel. O Starter não pede cartão nesta página.",
      discount_code: null,
      discount_hint: null,
      cta_label: "Escolher plano",
      cta_href: "#planos",
      secondary_label: "Falar com especialista",
      secondary_href: "/auth",
      once_per_session: true,
      accent: "#22d3ee",
    },
  ],
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function strOrNull(v: unknown, fallback: string | null): string | null {
  if (typeof v === "string") return v;
  if (v === null) return null;
  return fallback;
}

function clampInt(n: unknown, fallback: number, min: number, max: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function coercePopup(raw: unknown, fallback: SalesPromoPopup): SalesPromoPopup {
  if (!isPlainObject(raw)) return { ...fallback };
  const trigger = raw.trigger;
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim().slice(0, 64) : fallback.id,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    trigger:
      trigger === "exit_intent" || trigger === "timed" || trigger === "scroll" || trigger === "manual"
        ? trigger
        : fallback.trigger,
    delay_ms: clampInt(raw.delay_ms, fallback.delay_ms, 0, 600_000),
    scroll_percent: clampInt(raw.scroll_percent, fallback.scroll_percent, 0, 100),
    badge: strOrNull(raw.badge, fallback.badge),
    title: typeof raw.title === "string" ? raw.title : fallback.title,
    body: typeof raw.body === "string" ? raw.body : fallback.body,
    discount_code: strOrNull(raw.discount_code, fallback.discount_code),
    discount_hint: strOrNull(raw.discount_hint, fallback.discount_hint),
    cta_label: typeof raw.cta_label === "string" ? raw.cta_label : fallback.cta_label,
    cta_href: typeof raw.cta_href === "string" ? raw.cta_href : fallback.cta_href,
    secondary_label: strOrNull(raw.secondary_label, fallback.secondary_label),
    secondary_href: strOrNull(raw.secondary_href, fallback.secondary_href),
    once_per_session:
      typeof raw.once_per_session === "boolean" ? raw.once_per_session : fallback.once_per_session,
    accent: strOrNull(raw.accent, fallback.accent),
  };
}

export function coerceSalesLandingPromos(raw: unknown): SalesLandingPromos {
  const base = DEFAULT_SALES_LANDING_PROMOS;
  if (!isPlainObject(raw)) return structuredClone(base);

  let sticky_bar = { ...base.sticky_bar };
  if (raw.sticky_bar === null) {
    sticky_bar = { ...base.sticky_bar, enabled: false };
  } else if (isPlainObject(raw.sticky_bar)) {
    const s = raw.sticky_bar;
    sticky_bar = {
      enabled: typeof s.enabled === "boolean" ? s.enabled : base.sticky_bar.enabled,
      text: typeof s.text === "string" ? s.text : base.sticky_bar.text,
      cta_label: strOrNull(s.cta_label, base.sticky_bar.cta_label),
      cta_href: strOrNull(s.cta_href, base.sticky_bar.cta_href),
      discount_code: strOrNull(s.discount_code, base.sticky_bar.discount_code),
      dismissible: typeof s.dismissible === "boolean" ? s.dismissible : base.sticky_bar.dismissible,
      accent: strOrNull(s.accent, base.sticky_bar.accent),
      text_color: strOrNull(s.text_color, base.sticky_bar.text_color),
      background: strOrNull(s.background, base.sticky_bar.background),
    };
  }

  let popups = base.popups.map((p) => ({ ...p }));
  if (Array.isArray(raw.popups)) {
    popups = raw.popups
      .slice(0, 8)
      .map((item, i) => coercePopup(item, base.popups[i] ?? base.popups[0]));
  }

  return { sticky_bar, popups };
}

export function newBlankSalesPromoPopup(): SalesPromoPopup {
  return {
    id: `promo_${Date.now().toString(36)}`,
    enabled: false,
    trigger: "timed",
    delay_ms: 20000,
    scroll_percent: 40,
    badge: "Promoção",
    title: "Nova oferta",
    body: "Descreva o benefício ou o desconto. Tudo editável.",
    discount_code: null,
    discount_hint: null,
    cta_label: "Quero aproveitar",
    cta_href: "#planos",
    secondary_label: "Fechar",
    secondary_href: null,
    once_per_session: true,
    accent: null,
  };
}
