/**
 * Plataformas de redes de afiliados (postback em Integrações → Plataformas).
 * Fonte única para a página Plataformas e para o combobox "Plataforma" no Construtor de URL.
 *
 * Regra: só entram redes reais com preset documentado (nativo ou S2S honesto).
 * Sem fillers / hints vagos — o catálogo tem de ser verdadeiro e profissional.
 */

export type AffiliatePlatformTier = "native" | "documented_s2s";

export type AffiliatePostbackPreset = {
  /** Texto de ajuda por rede */
  hint: string;
  /** Query string (macros {…} não são codificados — a rede substitui no envio real) */
  params: Record<string, string>;
};

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

export type AffiliatePlatformDef = {
  name: string;
  tier: AffiliatePlatformTier;
  preset: AffiliatePostbackPreset;
  funnel: AffiliateFunnelGuide;
};

const GENERIC_S2S_PARAMS: Record<string, string> = {
  orderid: "{ORDERID}",
  amount: "{COMMISSION_AMOUNT}",
  cy: "USD",
  status: "approved",
  clickora_click_id: "{SUBID}",
  product: "{PRODUCT_CODENAME}",
  subid1: "{SUBID}",
  subid2: "{SUBID2}",
};

const SALE_ONLY = (panelPath: string, summary: string): AffiliateFunnelGuide => ({
  mode: "sale_only",
  panelPath,
  summary,
  supportsLander: false,
});

/**
 * Catálogo profissional — nativas (parser BE) + S2S documentado (contrato genérico honesto).
 * Ordem alfabética por nome; a UI filtra por texto.
 */
export const AFFILIATE_PLATFORM_DEFS: AffiliatePlatformDef[] = [
  {
    name: "AdCombo",
    tier: "documented_s2s",
    preset: {
      hint:
        "AdCombo (S2S). No hoplink use clickid=UUID. No postback ecoe {clickid} em clickora_click_id. Mapeie payout→amount e transactionid→orderid. status tem de ser approved/pending/refund/chargeback (fixe approved se a rede só envia códigos numéricos).",
      params: {
        clickora_click_id: "{clickid}",
        subid1: "{clickid}",
        orderid: "{transactionid}",
        amount: "{payout}",
        cy: "USD",
        status: "approved",
      },
    },
    funnel: SALE_ONLY(
      "AdCombo → Postback da oferta",
      "Tipicamente só conversão/lead pago via postback. Checkout da rede só se o painel oferecer pixel/evento extra.",
    ),
  },
  {
    name: "Awin",
    tier: "documented_s2s",
    preset: {
      hint:
        "Awin não tem IPN nativo nesta app. No postback mapeie o click ref → clickora_click_id, o id da transacção → orderid, a comissão → amount, e status approved/pending/refund/chargeback.",
      params: { ...GENERIC_S2S_PARAMS },
    },
    funnel: SALE_ONLY("Awin → Postbacks / tracking", "Notifica tipicamente na conversão publicada. Sem checkout nativo na dclickora."),
  },
  {
    name: "Braip",
    tier: "documented_s2s",
    preset: {
      hint:
        "Braip (S2S). No hoplink o UUID vai em xcod. No postback ecoe {xcod}. Mapeie o código da transacção → orderid e a comissão → amount. Converta trans_status da Braip para approved/pending/refund/chargeback.",
      params: {
        clickora_click_id: "{xcod}",
        subid1: "{xcod}",
        orderid: "{trans_cod}",
        amount: "{trans_valor_recebido}",
        cy: "BRL",
        status: "approved",
        product: "{prod_name}",
      },
    },
    funnel: SALE_ONLY("Braip → Postback / IPN", "Braip notifica na compra. Sem evento de checkout afiliado na dclickora."),
  },
  {
    name: "BuyGoods",
    tier: "native",
    preset: {
      hint:
        "BuyGoods: venda com {SUBID}/{SUBID2} (o hoplink leva o UUID em subid e subid2). Não leva status=approved fixo. Checkout Visitors entram pelo pixel HTML ou pelo URL de evento Checkout, nunca por este URL.",
      params: {
        subid: "{SUBID}",
        subid2: "{SUBID2}",
        clickora_click_id: "{SUBID2}",
        orderid: "{ORDERID}",
        amount: "{COMMISSION_AMOUNT}",
        product: "{PRODUCT_CODENAME}",
        cy: "USD",
      },
    },
    funnel: {
      mode: "html_funnel_pixels",
      panelPath: "BuyGoods → Funnel Pixels → Checkout (e Lander/VSL se quiser)",
      summary:
        "BuyGoods injecta o teu HTML no checkout (e no lander/VSL). Sem colar o pixel, a dclickora não recebe Checkout Visitors — só o Overview do BuyGoods os conta.",
      supportsLander: true,
    },
  },
  {
    name: "CJ Affiliate",
    tier: "documented_s2s",
    preset: {
      hint:
        "CJ Affiliate não tem adaptador nativo. Mapeie a comissão, o id da acção e o UUID do clique para o contrato genérico (amount, orderid, clickora_click_id, status).",
      params: { ...GENERIC_S2S_PARAMS },
    },
    funnel: SALE_ONLY("CJ → Account → Pixel / Postback", "CJ publica conversões; sem funil de checkout nativo na dclickora."),
  },
  {
    name: "ClickBank",
    tier: "native",
    preset: {
      hint:
        "ClickBank INS chega cifrado (notification + iv). Sem a chave da conta este endpoint não decifra e ignora o aviso. Se os campos já vierem em claro, lê transactionType (SALE, BILL, RFND, CGBK), receipt, totalAccountAmount e tid. Não use macros {SUBID}.",
      params: {},
    },
    funnel: SALE_ONLY(
      "ClickBank → IPN / Hop Toolkit (pixels do vendor, se existirem)",
      "ClickBank afiliado: IPN na venda. Pixels de order form só se o vendor/Hop Toolkit os disponibilizar — não inventamos checkout sem esse slot.",
    ),
  },
  {
    name: "Digistore24",
    tier: "native",
    preset: {
      hint:
        "Digistore24 (S2S). No hoplink: cid + sid1 (se outro tracker já usa cid, o UUID da dclickora fica em sid1). No postback ecoe {sid1} e {cid}. payment+completed/paying é venda. refund e chargeback revertem a transacção. payment_missed não é reembolso.",
      params: {
        cid: "{cid}",
        sid1: "{sid1}",
        clickora_click_id: "{sid1}",
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
    funnel: SALE_ONLY(
      "Digistore24 → Sales & partners → Integrations (S2S postback)",
      "Digistore24 (afiliado) notifica tipicamente na compra via S2S — não há Checkout Visitors oficiais para afiliados. Clique = saída para a oferta; venda = postback.",
    ),
  },
  {
    name: "DrCash",
    tier: "documented_s2s",
    preset: {
      hint:
        "DrCash (S2S). Ecoe o click id da oferta em clickora_click_id. Mapeie o id da conversão → orderid e o payout → amount. Converta o status da rede para approved/pending/refund/chargeback.",
      params: {
        clickora_click_id: "{sub1}",
        subid1: "{sub1}",
        orderid: "{conversion_id}",
        amount: "{payout}",
        cy: "USD",
        status: "approved",
      },
    },
    funnel: SALE_ONLY("DrCash → Offer → Postback", "Postback de conversão/lead. Sem funil checkout nativo na dclickora."),
  },
  {
    name: "Eduzz",
    tier: "documented_s2s",
    preset: {
      hint:
        "Eduzz (S2S). Guarde o UUID num parâmetro custom do hoplink e ecoe-o em clickora_click_id. Mapeie trans_cod→orderid e a comissão→amount. Converta trans_status (pago/cancelado/reembolso) para approved/pending/refund/chargeback.",
      params: {
        clickora_click_id: "{tracker}",
        subid1: "{tracker}",
        orderid: "{trans_cod}",
        amount: "{trans_value}",
        cy: "BRL",
        status: "approved",
      },
    },
    funnel: SALE_ONLY("Eduzz → MyEddings / Postback", "Eduzz notifica na compra. Sem checkout afiliado nativo na dclickora."),
  },
  {
    name: "EverFlow",
    tier: "documented_s2s",
    preset: {
      hint:
        "Everflow (S2S). No hoplink o UUID tipicamente vai em sub1. No postback ecoe {sub1}. Mapeie payout→amount e transaction_id→orderid. status=approved/pending/refund/chargeback (ou fixe approved se o event só dispara em venda).",
      params: {
        clickora_click_id: "{sub1}",
        subid1: "{sub1}",
        orderid: "{transaction_id}",
        amount: "{payout}",
        cy: "USD",
        status: "approved",
      },
    },
    funnel: {
      mode: "event_postback",
      panelPath: "Everflow → postbacks / event pixels conforme o anunciante",
      summary:
        "Everflow costuma permitir event postbacks além da conversão. Use o URL de evento Checkout se o offer o expuser; senão só há venda.",
      eventClickIdMacro: "{sub1}",
      supportsLander: false,
    },
  },
  {
    name: "Hotmart",
    tier: "native",
    preset: {
      hint:
        "Vendas Hotmart (webhook 2.0 do produto), separado do webhook de planos da aplicação. O hoplink recebe src=UUID. Eventos: PURCHASE_APPROVED e PURCHASE_COMPLETE são a mesma transacção; PURCHASE_REFUNDED e PURCHASE_CANCELED revertem; PURCHASE_CHARGEBACK é chargeback; boleto impresso fica pendente. A comissão lida é a linha AFFILIATE, não o preço do comprador.",
      params: {},
    },
    funnel: SALE_ONLY(
      "Hotmart → Webhook / Postback de compra",
      "Hotmart notifica na compra (webhook). Não há evento de «chegou ao checkout Hotmart» para afiliados na dclickora.",
    ),
  },
  {
    name: "Impact",
    tier: "documented_s2s",
    preset: {
      hint:
        "Impact não tem adaptador nativo. Mapeie SharedId → clickora_click_id, ActionId → orderid, a comissão → amount e status do contrato genérico.",
      params: { ...GENERIC_S2S_PARAMS },
    },
    funnel: SALE_ONLY("Impact → Settings → Tracking / Postbacks", "Impact publica acções; sem checkout nativo na dclickora."),
  },
  {
    name: "JVZoo",
    tier: "native",
    preset: {
      hint:
        "JVZoo envia ctransaction (SALE, BILL, RFND, CGBK), ctransreceipt e tid. CANCEL-REBILL não é uma venda nova nem um reembolso da cobrança já paga.",
      params: {},
    },
    funnel: SALE_ONLY("JVZoo → IPN / JVZIPN", "JVZoo notifica na venda via IPN. Sem funil checkout na dclickora."),
  },
  {
    name: "Keitaro",
    tier: "documented_s2s",
    preset: {
      hint:
        "Keitaro reencaminha o que configurar. Aponte o postback para o contrato genérico: clickora_click_id, orderid, amount, status (approved/pending/refund/chargeback).",
      params: { ...GENERIC_S2S_PARAMS },
    },
    funnel: {
      mode: "event_postback",
      panelPath: "Keitaro → Campaign → Postbacks / Goals",
      summary: "Keitaro pode disparar postbacks por goal (venda, checkout…). Configure o goal e cole o URL correcto.",
      eventClickIdMacro: "{subid}",
      supportsLander: false,
    },
  },
  {
    name: "Kiwify",
    tier: "documented_s2s",
    preset: {
      hint:
        "Kiwify envia webhook JSON (order_id, order_status, TrackingParameters). Não use macros GET inventadas: mapeie o TrackingParameters (src/sck) → clickora_click_id e a comissão do afiliado → amount, com status approved/pending/refund/chargeback no contrato genérico se a rede permitir URL custom.",
      params: {},
    },
    funnel: SALE_ONLY("Kiwify → Apps → Webhooks", "Kiwify notifica na compra. Sem checkout afiliado nativo na dclickora."),
  },
  {
    name: "LeadBit",
    tier: "documented_s2s",
    preset: {
      hint:
        "LeadBit (S2S). Ecoe o subid do clique em clickora_click_id. Mapeie o id da lead/sale → orderid e o payout → amount. Converta o status da rede para approved/pending/refund/chargeback.",
      params: {
        clickora_click_id: "{subid}",
        subid1: "{subid}",
        orderid: "{lead_id}",
        amount: "{payout}",
        cy: "USD",
        status: "approved",
      },
    },
    funnel: SALE_ONLY("LeadBit → Offer → Postback", "Postback de lead/sale. Sem funil checkout nativo na dclickora."),
  },
  {
    name: "MaxBounty",
    tier: "documented_s2s",
    preset: {
      hint:
        "MaxBounty (S2S). Ecoe o s1/s2 do hoplink em clickora_click_id. Mapeie o id da conversão → orderid e a comissão → amount. status approved/pending/refund/chargeback.",
      params: {
        clickora_click_id: "{s1}",
        subid1: "{s1}",
        orderid: "{oid}",
        amount: "{payout}",
        cy: "USD",
        status: "approved",
      },
    },
    funnel: SALE_ONLY("MaxBounty → Campaign → Postback URL", "Postback de conversão. Sem checkout nativo na dclickora."),
  },
  {
    name: "MaxWeb",
    tier: "native",
    preset: {
      hint:
        "MaxWeb: o hoplink leva o UUID em subid e subid2. No lander a rede pode mostrar subid=<id do path> — ignore isso; o postback tem de ecoar {SUBID2} (e {SUBID} como backup). Este URL é a compra. Checkout Visit usa o URL de funil (funnel_step=checkout), não este.",
      params: {
        subid: "{SUBID}",
        subid2: "{SUBID2}",
        clickora_click_id: "{SUBID2}",
        orderid: "{ORDERID}",
        amount: "{COMMISSION_AMOUNT}",
        product: "{PRODUCT_CODENAME}",
        cy: "USD",
      },
    },
    funnel: {
      mode: "event_postback",
      panelPath: "MaxWeb → Postback Pixels. Compra neste URL. Checkout Visit no URL de evento (funnel_step=checkout).",
      summary:
        "A MaxWeb deixa escolher Purchase ou Checkout Visit. O URL de venda não traz status=approved. Cole o URL de funil só no evento Checkout Visit, senão a visita ao checkout conta como venda. Use {SUBID2} no click id (o lander pode reescrever subid).",
      eventClickIdMacro: "{SUBID2}",
      supportsLander: false,
    },
  },
  {
    name: "Monetizze",
    tier: "documented_s2s",
    preset: {
      hint:
        "Monetizze (S2S). No hoplink o UUID tipicamente vai em src / referência. No postback ecoe [[src]] ou a referência custom em clickora_click_id. Mapeie [[transacao]]→orderid e [[comissao]]→amount. Converta [[status]] Monetizze para approved/pending/refund/chargeback.",
      params: {
        clickora_click_id: "[[src]]",
        subid1: "[[src]]",
        orderid: "[[transacao]]",
        amount: "[[comissao]]",
        cy: "BRL",
        status: "approved",
        product: "[[produto]]",
      },
    },
    funnel: SALE_ONLY("Monetizze → Ferramentas → Postback", "Monetizze notifica na compra. Sem checkout afiliado nativo na dclickora."),
  },
  {
    name: "Rakuten",
    tier: "documented_s2s",
    preset: {
      hint:
        "Rakuten Advertising não tem adaptador nativo. Use o contrato genérico: clickora_click_id, orderid, amount (comissão) e status.",
      params: { ...GENERIC_S2S_PARAMS },
    },
    funnel: SALE_ONLY("Rakuten → Tracking / Postback", "Publicação de conversões; sem checkout nativo na dclickora."),
  },
  {
    name: "ShareASale",
    tier: "documented_s2s",
    preset: {
      hint:
        "ShareASale não tem adaptador nativo. Mapeie a transacção → orderid, a comissão → amount e o tracking → clickora_click_id, com status approved/pending/refund/chargeback.",
      params: { ...GENERIC_S2S_PARAMS },
    },
    funnel: SALE_ONLY("ShareASale → Merchant / Postback", "Notifica na conversão. Sem funil checkout na dclickora."),
  },
  {
    name: "SmartAdv",
    tier: "native",
    preset: {
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
    funnel: {
      mode: "event_postback",
      panelPath: "SmartAdv → Postbacks → Type: Event (não Conversion) → evento Checkout / Add to Cart se a oferta o tiver",
      summary:
        "SmartAdv distingue Conversion (venda) e Event (checkout, add to cart…). Só ofertas com o evento activo disparam. Confirme no catálogo/relatório Events da SmartAdv.",
      eventClickIdMacro: "{sub3}",
      supportsLander: false,
    },
  },
  {
    name: "TradeDoubler",
    tier: "documented_s2s",
    preset: {
      hint:
        "TradeDoubler não tem adaptador nativo. Mapeie o epi/click ref → clickora_click_id, o id da transacção → orderid e a comissão → amount, com status do contrato genérico.",
      params: { ...GENERIC_S2S_PARAMS },
    },
    funnel: SALE_ONLY("TradeDoubler → Postbacks", "Conversão publicada; sem checkout nativo na dclickora."),
  },
  {
    name: "WarriorPlus",
    tier: "native",
    preset: {
      hint:
        "WarriorPlus envia IPN em POST (WP_ACTION, WP_SALEID, WP_COMMISSION, WP_TID). sale regista a comissão. refund reverte. dispute é chargeback. Não usa {ORDERID}.",
      params: {},
    },
    funnel: SALE_ONLY("WarriorPlus → IPN", "WarriorPlus notifica na venda via IPN. Sem funil checkout na dclickora."),
  },
  {
    name: "Webgains",
    tier: "documented_s2s",
    preset: {
      hint:
        "Webgains não tem adaptador nativo. Mapeie o click reference → clickora_click_id, o id da transacção → orderid e a comissão → amount, com status do contrato genérico.",
      params: { ...GENERIC_S2S_PARAMS },
    },
    funnel: SALE_ONLY("Webgains → Tracking / Postback", "Conversão publicada; sem checkout nativo na dclickora."),
  },
];

/** Lista ordenada para UI (Plataformas / filtros). */
export const AFFILIATE_PLATFORMS: string[] = AFFILIATE_PLATFORM_DEFS.map((d) => d.name);

/** Redes com parser nativo no backend (`parseAffiliatePostback` / `canonicalPlatformId`). */
export const NATIVE_AFFILIATE_PLATFORMS: string[] = AFFILIATE_PLATFORM_DEFS.filter((d) => d.tier === "native").map(
  (d) => d.name,
);

/** @deprecated BR passaram para AFFILIATE_PLATFORMS; mantido vazio para imports legados. */
export const EXTRA_OFFER_PLATFORMS: string[] = [];

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

function uniqueSortedPlatforms(names: string[]): string[] {
  return [...new Set(names.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt", { sensitivity: "base" }),
  );
}

/**
 * Lista completa para o Construtor de URL: tráfego + afiliados + Personalizado no fim.
 */
export function getUrlBuilderPlatformList(): string[] {
  const merged = uniqueSortedPlatforms([...TRAFFIC_SOURCE_PLATFORMS, ...AFFILIATE_PLATFORMS, ...EXTRA_OFFER_PLATFORMS]);
  return [...merged, "Personalizado"];
}

const DEFS_BY_NAME = new Map(AFFILIATE_PLATFORM_DEFS.map((d) => [d.name, d]));

/** Presets indexados (compatível com checklist / código legado). */
export const AFFILIATE_POSTBACK_PRESETS: Record<string, AffiliatePostbackPreset> = Object.fromEntries(
  AFFILIATE_PLATFORM_DEFS.map((d) => [d.name, d.preset]),
);

export const DEFAULT_AFFILIATE_POSTBACK_PRESET: AffiliatePostbackPreset = {
  hint:
    "Contrato genérico desta app, não o IPN nativo da rede. Mapeie a comissão para amount, o id da transacção para orderid e o UUID do clique para clickora_click_id ou subid1. status tem de ser approved, pending, refund ou chargeback. Só use isto para redes fora do catálogo profissional.",
  params: {
    ...GENERIC_S2S_PARAMS,
    subid3: "{SUBID3}",
    subid4: "{SUBID4}",
    subid5: "{SUBID5}",
  },
};

export function getAffiliatePlatformDef(platform: string): AffiliatePlatformDef | undefined {
  return DEFS_BY_NAME.get(platform);
}

export function getAffiliatePostbackPreset(platform: string): AffiliatePostbackPreset {
  return DEFS_BY_NAME.get(platform)?.preset ?? DEFAULT_AFFILIATE_POSTBACK_PRESET;
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

const DEFAULT_FUNNEL_GUIDE: AffiliateFunnelGuide = SALE_ONLY(
  "Painel da rede → Postback / IPN / Pixel (venda)",
  "A maioria das redes só notifica a venda (ou lead pago). A dclickora já regista o Clique (saída para a oferta). Checkout da rede só aparece se colar pixel HTML / Event postback — e só se a rede o injectar ou disparar.",
);

export function getAffiliateFunnelGuide(platform: string): AffiliateFunnelGuide {
  return DEFS_BY_NAME.get(platform)?.funnel ?? DEFAULT_FUNNEL_GUIDE;
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
  const base =
    `${eventBaseUrl}${joiner}platform=${encodeURIComponent(platform)}` +
    `&funnel_step=${step}&status=${step}&clickora_click_id=${macro}&subid1=${macro}`;
  if (platform === "MaxWeb" || platform === "BuyGoods") {
    return `${base}&subid={SUBID}&subid2={SUBID2}`;
  }
  return base;
}
