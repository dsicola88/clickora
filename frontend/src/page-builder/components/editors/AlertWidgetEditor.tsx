import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { NumberField, SelectField, TextField, TextareaField } from "../PropertyControls";
import { PanelSection } from "./PanelSection";

export function AlertWidgetEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  return (
    <PanelSection title={t("pages.pageBuilder.content")}>
      <SelectField
        label={t("pages.pageBuilder.widgets.fields.type")}
        value={(content.variant as string) ?? "info"}
        options={[
          { value: "info", label: t("pages.pageBuilder.chrome.variantInfo") },
          { value: "success", label: t("pages.pageBuilder.chrome.variantSuccess") },
          { value: "warning", label: t("pages.pageBuilder.chrome.variantWarning") },
          { value: "danger", label: t("pages.pageBuilder.chrome.variantDanger") },
        ]}
        onChange={(v) => setContent({ variant: v })}
      />
      <TextField
        label={t("pages.pageBuilder.widgets.fields.title")}
        value={(content.title as string) ?? ""}
        onChange={(v) => setContent({ title: v })}
      />
      <TextareaField
        label={t("pages.pageBuilder.chrome.messageHtml")}
        value={(content.message as string) ?? ""}
        onChange={(v) => setContent({ message: v })}
        rows={5}
      />
      <SelectField
        label={t("pages.pageBuilder.chrome.showIcon")}
        value={((content.showIcon as boolean) ?? true) ? "yes" : "no"}
        options={[
          { value: "yes", label: t("common.yes") },
          { value: "no", label: t("common.no") },
        ]}
        onChange={(v) => setContent({ showIcon: v === "yes" })}
      />
      <SelectField
        label={t("pages.pageBuilder.chrome.dismiss")}
        value={((content.dismissible as boolean) ?? false) ? "yes" : "no"}
        options={[
          { value: "no", label: t("common.no") },
          { value: "yes", label: t("common.yes") },
        ]}
        onChange={(v) => setContent({ dismissible: v === "yes" })}
      />
      <NumberField
        label={t("pages.pageBuilder.chrome.borderRadius")}
        value={(content.borderRadius as number) ?? 10}
        min={0}
        max={32}
        onChange={(v) => setContent({ borderRadius: v })}
      />
    </PanelSection>
  );
}
