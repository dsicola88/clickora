import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { ColorField, NumberField, SelectField, TextField } from "../PropertyControls";
import { PanelSection } from "./PanelSection";

export function CountdownWidgetEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  const deadline = (content.deadline as string) ?? new Date(Date.now() + 86400000).toISOString();
  const dt = new Date(deadline);
  const isoLocal = !isNaN(dt.getTime())
    ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
    : "";

  return (
    <>
      <PanelSection title={t("pages.pageBuilder.chrome.targetDate")}>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-editor-fg-muted">
            {t("pages.pageBuilder.chrome.expires")}
          </label>
          <input
            type="datetime-local"
            value={isoLocal}
            onChange={(e) => {
              const d = new Date(e.target.value);
              if (!isNaN(d.getTime())) setContent({ deadline: d.toISOString() });
            }}
            className="w-full rounded border border-editor-border bg-editor-panel-2 px-2 py-1.5 text-xs text-editor-fg focus:outline-none focus:ring-1 focus:ring-editor-accent"
          />
        </div>
        <TextField
          label={t("pages.pageBuilder.chrome.expiredLabel")}
          value={(content.expiredMessage as string) ?? t("pages.pageBuilder.defaults.countdownExpired")}
          onChange={(v) => setContent({ expiredMessage: v })}
        />
      </PanelSection>
      <PanelSection title={t("pages.pageBuilder.chrome.display")}>
        <SelectField
          label={t("pages.pageBuilder.chrome.showDays")}
          value={(content.showDays as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
          ]}
          onChange={(v) => setContent({ showDays: v === "yes" })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.showLabels")}
          value={(content.showLabels as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
          ]}
          onChange={(v) => setContent({ showLabels: v === "yes" })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.digitSize")}
          value={(content.digitSize as number) ?? 48}
          min={20}
          max={120}
          onChange={(v) => setContent({ digitSize: v })}
        />
      </PanelSection>
      <PanelSection title={t("pages.pageBuilder.colors")}>
        <ColorField
          label={t("pages.pageBuilder.chrome.digitBg")}
          value={(content.digitBg as string) ?? "#0f172a"}
          onChange={(v) => setContent({ digitBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.digitColor")}
          value={(content.digitColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ digitColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.labelColor")}
          value={(content.labelColor as string) ?? "#475569"}
          onChange={(v) => setContent({ labelColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.separatorColor")}
          value={(content.separatorColor as string) ?? "#0f172a"}
          onChange={(v) => setContent({ separatorColor: v })}
        />
      </PanelSection>
    </>
  );
}
