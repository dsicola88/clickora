import { useEffect, useState } from "react";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useBuilder } from "../store";
import type { PageSeo } from "../types";
import { Search, X, Globe2, FileImage } from "lucide-react";
import { BuilderImageUrlField } from "./PropertyControls";

const labelCls = "block text-[11px] font-medium text-editor-fg-muted mb-1";
const inputCls =
  "w-full rounded bg-editor-panel-2 border border-editor-border px-2 py-1.5 text-xs text-editor-fg placeholder:text-editor-fg-muted focus:outline-none focus:ring-1 focus:ring-editor-accent";

export function SeoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useAppLocale();
  const doc = useBuilder((s) => s.doc);
  const updateSeo = useBuilder((s) => s.updateSeo);
  const updateName = useBuilder((s) => s.updateName);

  const [name, setName] = useState(doc.name);
  const [seo, setSeo] = useState<PageSeo>(doc.seo ?? {});

  useEffect(() => {
    if (open) {
      setName(doc.name);
      setSeo(doc.seo ?? {});
    }
  }, [open, doc.name, doc.seo]);

  if (!open) return null;

  const set = <K extends keyof PageSeo>(k: K, v: PageSeo[K]) =>
    setSeo((prev) => ({ ...prev, [k]: v }));

  const handleSave = () => {
    if (name.trim() && name !== doc.name) updateName(name.trim());
    updateSeo(seo);
    onClose();
  };

  const previewTitle = seo.title || name || t("pages.pageBuilder.seo.previewTitle");
  const previewDesc = seo.description || t("pages.pageBuilder.seo.previewDesc");
  const previewUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${t("pages.pageBuilder.seo.previewPath")}`
      : t("pages.pageBuilder.seo.previewPath");

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-editor-border bg-editor-panel text-editor-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-editor-border p-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-editor-accent" />
            <h2 className="text-base font-semibold">{t("pages.pageBuilder.seo.title")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="editor-scrollbar grid flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
              <Globe2 className="h-3.5 w-3.5" /> {t("pages.pageBuilder.seo.general")}
            </h3>

            <div>
              <label className={labelCls}>{t("pages.pageBuilder.seo.internalName")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder={t("pages.pageBuilder.seo.internalPlaceholder")}
              />
            </div>

            <div>
              <label className={labelCls}>
                {fill(t("pages.pageBuilder.seo.titleLabel"), { max: 60, n: (seo.title ?? "").length })}
              </label>
              <input
                value={seo.title ?? ""}
                maxLength={70}
                onChange={(e) => set("title", e.target.value)}
                className={inputCls}
                placeholder={t("pages.pageBuilder.seo.titlePlaceholder")}
              />
            </div>

            <div>
              <label className={labelCls}>
                {fill(t("pages.pageBuilder.seo.descriptionLabel"), {
                  max: 160,
                  n: (seo.description ?? "").length,
                })}
              </label>
              <textarea
                value={seo.description ?? ""}
                maxLength={200}
                rows={3}
                onChange={(e) => set("description", e.target.value)}
                className={inputCls}
                placeholder={t("pages.pageBuilder.seo.descriptionPlaceholder")}
              />
            </div>

            <div>
              <label className={labelCls}>{t("pages.pageBuilder.seo.keywords")}</label>
              <input
                value={seo.keywords ?? ""}
                onChange={(e) => set("keywords", e.target.value)}
                className={inputCls}
                placeholder={t("pages.pageBuilder.seo.keywordsPlaceholder")}
              />
            </div>

            <h3 className="flex items-center gap-1.5 pt-2 text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
              <FileImage className="h-3.5 w-3.5" /> {t("pages.pageBuilder.seo.images")}
            </h3>

            <div>
              <BuilderImageUrlField
                label={t("pages.pageBuilder.seo.ogImage")}
                value={seo.ogImage ?? ""}
                onChange={(v) => set("ogImage", v)}
                placeholder={t("pages.pageBuilder.seo.ogPlaceholder")}
              />
              <p className="mt-1 text-[10px] text-editor-fg-muted">
                {t("pages.pageBuilder.seo.ogHint")}
              </p>
            </div>

            <div>
              <label className={labelCls}>{t("pages.pageBuilder.seo.favicon")}</label>
              <input
                value={seo.favicon ?? ""}
                onChange={(e) => set("favicon", e.target.value)}
                className={inputCls}
                placeholder="https://.../favicon.ico"
              />
            </div>

            <div>
              <label className={labelCls}>{t("pages.pageBuilder.seo.canonical")}</label>
              <input
                value={seo.canonicalUrl ?? ""}
                onChange={(e) => set("canonicalUrl", e.target.value)}
                className={inputCls}
                placeholder={t("pages.pageBuilder.seo.canonicalPlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-start gap-2 text-xs leading-snug">
                <input
                  type="checkbox"
                  checked={seo.allowSearchIndexing === true && seo.noindex !== true}
                  onChange={(e) => {
                    const on = e.target.checked;
                    set("allowSearchIndexing", on);
                    set("noindex", on ? false : true);
                  }}
                  className="mt-0.5 h-3.5 w-3.5 accent-editor-accent"
                />
                <span>
                  {t("pages.pageBuilder.seo.allowIndex")}
                  <span className="mt-0.5 block text-[11px] text-editor-fg-muted">
                    {t("pages.pageBuilder.seo.allowIndexHint")}
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
              {t("pages.pageBuilder.seo.preview")}
            </h3>

            {/* Google preview */}
            {/* Pré-visualização SERP: cores fixas de propósito (imitam o Google, não o tema do editor). */}
            <div className="rounded border border-editor-border bg-[#fff] p-4 text-left shadow-sm">
              <div className="text-[11px] text-[#5f6368]">{previewUrl}</div>
              <div className="mt-1 truncate text-[18px] leading-tight text-[#1a0dab]">
                {previewTitle}
              </div>
              <div className="mt-1 line-clamp-2 text-[13px] text-[#4d5156]">{previewDesc}</div>
            </div>

            {/* Social preview — cartão claro estilo redes, independente do chrome */}
            <div className="overflow-hidden rounded border border-editor-border bg-[#fff] shadow-sm">
              {seo.ogImage ? (
                <img
                  src={seo.ogImage}
                  alt="OG preview"
                  className="h-40 w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
                  {t("pages.pageBuilder.seo.noImage")}
                </div>
              )}
              <div className="space-y-1 p-3">
                <div className="text-[10px] uppercase text-gray-500">
                  {previewUrl.replace(/^https?:\/\//, "").split("/")[0]}
                </div>
                <div className="line-clamp-2 text-sm font-semibold text-gray-900">
                  {previewTitle}
                </div>
                <div className="line-clamp-2 text-xs text-gray-600">{previewDesc}</div>
              </div>
            </div>

            <p className="text-[11px] text-editor-fg-muted">
              {t("pages.pageBuilder.seo.metaBefore")}{" "}
              <code className="rounded bg-editor-bg px-1">{t("pages.pageBuilder.seo.previewPath")}</code>{" "}
              {t("pages.pageBuilder.seo.metaAfter")}
            </p>
          </div>
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
            {t("pages.pageBuilder.seo.save")}
          </button>
        </footer>
      </div>
    </div>
  );
}
