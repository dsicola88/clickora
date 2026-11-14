import { nanoid } from "nanoid";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { ColorField, NumberField, SelectField, TextField, TextareaField } from "../PropertyControls";
import { ListEditor } from "./ListEditor";
import { PanelSection } from "./PanelSection";

export function FaqWidgetEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  const items =
    (content.items as Array<{ id: string; question: string; answer: string }>) ?? [];
  return (
    <>
      <ListEditor
        title={t("pages.pageBuilder.chrome.questions")}
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.question || t("pages.pageBuilder.chrome.questionFallback")}
        newItem={() => ({
          id: `q_${nanoid(6)}`,
          question: t("pages.pageBuilder.chrome.faqNewQuestion"),
          answer: t("pages.pageBuilder.chrome.faqNewAnswer"),
        })}
        renderFields={(item, update) => (
          <>
            <TextField
              label={t("pages.pageBuilder.chrome.question")}
              value={item.question}
              onChange={(v) => update({ question: v })}
            />
            <TextareaField
              label={t("pages.pageBuilder.chrome.answerHtml")}
              value={item.answer}
              onChange={(v) => update({ answer: v })}
              rows={3}
            />
          </>
        )}
      />
      <PanelSection title={t("pages.pageBuilder.chrome.behavior")}>
        <SelectField
          label={t("pages.pageBuilder.chrome.allowMultiple")}
          value={(content.allowMultiple as boolean) ? "yes" : "no"}
          options={[
            { value: "no", label: t("common.no") },
            { value: "yes", label: t("common.yes") },
          ]}
          onChange={(v) => setContent({ allowMultiple: v === "yes" })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.defaultOpen")}
          value={(content.defaultOpen as number) ?? 0}
          min={-1}
          max={Math.max(0, items.length - 1)}
          onChange={(v) => setContent({ defaultOpen: v })}
        />
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          {t("pages.pageBuilder.chrome.defaultOpenHint")}
        </p>
      </PanelSection>
      <PanelSection title={t("pages.pageBuilder.chrome.appearance")}>
        <ColorField
          label={t("pages.pageBuilder.chrome.itemBg")}
          value={(content.itemBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ itemBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.panel.borderColor")}
          value={(content.itemBorderColor as string) ?? "#e5e7eb"}
          onChange={(v) => setContent({ itemBorderColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.questionColor")}
          value={(content.questionColor as string) ?? "#111827"}
          onChange={(v) => setContent({ questionColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.answerColor")}
          value={(content.answerColor as string) ?? "#4b5563"}
          onChange={(v) => setContent({ answerColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.accent")}
          value={(content.accentColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ accentColor: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.panel.radius")}
          value={(content.borderRadius as number) ?? 10}
          min={0}
          max={32}
          onChange={(v) => setContent({ borderRadius: v })}
        />
      </PanelSection>
    </>
  );
}
