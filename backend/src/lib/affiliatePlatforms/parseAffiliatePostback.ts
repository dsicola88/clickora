import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AffiliateOutcome =
  | { kind: "approved" }
  | { kind: "pending" }
  | { kind: "refund"; partial: boolean }
  | { kind: "chargeback" }
  | { kind: "funnel"; step: "checkout" | "lander" }
  | { kind: "ignore"; reason: string };

export type ParsedAffiliatePostback = {
  adapterId: string;
  clickId: string | null;
  /** Chave de idempotência. Transacção, não o id da encomenda, quando a rede distingue os dois. */
  externalId: string | null;
  /** Encomenda estável (rebills). Serve para localizar a venda quando o reembolso traz outro transaction id. */
  networkOrderId: string | null;
  amount: Prisma.Decimal | null;
  currency: string;
  product: string | null;
  outcome: AffiliateOutcome;
  statusRaw: string | null;
};

const SECRET_KEY = /token|secret|password|authorization|hottok|cverify|signature|api[_-]?key/i;

/** Remove segredos antes de gravar log ou metadados. */
export function redactAffiliateFlat(flat: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : v;
  }
  return out;
}

function norm(raw: string | undefined | null): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function uuidOf(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

function firstUuid(flat: Record<string, string>, keys: string[]): string | null {
  for (const k of keys) {
    const id = uuidOf(flat[k]);
    if (id) return id;
  }
  return null;
}

function firstText(flat: Record<string, string>, keys: string[], max = 200): string | null {
  for (const k of keys) {
    const v = flat[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
  }
  return null;
}

export function parseMoney(raw: string | undefined | null): Prisma.Decimal | null {
  if (raw == null) return null;
  const cleaned = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(n);
}

function moneyFrom(flat: Record<string, string>, keys: string[]): Prisma.Decimal | null {
  for (const k of keys) {
    if (flat[k] === undefined) continue;
    const n = parseMoney(flat[k]);
    if (n) return n;
  }
  return null;
}

function currencyFrom(flat: Record<string, string>, keys: string[], fallback = "USD"): string {
  const raw = firstText(flat, keys, 8);
  return (raw || fallback).toUpperCase().slice(0, 8) || fallback;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function dig(body: unknown, path: string[]): unknown {
  let cur: unknown = body;
  for (const key of path) {
    const rec = asRecord(cur);
    if (!rec) return undefined;
    cur = rec[key];
  }
  return cur;
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function isCheckoutWord(raw: string): boolean {
  const t = norm(raw);
  return (
    t === "checkout" ||
    t === "initiate_checkout" ||
    t === "initiatecheckout" ||
    t === "order_form" ||
    t === "checkout_visit" ||
    t === "checkout_visitor"
  );
}

function isLanderWord(raw: string): boolean {
  const t = norm(raw);
  return t === "lander" || t === "landing" || t === "vsl" || t === "landing_page" || t === "view_content";
}

function funnelFrom(flat: Record<string, string>): "checkout" | "lander" | null {
  const explicit = norm(flat.funnel_step || flat.funnel);
  if (explicit === "checkout" || explicit === "lander") return explicit;
  const event = flat.event || flat.event_name || flat.event_type || "";
  if (isCheckoutWord(event) || isCheckoutWord(flat.status || "")) return "checkout";
  if (isLanderWord(event) || isLanderWord(flat.status || "")) return "lander";
  return null;
}

function done(
  adapterId: string,
  flat: Record<string, string>,
  partial: Omit<ParsedAffiliatePostback, "adapterId" | "product" | "networkOrderId"> & {
    product?: string | null;
    networkOrderId?: string | null;
  },
): ParsedAffiliatePostback {
  return {
    adapterId,
    product: partial.product ?? firstText(flat, ["product", "PRODUCT_CODENAME", "product_name"]),
    networkOrderId: partial.networkOrderId ?? partial.externalId,
    ...partial,
  };
}

function parseDigistore(flat: Record<string, string>): ParsedAffiliatePostback {
  const tx = norm(flat.transaction_type);
  const billing = norm(flat.billing_status || flat.order_billing_status);
  const clickId = firstUuid(flat, ["cid", "sid1", "clickora_click_id"]);
  const networkOrderId = firstText(flat, ["order_id", "orderid"]);
  const externalId = firstText(flat, ["transaction_id"]) || networkOrderId;
  const currency = currencyFrom(flat, ["currency", "cy"]);
  let amount: Prisma.Decimal | null = null;
  if (flat.amount_affiliate !== undefined) amount = parseMoney(flat.amount_affiliate);
  else if (!flat.amount_brutto && !flat.amount_net && !flat.amount_vendor) amount = parseMoney(flat.amount);

  const base = { clickId, externalId, networkOrderId, amount, currency, statusRaw: billing || tx || null };

  if (tx === "refund") return done("digistore24", flat, { ...base, outcome: { kind: "refund", partial: norm(flat.refund_type) === "partial" } });
  if (tx === "chargeback") return done("digistore24", flat, { ...base, outcome: { kind: "chargeback" } });
  if (tx === "payment_missed" || tx === "payment_denial" || tx === "rebill_cancelled" || tx === "rebill_canceled") {
    return done("digistore24", flat, { ...base, outcome: { kind: "ignore", reason: tx } });
  }
  if (tx && tx !== "payment") {
    return done("digistore24", flat, { ...base, outcome: { kind: "ignore", reason: `transaction_type:${tx}` } });
  }
  if (billing === "completed" || billing === "paying") {
    return done("digistore24", flat, { ...base, outcome: { kind: "approved" } });
  }
  if (billing === "unpaid" || billing === "reminding") {
    return done("digistore24", flat, { ...base, outcome: { kind: "pending" } });
  }
  return done("digistore24", flat, { ...base, outcome: { kind: "ignore", reason: billing ? `billing_status:${billing}` : "sem_estado" } });
}

/** O URL já colado trazia status=approved fixo e o estado real em transaction_type. */
function statusFromInstalledUrl(flat: Record<string, string>): string {
  const declared = norm(flat.status);
  const tx = norm(flat.transaction_type || flat.event);
  const movement =
    tx === "refund" ||
    tx === "refunded" ||
    tx === "partial_refund" ||
    tx === "chargeback" ||
    tx === "charge_back" ||
    tx === "cancel" ||
    tx === "cancelled" ||
    tx === "canceled";
  if (declared === "approved" && movement) return tx;
  return declared || tx;
}

function parseSubidCommission(adapterId: string, flat: Record<string, string>): ParsedAffiliatePostback {
  const funnel = funnelFrom(flat);
  const clickId = firstUuid(flat, ["subid", "SUBID", "clickora_click_id", "subid1", "s1"]);
  const externalId = firstText(flat, ["ORDERID", "orderid", "order_id"]);
  const amount = moneyFrom(flat, ["COMMISSION_AMOUNT", "commission_amount", "amount"]);
  const currency = currencyFrom(flat, ["currency", "cy", "CURRENCY"]);
  const status = statusFromInstalledUrl(flat);
  const base = { clickId, externalId, amount, currency, statusRaw: status || null };

  if (funnel && status !== "approved" && status !== "sale" && status !== "purchase") {
    return done(adapterId, flat, { ...base, outcome: { kind: "funnel", step: funnel } });
  }
  if (
    status === "partial_refund" ||
    status === "refund" ||
    status === "refunded" ||
    status === "cancel" ||
    status === "cancelled" ||
    status === "canceled"
  ) {
    return done(adapterId, flat, { ...base, outcome: { kind: "refund", partial: status === "partial_refund" } });
  }
  if (status === "chargeback" || status === "charge_back") {
    return done(adapterId, flat, { ...base, outcome: { kind: "chargeback" } });
  }
  if (status === "pending" || status === "hold" || status === "on_hold") {
    return done(adapterId, flat, { ...base, outcome: { kind: "pending" } });
  }
  if ((!status || status === "approved" || status === "sale" || status === "purchase") && (externalId || amount)) {
    return done(adapterId, flat, { ...base, outcome: { kind: "approved" } });
  }
  return done(adapterId, flat, { ...base, outcome: { kind: "ignore", reason: status ? `status:${status}` : "sem_encomenda" } });
}

function parseSmartAdv(flat: Record<string, string>): ParsedAffiliatePostback {
  const funnel = funnelFrom(flat);
  const clickId = firstUuid(flat, ["sub3", "cid", "clickora_click_id"]);
  const externalId = firstText(flat, ["transaction_id", "orderid", "order_id"]);
  const amount = moneyFrom(flat, ["payout", "amount"]);
  const currency = currencyFrom(flat, ["currency", "cy"]);
  const status = statusFromInstalledUrl(flat);
  const base = { clickId, externalId, amount, currency, statusRaw: status || null };

  if (status === "refund" || status === "refunded" || status === "reversed") {
    return done("smartadv", flat, { ...base, outcome: { kind: "refund", partial: false } });
  }
  if (status === "chargeback") return done("smartadv", flat, { ...base, outcome: { kind: "chargeback" } });
  if (status === "rejected" || status === "trash" || status === "declined") {
    return done("smartadv", flat, { ...base, outcome: { kind: "ignore", reason: status } });
  }
  if (status === "pending" || status === "hold") return done("smartadv", flat, { ...base, outcome: { kind: "pending" } });
  if (status === "approved" || status === "sale" || status === "conversion") {
    return done("smartadv", flat, { ...base, outcome: { kind: "approved" } });
  }
  if (funnel) return done("smartadv", flat, { ...base, outcome: { kind: "funnel", step: funnel } });
  return done("smartadv", flat, { ...base, outcome: { kind: "ignore", reason: status ? `status:${status}` : "sem_estado" } });
}

function hotmartAffiliateCommission(body: unknown): { amount: Prisma.Decimal | null; currency: string | null } {
  const rows = dig(body, ["data", "commissions"]);
  if (!Array.isArray(rows)) return { amount: null, currency: null };
  for (const row of rows) {
    const rec = asRecord(row);
    if (!rec) continue;
    if (String(rec.source || "").toUpperCase() !== "AFFILIATE") continue;
    const amount = parseMoney(str(rec.value));
    const currency = str(rec.currency_value) || str(rec.currency_code) || str(rec.currency);
    return { amount, currency };
  }
  return { amount: null, currency: null };
}

function parseHotmartAffiliate(flat: Record<string, string>, body: unknown): ParsedAffiliatePostback {
  const event = (str(dig(body, ["event"])) || flat.event || "").trim();
  const purchaseStatus = str(dig(body, ["data", "purchase", "status"])) || "";
  const eventNorm = norm(event || purchaseStatus);
  const clickId = firstUuid(flat, ["src", "sck", "clickora_click_id"]) ||
    uuidOf(str(dig(body, ["data", "purchase", "origin", "src"]))) ||
    uuidOf(str(dig(body, ["data", "purchase", "origin", "sck"])));
  const externalId =
    str(dig(body, ["data", "purchase", "transaction"])) ||
    firstText(flat, ["transaction", "transaction_id"]);
  const commission = hotmartAffiliateCommission(body);
  const amount = commission.amount || moneyFrom(flat, ["commission", "affiliate_commission"]);
  const currency = (commission.currency || currencyFrom(flat, ["currency", "currency_code"])).toUpperCase().slice(0, 8);
  const base = { clickId, externalId, amount, currency, statusRaw: event || purchaseStatus || null };

  const purchaseNorm = norm(purchaseStatus);
  if (
    eventNorm === "purchase_refunded" ||
    eventNorm === "purchase_canceled" ||
    eventNorm === "purchase_cancelled" ||
    purchaseNorm === "partially_refunded" ||
    purchaseNorm === "refunded"
  ) {
    return done("hotmart", flat, {
      ...base,
      outcome: { kind: "refund", partial: purchaseNorm === "partially_refunded" },
    });
  }
  if (eventNorm === "purchase_chargeback" || norm(purchaseStatus) === "chargeback") {
    return done("hotmart", flat, { ...base, outcome: { kind: "chargeback" } });
  }
  if (eventNorm === "purchase_billet_printed" || eventNorm === "purchase_delayed" || norm(purchaseStatus) === "waiting_payment" || norm(purchaseStatus) === "printed_billet") {
    return done("hotmart", flat, { ...base, outcome: { kind: "pending" } });
  }
  if (eventNorm === "purchase_approved" || eventNorm === "purchase_complete" || norm(purchaseStatus) === "approved" || norm(purchaseStatus) === "complete") {
    return done("hotmart", flat, { ...base, outcome: { kind: "approved" } });
  }
  if (eventNorm === "purchase_expired" || eventNorm === "purchase_protest") {
    return done("hotmart", flat, { ...base, outcome: { kind: "ignore", reason: eventNorm } });
  }
  return done("hotmart", flat, { ...base, outcome: { kind: "ignore", reason: eventNorm ? `event:${eventNorm}` : "evento_hotmart_desconhecido" } });
}

function parseClickBank(flat: Record<string, string>, body: unknown): ParsedAffiliatePostback {
  const envelope = asRecord(body);
  const encrypted = Boolean(envelope && (envelope.notification || envelope.iv) && !flat.transactionType && !flat.transaction_type);
  const tx = (flat.transactionType || flat.transaction_type || "").trim().toUpperCase();
  const clickId =
    firstUuid(flat, ["tid", "trackingId", "tracking_id", "clickora_click_id"]) ||
    uuidOf(flat.trackingCodes);
  const externalId = firstText(flat, ["receipt", "transaction_id"]);
  const amount = moneyFrom(flat, ["totalAccountAmount", "affiliateCommission"]);
  const currency = currencyFrom(flat, ["currency"], "USD");
  const base = { clickId, externalId, amount, currency, statusRaw: tx || null };

  if (encrypted || (!tx && (flat.notification || flat.iv))) {
    return done("clickbank", flat, { ...base, outcome: { kind: "ignore", reason: "clickbank_encrypted" } });
  }
  if (tx === "SALE" || tx === "BILL" || tx === "TEST" || tx === "TEST_SALE" || tx === "TEST_BILL") {
    return done("clickbank", flat, { ...base, outcome: { kind: "approved" } });
  }
  if (tx === "RFND" || tx === "TEST_RFND") return done("clickbank", flat, { ...base, outcome: { kind: "refund", partial: false } });
  if (tx === "CGBK" || tx === "INSF" || tx === "TEST_CGBK") return done("clickbank", flat, { ...base, outcome: { kind: "chargeback" } });
  if (tx === "CANCEL-REBILL" || tx === "UNCANCEL-REBILL" || tx === "ABANDONED_ORDER" || tx === "SUBSCRIPTION-CHG") {
    return done("clickbank", flat, { ...base, outcome: { kind: "ignore", reason: tx } });
  }
  return done("clickbank", flat, { ...base, outcome: { kind: "ignore", reason: tx ? `transactionType:${tx}` : "clickbank_sem_tipo" } });
}

function parseWarriorPlus(flat: Record<string, string>): ParsedAffiliatePostback {
  const action = norm(flat.WP_ACTION || flat.wp_action);
  const clickId = firstUuid(flat, ["WP_TID", "tid", "clickora_click_id"]);
  const externalId = firstText(flat, ["WP_SALEID", "WP_SALE", "WP_TXNID"]);
  const amount = moneyFrom(flat, ["WP_COMMISSION", "WP_AFF_COMMISSION", "WP_AFF_AMOUNT"]);
  const currency = currencyFrom(flat, ["currency", "cy"], "USD");
  const base = { clickId, externalId, amount, currency, statusRaw: action || null };

  if (action === "refund") return done("warriorplus", flat, { ...base, outcome: { kind: "refund", partial: false } });
  if (action === "dispute") return done("warriorplus", flat, { ...base, outcome: { kind: "chargeback" } });
  if (action === "sale" || action.includes("sale")) {
    return done("warriorplus", flat, { ...base, outcome: { kind: "approved" } });
  }
  return done("warriorplus", flat, { ...base, outcome: { kind: "ignore", reason: action ? `WP_ACTION:${action}` : "sem_wp_action" } });
}

function parseJvzoo(flat: Record<string, string>): ParsedAffiliatePostback {
  const tx = (flat.ctransaction || "").trim().toUpperCase();
  const clickId = firstUuid(flat, ["tid", "ctid", "clickora_click_id"]);
  const externalId = firstText(flat, ["ctransreceipt", "receipt"]);
  const amount = moneyFrom(flat, ["caffitid_amount", "ctransamount"]);
  const currency = currencyFrom(flat, ["currency"], "USD");
  const base = { clickId, externalId, amount, currency, statusRaw: tx || null };

  if (tx === "RFND") return done("jvzoo", flat, { ...base, outcome: { kind: "refund", partial: false } });
  if (tx === "CGBK" || tx === "INSF") return done("jvzoo", flat, { ...base, outcome: { kind: "chargeback" } });
  if (tx === "SALE" || tx === "BILL") return done("jvzoo", flat, { ...base, outcome: { kind: "approved" } });
  if (tx === "CANCEL-REBILL" || tx === "UNCANCEL-REBILL") {
    return done("jvzoo", flat, { ...base, outcome: { kind: "ignore", reason: tx } });
  }
  return done("jvzoo", flat, { ...base, outcome: { kind: "ignore", reason: tx ? `ctransaction:${tx}` : "sem_ctransaction" } });
}

/** Contrato explícito para redes sem IPN próprio. Não lê campos de outras plataformas. */
function parseGeneric(flat: Record<string, string>, adapterId = "generic"): ParsedAffiliatePostback {
  const funnel = funnelFrom(flat);
  const clickId = firstUuid(flat, ["clickora_click_id", "subid1"]);
  const externalId = firstText(flat, ["orderid", "order_id", "transaction_id"]);
  const amount = moneyFrom(flat, ["amount"]);
  const currency = currencyFrom(flat, ["cy", "currency"]);
  const status = norm(flat.status);
  const tx = norm(flat.transaction_type);
  const base = { clickId, externalId, amount, currency, statusRaw: status || tx || null };

  if (
    tx === "partial_refund" ||
    status === "partial_refund" ||
    tx === "refund" ||
    tx === "refunded" ||
    status === "refund" ||
    status === "refunded" ||
    status === "cancelled" ||
    status === "canceled"
  ) {
    return done(adapterId, flat, {
      ...base,
      outcome: { kind: "refund", partial: tx === "partial_refund" || status === "partial_refund" },
    });
  }
  if (tx === "chargeback" || status === "chargeback") return done(adapterId, flat, { ...base, outcome: { kind: "chargeback" } });
  if (funnel && status !== "approved") return done(adapterId, flat, { ...base, outcome: { kind: "funnel", step: funnel } });
  if (status === "pending" || status === "hold") return done(adapterId, flat, { ...base, outcome: { kind: "pending" } });
  if (status === "approved" || status === "sale" || status === "paid") {
    return done(adapterId, flat, { ...base, outcome: { kind: "approved" } });
  }
  return done(adapterId, flat, { ...base, outcome: { kind: "ignore", reason: status ? `status:${status}` : "status_obrigatorio" } });
}

const NAMED: Record<string, (flat: Record<string, string>, body: unknown) => ParsedAffiliatePostback> = {
  digistore24: (flat) => parseDigistore(flat),
  buygoods: (flat) => parseSubidCommission("buygoods", flat),
  maxweb: (flat) => parseSubidCommission("maxweb", flat),
  smartadv: (flat) => parseSmartAdv(flat),
  hotmart: (flat, body) => parseHotmartAffiliate(flat, body),
  clickbank: (flat, body) => parseClickBank(flat, body),
  warriorplus: (flat) => parseWarriorPlus(flat),
  jvzoo: (flat) => parseJvzoo(flat),
};

const NAME_TO_ID: Record<string, string> = {
  digistore24: "digistore24",
  digistore: "digistore24",
  buygoods: "buygoods",
  maxweb: "maxweb",
  smartadv: "smartadv",
  hotmart: "hotmart",
  clickbank: "clickbank",
  warriorplus: "warriorplus",
  jvzoo: "jvzoo",
};

export function canonicalPlatformId(name: string | null | undefined): string | null {
  const key = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "");
  return NAME_TO_ID[key] || null;
}

const LEGACY_IGNORE = new Set([
  "clickbank_sem_tipo",
  "sem_wp_action",
  "sem_ctransaction",
  "evento_hotmart_desconhecido",
]);

/** URL genérico que as campanhas já tinham colado, antes do IPN nativo. */
function legacyInstalledPostback(flat: Record<string, string>, reason: string | undefined): boolean {
  if (!reason || !LEGACY_IGNORE.has(reason)) return false;
  if (flat.notification || flat.iv || flat.ctransaction || flat.cverify || flat.WP_ACTION || flat.wp_action) return false;
  const status = norm(flat.status);
  if (status !== "approved" && status !== "pending" && status !== "refund" && status !== "refunded" && status !== "chargeback") {
    return false;
  }
  return Boolean(firstText(flat, ["orderid", "ORDERID"]) || firstUuid(flat, ["clickora_click_id", "subid1"]));
}

function fingerprint(flat: Record<string, string>, body: unknown): string | null {
  const event = (str(dig(body, ["event"])) || flat.event || "").toUpperCase();
  if (event.startsWith("PURCHASE_") || flat.WP_ACTION || flat.wp_action) {
    if (event.startsWith("PURCHASE_")) return "hotmart";
  }
  if (flat.WP_ACTION || flat.wp_action || flat.WP_SALEID) return "warriorplus";
  if (flat.ctransaction || flat.cverify) return "jvzoo";
  if (flat.transactionType || flat.notification || flat.iv) return "clickbank";
  if (flat.billing_status || flat.amount_affiliate || flat.order_billing_status) return "digistore24";
  if (flat.COMMISSION_AMOUNT || flat.PRODUCT_CODENAME) return null;
  if (flat.payout && (flat.sub3 || flat.transaction_id) && !flat.billing_status) return "smartadv";
  return null;
}

export function parseAffiliatePostback(input: {
  platform?: string | null;
  flat: Record<string, string>;
  body?: unknown;
}): ParsedAffiliatePostback {
  const body = input.body ?? null;
  const named = canonicalPlatformId(input.platform);
  if (named && NAMED[named]) {
    const parsed = NAMED[named](input.flat, body);
    if (parsed.outcome.kind === "ignore" && legacyInstalledPostback(input.flat, parsed.outcome.reason)) {
      return parseGeneric(input.flat, named);
    }
    return parsed;
  }
  if (input.platform && norm(input.platform) !== "postback") {
    return parseGeneric(input.flat, `generic:${norm(input.platform).slice(0, 40)}`);
  }
  const detected = fingerprint(input.flat, body);
  if (detected === "hotmart") return parseHotmartAffiliate(input.flat, body);
  if (detected && NAMED[detected]) return NAMED[detected](input.flat, body);
  if (!input.platform && (input.flat.COMMISSION_AMOUNT || input.flat.PRODUCT_CODENAME || input.flat.SUBID)) {
    return parseSubidCommission("subid_commission", input.flat);
  }
  return parseGeneric(input.flat);
}

const REFUND_EPSILON = 0.01;

/**
 * Reembolso com valor estritamente menor que a venda fica parcial.
 * Chargeback, valor em falta, valor zero ou valor que esgota a venda ficam totais.
 * A flag `partial` do adaptador não decide sozinha: a Digistore24 e a BuyGoods
 * não têm esse campo no postback oficial.
 */
export function classifyRefundAdjustment(args: {
  kind: "refund" | "chargeback";
  existingAmount: number | null;
  refundAmount: number | null;
}): "partial" | "full" {
  if (args.kind !== "refund") return "full";
  if (args.existingAmount == null || args.refundAmount == null) return "full";
  if (!(args.refundAmount > 0) || !Number.isFinite(args.existingAmount) || !Number.isFinite(args.refundAmount)) {
    return "full";
  }
  const remainder = args.existingAmount - args.refundAmount;
  return remainder >= REFUND_EPSILON ? "partial" : "full";
}

export function refundTransactionIds(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const raw = (metadata as Record<string, unknown>).refund_transaction_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** Acrescenta o id deste evento de reembolso sem apagar os anteriores. */
export function metadataWithRefundTxn(
  existingMetadata: unknown,
  extra: Record<string, unknown>,
  txnId: string | null,
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...(existingMetadata as Record<string, unknown>) }
      : {};
  const ids = refundTransactionIds(base);
  if (txnId && !ids.includes(txnId)) ids.push(txnId);
  const merged: Record<string, unknown> = { ...base, ...extra };
  if (ids.length > 0) merged.refund_transaction_ids = ids;
  return merged;
}

/** Campos do POST da JVZoo. A query do webhook (token, platform) não entra na assinatura. */
export function jvzooSignedFields(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value == null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value);
    }
  }
  return out;
}

/**
 * JVZIPN: chaves ordenadas, valores unidos por "|", segredo no fim, SHA-1 UTF-8, 8 hex maiúsculos.
 * Documentado nos exemplos oficiais de verificação do IPN (não é o preço do cliente).
 */
export function jvzooExpectedCverify(fields: Record<string, string>, secret: string): string {
  const keys = Object.keys(fields)
    .filter((key) => key !== "cverify")
    .sort();
  const pop = `${keys.map((key) => fields[key]).join("|")}|${secret}`;
  return createHash("sha1").update(Buffer.from(pop, "utf8")).digest("hex").slice(0, 8).toUpperCase();
}

export function jvzooCverifyMatches(fields: Record<string, string>, secret: string): boolean {
  const got = (fields.cverify || "").trim().toUpperCase();
  const expected = jvzooExpectedCverify(fields, secret);
  if (!got || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** Repetição idêntica sem id da rede não abre outra venda. */
export function fallbackExternalId(parsed: ParsedAffiliatePostback): string | null {
  if (parsed.externalId) return parsed.externalId;
  if (!parsed.clickId && !parsed.amount && !parsed.product) return null;
  const basis = [
    parsed.adapterId,
    parsed.clickId || "",
    parsed.amount != null ? parsed.amount.toString() : "",
    parsed.currency,
    parsed.product || "",
    parsed.outcome.kind,
  ].join("|");
  return `fp:${createHash("sha256").update(basis).digest("hex").slice(0, 40)}`;
}

export function buildTestSaleQuery(platform: string, clickId: string, orderId: string): Record<string, string> {
  const id = canonicalPlatformId(platform);
  if (id === "digistore24") {
    return {
      platform: "Digistore24",
      cid: clickId,
      billing_status: "completed",
      transaction_type: "payment",
      transaction_id: orderId,
      amount_affiliate: "1.00",
      currency: "USD",
    };
  }
  if (id === "buygoods" || id === "maxweb") {
    return {
      platform: id === "maxweb" ? "MaxWeb" : "BuyGoods",
      subid: clickId,
      clickora_click_id: clickId,
      orderid: orderId,
      amount: "1.00",
      cy: "USD",
    };
  }
  if (id === "smartadv") {
    return {
      platform: "SmartAdv",
      sub3: clickId,
      transaction_id: orderId,
      payout: "1.00",
      status: "approved",
    };
  }
  if (id === "hotmart") {
    return {
      platform: "Hotmart",
      src: clickId,
      event: "PURCHASE_APPROVED",
      transaction: orderId,
      commission: "1.00",
      currency: "BRL",
    };
  }
  if (id === "clickbank") {
    return {
      platform: "ClickBank",
      transactionType: "SALE",
      receipt: orderId,
      totalAccountAmount: "1.00",
      tid: clickId,
      currency: "USD",
    };
  }
  if (id === "warriorplus") {
    return {
      platform: "WarriorPlus",
      WP_ACTION: "sale",
      WP_SALEID: orderId,
      WP_COMMISSION: "1.00",
      WP_TID: clickId,
    };
  }
  if (id === "jvzoo") {
    return {
      platform: "JVZoo",
      ctransaction: "SALE",
      ctransreceipt: orderId,
      ctransamount: "1.00",
      tid: clickId,
    };
  }
  return {
    platform: platform || "generic",
    clickora_click_id: clickId,
    subid1: clickId,
    orderid: orderId,
    amount: "1.00",
    cy: "USD",
    status: "approved",
  };
}
