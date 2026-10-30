import { useEffect, useState, type ReactNode } from "react";
import { MessageSquarePlus, Plus, Trash2, X } from "lucide-react";
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
import {
  OVERLAY_ANIMATION_OPTIONS,
  OVERLAY_MODE_OPTIONS,
  OVERLAY_POSITION_OPTIONS,
} from "../overlay-placement";

const TRIGGER_OPTIONS: Array<{ value: PagePopupTrigger; label: string }> = [
  { value: "onLoad", label: "Ao carregar a página" },
  { value: "onScroll", label: "Ao fazer scroll" },
  { value: "exitIntent", label: "Ao sair (exit intent)" },
  { value: "manual", label: "Só por interação (botão/elemento)" },
];

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
  const doc = useBuilder((s) => s.doc);
  const updatePopups = useBuilder((s) => s.updatePopups);
  const [draft, setDraft] = useState<PagePopup[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    const p = createPagePopup(`Popup ${draft.length + 1}`);
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
              <h2 className="text-base font-semibold">Popups da página</h2>
              <p className="text-[11px] text-editor-fg-muted">
                Modo, posição, tempo de entrada e efeitos — como cookies e overlays.
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

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_1fr]">
          <aside className="border-b border-editor-border p-3 md:border-b-0 md:border-r">
            <button
              type="button"
              onClick={addPopup}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-editor-accent px-2 py-1.5 text-xs font-semibold text-editor-accent-fg"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo popup
            </button>
            <ul className="space-y-1">
              {draft.length === 0 ? (
                <li className="px-1 py-2 text-[11px] text-editor-fg-muted">
                  Ainda sem popups. Crie um para ofertas, avisos ou captura.
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
                      {p.name || "Sem nome"}
                      <span className="mt-0.5 block text-[10px] opacity-70">
                        {TRIGGER_OPTIONS.find((t) => t.value === p.trigger)?.label ?? p.trigger}
                        {" · "}
                        {OVERLAY_MODE_OPTIONS.find((m) => m.value === (p.displayMode ?? "modal"))
                          ?.label ?? "Modal"}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>

          <div className="editor-scrollbar min-h-0 space-y-3 overflow-y-auto p-4">
            {!selected ? (
              <p className="text-sm text-editor-fg-muted">Seleccione ou crie um popup.</p>
            ) : (
              <>
                <Section title="Geral">
                  <div className="flex items-start justify-between gap-2">
                    <TextField
                      label="Nome interno"
                      value={selected.name}
                      onChange={(v) => patchSelected({ name: v })}
                    />
                    <button
                      type="button"
                      onClick={removeSelected}
                      className="mt-5 flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Apagar
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[11px] text-editor-fg">Activo</Label>
                    <Switch
                      checked={selected.enabled !== false}
                      onCheckedChange={(v) => patchSelected({ enabled: v })}
                    />
                  </div>
                </Section>

                <Section title="Disparo e tempo">
                  <SelectField
                    label="Disparo"
                    value={selected.trigger}
                    options={TRIGGER_OPTIONS}
                    onChange={(v) => patchSelected({ trigger: v as PagePopupTrigger })}
                  />
                  {selected.trigger === "onScroll" ? (
                    <NumberField
                      label="Scroll (%)"
                      value={selected.scrollPercent ?? 40}
                      min={1}
                      max={100}
                      onChange={(v) => patchSelected({ scrollPercent: v })}
                    />
                  ) : null}
                  {selected.trigger !== "manual" ? (
                    <NumberField
                      label="Atraso de entrada (ms)"
                      value={selected.delayMs ?? 0}
                      min={0}
                      max={60000}
                      onChange={(v) => patchSelected({ delayMs: v })}
                    />
                  ) : (
                    <p className="text-[10px] leading-relaxed text-editor-fg-muted">
                      ID para interações de widget:{" "}
                      <span className="font-mono text-editor-fg">{selected.id}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[11px] text-editor-fg">Só uma vez por sessão</Label>
                    <Switch
                      checked={selected.oncePerSession !== false}
                      onCheckedChange={(v) => patchSelected({ oncePerSession: v })}
                    />
                  </div>
                </Section>

                <Section title="Modo e posição">
                  <SelectField
                    label="Modo"
                    value={selected.displayMode ?? "modal"}
                    options={OVERLAY_MODE_OPTIONS}
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
                    label="Posição"
                    value={
                      mode === "modal"
                        ? "center"
                        : (selected.position ?? (mode === "bar" ? "bottom" : "bottom-right"))
                    }
                    options={
                      mode === "modal"
                        ? OVERLAY_POSITION_OPTIONS.filter((o) => o.value === "center")
                        : mode === "bar"
                          ? OVERLAY_POSITION_OPTIONS.filter((o) => o.value === "top" || o.value === "bottom")
                          : OVERLAY_POSITION_OPTIONS
                    }
                    onChange={(v) => patchSelected({ position: v as PagePopupPosition })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      label="Offset X (px)"
                      value={selected.offsetXPx ?? 16}
                      min={0}
                      max={120}
                      onChange={(v) => patchSelected({ offsetXPx: v })}
                    />
                    <NumberField
                      label="Offset Y (px)"
                      value={selected.offsetYPx ?? 16}
                      min={0}
                      max={120}
                      onChange={(v) => patchSelected({ offsetYPx: v })}
                    />
                  </div>
                  <NumberField
                    label="Largura máx. (px)"
                    value={selected.maxWidthPx ?? 480}
                    min={240}
                    max={960}
                    onChange={(v) => patchSelected({ maxWidthPx: v })}
                  />
                  <NumberField
                    label="Z-index"
                    value={selected.zIndex ?? 99990}
                    min={1}
                    max={2147483000}
                    onChange={(v) => patchSelected({ zIndex: v })}
                  />
                </Section>

                <Section title="Animação de entrada">
                  <SelectField
                    label="Efeito"
                    value={selected.animation ?? "fadeUp"}
                    options={OVERLAY_ANIMATION_OPTIONS}
                    onChange={(v) => patchSelected({ animation: v as PagePopupAnimation })}
                  />
                  <NumberField
                    label="Duração (ms)"
                    value={selected.animationDurationMs ?? 320}
                    min={80}
                    max={3000}
                    onChange={(v) => patchSelected({ animationDurationMs: v })}
                  />
                  <TextField
                    label="Curva CSS (easing)"
                    value={selected.animationEasing ?? ""}
                    onChange={(v) => patchSelected({ animationEasing: v || undefined })}
                    placeholder="cubic-bezier(0.22, 1, 0.36, 1)"
                  />
                </Section>

                <Section title="Conteúdo">
                  <TextField
                    label="Título"
                    value={selected.title ?? ""}
                    onChange={(v) => patchSelected({ title: v })}
                  />
                  <TextareaField
                    label="Conteúdo (HTML)"
                    value={selected.html ?? ""}
                    onChange={(v) => patchSelected({ html: v })}
                    rows={4}
                  />
                  <TextField
                    label="Texto do botão"
                    value={selected.ctaLabel ?? ""}
                    onChange={(v) => patchSelected({ ctaLabel: v })}
                  />
                  <TextField
                    label="Link do botão"
                    value={selected.ctaHref ?? ""}
                    onChange={(v) => patchSelected({ ctaHref: v })}
                    placeholder="https://… ou #secção"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[11px] text-editor-fg">Botão fechar (×)</Label>
                    <Switch
                      checked={selected.showCloseButton !== false}
                      onCheckedChange={(v) => patchSelected({ showCloseButton: v })}
                    />
                  </div>
                </Section>

                <Section title="Estilo">
                  <NumberField
                    label="Raio (px)"
                    value={selected.borderRadiusPx ?? 16}
                    min={0}
                    max={48}
                    onChange={(v) => patchSelected({ borderRadiusPx: v })}
                  />
                  <ColorField
                    label="Fundo"
                    value={selected.background ?? "#ffffff"}
                    onChange={(v) => patchSelected({ background: v })}
                  />
                  <ColorField
                    label="Texto"
                    value={selected.textColor ?? "#0f172a"}
                    onChange={(v) => patchSelected({ textColor: v })}
                  />
                  <ColorField
                    label="Botão — fundo"
                    value={selected.ctaBg ?? "#e63946"}
                    onChange={(v) => patchSelected({ ctaBg: v })}
                  />
                  <ColorField
                    label="Botão — texto"
                    value={selected.ctaColor ?? "#ffffff"}
                    onChange={(v) => patchSelected({ ctaColor: v })}
                  />
                  {mode === "modal" ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[11px] text-editor-fg">Backdrop</Label>
                        <Switch
                          checked={selected.backdrop !== false}
                          onCheckedChange={(v) => patchSelected({ backdrop: v })}
                        />
                      </div>
                      <NumberField
                        label="Opacidade do backdrop (%)"
                        value={selected.backdropOpacity ?? 55}
                        min={0}
                        max={90}
                        onChange={(v) => patchSelected({ backdropOpacity: v })}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-[11px] text-editor-fg">Fechar ao clicar no fundo</Label>
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
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-editor-accent px-3 py-1.5 text-xs font-semibold text-editor-accent-fg"
          >
            Guardar
          </button>
        </footer>
      </div>
    </div>
  );
}
