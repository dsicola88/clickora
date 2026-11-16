import { useEffect, useState } from "react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { Blend, ImageIcon, Paintbrush, Palette, X } from "lucide-react";
import { useBuilder } from "../store";
import type { PageGlobalDesign } from "../types";
import { resolveGlobalDesign } from "../page-global-design";
import {
  resolvePageBackgroundType,
  serializePageBackground,
  type PageBackgroundType,
} from "../page-background";
import { BuilderImageUrlField, ColorField, SelectField, TextField } from "./PropertyControls";
import { cn } from "@/lib/utils";

/**
 * Kit global da página (cores e tipografia) + tipo de plano de fundo
 * (sólido / gradiente / imagem) para facilitar presells no editor manual.
 */
export function PageSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useAppLocale();
  const doc = useBuilder((s) => s.doc);
  const updateSettings = useBuilder((s) => s.updateSettings);
  const [design, setDesign] = useState<PageGlobalDesign>({});
  const [bgType, setBgType] = useState<PageBackgroundType>("solid");
  const [solid, setSolid] = useState("#ffffff");
  const [gradient, setGradient] = useState("linear-gradient(180deg, #0f172a 0%, #1e293b 100%)");
  const [imageUrl, setImageUrl] = useState("");
  const [imageSize, setImageSize] = useState<"cover" | "contain" | "auto">("cover");
  const [imagePosition, setImagePosition] = useState("center center");
  const [maxWidth, setMaxWidth] = useState(1140);

  useEffect(() => {
    if (!open) return;
    const s = doc.settings;
    setDesign({ ...resolveGlobalDesign(s) });
    const type = resolvePageBackgroundType(s);
    setBgType(type);
    setSolid(
      (s.backgroundSolid ?? (type === "solid" ? s.background : undefined) ?? "#ffffff").trim() ||
        "#ffffff",
    );
    setGradient(
      (
        s.backgroundGradient ??
        (type === "gradient" ? s.background : undefined) ??
        "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)"
      ).trim(),
    );
    setImageUrl((s.backgroundImageUrl ?? "").trim());
    setImageSize(s.backgroundImageSize ?? "cover");
    setImagePosition(s.backgroundImagePosition ?? "center center");
    setMaxWidth(s.maxContentWidth ?? 1140);
  }, [open, doc.settings]);

  if (!open) return null;

  const patch = <K extends keyof PageGlobalDesign>(k: K, v: PageGlobalDesign[K]) =>
    setDesign((prev) => ({ ...prev, [k]: v }));

  const handleSave = () => {
    const background = serializePageBackground({
      type: bgType,
      solid,
      gradient,
      imageUrl,
      imageSize,
      imagePosition,
    });
    updateSettings({
      background,
      backgroundType: bgType,
      backgroundSolid: solid.trim() || "#ffffff",
      backgroundGradient: gradient.trim() || undefined,
      backgroundImageUrl: imageUrl.trim() || undefined,
      backgroundImageSize: imageSize,
      backgroundImagePosition: imagePosition.trim() || "center center",
      backgroundImageRepeat: "no-repeat",
      maxContentWidth: Math.min(1920, Math.max(320, maxWidth)),
      globalDesign: design,
    });
    onClose();
  };

  const typeOptions: { id: PageBackgroundType; label: string; icon: typeof Paintbrush }[] = [
    {
      id: "solid",
      label: t("pages.pageBuilder.pageSettings.bgTypeSolid"),
      icon: Paintbrush,
    },
    {
      id: "gradient",
      label: t("pages.pageBuilder.pageSettings.bgTypeGradient"),
      icon: Blend,
    },
    {
      id: "image",
      label: t("pages.pageBuilder.pageSettings.bgTypeImage"),
      icon: ImageIcon,
    },
  ];

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

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-editor-fg-muted">
                {t("pages.pageBuilder.pageSettings.bgType")}
              </p>
              <div className="inline-flex flex-wrap rounded-md border border-editor-border bg-editor-panel-2 p-0.5">
                {typeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = bgType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.label}
                      aria-label={opt.label}
                      onClick={() => setBgType(opt.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                        active
                          ? "bg-editor-panel text-editor-fg shadow-sm"
                          : "text-editor-fg-muted hover:text-editor-fg",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {bgType === "solid" ? (
              <ColorField
                label={t("pages.pageBuilder.pageSettings.pageBg")}
                value={solid}
                onChange={setSolid}
              />
            ) : null}

            {bgType === "gradient" ? (
              <TextField
                label={t("pages.pageBuilder.pageSettings.bgGradient")}
                value={gradient}
                onChange={setGradient}
                placeholder="linear-gradient(180deg, #0f172a 0%, #1e293b 100%)"
              />
            ) : null}

            {bgType === "image" ? (
              <div className="space-y-3">
                <ColorField
                  label={t("pages.pageBuilder.pageSettings.bgFallbackColor")}
                  value={solid}
                  onChange={setSolid}
                />
                <BuilderImageUrlField
                  label={t("pages.pageBuilder.panel.backgroundImage")}
                  value={imageUrl}
                  onChange={setImageUrl}
                  placeholder="https://…"
                />
                <SelectField
                  label={t("pages.pageBuilder.panel.size")}
                  value={imageSize}
                  options={[
                    { value: "cover", label: t("pages.pageBuilder.panel.cover") },
                    { value: "contain", label: t("pages.pageBuilder.panel.contain") },
                    { value: "auto", label: t("pages.pageBuilder.panel.auto") },
                  ]}
                  onChange={(v) => setImageSize(v as "cover" | "contain" | "auto")}
                />
                <TextField
                  label={t("pages.pageBuilder.panel.position")}
                  value={imagePosition}
                  onChange={setImagePosition}
                  placeholder="center center"
                />
              </div>
            ) : null}

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
            <ColorField
              label={t("pages.pageBuilder.pageSettings.text")}
              value={design.text ?? ""}
              onChange={(v) => patch("text", v)}
            />
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
