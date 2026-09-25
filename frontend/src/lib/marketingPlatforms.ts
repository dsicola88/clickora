/**
 * Plataformas de redes de afiliados (postback em Integrações → Plataformas).
 * Fonte única para a página Plataformas e para o combobox "Plataforma" no Construtor de URL.
 */
export const AFFILIATE_PLATFORMS: string[] = [
  "AdCombo",
  "Adexico",
  "Affbay",
  "Ambalaya",
  "Awin",
  "BlitzAds",
  "BuyGoods",
  "ClickBank",
  "ClickDealer",
  "ClickFlow",
  "ClickHunts",
  "ClicksAdv",
  "CPAGetti",
  "CPAHouse",
  "CJ Affiliate",
  "Digistore24",
  "DrCash",
  "EverAd",
  "EverFlow",
  "Gasmobi",
  "Giantmobi",
  "Gurumedia",
  "HealthTrader",
  "Hotmart",
  "Impact",
  "JVZoo",
  "Keitaro",
  "LeadBit",
  "LeadReaktor",
  "LemonAd",
  "MaxBounty",
  "MaxWeb",
  "Mediascalers",
  "Monetizer",
  "MoreNiche",
  "Netvork",
  "NutriProfits",
  "ProfitPay",
  "Rakuten",
  "SellHealth",
  "ShareASale",
  "ShakesPro",
  "SmartAdv",
  "TerraLeads",
  "TradeDoubler",
  "TrafficLight",
  "UpPromote",
  "WarriorPlus",
  "Webgains",
  "Webvork",
];

/** Redes de tráfego pago (UTMs + macros) — não são postback de afiliado, mas entram no construtor de URL. */
export const TRAFFIC_SOURCE_PLATFORMS: string[] = [
  "Google Ads",
  "Facebook Ads",
  "TikTok Ads",
  "Bing Ads",
  "Taboola",
  "Outbrain",
  "Pinterest Ads",
  "Kwai Ads",
  "Twitter Ads",
];

/** Plataformas BR comuns no construtor antigo; mantidas para presets de parâmetros. */
export const EXTRA_OFFER_PLATFORMS: string[] = ["Monetizze", "Eduzz", "Kiwify", "Braip"];

function uniqueSortedPlatforms(names: string[]): string[] {
  return [...new Set(names.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt", { sensitivity: "base" }),
  );
}

/**
 * Lista completa para o Construtor de URL: tráfego + afiliados + extras + Personalizado no fim.
 */
export function getUrlBuilderPlatformList(): string[] {
  const merged = uniqueSortedPlatforms([
    ...TRAFFIC_SOURCE_PLATFORMS,
    ...AFFILIATE_PLATFORMS,
    ...EXTRA_OFFER_PLATFORMS,
  ]);
  return [...merged, "Personalizado"];
}

// --- Postback (Plataformas): URL de exemplo com macros alinhadas ao backend (affiliatePostbackParsers) ---

export type AffiliatePostbackPreset = {
  /** Texto de ajuda por rede */
  hint: string;
  /** Query string (macros {…} não são codificados — a rede substitui no envio real) */
  params: Record<string, string>;
};

const DEFAULT_POSTBACK_PARAMS: Record<string, string> = {
  orderid: "{ORDERID}",
  amount: "{COMMISSION_AMOUNT}",
  cy: "USD",
  status: "approved",
  clickora_click_id: "{SUBID}",
  product: "{PRODUCT_CODENAME}",
  subid1: "{SUBID}",
  subid2: "{SUBID2}",
  subid3: "{SUBID3}",
  subid4: "{SUBID4}",
  subid5: "{SUBID5}",
};

export const DEFAULT_AFFILIATE_POSTBACK_PRESET: AffiliatePostbackPreset = {
  hint:
    "Query string genérica: a rede substitui {ORDERID}, {SUBID}, etc. O UUID do clique (presell → oferta) deve aparecer em clickora_click_id ou subid1 — o servidor aceita também sub1/SUB1 com UUID.",
  params: DEFAULT_POSTBACK_PARAMS,
};

/** Presets com parâmetros diferentes (documentação típica da rede). */
export const AFFILIATE_POSTBACK_PRESETS: Partial<Record<string, AffiliatePostbackPreset>> = {
  Digistore24: {
    hint:
      "Digistore24 (S2S): no hoplink a Clickora envia cid=UUID. No postback usa {cid} (não {SUBID}). Inclui transaction_type — refunds revertem a venda no painel e no Google Ads.",
    params: {
      cid: "{cid}",
      sid1: "{sid1}",
      clickora_click_id: "{cid}",
      amount: "{amount_affiliate}",
      billing_status: "{billing_status}",
      transaction_type: "{transaction_type}",
      orderid: "{order_id}",
      cy: "{currency}",
    },
  },
  BuyGoods: {
    hint:
      "BuyGoods: postback = vendas ({SUBID}). Para Checkout Visitors como no Overview, cole também o Funnel Pixel Checkout (abaixo nesta página) em BuyGoods → Funnel Pixels.",
    params: {
      subid: "{SUBID}",
      clickora_click_id: "{SUBID}",
      subid1: "{SUBID}",
      orderid: "{ORDERID}",
      amount: "{COMMISSION_AMOUNT}",
      product: "{PRODUCT_CODENAME}",
      status: "approved",
      transaction_type: "{EVENT}",
      cy: "USD",
    },
  },
  SmartAdv: {
    hint:
      "SmartAdv: a Clickora envia o UUID em sub3 (recomendado pela rede). No postback use cid={sub3}. Global postback cobre todas as ofertas; refunds com o mesmo transaction_id revertem receita.",
    params: {
      cid: "{sub3}",
      clickora_click_id: "{sub3}",
      sub3: "{sub3}",
      orderid: "{transaction_id}",
      amount: "{payout}",
      status: "approved",
      transaction_type: "{status}",
    },
  },
  MaxWeb: {
    hint:
      "MaxWeb: muitos anunciantes usam s1–s3; o UUID do clique pode ir em s1 ou subid1 (o backend lê sub1 com UUID).",
    params: {
      s1: "{SUBID}",
      s2: "{SUBID2}",
      s3: "{SUBID3}",
      orderid: "{ORDERID}",
      amount: "{COMMISSION_AMOUNT}",
      cy: "USD",
      status: "approved",
      clickora_click_id: "{SUBID}",
      subid1: "{SUBID}",
    },
  },
  ClickBank: {
    hint:
      "ClickBank (IPN): confirme o secret na conta; o UUID deve coincidir com o subid que enviaste no hoplink (subid1 ou clickora_click_id).",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  Hotmart: {
    hint:
      "Hotmart pode notificar por POST JSON; o mesmo conjunto de campos é aceite em query string e em form (flatten no servidor).",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  WarriorPlus: {
    hint: "WarriorPlus: confirme o WP IPN; o ID de tracking deve ser o UUID devolvido no link de oferta.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  JVZoo: {
    hint: "JVZoo: ctc ou parâmetros de tracking — o UUID do clique deve ser reenviado em subid1 ou clickora_click_id.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  "CJ Affiliate": {
    hint: "CJ: parâmetros de comissão variam; mantenha clickora_click_id ou subid1 com o UUID do clique.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  Impact: {
    hint: "Impact.com: confirme os placeholders do programa; o click id interno deve ser o UUID do dclickora.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  Rakuten: {
    hint: "Rakuten: confirme o formato de notificação do anunciante; UUID em subid1 ou clickora_click_id.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  ShareASale: {
    hint: "ShareASale: transaction e status típicos; afftrack/merchant — UUID do clique em subid1.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  Awin: {
    hint: "Awin: confirme o conversion pixel / postback do anunciante; UUID em clickora_click_id.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  Keitaro: {
    hint: "Keitaro: costuma reencaminhar parâmetros; o subid com UUID deve ser o mesmo do link de oferta.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
};

const FALLBACK_HINTS: Partial<Record<string, string>> = {
  AdCombo: "AdCombo: use os placeholders da rede para encomenda e subids; UUID do clique em subid1 ou clickora_click_id.",
  EverFlow: "EverFlow: fluxo típico s2/s3; UUID do clique em subid1 ou clickora_click_id.",
  EverAd: "EverAd: confirme o postback do anunciante; UUID do clique em subid1.",
  "CPAGetti": "CPAGetti: parâmetros de conversão da rede; UUID em subid1.",
  CPAHouse: "CPAHouse: confirme a documentação; UUID em subid1.",
  DrCash: "DrCash: postback por programa; UUID em subid1.",
  Gasmobi: "Gasmobi: confirme macros oficiais; UUID em subid1.",
  LeadBit: "LeadBit: parâmetros de lead/sale; UUID em subid1.",
  NutriProfits: "NutriProfits: IPN típico; UUID em subid1.",
  SellHealth: "SellHealth: confirme o formulário de postback; UUID em subid1.",
  TerraLeads: "TerraLeads: confirme o postback da oferta; UUID em subid1.",
  Webvork: "Webvork: parâmetros do anunciante; UUID em subid1.",
};

export function getAffiliatePostbackPreset(platform: string): AffiliatePostbackPreset {
  const full = AFFILIATE_POSTBACK_PRESETS[platform];
  if (full) return full;
  const hint = FALLBACK_HINTS[platform] ?? DEFAULT_AFFILIATE_POSTBACK_PRESET.hint;
  return { hint, params: DEFAULT_POSTBACK_PARAMS };
}

/** URL completa para colar na rede: base (token) + platform + macros compatíveis com o webhook. */
export function buildAffiliatePostbackExampleUrl(hookUrl: string, platform: string): string {
  const preset = getAffiliatePostbackPreset(platform);
  const joiner = hookUrl.includes("?") ? "&" : "?";
  const parts = [`platform=${encodeURIComponent(platform)}`];
  for (const [k, v] of Object.entries(preset.params)) {
    parts.push(`${encodeURIComponent(k)}=${v}`);
  }
  return `${hookUrl}${joiner}${parts.join("&")}`;
}

// --- Funil (Checkout / Lander): capacidades honestas por rede ---

/** Como a rede tipicamente entrega eventos de funil (não inventamos o que a rede não tem). */
export type AffiliateFunnelMode =
  /** BuyGoods: campos HTML Funnel Pixels (Checkout + Lander/VSL). */
  | "html_funnel_pixels"
  /** SmartAdv / Everflow-like: postback tipo Event (Checkout / Add to Cart se a oferta tiver). */
  | "event_postback"
  /** Só venda/IPN documentado; HTML opcional se a conta tiver slot de pixel. */
  | "sale_only";

export type AffiliateFunnelGuide = {
  mode: AffiliateFunnelMode;
  /** Onde colar no painel da rede (texto curto). */
  panelPath: string;
  /** Resumo honesto — o que esta rede costuma permitir. */
  summary: string;
  /** Macro típica do click id no Event postback (quando aplicável). */
  eventClickIdMacro?: string;
  supportsLander: boolean;
};

const FUNNEL_GUIDES: Partial<Record<string, AffiliateFunnelGuide>> = {
  BuyGoods: {
    mode: "html_funnel_pixels",
    panelPath: "BuyGoods → Funnel Pixels → Checkout (e Lander/VSL se quiser)",
    summary:
      "BuyGoods injecta o teu HTML no checkout (e no lander/VSL). Sem colar o pixel, a dclickora não recebe Checkout Visitors — só o Overview do BuyGoods os conta.",
    supportsLander: true,
  },
  SmartAdv: {
    mode: "event_postback",
    panelPath: "SmartAdv → Postbacks → Type: Event (não Conversion) → evento Checkout / Add to Cart se a oferta o tiver",
    summary:
      "SmartAdv distingue Conversion (venda) e Event (checkout, add to cart…). Só ofertas com o evento activo disparam. Confirme no catálogo/relatório Events da SmartAdv.",
    eventClickIdMacro: "{sub3}",
    supportsLander: false,
  },
  EverFlow: {
    mode: "event_postback",
    panelPath: "Everflow → postbacks / event pixels conforme o anunciante",
    summary:
      "Everflow costuma permitir event postbacks além da conversão. Use o URL de evento Checkout se o offer o expuser; senão só há venda.",
    eventClickIdMacro: "{subid1}",
    supportsLander: false,
  },
  Digistore24: {
    mode: "sale_only",
    panelPath: "Digistore24 → Sales & partners → Integrations (S2S postback)",
    summary:
      "Digistore24 (afiliado) notifica tipicamente na compra via S2S — não há Checkout Visitors oficiais para afiliados. Clique = saída para a oferta; venda = postback.",
    supportsLander: false,
  },
  ClickBank: {
    mode: "sale_only",
    panelPath: "ClickBank → IPN / Hop Toolkit (pixels do vendor, se existirem)",
    summary:
      "ClickBank afiliado: IPN na venda. Pixels de order form só se o vendor/Hop Toolkit os disponibilizar — não inventamos checkout sem esse slot.",
    supportsLander: false,
  },
  MaxWeb: {
    mode: "sale_only",
    panelPath: "MaxWeb → Postback Tracking Tags (venda)",
    summary:
      "MaxWeb documenta postback de conversão/comissão. Checkout Visitors da rede não entram automaticamente; use o pixel HTML só se a conta tiver campo de pixel no funil.",
    supportsLander: false,
  },
  Hotmart: {
    mode: "sale_only",
    panelPath: "Hotmart → Webhook / Postback de compra",
    summary:
      "Hotmart notifica na compra (webhook). Não há evento de «chegou ao checkout Hotmart» para afiliados na dclickora.",
    supportsLander: false,
  },
  AdCombo: {
    mode: "sale_only",
    panelPath: "AdCombo → Postback da oferta",
    summary: "Tipicamente só conversão/lead pago via postback. Checkout da rede só se o painel oferecer pixel/evento extra.",
    supportsLander: false,
  },
  Gurumedia: {
    mode: "sale_only",
    panelPath: "Gurumedia → Postback",
    summary: "Postback de conversão. Sem Funnel Pixels tipo BuyGoods na documentação típica.",
    supportsLander: false,
  },
};

const DEFAULT_FUNNEL_GUIDE: AffiliateFunnelGuide = {
  mode: "sale_only",
  panelPath: "Painel da rede → Postback / IPN / Pixel (venda)",
  summary:
    "A maioria das redes só notifica a venda (ou lead pago). A dclickora já regista o Clique (saída para a oferta). Checkout da rede só aparece se colar pixel HTML / Event postback — e só se a rede o injectar ou disparar.",
  supportsLander: false,
};

export function getAffiliateFunnelGuide(platform: string): AffiliateFunnelGuide {
  return FUNNEL_GUIDES[platform] ?? DEFAULT_FUNNEL_GUIDE;
}

/** URL de Event postback com macro do click id + funnel_step (S2S). */
export function buildAffiliateFunnelEventUrl(
  eventBaseUrl: string,
  platform: string,
  step: "checkout" | "lander",
): string {
  const guide = getAffiliateFunnelGuide(platform);
  const macro = guide.eventClickIdMacro || "{SUBID}";
  const joiner = eventBaseUrl.includes("?") ? "&" : "?";
  return (
    `${eventBaseUrl}${joiner}platform=${encodeURIComponent(platform)}` +
    `&funnel_step=${step}&status=${step}&clickora_click_id=${macro}&subid1=${macro}`
  );
}

