import { useMemo, useState } from "react";
import {
  SECTION_BLOCKS,
  SECTION_BLOCK_CATEGORIES,
  buildSectionsFromRecipe,
  type SectionBlockDefinition,
} from "../section-blocks";
import { documentHasImportedFold } from "../pageIdentity";
import { useBuilder } from "../store";
import { TEMPLATES } from "../templates";
import { Blocks, LayoutTemplate, X } from "lucide-react";

export function BlocksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [category, setCategory] = useState<SectionBlockDefinition["category"] | "all" | "recipe">(
    "all",
  );
  const appendSections = useBuilder((s) => s.appendSections);
  const replaceSections = useBuilder((s) => s.replaceSections);
  const doc = useBuilder((s) => s.doc);
  const identity = useBuilder((s) => s.pageIdentity);
  const imported = documentHasImportedFold(doc);

  const items = useMemo(() => {
    if (category === "recipe" || category === "all") return SECTION_BLOCKS;
    return SECTION_BLOCKS.filter((b) => b.category === category);
  }, [category]);

  if (!open) return null;

  const insertBlock = (block: SectionBlockDefinition) => {
    appendSections(block.build(identity));
  };

  const applyRecipe = () => {
    const sections = buildSectionsFromRecipe(undefined, identity);
    if (doc.sections.length === 0) replaceSections(sections);
    else appendSections(sections);
    onClose();
  };

  const applyFullTemplate = () => {
    const t = TEMPLATES.find((x) => x.id === "presell-dtc-vision");
    if (!t) return;
    if (imported) {
      window.alert(
        "Esta página já foi importada. Não substitui o conteúdo por Visivra. Insira blocos — eles usam o nome e a oferta desta página.",
      );
      return;
    }
    const product = (identity.productName || "").toLowerCase();
    if (product && !product.includes("visivra") && doc.sections.length > 0) {
      window.alert(
        `A página em edição é «${identity.productName}». O modelo Visivra não a substitui. Use a receita DTC (copia o nome desta página).`,
      );
      return;
    }
    if (doc.sections.length > 0) {
      const ok = window.confirm("Substituir o conteúdo atual pelo modelo Visivra completo?");
      if (!ok) return;
    }
    replaceSections(t.build());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-editor-border bg-editor-panel text-editor-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-editor-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Blocks className="h-5 w-5 text-editor-accent" />
            <div>
              <h2 className="text-base font-semibold">Blocos — montar do zero</h2>
              <p className="text-[11px] text-editor-fg-muted">
                Escolha estruturas e widgets, ou insira blocos prontos e edite tudo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="w-44 shrink-0 overflow-y-auto border-r border-editor-border p-3">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                category === "all" ? "bg-editor-accent text-editor-accent-fg" : "hover:bg-editor-panel-2"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setCategory("recipe")}
              className={`mb-2 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                category === "recipe" ? "bg-editor-accent text-editor-accent-fg" : "hover:bg-editor-panel-2"
              }`}
            >
              Receita DTC
            </button>
            {SECTION_BLOCK_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                  category === cat.id
                    ? "bg-editor-accent text-editor-accent-fg"
                    : "hover:bg-editor-panel-2"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </aside>

          <div className="editor-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            {category === "recipe" ? (
              <div className="mb-4 space-y-3 rounded-lg border border-editor-border bg-editor-panel-2/40 p-4">
                <h3 className="text-sm font-semibold">Receita DTC (esta página)</h3>
                <p className="text-[12px] text-editor-fg-muted">
                  Os blocos copiam o nome, a imagem e a oferta da página que está a editar
                  {identity.productName ? ` (${identity.productName})` : ""}. Não colam um produto de catálogo.
                </p>
                <ol className="list-decimal space-y-1 pl-4 text-[12px] text-editor-fg-muted">
                  <li>Menu (logo | links | Order Now)</li>
                  <li>Hero imagem + título do produto</li>
                  <li>CTA amarelo</li>
                  <li>Why Choose + 4 selos</li>
                  <li>Benefits + lista com checks</li>
                  <li>CTA + rodapé legal + cookie modal</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyRecipe}
                    className="rounded-md bg-editor-accent px-3 py-2 text-xs font-semibold text-editor-accent-fg"
                  >
                    Inserir blocos na ordem
                  </button>
                  <button
                    type="button"
                    onClick={applyFullTemplate}
                    className="inline-flex items-center gap-1.5 rounded-md border border-editor-border px-3 py-2 text-xs font-medium hover:bg-editor-panel-2"
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    Modelo completo (1 clique)
                  </button>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((block) => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => insertBlock(block)}
                  className="rounded-lg border border-editor-border bg-editor-panel-2/30 p-4 text-left transition-colors hover:border-editor-accent hover:bg-editor-bg"
                >
                  <p className="text-sm font-semibold">{block.name}</p>
                  <p className="mt-1 text-[11px] leading-snug text-editor-fg-muted">{block.description}</p>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-editor-accent">
                    + Inserir bloco
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
