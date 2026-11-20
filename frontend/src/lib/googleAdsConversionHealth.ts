/**
 * Saúde do ciclo afiliado Google Ads: upload (stack Integrações) vs conta Paid (Ads Studio).
 * Sem inventar eventos — só classifica estado a partir de settings + sync ledger.
 */

import type { MessageKey } from "@/i18n";

type Translator = (key: MessageKey) => string;

const SYNC_I18N = {
  sent: "pages.dpilot.google.cm.status.syncLabel.sent",
  direct: "pages.dpilot.google.cm.status.syncLabel.direct",
  csv: "pages.dpilot.google.cm.status.syncLabel.csv",
  restated: "pages.dpilot.google.cm.status.syncLabel.restated",
  retracted: "pages.dpilot.google.cm.status.syncLabel.retracted",
  failed: "pages.dpilot.google.cm.status.syncLabel.failed",
  pending: "pages.dpilot.google.cm.status.syncLabel.pending",
  noGclid: "pages.dpilot.google.cm.status.syncLabel.noGclid",
  disabled: "pages.dpilot.google.cm.status.syncLabel.disabled",
} as const satisfies Record<string, MessageKey>;

export function normalizeGoogleCustomerId(id: string | null | undefined): string {
  return String(id ?? "").replace(/\D/g, "");
}

export type CustomerAlign = "match" | "mismatch" | "unknown";

export function alignGoogleCustomers(
  paidCustomerId: string | null | undefined,
  uploadCustomerId: string | null | undefined,
): CustomerAlign {
  const a = normalizeGoogleCustomerId(paidCustomerId);
  const b = normalizeGoogleCustomerId(uploadCustomerId);
  if (!a || !b) return "unknown";
  return a === b ? "match" : "mismatch";
}

export type GoogleAdsSyncBucket = "ok" | "failed" | "pending" | "no_gclid" | "disabled" | "other";

export function bucketGoogleAdsSync(sync: string | null | undefined): GoogleAdsSyncBucket {
  if (sync === "sent" || sync === "restated" || sync === "retracted") return "ok";
  if (sync === "skipped_direct_upload" || sync === "skipped_ads_direct" || sync === "skipped_offline_csv_import") {
    return "ok";
  }
  if (sync === "failed") return "failed";
  if (!sync || sync === "skipped_pending") return "pending";
  if (sync === "skipped_no_gclid") return "no_gclid";
  if (sync === "skipped_disabled" || sync === "skipped_no_config") return "disabled";
  return "other";
}

export type GoogleAdsSyncHealthSummary = {
  total: number;
  ok: number;
  failed: number;
  pending: number;
  no_gclid: number;
  disabled: number;
};

export function summarizeGoogleAdsSyncHealth(
  rows: Array<{ google_ads_sync: string | null }>,
): GoogleAdsSyncHealthSummary {
  const out: GoogleAdsSyncHealthSummary = {
    total: rows.length,
    ok: 0,
    failed: 0,
    pending: 0,
    no_gclid: 0,
    disabled: 0,
  };
  for (const r of rows) {
    const b = bucketGoogleAdsSync(r.google_ads_sync);
    if (b === "ok") out.ok += 1;
    else if (b === "failed") out.failed += 1;
    else if (b === "pending") out.pending += 1;
    else if (b === "no_gclid") out.no_gclid += 1;
    else if (b === "disabled") out.disabled += 1;
  }
  return out;
}

export type ConversionFunnelStatus =
  | "ready"
  | "upload_incomplete"
  | "customer_mismatch"
  | "settings_unknown";

/** Estado do checklist «conversões» no centro de operações. */
export function conversionFunnelStatus(opts: {
  canUpload: boolean | null;
  paidCustomerId: string | null | undefined;
  uploadCustomerId: string | null | undefined;
}): ConversionFunnelStatus {
  if (opts.canUpload == null) return "settings_unknown";
  if (!opts.canUpload) return "upload_incomplete";
  const align = alignGoogleCustomers(opts.paidCustomerId, opts.uploadCustomerId);
  if (align === "mismatch") return "customer_mismatch";
  return "ready";
}

export function googleAdsSyncShortLabel(sync: string | null | undefined, t?: Translator): string {
  const b = bucketGoogleAdsSync(sync);
  if (b === "ok") {
    if (sync === "skipped_direct_upload" || sync === "skipped_ads_direct") {
      return t?.(SYNC_I18N.direct) ?? "Directo";
    }
    if (sync === "skipped_offline_csv_import") return t?.(SYNC_I18N.csv) ?? "CSV";
    if (sync === "restated") return t?.(SYNC_I18N.restated) ?? "Restated";
    if (sync === "retracted") return t?.(SYNC_I18N.retracted) ?? "Retracted";
    return t?.(SYNC_I18N.sent) ?? "Enviado";
  }
  if (b === "failed") return t?.(SYNC_I18N.failed) ?? "Falhou";
  if (b === "pending") return t?.(SYNC_I18N.pending) ?? "Pendente";
  if (b === "no_gclid") return t?.(SYNC_I18N.noGclid) ?? "Sem gclid";
  if (b === "disabled") return t?.(SYNC_I18N.disabled) ?? "Off / sem config";
  return sync || "—";
}
