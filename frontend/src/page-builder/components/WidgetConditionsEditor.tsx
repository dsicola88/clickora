import type { MessageKey } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { WidgetConditions, WidgetNode } from "../types";
import { CSS_MASK_OPTIONS } from "../widget-mask";
import { NumberField, SelectField, TextareaField } from "./PropertyControls";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const MASK_KEYS: Partial<Record<string, MessageKey>> = {
  none: "pages.pageBuilder.widgets.opt.noneFem",
  circle: "pages.pageBuilder.widgets.opt.circle",
  ellipse: "pages.pageBuilder.chrome.conditions.ellipse",
  diamond: "pages.pageBuilder.chrome.conditions.diamond",
  hexagon: "pages.pageBuilder.chrome.conditions.hexagon",
  custom: "pages.pageBuilder.chrome.conditions.custom",
};

export function WidgetConditionsEditor({
  widget,
  onChange,
}: {
  widget: WidgetNode;
  onChange: (conditions: WidgetConditions | undefined) => void;
}) {
  const { t } = useAppLocale();
  const c = widget.conditions ?? {};
  const patch = (partial: Partial<WidgetConditions>) => {
    const next = { ...c, ...partial };
    const empty =
      !next.hideDesktop &&
      !next.hideTablet &&
      !next.hideMobile &&
      !(next.showAfterMs && next.showAfterMs > 0) &&
      !(typeof next.showAtScrollPercent === "number" && next.showAtScrollPercent > 0);
    onChange(empty ? undefined : next);
  };

  return (
    <div className="border-b border-editor-border p-3">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
        {t("pages.pageBuilder.chrome.conditions.title")}
      </h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">{t("pages.pageBuilder.chrome.conditions.hideDesktop")}</Label>
          <Switch
            checked={Boolean(c.hideDesktop)}
            onCheckedChange={(v) => patch({ hideDesktop: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">{t("pages.pageBuilder.chrome.conditions.hideTablet")}</Label>
          <Switch
            checked={Boolean(c.hideTablet)}
            onCheckedChange={(v) => patch({ hideTablet: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">{t("pages.pageBuilder.chrome.conditions.hideMobile")}</Label>
          <Switch
            checked={Boolean(c.hideMobile)}
            onCheckedChange={(v) => patch({ hideMobile: v })}
          />
        </div>
        <NumberField
          label={t("pages.pageBuilder.chrome.conditions.afterMs")}
          value={c.showAfterMs ?? 0}
          min={0}
          max={120000}
          onChange={(v) => patch({ showAfterMs: v > 0 ? v : undefined })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.conditions.afterScroll")}
          value={c.showAtScrollPercent ?? 0}
          min={0}
          max={100}
          onChange={(v) => patch({ showAtScrollPercent: v > 0 ? v : undefined })}
        />
      </div>
    </div>
  );
}

export function WidgetMaskEditor({
  widget,
  onChange,
}: {
  widget: WidgetNode;
  onChange: (patch: { cssMask?: string; cssMaskCustom?: string }) => void;
}) {
  const { t } = useAppLocale();
  const mask = widget.cssMask ?? "none";
  return (
    <div className="border-b border-editor-border p-3">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
        {t("pages.pageBuilder.chrome.conditions.mask")}
      </h4>
      <div className="space-y-3">
        <SelectField
          label={t("pages.pageBuilder.widgets.fields.shape")}
          value={mask}
          options={CSS_MASK_OPTIONS.map((o) => ({
            value: o.value,
            label: MASK_KEYS[o.value] ? t(MASK_KEYS[o.value] as MessageKey) : o.label,
          }))}
          onChange={(v) =>
            onChange({
              cssMask: v === "none" ? undefined : v,
              cssMaskCustom: v === "custom" ? widget.cssMaskCustom : undefined,
            })
          }
        />
        {mask === "custom" ? (
          <TextareaField
            label={t("pages.pageBuilder.chrome.conditions.clipPath")}
            value={widget.cssMaskCustom ?? ""}
            onChange={(v) => onChange({ cssMask: "custom", cssMaskCustom: v })}
            rows={2}
            placeholder="polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
          />
        ) : null}
      </div>
    </div>
  );
}
