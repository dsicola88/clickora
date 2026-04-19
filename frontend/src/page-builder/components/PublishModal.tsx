import { useEffect, useMemo, useState } from "react";
import { useBuilder } from "../store";
import { publishPage, slugify } from "../published";
import { downloadHtml } from "../export-html";
import { Globe, Download, Copy, X, Check, ExternalLink } from "lucide-react";

export function PublishModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useBuilder((s) => s.doc);
  const [slug, setSlug] = useState("");
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setSlug(slugify(doc.name));
      setPublished(false);
      setCopied(false);
    }
  }, [open, doc.name]);

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/p/${slug}`;
  }, [slug]);

  if (!open) return null;

  const handlePublish = async () => {
    const safeSlug = slugify(slug);
    setSlug(safeSlug);
    await publishPage(safeSlug, doc);
    setPublished(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
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
            <Globe className="h-5 w-5 text-editor-accent" />
            <h2 className="text-base font-semibold">Publicar página</h2>
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
              Slug da URL pública
            </label>
            <div className="flex items-center gap-1 overflow-hidden rounded border border-editor-border bg-editor-bg">
              <span className="px-3 text-xs text-editor-fg-muted">/p/</span>
              <input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setPublished(false);
                }}
                className="flex-1 bg-transparent py-2 pr-3 text-sm text-editor-fg outline-none"
                placeholder="minha-pagina"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-editor-fg-muted">
              Letras minúsculas, números e hifens. Acentos serão removidos.
            </p>
          </div>

          {published && (
            <div className="rounded border border-editor-accent/30 bg-editor-accent/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-editor-accent">
                <Check className="h-3.5 w-3.5" />
                Página publicada com sucesso
              </div>
              <div className="flex items-center gap-1 overflow-hidden rounded border border-editor-border bg-editor-bg">
                <input
                  readOnly
                  value={publicUrl}
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-editor-fg outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex h-9 w-9 items-center justify-center text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
                  title="Copiar"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
                  title="Abrir"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePublish}
              className="flex items-center justify-center gap-1.5 rounded bg-editor-accent px-4 py-2.5 text-sm font-medium text-editor-accent-fg hover:opacity-90"
            >
              <Globe className="h-4 w-4" />
              {published ? "Republicar" : "Publicar"}
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
            <strong className="text-editor-fg">Publicar</strong> torna a página acessível em{" "}
            <code className="rounded bg-editor-bg px-1">/p/seu-slug</code>.{" "}
            <strong className="text-editor-fg">Exportar HTML</strong> baixa um arquivo standalone
            que você pode hospedar em qualquer lugar.
          </p>
        </div>
      </div>
    </div>
  );
}
