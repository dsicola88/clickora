import type { WidgetConditions, WidgetNode } from "../types";
import { CSS_MASK_OPTIONS } from "../widget-mask";
import { NumberField, SelectField, TextareaField } from "./PropertyControls";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function WidgetConditionsEditor({
  widget,
  onChange,
}: {
  widget: WidgetNode;
  onChange: (conditions: WidgetConditions | undefined) => void;
}) {
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
        Condições de exibição
      </h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">Ocultar no desktop</Label>
          <Switch
            checked={Boolean(c.hideDesktop)}
            onCheckedChange={(v) => patch({ hideDesktop: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">Ocultar no tablet</Label>
          <Switch
            checked={Boolean(c.hideTablet)}
            onCheckedChange={(v) => patch({ hideTablet: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">Ocultar no telemóvel</Label>
          <Switch
            checked={Boolean(c.hideMobile)}
            onCheckedChange={(v) => patch({ hideMobile: v })}
          />
        </div>
        <NumberField
          label="Mostrar após (ms)"
          value={c.showAfterMs ?? 0}
          min={0}
          max={120000}
          onChange={(v) => patch({ showAfterMs: v > 0 ? v : undefined })}
        />
        <NumberField
          label="Mostrar após scroll (%)"
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
  const mask = widget.cssMask ?? "none";
  return (
    <div className="border-b border-editor-border p-3">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
        Máscara
      </h4>
      <div className="space-y-3">
        <SelectField
          label="Forma"
          value={mask}
          options={[...CSS_MASK_OPTIONS]}
          onChange={(v) =>
            onChange({
              cssMask: v === "none" ? undefined : v,
              cssMaskCustom: v === "custom" ? widget.cssMaskCustom : undefined,
            })
          }
        />
        {mask === "custom" ? (
          <TextareaField
            label="clip-path CSS"
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
