import type { WidgetEffects, WidgetNode } from "../types";
import {
  EASING_PRESET_OPTIONS,
  ENTRANCE_ANIMATION_OPTIONS,
  HOVER_PRESET_OPTIONS,
  resolveWidgetEffects,
} from "../widget-motion";
import { NumberField, SelectField, TextareaField } from "./PropertyControls";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-editor-border p-3 last:border-0">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/**
 * Motion Effects (Elementor Advanced) — comum a todos os widgets.
 * Guarda em `widget.effects` (independente do tipo).
 */
export function WidgetEffectsEditor({
  widget,
  onChange,
}: {
  widget: WidgetNode;
  onChange: (effects: WidgetEffects) => void;
}) {
  const e = resolveWidgetEffects(widget.effects, widget.content);
  const patch = (partial: Partial<WidgetEffects>) =>
    onChange({ ...(widget.effects ?? {}), ...partial });

  const hoverPresetMatch = HOVER_PRESET_OPTIONS.find((o) => o.value === (e.hoverTransform ?? ""));

  return (
    <>
      <Section title="Animação à entrada">
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          Como no Elementor: cada elemento tem a sua animação ao aparecer na página.
        </p>
        <SelectField
          label="Tipo"
          value={e.entranceAnimation ?? "none"}
          options={[...ENTRANCE_ANIMATION_OPTIONS]}
          onChange={(v) => patch({ entranceAnimation: v })}
        />
        <NumberField
          label="Duração (ms)"
          value={e.entranceDurationMs ?? 600}
          min={0}
          max={10000}
          onChange={(v) => patch({ entranceDurationMs: v })}
        />
        <NumberField
          label="Atraso (ms)"
          value={e.entranceDelayMs ?? 0}
          min={0}
          max={10000}
          onChange={(v) => patch({ entranceDelayMs: v })}
        />
        <SelectField
          label="Curva (easing)"
          value={e.entranceEasing ?? "cubic-bezier(0.4, 0, 0.2, 1)"}
          options={[...EASING_PRESET_OPTIONS]}
          onChange={(v) => patch({ entranceEasing: v })}
        />
      </Section>

      <Section title="Transformação e transição">
        <TextareaField
          label="Transform (estado normal)"
          value={e.transform ?? ""}
          onChange={(v) => patch({ transform: v.trim() ? v : undefined })}
          rows={2}
          placeholder="ex.: rotate(0deg) scale(1)"
        />
        <NumberField
          label="Duração hover (ms)"
          value={e.transitionDurationMs ?? 200}
          min={0}
          max={5000}
          onChange={(v) => patch({ transitionDurationMs: v })}
        />
        <SelectField
          label="Curva da transição"
          value={e.transitionEasing ?? "ease"}
          options={[...EASING_PRESET_OPTIONS]}
          onChange={(v) => patch({ transitionEasing: v })}
        />
      </Section>

      <Section title="Ao passar o rato (hover)">
        <SelectField
          label="Preset de transformação"
          value={hoverPresetMatch ? (e.hoverTransform ?? "") : ""}
          options={[...HOVER_PRESET_OPTIONS]}
          onChange={(v) => patch({ hoverTransform: v.trim() ? v : undefined })}
        />
        <TextareaField
          label="Transform (custom)"
          value={e.hoverTransform ?? ""}
          onChange={(v) => patch({ hoverTransform: v.trim() ? v : undefined })}
          rows={2}
          placeholder="scale(1.05) translateY(-2px)"
        />
        <TextareaField
          label="Sombra no hover"
          value={e.hoverBoxShadow ?? ""}
          onChange={(v) => patch({ hoverBoxShadow: v.trim() ? v : undefined })}
          rows={2}
          placeholder="0 8px 24px rgba(0,0,0,0.18)"
        />
        <NumberField
          label="Opacidade no hover (0–1)"
          value={typeof e.hoverOpacity === "number" ? e.hoverOpacity : 1}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => patch({ hoverOpacity: v })}
        />
        <p className="text-[10px] leading-relaxed text-editor-fg-muted">
          No botão, cores de hover (texto/fundo) continuam na aba <strong>Conteúdo</strong>.
        </p>
      </Section>
    </>
  );
}
