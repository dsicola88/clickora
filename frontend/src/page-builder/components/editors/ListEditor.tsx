import type { ReactNode } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { PanelSection } from "./PanelSection";

export interface ListEditorItem {
  id: string;
  [k: string]: unknown;
}

export function ListEditor<T extends ListEditorItem>({
  title,
  items,
  onChange,
  newItem,
  renderFields,
  itemLabel,
}: {
  title: string;
  items: T[];
  onChange: (next: T[]) => void;
  newItem: () => T;
  renderFields: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  itemLabel: (item: T, idx: number) => string;
}) {
  const { t } = useAppLocale();
  const update = (idx: number, patch: Partial<T>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  return (
    <PanelSection title={title}>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded bg-editor-panel-2 p-3 text-center text-[11px] text-editor-fg-muted">
            {t("pages.pageBuilder.chrome.listEmpty")}
          </p>
        )}
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="space-y-2 rounded border border-editor-border bg-editor-panel-2 p-2.5"
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="text-editor-fg-muted hover:text-editor-fg disabled:opacity-30"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] font-semibold text-editor-fg">
                  {itemLabel(item, idx)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded p-1 text-editor-fg-muted hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {renderFields(item, (patch) => update(idx, patch))}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, newItem()])}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-editor-border py-2 text-[11px] font-medium text-editor-fg-muted transition-colors hover:border-editor-accent hover:text-editor-accent"
        >
          <Plus className="h-3.5 w-3.5" /> {t("common.add")}
        </button>
      </div>
    </PanelSection>
  );
}
