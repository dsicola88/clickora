import { useEffect, useState } from "react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { Palette, X } from "lucide-react";
import { useBuilder } from "../store";
import type { PageGlobalDesign } from "../types";
import { resolveGlobalDesign } from "../page-global-design";
import { ColorField, TextField } from "./PropertyControls";

/**
 * Kit global da página (cores e tipografia):
 * cores + tipografia aplicadas via CSS variables --pb-*.
 */
export function PageSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useAppLocale();
  const doc = useBuilder((s) => s.doc);
  const updateSettings = useBuilder((s) => s.updateSettings);
  const [design, setDesign] = useState<PageGlobalDesign>({});
  const [background, setBackground] = useState("#ffffff");
  const [maxWidth, setMaxWidth] = useState(1140);

  useEffect(() => {
    if (!open) return;
    setDesign({ ...resolveGlobalDesign(doc.settings) });
    setBackground(doc.settings.background ?? "#ffffff");
    setMaxWidth(doc.settings.maxContentWidth ?? 1140);
  }, [open, doc.settings]);

  if (!open) return null;

  const patch = <K extends keyof PageGlobalDesign>(k: K, v: PageGlobalDesign[K]) =>
    setDesign((prev) => ({ ...prev, [k]: v }));

  const handleSave = () => {
    updateSettings({
      background: background.trim() || "#ffffff",
      maxContentWidth: Math.min(1920, Math.max(320, maxWidth)),
      globalDesign: design,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-editor-border bg-editor-panel text-editor-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-editor-border p-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-editor-accent" />
            <h2 className="text-base font-semibold">{t("pages.pageBuilder.pageSettings.title")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="editor-scrollbar space-y-5 overflow-y-auto p-5">
          <p className="text-[11px] leading-relaxed text-editor-fg-muted">
            {t("pages.pageBuilder.pageSettings.intro")}
          </p>

          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
              {t("pages.pageBuilder.pageSettings.page")}
            </h3>
            <ColorField label={t("pages.pageBuilder.pageSettings.pageBg")} value={background} onChange={setBackground} />
            <label className="block text-[11px] font-medium text-editor-fg-muted">
              {t("pages.pageBuilder.pageSettings.maxWidth")}
              <input
                type="number"
                min={320}
                max={1920}
                value={maxWidth}
                onChange={(e) => setMaxWidth(Number(e.target.value) || 1140)}
                className="mt-1 w-full rounded border border-editor-border bg-editor-panel-2 px-2 py-1.5 text-xs text-editor-fg"
              />
            </label>
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
              {t("pages.pageBuilder.pageSettings.globalColors")}
            </h3>
            <ColorField
              label={t("pages.pageBuilder.pageSettings.primary")}
              value={design.primary ?? ""}
              onChange={(v) => patch("primary", v)}
            />
            <ColorField
              label={t("pages.pageBuilder.pageSettings.secondary")}
              value={design.secondary ?? ""}
              onChange={(v) => patch("secondary", v)}
            />
            <ColorField label={t("pages.pageBuilder.pageSettings.text")} value={design.text ?? ""} onChange={(v) => patch("text", v)} />
            <ColorField
              label={t("pages.pageBuilder.pageSettings.accent")}
              value={design.accent ?? ""}
              onChange={(v) => patch("accent", v)}
            />
            <ColorField
              label={t("pages.pageBuilder.pageSettings.muted")}
              value={design.muted ?? ""}
              onChange={(v) => patch("muted", v)}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
              {t("pages.pageBuilder.pageSettings.globalType")}
            </h3>
            <TextField
              label={t("pages.pageBuilder.pageSettings.fontPrimary")}
              value={design.fontPrimary ?? ""}
              onChange={(v) => patch("fontPrimary", v)}
              placeholder="Inter, system-ui, sans-serif"
            />
            <TextField
              label={t("pages.pageBuilder.pageSettings.fontSecondary")}
              value={design.fontSecondary ?? ""}
              onChange={(v) => patch("fontSecondary", v)}
              placeholder="Georgia, serif"
            />
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-editor-border p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-editor-fg-muted hover:bg-editor-panel-2"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-editor-accent px-3 py-1.5 text-xs font-semibold text-editor-accent-fg"
          >
            {t("common.save")}
          </button>
        </footer>
      </div>
    </div>
  );
}
