import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { WidgetInteraction, WidgetInteractionAction, WidgetInteractionTrigger, WidgetNode } from "../types";
import { createWidgetInteraction } from "../factory";
import { SelectField, TextField } from "./PropertyControls";
import { Plus, Trash2 } from "lucide-react";

/** Per-widget interactions (click/hover → action). */
export function WidgetInteractionsEditor({
  widget,
  onChange,
}: {
  widget: WidgetNode;
  onChange: (interactions: WidgetInteraction[]) => void;
}) {
  const { t } = useAppLocale();
  const list = widget.interactions ?? [];

  const triggerOpts = [
    { value: "click" as const, label: t("pages.pageBuilder.chrome.interactions.click") },
    { value: "hover" as const, label: t("pages.pageBuilder.chrome.interactions.hover") },
  ];
  const actionOpts = [
    { value: "openUrl" as const, label: t("pages.pageBuilder.chrome.interactions.openUrl") },
    { value: "scrollTo" as const, label: t("pages.pageBuilder.chrome.interactions.scrollTo") },
    { value: "openPopup" as const, label: t("pages.pageBuilder.chrome.interactions.openPopup") },
    { value: "show" as const, label: t("pages.pageBuilder.chrome.interactions.showEl") },
    { value: "hide" as const, label: t("pages.pageBuilder.chrome.interactions.hideEl") },
    { value: "toggle" as const, label: t("pages.pageBuilder.chrome.interactions.toggle") },
  ];

  const patchAt = (index: number, partial: Partial<WidgetInteraction>) => {
    const next = list.map((ix, i) => (i === index ? { ...ix, ...partial } : ix));
    onChange(next);
  };

  return (
    <div className="border-b border-editor-border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
          {t("pages.pageBuilder.chrome.interactions.title")}
        </h4>
        <button
          type="button"
          onClick={() => onChange([...list, createWidgetInteraction()])}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-editor-accent hover:bg-editor-panel-2"
        >
          <Plus className="h-3 w-3" />
          {t("common.add")}
        </button>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-editor-fg-muted">
        {t("pages.pageBuilder.chrome.interactions.hint")}
      </p>
      {list.length === 0 ? (
        <p className="text-[11px] text-editor-fg-muted">{t("pages.pageBuilder.chrome.interactions.empty")}</p>
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
                  title={t("common.remove")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <SelectField
                label={t("pages.pageBuilder.chrome.interactions.when")}
                value={ix.trigger}
                options={triggerOpts}
                onChange={(v) => patchAt(index, { trigger: v as WidgetInteractionTrigger })}
              />
              <SelectField
                label={t("pages.pageBuilder.chrome.interactions.action")}
                value={ix.action}
                options={actionOpts}
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
                    label={t("pages.pageBuilder.widgets.opt.newWindow")}
                    value={ix.openInNewTab ? "yes" : "no"}
                    options={[
                      { value: "no", label: t("common.no") },
                      { value: "yes", label: t("common.yes") },
                    ]}
                    onChange={(v) => patchAt(index, { openInNewTab: v === "yes" })}
                  />
                </>
              ) : (
                <TextField
                  label={
                    ix.action === "openPopup"
                      ? t("pages.pageBuilder.chrome.interactions.popupId")
                      : ix.action === "scrollTo"
                        ? t("pages.pageBuilder.chrome.interactions.anchorId")
                        : t("pages.pageBuilder.chrome.interactions.targetId")
                  }
                  value={ix.targetId ?? ""}
                  onChange={(v) => patchAt(index, { targetId: v })}
                  placeholder={
                    ix.action === "openPopup"
                      ? t("pages.pageBuilder.chrome.interactions.popupPh")
                      : t("pages.pageBuilder.chrome.interactions.targetPh")
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
