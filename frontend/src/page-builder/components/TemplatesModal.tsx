import { useState } from "react";
import { TEMPLATES, TEMPLATE_CATEGORIES, type TemplateDefinition } from "../templates";
import { useBuilder } from "../store";
import { X, LayoutTemplate, Plus } from "lucide-react";

export function TemplatesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [category, setCategory] = useState<TemplateDefinition["category"] | "all">("all");
  const [pendingTemplate, setPendingTemplate] = useState<TemplateDefinition | null>(null);
  const doc = useBuilder((s) => s.doc);

  if (!open) return null;

  const items =
    category === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.category === category);

  const handlePick = (t: TemplateDefinition) => {
    if (doc.sections.length > 0) {
      setPendingTemplate(t);
    } else {
      applyTemplate(t, "replace");
    }
  };

  const applyTemplate = (t: TemplateDefinition, mode: "replace" | "append") => {
    const state = useBuilder.getState();
    const newSections = t.build();
    if (mode === "replace") {
      // Replace via store — we do this by manipulating doc directly through public APIs.
      // Easiest: reset then add each section. But reset clears the whole doc nicely.
      state.replaceSections(newSections);
    } else {
      state.appendSections(newSections);
    }
    setPendingTemplate(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-editor-border bg-editor-panel text-editor-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-editor-border px-5 py-4">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-editor-accent" />
            <h2 className="text-base font-semibold">Biblioteca de Templates</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-editor-fg-muted transition-colors hover:bg-editor-panel-2 hover:text-editor-fg"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-48 shrink-0 border-r border-editor-border p-3">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-editor-fg-muted">
              Categorias
            </h3>
            <nav className="space-y-1">
              <CategoryButton
                active={category === "all"}
                onClick={() => setCategory("all")}
                count={TEMPLATES.length}
              >
                Todos
              </CategoryButton>
              {TEMPLATE_CATEGORIES.map((c) => {
                const count = TEMPLATES.filter((t) => t.category === c.id).length;
                return (
                  <CategoryButton
                    key={c.id}
                    active={category === c.id}
                    onClick={() => setCategory(c.id)}
                    count={count}
                  >
                    {c.label}
                  </CategoryButton>
                );
              })}
            </nav>
          </aside>

          <div className="editor-scrollbar flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <TemplateCard key={t.id} template={t} onPick={handlePick} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {pendingTemplate && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPendingTemplate(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-editor-border bg-editor-panel p-5 text-editor-fg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold">Inserir template</h3>
            <p className="mb-5 text-sm text-editor-fg-muted">
              Sua página já tem conteúdo. Como deseja inserir{" "}
              <strong className="text-editor-fg">{pendingTemplate.name}</strong>?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => applyTemplate(pendingTemplate, "append")}
                className="rounded bg-editor-accent px-4 py-2.5 text-sm font-medium text-editor-accent-fg hover:opacity-90"
              >
                Adicionar ao final
              </button>
              <button
                type="button"
                onClick={() => applyTemplate(pendingTemplate, "replace")}
                className="rounded border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20"
              >
                Substituir página inteira
              </button>
              <button
                type="button"
                onClick={() => setPendingTemplate(null)}
                className="rounded px-4 py-2 text-sm text-editor-fg-muted hover:text-editor-fg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryButton({
  children,
  active,
  onClick,
  count,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
        active
          ? "bg-editor-accent/15 text-editor-accent"
          : "text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
      }`}
    >
      <span className="font-medium">{children}</span>
      <span className="text-[10px] opacity-60">{count}</span>
    </button>
  );
}

function TemplateCard({
  template,
  onPick,
}: {
  template: TemplateDefinition;
  onPick: (t: TemplateDefinition) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(template)}
      className="group flex flex-col overflow-hidden rounded-lg border border-editor-border bg-editor-panel-2 text-left transition-all hover:border-editor-accent hover:shadow-lg"
    >
      <div className="relative aspect-video overflow-hidden bg-editor-canvas">
        <img
          src={template.thumbnail}
          alt={template.name}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-editor-accent/0 transition-colors group-hover:bg-editor-accent/30">
          <span className="flex items-center gap-1.5 rounded-full bg-editor-accent px-3 py-1.5 text-xs font-semibold text-editor-accent-fg opacity-0 transition-opacity group-hover:opacity-100">
            <Plus className="h-3.5 w-3.5" /> Usar template
          </span>
        </div>
      </div>
      <div className="p-3">
        <h4 className="text-sm font-semibold text-editor-fg">{template.name}</h4>
        <p className="mt-1 line-clamp-2 text-xs text-editor-fg-muted">{template.description}</p>
      </div>
    </button>
  );
}
