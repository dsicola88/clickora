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
    "Contrato genérico desta app, não o IPN nativo da rede. Mapeie a comissão para amount, o id da transacção para orderid e o UUID do clique para clickora_click_id ou subid1. status tem de ser approved, pending, refund ou chargeback. Campos de outra rede (cid, billing_status, WP_ACTION, ctransaction) não são lidos neste contrato.",
  params: DEFAULT_POSTBACK_PARAMS,
};

/** Presets com parâmetros diferentes (documentação típica da rede). */
export const AFFILIATE_POSTBACK_PRESETS: Partial<Record<string, AffiliatePostbackPreset>> = {
  Digistore24: {
    hint:
      "Digistore24 (S2S). No hoplink vai cid (e sid1 se cid já existir). No postback use {cid}, {amount_affiliate}, {billing_status}, {transaction_type}, {transaction_id}, {order_id}, {payment_id} e {pay_sequence_no}. payment+completed/paying é venda. refund e chargeback revertem a transacção indicada por parent_transaction_id, payment_id ou pay_sequence_no. payment_missed não é reembolso.",
    params: {
      cid: "{cid}",
      sid1: "{sid1}",
      clickora_click_id: "{cid}",
      amount_affiliate: "{amount_affiliate}",
      billing_status: "{billing_status}",
      transaction_type: "{transaction_type}",
      transaction_id: "{transaction_id}",
      order_id: "{order_id}",
      payment_id: "{payment_id}",
      pay_sequence_no: "{pay_sequence_no}",
      currency: "{currency}",
    },
  },
  BuyGoods: {
    hint:
      "BuyGoods: este URL é só a venda ({SUBID}, {ORDERID}, {COMMISSION_AMOUNT}). Não leva status=approved fixo. Checkout Visitors entram pelo pixel HTML ou pelo URL de evento Checkout, nunca por este URL.",
    params: {
      subid: "{SUBID}",
      clickora_click_id: "{SUBID}",
      orderid: "{ORDERID}",
      amount: "{COMMISSION_AMOUNT}",
      product: "{PRODUCT_CODENAME}",
      cy: "USD",
    },
  },
  SmartAdv: {
    hint:
      "SmartAdv: o UUID vai em sub3. status={status} (approved, pending, refund, rejected). Checkout é o URL de evento, não esta conversão. O id de deduplicação é {transaction_id}.",
    params: {
      sub3: "{sub3}",
      clickora_click_id: "{sub3}",
      orderid: "{transaction_id}",
      amount: "{payout}",
      status: "{status}",
      currency: "{currency}",
    },
  },
  MaxWeb: {
    hint:
      "MaxWeb: o parâmetro oficial no hoplink é subid, ecoado como {SUBID}. Este URL é a compra. O evento Checkout Visit da MaxWeb tem de usar o URL de funil (funnel_step=checkout), não este.",
    params: {
      subid: "{SUBID}",
      clickora_click_id: "{SUBID}",
      orderid: "{ORDERID}",
      amount: "{COMMISSION_AMOUNT}",
      product: "{PRODUCT_CODENAME}",
      cy: "USD",
    },
  },
  ClickBank: {
    hint:
      "ClickBank INS chega cifrado (notification + iv). Sem a chave da conta este endpoint não decifra e ignora o aviso. Se os campos já vierem em claro, lê transactionType (SALE, BILL, RFND, CGBK), receipt, totalAccountAmount e tid. Não use macros {SUBID}.",
    params: {},
  },
  Hotmart: {
    hint:
      "Vendas Hotmart (webhook 2.0 do produto), separado do webhook de planos da aplicação. O hoplink recebe src=UUID. Eventos: PURCHASE_APPROVED e PURCHASE_COMPLETE são a mesma transacção; PURCHASE_REFUNDED e PURCHASE_CANCELED revertem; PURCHASE_CHARGEBACK é chargeback; boleto impresso fica pendente. A comissão lida é a linha AFFILIATE, não o preço do comprador.",
    params: {},
  },
  WarriorPlus: {
    hint:
      "WarriorPlus envia IPN em POST (WP_ACTION, WP_SALEID, WP_COMMISSION, WP_TID). sale regista a comissão. refund reverte. dispute é chargeback. Não usa {ORDERID}.",
    params: {},
  },
  JVZoo: {
    hint:
      "JVZoo envia ctransaction (SALE, BILL, RFND, CGBK), ctransreceipt e tid. CANCEL-REBILL não é uma venda nova nem um reembolso da cobrança já paga.",
    params: {},
  },
  "CJ Affiliate": {
    hint: "CJ não tem adaptador nativo. Mapeie a comissão, o id e o UUID para o contrato genérico (amount, orderid, clickora_click_id, status).",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  Impact: {
    hint: "Impact não tem adaptador nativo. Mapeie SharedId/ActionId para clickora_click_id, orderid, amount e status do contrato genérico.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  Rakuten: {
    hint: "Rakuten não tem adaptador nativo. Use o contrato genérico: clickora_click_id, orderid, amount (comissão) e status.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  ShareASale: {
    hint: "ShareASale não tem adaptador nativo. Mapeie a transacção para orderid, a comissão para amount e o tracking para clickora_click_id.",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  Awin: {
    hint: "Awin não tem adaptador nativo. Mapeie o clique e a comissão para o contrato genérico (clickora_click_id, orderid, amount, status).",
    params: DEFAULT_POSTBACK_PARAMS,
  },
  Keitaro: {
    hint: "Keitaro reencaminha o que configurar. Aponte o postback para o contrato genérico: clickora_click_id, orderid, amount, status.",
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
    mode: "event_postback",
    panelPath: "MaxWeb → Postback Pixels. Compra neste URL. Checkout Visit no URL de evento (funnel_step=checkout).",
    summary:
      "A MaxWeb deixa escolher Purchase ou Checkout Visit. O URL de venda não traz status=approved. Cole o URL de funil só no evento Checkout Visit, senão a visita ao checkout conta como venda.",
    eventClickIdMacro: "{SUBID}",
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

