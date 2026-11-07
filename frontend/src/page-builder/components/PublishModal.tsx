import { useEffect, useState } from "react";
import { useBuilder } from "../store";
import { publishPage, slugify } from "../published";
import { downloadHtml } from "../export-html";
import { Save, Download, X, Check } from "lucide-react";

/**
 * Standalone page-builder only — localStorage + HTML export.
 * Does not publish to Clickora `/p/:id` (that path is real API presells).
 */
export function PublishModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useBuilder((s) => s.doc);
  const [slug, setSlug] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setSlug(slugify(doc.name));
      setSaved(false);
    }
  }, [open, doc.name]);

  if (!open) return null;

  const handleSaveLocal = async () => {
    const safeSlug = slugify(slug);
    setSlug(safeSlug);
    await publishPage(safeSlug, doc);
    setSaved(true);
  };

  const handleDownload = () => {
    downloadHtml(doc, slugify(slug));
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-editor-border bg-editor-panel text-editor-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-editor-border p-4">
          <div className="flex items-center gap-2">
            <Save className="h-5 w-5 text-editor-accent" />
            <h2 className="text-base font-semibold">Guardar rascunho local</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-editor-fg-muted">
              Identificador do rascunho
            </label>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSaved(false);
              }}
              className="w-full rounded border border-editor-border bg-editor-bg px-3 py-2 text-sm text-editor-fg outline-none"
              placeholder="minha-pagina"
            />
            <p className="mt-1.5 text-[11px] text-editor-fg-muted">
              Letras minúsculas, números e hifens. Só para organização neste browser — não cria URL pública.
            </p>
          </div>

          {saved && (
            <div className="rounded border border-editor-accent/30 bg-editor-accent/5 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-editor-accent">
                <Check className="h-3.5 w-3.5" />
                Guardado neste browser
              </div>
              <p className="text-[11px] text-editor-fg-muted leading-relaxed">
                Este editor standalone não publica no Clickora. Para uma lander pública use o builder
                de presells, ou exporte HTML para hospedar noutro sítio.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleSaveLocal()}
              className="flex items-center justify-center gap-1.5 rounded bg-editor-accent px-4 py-2.5 text-sm font-medium text-editor-accent-fg hover:opacity-90"
            >
              <Save className="h-4 w-4" />
              {saved ? "Guardar de novo" : "Guardar local"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 rounded border border-editor-border bg-editor-panel-2 px-4 py-2.5 text-sm font-medium text-editor-fg hover:bg-editor-border"
            >
              <Download className="h-4 w-4" />
              Exportar HTML
            </button>
          </div>

          <p className="text-[11px] text-editor-fg-muted">
            <strong className="text-editor-fg">Guardar local</strong> só persiste neste browser.{" "}
            <strong className="text-editor-fg">Exportar HTML</strong> baixa um ficheiro standalone.
            Landers Clickora: use o builder de presells.
          </p>
        </div>
      </div>
    </div>
  );
}
