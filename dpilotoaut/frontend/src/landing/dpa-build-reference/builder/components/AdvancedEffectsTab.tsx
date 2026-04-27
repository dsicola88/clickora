import type { BaseStyles, DeviceType, HoverStyles, MotionEffect, TransformValue, ConditionalDisplay } from "../types";
import { ColorField, NumberField, SelectField, TextField, TextareaField } from "./PropertyControls";
import { useState } from "react";

const labelCls = "block text-[11px] font-medium text-editor-fg-muted mb-1";

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-editor-border p-3 last:border-0">
      {title && (
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
          {title}
        </h4>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** Hover state editor — toggle between Normal/Hover at the section header. */
export function HoverStateEditor({
  styles,
  onStyles,
}: {
  styles: BaseStyles;
  onStyles: (patch: Partial<BaseStyles>) => void;
}) {
  const [mode, setMode] = useState<"normal" | "hover">("normal");
  const hover: HoverStyles = styles.hover ?? {};
  const updateHover = (patch: Partial<HoverStyles>) => onStyles({ hover: { ...hover, ...patch } });

  return (
    <div className="border-b border-editor-border p-3">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
        Estado: hover
      </h4>
      <div className="mb-3 inline-flex w-full overflow-hidden rounded border border-editor-border">
        <button
          type="button"
          onClick={() => setMode("normal")}
          className={`flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors ${
            mode === "normal"
              ? "bg-editor-accent text-editor-accent-fg"
              : "bg-editor-panel-2 text-editor-fg-muted hover:text-editor-fg"
          }`}
        >
          Normal
        </button>
        <button
          type="button"
          onClick={() => setMode("hover")}
          className={`flex-1 border-l border-editor-border px-2 py-1.5 text-[11px] font-medium transition-colors ${
            mode === "hover"
              ? "bg-editor-accent text-editor-accent-fg"
              : "bg-editor-panel-2 text-editor-fg-muted hover:text-editor-fg"
          }`}
        >
          Hover
        </button>
      </div>
      {mode === "normal" ? (
        <p className="text-[11px] text-editor-fg-muted">
          Os estilos &ldquo;normal&rdquo; ficam nas abas Estilo e Avançado &gt; Bordas. Selecione &ldquo;Hover&rdquo;
          para definir o que muda quando o mouse passa.
        </p>
      ) : (
        <div className="space-y-3">
          <ColorField
            label="Cor do texto (hover)"
            value={hover.color ?? ""}
            onChange={(v) => updateHover({ color: v || undefined })}
          />
          <ColorField
            label="Fundo (hover)"
            value={hover.background ?? ""}
            onChange={(v) => updateHover({ background: v || undefined })}
          />
          <ColorField
            label="Cor da borda (hover)"
            value={hover.borderColor ?? ""}
            onChange={(v) => updateHover({ borderColor: v || undefined })}
          />
          <NumberField
            label="Raio da borda (hover, px)"
            value={hover.borderRadius ?? 0}
            min={0}
            max={200}
            onChange={(v) => updateHover({ borderRadius: v })}
          />
          <NumberField
            label="Opacidade (hover)"
            value={hover.opacity ?? 1}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => updateHover({ opacity: v })}
          />
          <TextField
            label="Transform (hover, CSS)"
            value={hover.transform ?? ""}
            onChange={(v) => updateHover({ transform: v || undefined })}
            placeholder="scale(1.05) translateY(-4px)"
          />
          <TextField
            label="Sombra (hover, CSS)"
            value={hover.boxShadow ?? ""}
            onChange={(v) => updateHover({ boxShadow: v || undefined })}
            placeholder="0 10px 30px rgba(0,0,0,0.15)"
          />
          <button
            type="button"
            onClick={() => onStyles({ hover: undefined })}
            className="w-full rounded border border-editor-border bg-editor-panel-2 px-2 py-1.5 text-[11px] text-editor-fg-muted hover:text-destructive"
          >
            Limpar estilos de hover
          </button>
        </div>
      )}
    </div>
  );
}

/** Transform (rest state) editor */
export function TransformEditor({
  transform,
  onChange,
}: {
  transform: TransformValue | undefined;
  onChange: (v: TransformValue | undefined) => void;
}) {
  const t = transform ?? {};
  const update = (patch: Partial<TransformValue>) => onChange({ ...t, ...patch });
  const isEmpty =
    !t.rotate && !t.translateX && !t.translateY && t.scaleX == null && t.scaleY == null && !t.skewX && !t.skewY;

  return (
    <Section title="Transformação">
      <NumberField label="Rotação (deg)" value={t.rotate ?? 0} min={-360} max={360} onChange={(v) => update({ rotate: v || undefined })} />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Mover X (px)" value={t.translateX ?? 0} min={-500} max={500} onChange={(v) => update({ translateX: v || undefined })} />
        <NumberField label="Mover Y (px)" value={t.translateY ?? 0} min={-500} max={500} onChange={(v) => update({ translateY: v || undefined })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Escala X" value={t.scaleX ?? 1} min={0.1} max={5} step={0.1} onChange={(v) => update({ scaleX: v === 1 ? undefined : v })} />
        <NumberField label="Escala Y" value={t.scaleY ?? 1} min={0.1} max={5} step={0.1} onChange={(v) => update({ scaleY: v === 1 ? undefined : v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Inclinar X (deg)" value={t.skewX ?? 0} min={-90} max={90} onChange={(v) => update({ skewX: v || undefined })} />
        <NumberField label="Inclinar Y (deg)" value={t.skewY ?? 0} min={-90} max={90} onChange={(v) => update({ skewY: v || undefined })} />
      </div>
      {!isEmpty && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="w-full rounded border border-editor-border bg-editor-panel-2 px-2 py-1.5 text-[11px] text-editor-fg-muted hover:text-destructive"
        >
          Limpar transformação
        </button>
      )}
    </Section>
  );
}

/** Motion / scroll-in animation editor */
export function MotionEditor({
  motion,
  onChange,
}: {
  motion: MotionEffect | undefined;
  onChange: (v: MotionEffect | undefined) => void;
}) {
  const m = motion ?? { type: "none" as const };
  const update = (patch: Partial<MotionEffect>) => onChange({ ...m, ...patch });

  return (
    <Section title="Efeito de entrada (scroll)">
      <SelectField
        label="Tipo"
        value={m.type}
        options={[
          { value: "none", label: "Nenhum" },
          { value: "fade-in", label: "Fade In" },
          { value: "slide-up", label: "Slide Up" },
          { value: "slide-down", label: "Slide Down" },
          { value: "slide-left", label: "Slide Left" },
          { value: "slide-right", label: "Slide Right" },
          { value: "zoom-in", label: "Zoom In" },
          { value: "zoom-out", label: "Zoom Out" },
          { value: "flip-x", label: "Flip X" },
          { value: "flip-y", label: "Flip Y" },
        ]}
        onChange={(v) => update({ type: v as MotionEffect["type"] })}
      />
      {m.type !== "none" && (
        <>
          <NumberField label="Duração (ms)" value={m.duration ?? 700} min={100} max={5000} step={100} onChange={(v) => update({ duration: v })} />
          <NumberField label="Delay (ms)" value={m.delay ?? 0} min={0} max={5000} step={100} onChange={(v) => update({ delay: v })} />
        </>
      )}
    </Section>
  );
}

/** Custom CSS editor (uses `selector` placeholder for the scoped class) */
export function CustomCssEditor({
  customCss,
  onChange,
}: {
  customCss: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <Section title="CSS personalizado">
      <p className="text-[11px] text-editor-fg-muted">
        Use <code className="rounded bg-editor-bg px-1">selector</code> para se referir a este widget.
      </p>
      <TextareaField
        label="CSS"
        value={customCss ?? ""}
        rows={6}
        onChange={(v) => onChange(v || undefined)}
      />
    </Section>
  );
}

/** Conditional display editor */
export function ConditionalEditor({
  conditional,
  onChange,
}: {
  conditional: ConditionalDisplay | undefined;
  onChange: (v: ConditionalDisplay | undefined) => void;
}) {
  const c = conditional ?? {};
  const update = (patch: Partial<ConditionalDisplay>) => {
    const next = { ...c, ...patch };
    // Strip empty
    const isEmpty =
      (!next.hideOnDevice || next.hideOnDevice.length === 0) &&
      !next.hourRange &&
      !next.requireQueryParam;
    onChange(isEmpty ? undefined : next);
  };

  const toggleDevice = (d: DeviceType) => {
    const cur = c.hideOnDevice ?? [];
    const has = cur.includes(d);
    update({ hideOnDevice: has ? cur.filter((x) => x !== d) : [...cur, d] });
  };

  return (
    <Section title="Exibição condicional">
      <div>
        <label className={labelCls}>Esconder em</label>
        <div className="grid grid-cols-3 gap-1">
          {(["desktop", "tablet", "mobile"] as DeviceType[]).map((d) => {
            const active = c.hideOnDevice?.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDevice(d)}
                className={`rounded border px-2 py-1.5 text-[11px] capitalize transition-colors ${
                  active
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-editor-border bg-editor-panel-2 text-editor-fg-muted hover:text-editor-fg"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelCls}>Faixa horária (mostrar entre)</label>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Início (0-23)"
            value={c.hourRange?.start ?? 0}
            min={0}
            max={23}
            onChange={(v) => update({ hourRange: { start: v, end: c.hourRange?.end ?? 23 } })}
          />
          <NumberField
            label="Fim (0-23)"
            value={c.hourRange?.end ?? 23}
            min={0}
            max={23}
            onChange={(v) => update({ hourRange: { start: c.hourRange?.start ?? 0, end: v } })}
          />
        </div>
        {c.hourRange && (
          <button
            type="button"
            onClick={() => update({ hourRange: undefined })}
            className="mt-1 text-[11px] text-editor-fg-muted hover:text-destructive"
          >
            Limpar faixa
          </button>
        )}
      </div>

      <TextField
        label="Exigir parâmetro de URL (?param)"
        value={c.requireQueryParam ?? ""}
        onChange={(v) => update({ requireQueryParam: v || undefined })}
        placeholder="utm_source"
      />
    </Section>
  );
}
