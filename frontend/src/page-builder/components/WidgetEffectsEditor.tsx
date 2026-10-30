import type { WidgetEffects, WidgetNode } from "../types";
import {
  CONTINUOUS_ANIMATION_OPTIONS,
  EASING_PRESET_OPTIONS,
  ENTRANCE_ANIMATION_OPTIONS,
  ENTRANCE_TRIGGER_OPTIONS,
  HOVER_PRESET_OPTIONS,
  MOTION_PATH_OPTIONS,
  SCROLLING_EFFECT_OPTIONS,
  resolveWidgetEffects,
} from "../widget-motion";
import { ColorField, NumberField, SelectField, TextareaField } from "./PropertyControls";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
 * Efeitos de movimento — comum a todos os widgets (aba Avançado).
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
          Dispara ao scroll (viewport) ou no load — duração, atraso e curva
          por elemento.
        </p>
        <SelectField
          label="Tipo"
          value={e.entranceAnimation ?? "none"}
          options={[...ENTRANCE_ANIMATION_OPTIONS]}
          onChange={(v) => patch({ entranceAnimation: v })}
        />
        <SelectField
          label="Disparo"
          value={e.entranceTrigger ?? "scroll"}
          options={[...ENTRANCE_TRIGGER_OPTIONS]}
          onChange={(v) => patch({ entranceTrigger: v === "load" ? "load" : "scroll" })}
        />
        <NumberField
          label="Duração (ms)"
          value={e.entranceDurationMs ?? 700}
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
          value={e.entranceEasing ?? "cubic-bezier(0.22, 1, 0.36, 1)"}
          options={[...EASING_PRESET_OPTIONS]}
          onChange={(v) => patch({ entranceEasing: v })}
        />
        <NumberField
          label="Limiar viewport (%)"
          value={e.entranceThreshold ?? 12}
          min={0}
          max={100}
          onChange={(v) => patch({ entranceThreshold: v })}
        />
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">Só uma vez</Label>
          <Switch
            checked={e.entranceOnce !== false}
            onCheckedChange={(v) => patch({ entranceOnce: v })}
          />
        </div>
      </Section>

      <Section title="Scrolling effects">
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          Movimento ligado ao scroll da página.
        </p>
        <SelectField
          label="Efeito"
          value={e.scrollingEffect ?? "none"}
          options={[...SCROLLING_EFFECT_OPTIONS]}
          onChange={(v) => patch({ scrollingEffect: v })}
        />
        {(e.scrollingEffect || "none") !== "none" ? (
          <>
            <NumberField
              label="Intensidade (0–100)"
              value={e.scrollingSpeed ?? 40}
              min={0}
              max={100}
              onChange={(v) => patch({ scrollingSpeed: v })}
            />
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-editor-fg">Inverter direção</Label>
              <Switch
                checked={Boolean(e.scrollingReverse)}
                onCheckedChange={(v) => patch({ scrollingReverse: v })}
              />
            </div>
          </>
        ) : null}
      </Section>

      <Section title="Mouse effects">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">Tilt 3D</Label>
          <Switch
            checked={Boolean(e.mouseTilt)}
            onCheckedChange={(v) => patch({ mouseTilt: v })}
          />
        </div>
        {e.mouseTilt ? (
          <NumberField
            label="Máx. graus"
            value={e.mouseTiltMaxDeg ?? 8}
            min={1}
            max={30}
            onChange={(v) => patch({ mouseTiltMaxDeg: v })}
          />
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">Track (seguir rato)</Label>
          <Switch
            checked={Boolean(e.mouseTrack)}
            onCheckedChange={(v) => patch({ mouseTrack: v })}
          />
        </div>
        {e.mouseTrack ? (
          <NumberField
            label="Deslocamento (px)"
            value={e.mouseTrackPx ?? 12}
            min={1}
            max={60}
            onChange={(v) => patch({ mouseTrackPx: v })}
          />
        ) : null}
      </Section>

      <Section title="Sticky">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px] text-editor-fg">Fixar ao scroll</Label>
          <Switch checked={Boolean(e.sticky)} onCheckedChange={(v) => patch({ sticky: v })} />
        </div>
        {e.sticky ? (
          <NumberField
            label="Offset top (px)"
            value={e.stickyOffsetPx ?? 0}
            min={0}
            max={400}
            onChange={(v) => patch({ stickyOffsetPx: v })}
          />
        ) : null}
      </Section>

      <Section title="Animação contínua">
        <SelectField
          label="Loop"
          value={e.continuousAnimation ?? "none"}
          options={[...CONTINUOUS_ANIMATION_OPTIONS]}
          onChange={(v) => patch({ continuousAnimation: v })}
        />
        {(e.continuousAnimation || "none") !== "none" ? (
          <NumberField
            label="Duração do ciclo (ms)"
            value={e.continuousDurationMs ?? 3000}
            min={400}
            max={20000}
            onChange={(v) => patch({ continuousDurationMs: v })}
          />
        ) : null}
      </Section>

      <Section title="Percurso de movimento">
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          O elemento percorre um caminho (arco, círculo, zigzag…).
        </p>
        <SelectField
          label="Percurso"
          value={e.motionPath ?? "none"}
          options={[...MOTION_PATH_OPTIONS]}
          onChange={(v) => patch({ motionPath: v })}
        />
        {(e.motionPath || "none") !== "none" ? (
          <>
            <NumberField
              label="Duração (ms)"
              value={e.motionPathDurationMs ?? 4000}
              min={600}
              max={30000}
              onChange={(v) => patch({ motionPathDurationMs: v })}
            />
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-editor-fg">Loop</Label>
              <Switch
                checked={e.motionPathLoop !== false}
                onCheckedChange={(v) => patch({ motionPathLoop: v })}
              />
            </div>
          </>
        ) : null}
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
          value={e.transitionDurationMs ?? 280}
          min={0}
          max={5000}
          onChange={(v) => patch({ transitionDurationMs: v })}
        />
        <SelectField
          label="Curva da transição"
          value={e.transitionEasing ?? "cubic-bezier(0.4, 0, 0.2, 1)"}
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
        <ColorField
          label="Cor do texto (hover)"
          value={e.hoverColor ?? ""}
          onChange={(v) => patch({ hoverColor: v.trim() ? v : undefined })}
        />
        <ColorField
          label="Fundo (hover)"
          value={e.hoverBackground ?? ""}
          onChange={(v) => patch({ hoverBackground: v.trim() ? v : undefined })}
        />
        <ColorField
          label="Cor da borda (hover)"
          value={e.hoverBorderColor ?? ""}
          onChange={(v) => patch({ hoverBorderColor: v.trim() ? v : undefined })}
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
      </Section>
    </>
  );
}
