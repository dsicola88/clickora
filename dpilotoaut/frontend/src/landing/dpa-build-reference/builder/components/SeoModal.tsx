import { useEffect, useState } from "react";
import { useBuilder } from "../store";
import type { PageSeo } from "../types";
import { Search, X, Globe2, FileImage } from "lucide-react";

const labelCls = "block text-[11px] font-medium text-editor-fg-muted mb-1";
const inputCls =
  "w-full rounded bg-editor-panel-2 border border-editor-border px-2 py-1.5 text-xs text-editor-fg placeholder:text-editor-fg-muted focus:outline-none focus:ring-1 focus:ring-editor-accent";

export function SeoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  const previewTitle = seo.title || name || "Título da página";
  const previewDesc =
    seo.description || "Adicione uma descrição para melhorar SEO e compartilhamento.";
  const previewUrl =
    typeof window !== "undefined" ? `${window.location.origin}/p/sua-pagina` : "/p/sua-pagina";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-editor-border bg-editor-panel text-editor-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-editor-border p-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-editor-accent" />
            <h2 className="text-base font-semibold">Configurações de SEO</h2>
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
              <Globe2 className="h-3.5 w-3.5" /> Geral
            </h3>

            <div>
              <label className={labelCls}>Nome interno da página</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Minha página"
              />
            </div>

            <div>
              <label className={labelCls}>
                Title (60 caracteres) — {(seo.title ?? "").length}
              </label>
              <input
                value={seo.title ?? ""}
                maxLength={70}
                onChange={(e) => set("title", e.target.value)}
                className={inputCls}
                placeholder="Ex: Curso de Marketing — Resultados em 30 dias"
              />
            </div>

            <div>
              <label className={labelCls}>
                Meta description (160 caracteres) — {(seo.description ?? "").length}
              </label>
              <textarea
                value={seo.description ?? ""}
                maxLength={200}
                rows={3}
                onChange={(e) => set("description", e.target.value)}
                className={inputCls}
                placeholder="Resumo curto e atrativo da página."
              />
            </div>

            <div>
              <label className={labelCls}>Palavras-chave (separadas por vírgula)</label>
              <input
                value={seo.keywords ?? ""}
                onChange={(e) => set("keywords", e.target.value)}
                className={inputCls}
                placeholder="marketing, curso, vendas"
              />
            </div>

            <h3 className="flex items-center gap-1.5 pt-2 text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
              <FileImage className="h-3.5 w-3.5" /> Imagens
            </h3>

            <div>
              <label className={labelCls}>Open Graph image (URL)</label>
              <input
                value={seo.ogImage ?? ""}
                onChange={(e) => set("ogImage", e.target.value)}
                className={inputCls}
                placeholder="https://.../share-image.png (1200x630)"
              />
              <p className="mt-1 text-[10px] text-editor-fg-muted">
                Tamanho recomendado: 1200×630px.
              </p>
            </div>

            <div>
              <label className={labelCls}>Favicon (URL)</label>
              <input
                value={seo.favicon ?? ""}
                onChange={(e) => set("favicon", e.target.value)}
                className={inputCls}
                placeholder="https://.../favicon.ico"
              />
            </div>

            <div>
              <label className={labelCls}>URL canônica (opcional)</label>
              <input
                value={seo.canonicalUrl ?? ""}
                onChange={(e) => set("canonicalUrl", e.target.value)}
                className={inputCls}
                placeholder="https://seudominio.com/pagina"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={seo.noindex ?? false}
                  onChange={(e) => set("noindex", e.target.checked)}
                  className="h-3.5 w-3.5 accent-editor-accent"
                />
                Ocultar de buscadores (noindex)
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-editor-fg-muted">
              Pré-visualização
            </h3>

            {/* Google preview */}
            <div className="rounded border border-editor-border bg-white p-4 text-left">
              <div className="text-[11px] text-[#5f6368]">{previewUrl}</div>
              <div className="mt-1 truncate text-[18px] leading-tight text-[#1a0dab]">
                {previewTitle}
              </div>
              <div className="mt-1 line-clamp-2 text-[13px] text-[#4d5156]">{previewDesc}</div>
            </div>

            {/* Social preview */}
            <div className="overflow-hidden rounded border border-editor-border bg-white">
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
                  Sem imagem (og:image)
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
              Estas meta tags são aplicadas automaticamente na rota pública{" "}
              <code className="rounded bg-editor-bg px-1">/p/seu-slug</code> e no HTML exportado.
            </p>
          </div>
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
            Salvar SEO
          </button>
        </footer>
      </div>
    </div>
  );
}
