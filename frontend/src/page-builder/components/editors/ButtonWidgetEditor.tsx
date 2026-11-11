import type { ReactNode } from "react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { WidgetNode } from "../../types";
import { NumberField, SelectField, TextField, TextareaField } from "../PropertyControls";

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-editor-border p-3 last:border-0">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function ButtonWidgetEditor({
  widget,
  setContent,
}: {
  widget: WidgetNode;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  const c = widget.content;
  const entranceOptions = [
    { value: "none", label: t("pages.pageBuilder.popups.animNone") },
    { value: "fadeIn", label: t("pages.pageBuilder.widgets.button.fadeIn") },
    { value: "zoomIn", label: t("pages.pageBuilder.widgets.button.zoomIn") },
    { value: "slideUp", label: t("pages.pageBuilder.widgets.button.slideUp") },
    { value: "slideDown", label: t("pages.pageBuilder.widgets.button.slideDown") },
    { value: "slideLeft", label: t("pages.pageBuilder.widgets.button.slideLeft") },
    { value: "slideRight", label: t("pages.pageBuilder.widgets.button.slideRight") },
    { value: "bounceIn", label: t("pages.pageBuilder.widgets.button.bounceIn") },
  ];
  const easingPresets = [
    { value: "ease", label: "ease" },
    { value: "linear", label: "linear" },
    { value: "ease-in", label: "ease-in" },
    { value: "ease-out", label: "ease-out" },
    { value: "ease-in-out", label: "ease-in-out" },
    { value: "cubic-bezier(0.4, 0, 0.2, 1)", label: t("pages.pageBuilder.widgets.button.easeMaterial") },
    { value: "cubic-bezier(0.68, -0.55, 0.265, 1.55)", label: t("pages.pageBuilder.widgets.button.easeElastic") },
  ];

  return (
    <>
      <PanelSection title={t("pages.pageBuilder.widgets.button.section")}>
        <TextField
          label={t("pages.pageBuilder.widgets.fields.text")}
          value={(c.text as string) ?? ""}
          onChange={(v) => setContent({ text: v })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.fields.linkUrl")}
          value={(c.href as string) ?? ""}
          onChange={(v) => setContent({ href: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.widgets.fields.openIn")}
          value={(c.target as string) ?? "_self"}
          options={[
            { value: "_self", label: t("pages.pageBuilder.widgets.opt.sameTab") },
            { value: "_blank", label: t("pages.pageBuilder.widgets.opt.newTab") },
          ]}
          onChange={(v) => setContent({ target: v })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.button.icon")}
          value={(c.iconName as string) ?? ""}
          onChange={(v) => setContent({ iconName: v.trim() ? v : undefined })}
          placeholder={t("pages.pageBuilder.widgets.button.iconPh")}
        />
        <SelectField
          label={t("pages.pageBuilder.widgets.button.iconPosition")}
          value={(c.iconPosition as string) ?? "right"}
          options={[
            { value: "left", label: t("pages.pageBuilder.widgets.opt.left") },
            { value: "right", label: t("pages.pageBuilder.widgets.opt.right") },
          ]}
          onChange={(v) => setContent({ iconPosition: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.widgets.button.iconSize")}
          value={(c.iconSize as number) ?? 16}
          onChange={(v) => setContent({ iconSize: v })}
          min={12}
          max={40}
        />
      </PanelSection>

      <PanelSection title={t("pages.pageBuilder.widgets.button.normalTitle")}>
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          <span className="font-medium text-editor-fg">{t("pages.pageBuilder.widgets.button.normalShadow")}</span>{" "}
          {t("pages.pageBuilder.widgets.button.normalMid")}{" "}
          <span className="font-medium">{t("pages.pageBuilder.style")}</span>{" "}
          {t("pages.pageBuilder.widgets.button.normalTail")}{" "}
          <span className="font-mono text-[10px]">{t("pages.pageBuilder.widgets.button.normalTransform")}</span>{" "}
          {t("pages.pageBuilder.widgets.button.normalCss")}{" "}
          <span className="font-mono text-[10px]">{t("pages.pageBuilder.widgets.button.normalExample")}</span>).
        </p>
        <TextareaField
          label={t("pages.pageBuilder.widgets.button.transformCss")}
          value={(c.transform as string) ?? ""}
          onChange={(v) => setContent({ transform: v.trim() ? v : undefined })}
          rows={2}
          placeholder={t("pages.pageBuilder.widgets.button.transformPh")}
        />
        <NumberField
          label={t("pages.pageBuilder.widgets.button.hoverDuration")}
          value={typeof c.transitionDurationMs === "number" ? c.transitionDurationMs : 200}
          min={0}
          max={5000}
          onChange={(v) => setContent({ transitionDurationMs: v })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.button.easing")}
          value={(c.transitionEasing as string) ?? "ease"}
          onChange={(v) => setContent({ transitionEasing: v.trim() || "ease" })}
          placeholder={t("pages.pageBuilder.widgets.button.easingPh")}
        />
      </PanelSection>

      <PanelSection title={t("pages.pageBuilder.widgets.button.hoverTitle")}>
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          {t("pages.pageBuilder.widgets.button.hoverEmpty")}{" "}
          <span className="font-mono text-[10px]">{t("pages.pageBuilder.widgets.button.hoverGradient")}</span>.
        </p>
        <TextField
          label={t("pages.pageBuilder.panel.textColor")}
          value={(c.hoverColor as string) ?? ""}
          onChange={(v) => setContent({ hoverColor: v.trim() ? v : undefined })}
          placeholder={t("common.optional")}
        />
        <TextField
          label={t("pages.pageBuilder.background")}
          value={(c.hoverBackground as string) ?? ""}
          onChange={(v) => setContent({ hoverBackground: v.trim() ? v : undefined })}
          placeholder={t("common.optional")}
        />
        <TextField
          label={t("pages.pageBuilder.panel.borderColor")}
          value={(c.hoverBorderColor as string) ?? ""}
          onChange={(v) => setContent({ hoverBorderColor: v.trim() ? v : undefined })}
          placeholder={t("common.optional")}
        />
        <TextareaField
          label={t("pages.pageBuilder.widgets.button.boxShadow")}
          value={(c.hoverBoxShadow as string) ?? ""}
          onChange={(v) => setContent({ hoverBoxShadow: v.trim() ? v : undefined })}
          rows={2}
          placeholder={t("pages.pageBuilder.widgets.button.boxShadowPh")}
        />
        <TextareaField
          label={t("pages.pageBuilder.widgets.button.transform")}
          value={(c.hoverTransform as string) ?? ""}
          onChange={(v) => setContent({ hoverTransform: v.trim() ? v : undefined })}
          rows={2}
          placeholder={t("pages.pageBuilder.widgets.button.hoverTransformPh")}
        />
      </PanelSection>

      <PanelSection title={t("pages.pageBuilder.widgets.button.entranceTitle")}>
        <SelectField
          label={t("pages.pageBuilder.widgets.fields.type")}
          value={(c.entranceAnimation as string) ?? "none"}
          options={entranceOptions}
          onChange={(v) => setContent({ entranceAnimation: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.widgets.fields.durationMs")}
          value={typeof c.entranceDurationMs === "number" ? c.entranceDurationMs : 600}
          min={0}
          max={10000}
          onChange={(v) => setContent({ entranceDurationMs: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.widgets.fields.delayMs")}
          value={typeof c.entranceDelayMs === "number" ? c.entranceDelayMs : 0}
          min={0}
          max={10000}
          onChange={(v) => setContent({ entranceDelayMs: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.widgets.button.easingCurve")}
          value={(c.entranceEasing as string) ?? "cubic-bezier(0.4, 0, 0.2, 1)"}
          options={easingPresets}
          onChange={(v) => setContent({ entranceEasing: v })}
        />
      </PanelSection>
    </>
  );
}
