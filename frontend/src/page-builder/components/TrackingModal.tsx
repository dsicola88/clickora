import { useEffect, useState } from "react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useBuilder } from "../store";
import type { PageTrackingConfig } from "../types";
import { X, BarChart3, Code2 } from "lucide-react";

const labelCls = "block text-[11px] font-medium text-editor-fg-muted mb-1";
const inputCls =
  "w-full rounded bg-editor-panel-2 border border-editor-border px-2 py-1.5 text-xs text-editor-fg placeholder:text-editor-fg-muted focus:outline-none focus:ring-1 focus:ring-editor-accent font-mono";
const textareaCls = `${inputCls} min-h-[80px] resize-y`;

export function TrackingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useAppLocale();
  const doc = useBuilder((s) => s.doc);
  const updateTracking = useBuilder((s) => s.updateTracking);

  const [cfg, setCfg] = useState<PageTrackingConfig>(doc.tracking ?? {});

  useEffect(() => {
    if (open) setCfg(doc.tracking ?? {});
  }, [open, doc.tracking]);

  if (!open) return null;

  const set = <K extends keyof PageTrackingConfig>(k: K, v: PageTrackingConfig[K]) =>
    setCfg((prev) => ({ ...prev, [k]: v }));

  const handleSave = () => {
    updateTracking(cfg);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-editor-border bg-editor-panel text-editor-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-editor-border p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-editor-accent" />
            <div>
              <h2 className="text-base font-semibold">{t("pages.pageBuilder.tracking.title")}</h2>
              <p className="text-[11px] text-editor-fg-muted">
                {t("pages.pageBuilder.tracking.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="editor-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
              {t("pages.pageBuilder.tracking.integrations")}
            </h3>
            <div>
              <label className={labelCls}>{t("pages.pageBuilder.tracking.gtm")}</label>
              <input
                value={cfg.gtmId ?? ""}
                onChange={(e) => set("gtmId", e.target.value.trim() || undefined)}
                className={inputCls}
                placeholder="GTM-XXXXXXX"
              />
            </div>
            <div>
              <label className={labelCls}>{t("pages.pageBuilder.tracking.ga4")}</label>
              <input
                value={cfg.ga4Id ?? ""}
                onChange={(e) => set("ga4Id", e.target.value.trim() || undefined)}
                className={inputCls}
                placeholder="G-XXXXXXXXXX"
              />
            </div>
            <div>
              <label className={labelCls}>{t("pages.pageBuilder.tracking.metaPixel")}</label>
              <input
                value={cfg.metaPixelId ?? ""}
                onChange={(e) => set("metaPixelId", e.target.value.trim() || undefined)}
                className={inputCls}
                placeholder="1234567890"
              />
            </div>
          </section>

          <section className="space-y-2 rounded border border-editor-border bg-editor-panel-2 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
              {t("pages.pageBuilder.tracking.autoEvents")}
            </h3>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={cfg.trackFormSubmits !== false}
                onChange={(e) => set("trackFormSubmits", e.target.checked)}
                className="h-3.5 w-3.5 accent-editor-accent"
              />
              {t("pages.pageBuilder.tracking.trackFormsBefore")}{" "}
              <code className="rounded bg-editor-bg px-1">form_submit</code> /{" "}
              <code className="rounded bg-editor-bg px-1">Lead</code>{" "}
              {t("pages.pageBuilder.tracking.trackFormsAfter")}
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={cfg.trackButtonClicks !== false}
                onChange={(e) => set("trackButtonClicks", e.target.checked)}
                className="h-3.5 w-3.5 accent-editor-accent"
              />
              {t("pages.pageBuilder.tracking.trackClicksBefore")}{" "}
              <code className="rounded bg-editor-bg px-1">button_click</code> /{" "}
              <code className="rounded bg-editor-bg px-1">Contact</code>{" "}
              {t("pages.pageBuilder.tracking.trackClicksAfter")}
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
              <Code2 className="h-3.5 w-3.5" /> {t("pages.pageBuilder.tracking.customCode")}
            </h3>
            <div>
              <label className={labelCls}>{t("pages.pageBuilder.tracking.headInject")}</label>
              <textarea
                value={cfg.customHeadCode ?? ""}
                onChange={(e) => set("customHeadCode", e.target.value || undefined)}
                className={textareaCls}
                placeholder={t("pages.pageBuilder.tracking.headPlaceholder")}
              />
            </div>
            <div>
              <label className={labelCls}>{t("pages.pageBuilder.tracking.bodyInject")}</label>
              <textarea
                value={cfg.customBodyCode ?? ""}
                onChange={(e) => set("customBodyCode", e.target.value || undefined)}
                className={textareaCls}
                placeholder={t("pages.pageBuilder.tracking.bodyPlaceholder")}
              />
            </div>
            <p className="text-[11px] text-editor-fg-muted">
              {t("pages.pageBuilder.tracking.warning")}
            </p>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-editor-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-editor-border bg-editor-panel-2 px-4 py-2 text-xs font-medium text-editor-fg hover:bg-editor-border"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-editor-accent px-4 py-2 text-xs font-medium text-editor-accent-fg hover:opacity-90"
          >
            {t("pages.pageBuilder.tracking.save")}
          </button>
        </footer>
      </div>
    </div>
  );
}
