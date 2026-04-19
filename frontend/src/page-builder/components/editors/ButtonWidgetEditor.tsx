import type { ReactNode } from "react";
import type { WidgetNode } from "../../types";
import { NumberField, SelectField, TextField, TextareaField } from "../PropertyControls";

const ENTRANCE_OPTIONS = [
  { value: "none", label: "Nenhuma" },
  { value: "fadeIn", label: "Fade in" },
  { value: "zoomIn", label: "Zoom in" },
  { value: "slideUp", label: "Slide (de baixo)" },
  { value: "slideDown", label: "Slide (de cima)" },
  { value: "slideLeft", label: "Slide (da direita)" },
  { value: "slideRight", label: "Slide (da esquerda)" },
  { value: "bounceIn", label: "Bounce in" },
] as const;

const EASING_PRESETS = [
  { value: "ease", label: "ease" },
  { value: "linear", label: "linear" },
  { value: "ease-in", label: "ease-in" },
  { value: "ease-out", label: "ease-out" },
  { value: "ease-in-out", label: "ease-in-out" },
  { value: "cubic-bezier(0.4, 0, 0.2, 1)", label: "Suave (Material)" },
  { value: "cubic-bezier(0.68, -0.55, 0.265, 1.55)", label: "Elástico" },
];

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
  const c = widget.content;

  return (
    <>
      <PanelSection title="Botão">
        <TextField
          label="Texto"
          value={(c.text as string) ?? ""}
          onChange={(v) => setContent({ text: v })}
        />
        <TextField
          label="Link (URL)"
          value={(c.href as string) ?? ""}
          onChange={(v) => setContent({ href: v })}
        />
        <SelectField
          label="Abrir em"
          value={(c.target as string) ?? "_self"}
          options={[
            { value: "_self", label: "Mesma aba" },
            { value: "_blank", label: "Nova aba" },
          ]}
          onChange={(v) => setContent({ target: v })}
        />
      </PanelSection>

      <PanelSection title="Estado normal — transformação e transição">
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          <span className="font-medium text-editor-fg">Sombra</span> na aba <span className="font-medium">Estilo</span>{" "}
          (secção «Sombra»). Aqui: <span className="font-mono text-[10px]">transform</span> em CSS (ex.:{" "}
          <span className="font-mono text-[10px]">skewX(-4deg)</span>).
        </p>
        <TextareaField
          label="Transform (CSS)"
          value={(c.transform as string) ?? ""}
          onChange={(v) => setContent({ transform: v.trim() ? v : undefined })}
          rows={2}
          placeholder="ex.: scale(1) rotate(0deg)"
        />
        <NumberField
          label="Duração transição hover (ms)"
          value={typeof c.transitionDurationMs === "number" ? c.transitionDurationMs : 200}
          min={0}
          max={5000}
          onChange={(v) => setContent({ transitionDurationMs: v })}
        />
        <TextField
          label="Curva CSS (transição)"
          value={(c.transitionEasing as string) ?? "ease"}
          onChange={(v) => setContent({ transitionEasing: v.trim() || "ease" })}
          placeholder="ease ou cubic-bezier(0.4,0,0.2,1)"
        />
      </PanelSection>

      <PanelSection title="Ao passar o rato (hover)">
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          Vazio = mantém o valor normal. Fundo pode ser cor sólida ou{" "}
          <span className="font-mono text-[10px]">linear-gradient(…)</span>.
        </p>
        <TextField
          label="Cor do texto"
          value={(c.hoverColor as string) ?? ""}
          onChange={(v) => setContent({ hoverColor: v.trim() ? v : undefined })}
          placeholder="Opcional"
        />
        <TextField
          label="Fundo"
          value={(c.hoverBackground as string) ?? ""}
          onChange={(v) => setContent({ hoverBackground: v.trim() ? v : undefined })}
          placeholder="Opcional"
        />
        <TextField
          label="Cor da borda"
          value={(c.hoverBorderColor as string) ?? ""}
          onChange={(v) => setContent({ hoverBorderColor: v.trim() ? v : undefined })}
          placeholder="Opcional"
        />
        <TextareaField
          label="Sombra (box-shadow)"
          value={(c.hoverBoxShadow as string) ?? ""}
          onChange={(v) => setContent({ hoverBoxShadow: v.trim() ? v : undefined })}
          rows={2}
          placeholder="0 8px 24px rgba(0,0,0,0.2)"
        />
        <TextareaField
          label="Transform"
          value={(c.hoverTransform as string) ?? ""}
          onChange={(v) => setContent({ hoverTransform: v.trim() ? v : undefined })}
          rows={2}
          placeholder="scale(1.05) translateY(-2px)"
        />
      </PanelSection>

      <PanelSection title="Animação à entrada">
        <SelectField
          label="Tipo"
          value={(c.entranceAnimation as string) ?? "none"}
          options={[...ENTRANCE_OPTIONS]}
          onChange={(v) => setContent({ entranceAnimation: v })}
        />
        <NumberField
          label="Duração (ms)"
          value={typeof c.entranceDurationMs === "number" ? c.entranceDurationMs : 600}
          min={0}
          max={10000}
          onChange={(v) => setContent({ entranceDurationMs: v })}
        />
        <NumberField
          label="Atraso (ms)"
          value={typeof c.entranceDelayMs === "number" ? c.entranceDelayMs : 0}
          min={0}
          max={10000}
          onChange={(v) => setContent({ entranceDelayMs: v })}
        />
        <SelectField
          label="Curva (easing)"
          value={(c.entranceEasing as string) ?? "cubic-bezier(0.4, 0, 0.2, 1)"}
          options={EASING_PRESETS}
          onChange={(v) => setContent({ entranceEasing: v })}
        />
      </PanelSection>
    </>
  );
}
