import { useEffect, useState, type ReactNode } from "react";
import { MessageSquarePlus, Plus, Trash2, X } from "lucide-react";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useBuilder } from "../store";
import type {
  PagePopup,
  PagePopupAnimation,
  PagePopupDisplayMode,
  PagePopupPosition,
  PagePopupTrigger,
} from "../types";
import { createPagePopup } from "../factory";
import { ColorField, NumberField, SelectField, TextField, TextareaField } from "./PropertyControls";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-editor-border bg-editor-panel-2/40 p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function PopupsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useAppLocale();
  const doc = useBuilder((s) => s.doc);
  const updatePopups = useBuilder((s) => s.updatePopups);
  const [draft, setDraft] = useState<PagePopup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const triggerOptions: Array<{ value: PagePopupTrigger; label: string }> = [
    { value: "onLoad", label: t("pages.pageBuilder.popups.onLoad") },
    { value: "onScroll", label: t("pages.pageBuilder.popups.onScroll") },
    { value: "exitIntent", label: t("pages.pageBuilder.popups.exitIntent") },
    { value: "manual", label: t("pages.pageBuilder.popups.manual") },
  ];
  const modeOptions: Array<{ value: PagePopupDisplayMode; label: string }> = [
    { value: "modal", label: t("pages.pageBuilder.popups.modeModal") },
    { value: "bar", label: t("pages.pageBuilder.popups.modeBar") },
    { value: "slide-in", label: t("pages.pageBuilder.popups.modeSlide") },
    { value: "toast", label: t("pages.pageBuilder.popups.modeToast") },
  ];
  const positionOptions: Array<{ value: PagePopupPosition; label: string }> = [
    { value: "center", label: t("pages.pageBuilder.popups.posCenter") },
    { value: "top", label: t("pages.pageBuilder.popups.posTopBar") },
    { value: "bottom", label: t("pages.pageBuilder.popups.posBottomBar") },
    { value: "top-left", label: t("pages.pageBuilder.popups.posTopLeft") },
    { value: "top-right", label: t("pages.pageBuilder.popups.posTopRight") },
    { value: "bottom-left", label: t("pages.pageBuilder.popups.posBottomLeft") },
    { value: "bottom-right", label: t("pages.pageBuilder.popups.posBottomRight") },
    { value: "left", label: t("pages.pageBuilder.popups.posLeft") },
    { value: "right", label: t("pages.pageBuilder.popups.posRight") },
  ];
  const animationOptions: Array<{ value: PagePopupAnimation; label: string }> = [
    { value: "none", label: t("pages.pageBuilder.popups.animNone") },
    { value: "fade", label: t("pages.pageBuilder.popups.animFade") },
    { value: "fadeUp", label: t("pages.pageBuilder.popups.animFadeUp") },
    { value: "fadeDown", label: t("pages.pageBuilder.popups.animFadeDown") },
    { value: "scale", label: t("pages.pageBuilder.popups.animScale") },
    { value: "slideLeft", label: t("pages.pageBuilder.popups.animSlideLeft") },
    { value: "slideRight", label: t("pages.pageBuilder.popups.animSlideRight") },
    { value: "slideUp", label: t("pages.pageBuilder.popups.animSlideUp") },
    { value: "slideDown", label: t("pages.pageBuilder.popups.animSlideDown") },
  ];

  useEffect(() => {
    if (!open) return;
    const list = [...(doc.popups ?? [])];
    setDraft(list);
    setSelectedId(list[0]?.id ?? null);
  }, [open, doc.popups]);

  if (!open) return null;

  const selected = draft.find((p) => p.id === selectedId) ?? null;

  const patchSelected = (partial: Partial<PagePopup>) => {
    if (!selected) return;
    setDraft((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...partial } : p)));
  };

  const addPopup = () => {
    const p = createPagePopup(
      fill(t("pages.pageBuilder.popups.defaultName"), { n: draft.length + 1 }),
    );
    setDraft((prev) => [...prev, p]);
    setSelectedId(p.id);
  };

  const removeSelected = () => {
    if (!selected) return;
    const next = draft.filter((p) => p.id !== selected.id);
    setDraft(next);
    setSelectedId(next[0]?.id ?? null);
  };

  const handleSave = () => {
    updatePopups(draft);
    onClose();
  };

  const mode = selected?.displayMode ?? "modal";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-editor-border bg-editor-panel text-editor-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-editor-border p-4">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-editor-accent" />
            <div>
              <h2 className="text-base font-semibold">{t("pages.pageBuilder.popups.title")}</h2>
              <p className="text-[11px] text-editor-fg-muted">
                {t("pages.pageBuilder.popups.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded p-1 text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_1fr]">
          <aside className="border-b border-editor-border p-3 md:border-b-0 md:border-r">
            <button
              type="button"
              onClick={addPopup}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-editor-accent px-2 py-1.5 text-xs font-semibold text-editor-accent-fg"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("pages.pageBuilder.popups.new")}
            </button>
            <ul className="space-y-1">
              {draft.length === 0 ? (
                <li className="px-1 py-2 text-[11px] text-editor-fg-muted">
                  {t("pages.pageBuilder.popups.empty")}
                </li>
              ) : (
                draft.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                        p.id === selectedId
                          ? "bg-editor-accent/15 font-semibold text-editor-fg"
                          : "text-editor-fg-muted hover:bg-editor-panel-2"
                      }`}
                    >
                      {p.name || t("pages.pageBuilder.popups.unnamed")}
                      <span className="mt-0.5 block text-[10px] opacity-70">
                        {triggerOptions.find((opt) => opt.value === p.trigger)?.label ?? p.trigger}
                        {" · "}
                        {modeOptions.find((m) => m.value === (p.displayMode ?? "modal"))?.label ??
                          t("pages.pageBuilder.popups.modalFallback")}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>

          <div className="editor-scrollbar min-h-0 space-y-3 overflow-y-auto p-4">
            {!selected ? (
              <p className="text-sm text-editor-fg-muted">{t("pages.pageBuilder.popups.selectOrCreate")}</p>
            ) : (
              <>
                <Section title={t("pages.pageBuilder.popups.general")}>
                  <div className="flex items-start justify-between gap-2">
                    <TextField
                      label={t("pages.pageBuilder.popups.internalName")}
                      value={selected.name}
                      onChange={(v) => patchSelected({ name: v })}
                    />
                    <button
                      type="button"
                      onClick={removeSelected}
                      className="mt-5 flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("common.delete")}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[11px] text-editor-fg">{t("common.active")}</Label>
                    <Switch
                      checked={selected.enabled !== false}
                      onCheckedChange={(v) => patchSelected({ enabled: v })}
                    />
                  </div>
                </Section>

                <Section title={t("pages.pageBuilder.popups.triggerTime")}>
                  <SelectField
                    label={t("pages.pageBuilder.popups.trigger")}
                    value={selected.trigger}
                    options={triggerOptions}
                    onChange={(v) => patchSelected({ trigger: v as PagePopupTrigger })}
                  />
                  {selected.trigger === "onScroll" ? (
                    <NumberField
                      label={t("pages.pageBuilder.popups.scrollPercent")}
                      value={selected.scrollPercent ?? 40}
                      min={1}
                      max={100}
                      onChange={(v) => patchSelected({ scrollPercent: v })}
                    />
                  ) : null}
                  {selected.trigger !== "manual" ? (
                    <NumberField
                      label={t("pages.pageBuilder.popups.entryDelay")}
                      value={selected.delayMs ?? 0}
                      min={0}
                      max={60000}
                      onChange={(v) => patchSelected({ delayMs: v })}
                    />
                  ) : (
                    <p className="text-[10px] leading-relaxed text-editor-fg-muted">
                      {t("pages.pageBuilder.popups.interactionId")}{" "}
                      <span className="font-mono text-editor-fg">{selected.id}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[11px] text-editor-fg">
                      {t("pages.pageBuilder.popups.oncePerSession")}
                    </Label>
                    <Switch
                      checked={selected.oncePerSession !== false}
                      onCheckedChange={(v) => patchSelected({ oncePerSession: v })}
                    />
                  </div>
                </Section>

                <Section title={t("pages.pageBuilder.popups.modePosition")}>
                  <SelectField
                    label={t("pages.pageBuilder.popups.mode")}
                    value={selected.displayMode ?? "modal"}
                    options={modeOptions}
                    onChange={(v) => {
                      const displayMode = v as PagePopupDisplayMode;
                      const patch: Partial<PagePopup> = { displayMode };
                      if (displayMode === "modal") patch.position = "center";
                      if (displayMode === "bar" && selected.position !== "top" && selected.position !== "bottom") {
                        patch.position = "bottom";
                      }
                      if (displayMode === "toast" && (!selected.position || selected.position === "center")) {
                        patch.position = "bottom-right";
                      }
                      patchSelected(patch);
                    }}
                  />
                  <SelectField
                    label={t("pages.pageBuilder.popups.position")}
                    value={
                      mode === "modal"
                        ? "center"
                        : (selected.position ?? (mode === "bar" ? "bottom" : "bottom-right"))
                    }
                    options={
                      mode === "modal"
                        ? positionOptions.filter((o) => o.value === "center")
                        : mode === "bar"
                          ? positionOptions.filter((o) => o.value === "top" || o.value === "bottom")
                          : positionOptions
                    }
                    onChange={(v) => patchSelected({ position: v as PagePopupPosition })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label={t("pages.pageBuilder.popups.offsetX")}
                      value={selected.offsetXPx ?? 16}
                      min={0}
                      max={120}
                      onChange={(v) => patchSelected({ offsetXPx: v })}
                    />
                    <NumberField
                      label={t("pages.pageBuilder.popups.offsetY")}
                      value={selected.offsetYPx ?? 16}
                      min={0}
                      max={120}
                      onChange={(v) => patchSelected({ offsetYPx: v })}
                    />
                  </div>
                  <NumberField
                    label={t("pages.pageBuilder.popups.maxWidth")}
                    value={selected.maxWidthPx ?? 480}
                    min={240}
                    max={960}
                    onChange={(v) => patchSelected({ maxWidthPx: v })}
                  />
                  <NumberField
                    label={t("pages.pageBuilder.popups.zIndex")}
                    value={selected.zIndex ?? 99990}
                    min={1}
                    max={2147483000}
                    onChange={(v) => patchSelected({ zIndex: v })}
                  />
                </Section>

                <Section title={t("pages.pageBuilder.popups.entrance")}>
                  <SelectField
                    label={t("pages.pageBuilder.popups.effect")}
                    value={selected.animation ?? "fadeUp"}
                    options={animationOptions}
                    onChange={(v) => patchSelected({ animation: v as PagePopupAnimation })}
                  />
                  <NumberField
                    label={t("pages.pageBuilder.widgets.fields.durationMs")}
                    value={selected.animationDurationMs ?? 320}
                    min={80}
                    max={3000}
                    onChange={(v) => patchSelected({ animationDurationMs: v })}
                  />
                  <TextField
                    label={t("pages.pageBuilder.popups.easing")}
                    value={selected.animationEasing ?? ""}
                    onChange={(v) => patchSelected({ animationEasing: v || undefined })}
                    placeholder={t("pages.pageBuilder.popups.easingPlaceholder")}
                  />
                </Section>

                <Section title={t("pages.pageBuilder.content")}>
                  <TextField
                    label={t("pages.pageBuilder.widgets.fields.title")}
                    value={selected.title ?? ""}
                    onChange={(v) => patchSelected({ title: v })}
                  />
                  <TextareaField
                    label={t("pages.pageBuilder.popups.html")}
                    value={selected.html ?? ""}
                    onChange={(v) => patchSelected({ html: v })}
                    rows={4}
                  />
                  <TextField
                    label={t("pages.pageBuilder.widgets.fields.buttonText")}
                    value={selected.ctaLabel ?? ""}
                    onChange={(v) => patchSelected({ ctaLabel: v })}
                  />
                  <TextField
                    label={t("pages.pageBuilder.popups.buttonLink")}
                    value={selected.ctaHref ?? ""}
                    onChange={(v) => patchSelected({ ctaHref: v })}
                    placeholder={t("pages.pageBuilder.popups.buttonLinkPlaceholder")}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[11px] text-editor-fg">
                      {t("pages.pageBuilder.popups.closeButton")}
                    </Label>
                    <Switch
                      checked={selected.showCloseButton !== false}
                      onCheckedChange={(v) => patchSelected({ showCloseButton: v })}
                    />
                  </div>
                </Section>

                <Section title={t("pages.pageBuilder.style")}>
                  <NumberField
                    label={t("pages.pageBuilder.panel.radius")}
                    value={selected.borderRadiusPx ?? 16}
                    min={0}
                    max={48}
                    onChange={(v) => patchSelected({ borderRadiusPx: v })}
                  />
                  <ColorField
                    label={t("pages.pageBuilder.background")}
                    value={selected.background ?? "#ffffff"}
                    onChange={(v) => patchSelected({ background: v })}
                  />
                  <ColorField
                    label={t("pages.pageBuilder.widgets.fields.text")}
                    value={selected.textColor ?? "#0f172a"}
                    onChange={(v) => patchSelected({ textColor: v })}
                  />
                  <ColorField
                    label={t("pages.pageBuilder.popups.buttonBg")}
                    value={selected.ctaBg ?? "#e63946"}
                    onChange={(v) => patchSelected({ ctaBg: v })}
                  />
                  <ColorField
                    label={t("pages.pageBuilder.popups.buttonTextColor")}
                    value={selected.ctaColor ?? "#ffffff"}
                    onChange={(v) => patchSelected({ ctaColor: v })}
                  />
                  {mode === "modal" ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[11px] text-editor-fg">
                          {t("pages.pageBuilder.popups.backdrop")}
                        </Label>
                        <Switch
                          checked={selected.backdrop !== false}
                          onCheckedChange={(v) => patchSelected({ backdrop: v })}
                        />
                      </div>
                      <NumberField
                        label={t("pages.pageBuilder.popups.backdropOpacity")}
                        value={selected.backdropOpacity ?? 55}
                        min={0}
                        max={90}
                        onChange={(v) => patchSelected({ backdropOpacity: v })}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[11px] text-editor-fg">
                          {t("pages.pageBuilder.popups.backdropClose")}
                        </Label>
                        <Switch
                          checked={selected.backdropClose !== false}
                          onCheckedChange={(v) => patchSelected({ backdropClose: v })}
                        />
                      </div>
                    </>
                  ) : null}
                </Section>
              </>
            )}
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
