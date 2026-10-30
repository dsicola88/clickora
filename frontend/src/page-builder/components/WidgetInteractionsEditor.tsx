import type { WidgetInteraction, WidgetInteractionAction, WidgetInteractionTrigger, WidgetNode } from "../types";
import { createWidgetInteraction } from "../factory";
import { SelectField, TextField } from "./PropertyControls";
import { Plus, Trash2 } from "lucide-react";

const TRIGGER_OPTS: Array<{ value: WidgetInteractionTrigger; label: string }> = [
  { value: "click", label: "Clique" },
  { value: "hover", label: "Hover (passar o rato)" },
];

const ACTION_OPTS: Array<{ value: WidgetInteractionAction; label: string }> = [
  { value: "openUrl", label: "Abrir URL" },
  { value: "scrollTo", label: "Ir para âncora / ID" },
  { value: "openPopup", label: "Abrir popup" },
  { value: "show", label: "Mostrar elemento" },
  { value: "hide", label: "Ocultar elemento" },
  { value: "toggle", label: "Alternar visibilidade" },
];

/**
 * Interações por widget (clique/hover → acção).
 */
export function WidgetInteractionsEditor({
  widget,
  onChange,
}: {
  widget: WidgetNode;
  onChange: (interactions: WidgetInteraction[]) => void;
}) {
  const list = widget.interactions ?? [];

  const patchAt = (index: number, partial: Partial<WidgetInteraction>) => {
    const next = list.map((ix, i) => (i === index ? { ...ix, ...partial } : ix));
    onChange(next);
  };

  return (
    <div className="border-b border-editor-border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
          Interações
        </h4>
        <button
          type="button"
          onClick={() => onChange([...list, createWidgetInteraction()])}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-editor-accent hover:bg-editor-panel-2"
        >
          <Plus className="h-3 w-3" />
          Adicionar
        </button>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-editor-fg-muted">
        Clique ou hover neste elemento dispara uma acção (URL, popup, mostrar/ocultar outro ID).
      </p>
      {list.length === 0 ? (
        <p className="text-[11px] text-editor-fg-muted">Sem interações.</p>
      ) : (
        <div className="space-y-4">
          {list.map((ix, index) => (
            <div
              key={ix.id}
              className="space-y-2 rounded-md border border-editor-border bg-editor-panel-2/40 p-2"
            >
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onChange(list.filter((_, i) => i !== index))}
                  className="rounded p-0.5 text-editor-fg-muted hover:text-red-400"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <SelectField
                label="Quando"
                value={ix.trigger}
                options={TRIGGER_OPTS}
                onChange={(v) => patchAt(index, { trigger: v as WidgetInteractionTrigger })}
              />
              <SelectField
                label="Acção"
                value={ix.action}
                options={ACTION_OPTS}
                onChange={(v) => patchAt(index, { action: v as WidgetInteractionAction })}
              />
              {ix.action === "openUrl" ? (
                <>
                  <TextField
                    label="URL"
                    value={ix.url ?? ""}
                    onChange={(v) => patchAt(index, { url: v })}
                    placeholder="https://…"
                  />
                  <SelectField
                    label="Nova janela"
                    value={ix.openInNewTab ? "yes" : "no"}
                    options={[
                      { value: "no", label: "Não" },
                      { value: "yes", label: "Sim" },
                    ]}
                    onChange={(v) => patchAt(index, { openInNewTab: v === "yes" })}
                  />
                </>
              ) : (
                <TextField
                  label={
                    ix.action === "openPopup"
                      ? "ID do popup"
                      : ix.action === "scrollTo"
                        ? "ID / âncora (sem #)"
                        : "ID do elemento alvo (cssId)"
                  }
                  value={ix.targetId ?? ""}
                  onChange={(v) => patchAt(index, { targetId: v })}
                  placeholder={ix.action === "openPopup" ? "pop_…" : "meu-bloco"}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
