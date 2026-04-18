import { useEffect, useState } from "react";
import { useBuilder } from "../store";
import type { PageTrackingConfig } from "../types";
import { X, BarChart3, Code2 } from "lucide-react";

const labelCls = "block text-[11px] font-medium text-editor-fg-muted mb-1";
const inputCls =
  "w-full rounded bg-editor-panel-2 border border-editor-border px-2 py-1.5 text-xs text-editor-fg placeholder:text-editor-fg-muted focus:outline-none focus:ring-1 focus:ring-editor-accent font-mono";
const textareaCls = `${inputCls} min-h-[80px] resize-y`;

export function TrackingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useBuilder((s) => s.doc);
  const updateTracking = useBuilder((s) => s.updateTracking);

  const [t, setT] = useState<PageTrackingConfig>(doc.tracking ?? {});

  useEffect(() => {
    if (open) setT(doc.tracking ?? {});
  }, [open, doc.tracking]);

  if (!open) return null;

  const set = <K extends keyof PageTrackingConfig>(k: K, v: PageTrackingConfig[K]) =>
    setT((prev) => ({ ...prev, [k]: v }));

  const handleSave = () => {
    updateTracking(t);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
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
              <h2 className="text-base font-semibold">Tracking & Analytics</h2>
              <p className="text-[11px] text-editor-fg-muted">
                Aplica-se à rota pública /p/{`<slug>`} e ao HTML exportado
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
              Integrações
            </h3>
            <div>
              <label className={labelCls}>Google Tag Manager ID</label>
              <input
                value={t.gtmId ?? ""}
                onChange={(e) => set("gtmId", e.target.value.trim() || undefined)}
                className={inputCls}
                placeholder="GTM-XXXXXXX"
              />
            </div>
            <div>
              <label className={labelCls}>Google Analytics 4 (Measurement ID)</label>
              <input
                value={t.ga4Id ?? ""}
                onChange={(e) => set("ga4Id", e.target.value.trim() || undefined)}
                className={inputCls}
                placeholder="G-XXXXXXXXXX"
              />
            </div>
            <div>
              <label className={labelCls}>Meta (Facebook) Pixel ID</label>
              <input
                value={t.metaPixelId ?? ""}
                onChange={(e) => set("metaPixelId", e.target.value.trim() || undefined)}
                className={inputCls}
                placeholder="1234567890"
              />
            </div>
          </section>

          <section className="space-y-2 rounded border border-editor-border bg-editor-panel-2 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
              Eventos automáticos
            </h3>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={t.trackFormSubmits !== false}
                onChange={(e) => set("trackFormSubmits", e.target.checked)}
                className="h-3.5 w-3.5 accent-editor-accent"
              />
              Disparar <code className="rounded bg-editor-bg px-1">form_submit</code> /{" "}
              <code className="rounded bg-editor-bg px-1">Lead</code> ao enviar formulários
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={t.trackButtonClicks !== false}
                onChange={(e) => set("trackButtonClicks", e.target.checked)}
                className="h-3.5 w-3.5 accent-editor-accent"
              />
              Disparar <code className="rounded bg-editor-bg px-1">button_click</code> /{" "}
              <code className="rounded bg-editor-bg px-1">Contact</code> em cliques de botões/CTAs
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
              <Code2 className="h-3.5 w-3.5" /> Código personalizado (avançado)
            </h3>
            <div>
              <label className={labelCls}>Injeção em &lt;head&gt;</label>
              <textarea
                value={t.customHeadCode ?? ""}
                onChange={(e) => set("customHeadCode", e.target.value || undefined)}
                className={textareaCls}
                placeholder={"<!-- Hotjar, Clarity, scripts customizados -->"}
              />
            </div>
            <div>
              <label className={labelCls}>Injeção antes do &lt;/body&gt;</label>
              <textarea
                value={t.customBodyCode ?? ""}
                onChange={(e) => set("customBodyCode", e.target.value || undefined)}
                className={textareaCls}
                placeholder={"<!-- Chat, widgets, scripts customizados -->"}
              />
            </div>
            <p className="text-[11px] text-editor-fg-muted">
              ⚠️ Esses scripts rodam apenas em /p/seu-slug e no HTML exportado — não no editor.
            </p>
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-editor-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-editor-border bg-editor-panel-2 px-4 py-2 text-xs font-medium text-editor-fg hover:bg-editor-border"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-editor-accent px-4 py-2 text-xs font-medium text-editor-accent-fg hover:opacity-90"
          >
            Salvar tracking
          </button>
        </footer>
      </div>
    </div>
  );
}
