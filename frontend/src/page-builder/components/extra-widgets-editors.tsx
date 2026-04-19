import {
  ColorField,
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from "./PropertyControls";

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-editor-border p-3 last:border-0">
      {title ? (
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-editor-fg-muted">
          {title}
        </h4>
      ) : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function BackToTopContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Voltar ao topo">
      <NumberField
        label="Mostrar após scroll (px)"
        value={(c.threshold as number) ?? 300}
        onChange={(v) => setContent({ threshold: v })}
        min={0}
        max={4000}
      />
      <SelectField
        label="Posição horizontal"
        value={(c.position as string) ?? "right"}
        options={[
          { value: "right", label: "Direita" },
          { value: "left", label: "Esquerda" },
        ]}
        onChange={(v) => setContent({ position: v })}
      />
      <ColorField label="Fundo do botão" value={(c.bg as string) ?? "#0f172a"} onChange={(v) => setContent({ bg: v })} />
      <ColorField label="Cor do ícone" value={(c.color as string) ?? "#ffffff"} onChange={(v) => setContent({ color: v })} />
      <NumberField label="Tamanho (px)" value={(c.size as number) ?? 48} onChange={(v) => setContent({ size: v })} min={32} max={96} />
      <SelectField
        label="Forma"
        value={(c.shape as string) ?? "circle"}
        options={[
          { value: "circle", label: "Círculo" },
          { value: "square", label: "Quadrado" },
        ]}
        onChange={(v) => setContent({ shape: v })}
      />
    </Section>
  );
}

export function ReadingProgressContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Barra de leitura">
      <NumberField label="Altura (px)" value={(c.height as number) ?? 4} onChange={(v) => setContent({ height: v })} min={2} max={24} />
      <ColorField label="Fundo da barra" value={(c.bg as string) ?? "transparent"} onChange={(v) => setContent({ bg: v })} />
      <ColorField label="Cor do progresso" value={(c.fillColor as string) ?? "#e63946"} onChange={(v) => setContent({ fillColor: v })} />
      <SelectField
        label="Posição"
        value={(c.position as string) ?? "top"}
        options={[
          { value: "top", label: "Topo" },
          { value: "bottom", label: "Rodapé" },
        ]}
        onChange={(v) => setContent({ position: v })}
      />
    </Section>
  );
}

export function StickyVideoContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Vídeo sticky">
      <TextareaField
        label="YouTube ou Bunny.net"
        value={(c.url as string) ?? ""}
        onChange={(v) => setContent({ url: v })}
        rows={3}
        placeholder="https://www.youtube.com/watch?v=… ou video.bunnycdn.com/play/…"
      />
      <p className="text-[10px] leading-relaxed text-editor-fg-muted">
        Quando o vídeo inline sai do ecrã, uma cópia fixa aparece no canto (VSL).
      </p>
      <NumberField label="Altura inline (px)" value={(c.inlineHeight as number) ?? 360} onChange={(v) => setContent({ inlineHeight: v })} min={120} max={900} />
      <SelectField
        label="Canto (vídeo fixo)"
        value={(c.position as string) ?? "bottom-right"}
        options={[
          { value: "bottom-right", label: "Baixo direita" },
          { value: "bottom-left", label: "Baixo esquerda" },
          { value: "top-right", label: "Topo direita" },
          { value: "top-left", label: "Topo esquerda" },
        ]}
        onChange={(v) => setContent({ position: v })}
      />
      <NumberField label="Largura fixa (px)" value={(c.width as number) ?? 320} onChange={(v) => setContent({ width: v })} min={160} max={480} />
      <SelectField
        label="Proporção"
        value={(c.aspectRatio as string) ?? "16/9"}
        options={[
          { value: "16/9", label: "16:9" },
          { value: "4/3", label: "4:3" },
          { value: "1/1", label: "1:1" },
        ]}
        onChange={(v) => setContent({ aspectRatio: v })}
      />
      <NumberField label="Raio do canto" value={(c.borderRadius as number) ?? 8} onChange={(v) => setContent({ borderRadius: v })} min={0} max={32} />
      <SelectField
        label="Botão fechar"
        value={c.showCloseButton !== false ? "yes" : "no"}
        options={[
          { value: "yes", label: "Sim" },
          { value: "no", label: "Não" },
        ]}
        onChange={(v) => setContent({ showCloseButton: v === "yes" })}
      />
    </Section>
  );
}

export function PhoneCallContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Chamada telefónica">
      <TextField label="Número (com DDI)" value={(c.number as string) ?? ""} onChange={(v) => setContent({ number: v })} placeholder="+351…" />
      <TextField label="Texto" value={(c.displayText as string) ?? ""} onChange={(v) => setContent({ displayText: v })} />
      <SelectField
        label="Estilo"
        value={(c.variant as string) ?? "button"}
        options={[
          { value: "button", label: "Botão" },
          { value: "link", label: "Link" },
          { value: "floating", label: "Flutuante" },
        ]}
        onChange={(v) => setContent({ variant: v })}
      />
      <ColorField label="Fundo" value={(c.bg as string) ?? "#10b981"} onChange={(v) => setContent({ bg: v })} />
      <ColorField label="Cor do texto/ícone" value={(c.color as string) ?? "#ffffff"} onChange={(v) => setContent({ color: v })} />
      <NumberField label="Raio (botão)" value={(c.borderRadius as number) ?? 8} onChange={(v) => setContent({ borderRadius: v })} min={0} max={32} />
      <SelectField
        label="Mostrar ícone"
        value={c.showIcon !== false ? "yes" : "no"}
        options={[
          { value: "yes", label: "Sim" },
          { value: "no", label: "Não" },
        ]}
        onChange={(v) => setContent({ showIcon: v === "yes" })}
      />
      <NumberField label="Tamanho texto (px)" value={(c.fontSize as number) ?? 16} onChange={(v) => setContent({ fontSize: v })} min={10} max={32} />
      <SelectField
        label="Lado (flutuante)"
        value={(c.position as string) ?? "right"}
        options={[
          { value: "right", label: "Direita" },
          { value: "left", label: "Esquerda" },
        ]}
        onChange={(v) => setContent({ position: v })}
      />
    </Section>
  );
}

export function DateContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Data / hora">
      <SelectField
        label="Fonte"
        value={(c.source as string) ?? "now"}
        options={[
          { value: "now", label: "Data/hora actual" },
          { value: "fixed", label: "Data fixa" },
        ]}
        onChange={(v) => setContent({ source: v })}
      />
      {(c.source as string) === "fixed" ? (
        <TextField
          label="Data ISO"
          value={(c.fixedDate as string) ?? ""}
          onChange={(v) => setContent({ fixedDate: v })}
          placeholder="2026-04-18T12:00:00"
        />
      ) : null}
      <SelectField
        label="Formato"
        value={(c.format as string) ?? "long"}
        options={[
          { value: "long", label: "Longa" },
          { value: "short", label: "Média" },
          { value: "numeric", label: "Numérica" },
          { value: "time", label: "Hora" },
          { value: "datetime", label: "Data e hora" },
        ]}
        onChange={(v) => setContent({ format: v })}
      />
      <TextField label="Locale" value={(c.locale as string) ?? "pt-BR"} onChange={(v) => setContent({ locale: v })} />
      <TextField label="Prefixo" value={(c.prefix as string) ?? ""} onChange={(v) => setContent({ prefix: v })} />
      <TextField label="Sufixo" value={(c.suffix as string) ?? ""} onChange={(v) => setContent({ suffix: v })} />
      <NumberField label="Tamanho (px)" value={(c.fontSize as number) ?? 16} onChange={(v) => setContent({ fontSize: v })} min={10} max={48} />
      <ColorField label="Cor" value={(c.color as string) ?? "#0f172a"} onChange={(v) => setContent({ color: v })} />
      <NumberField label="Peso fonte" value={(c.fontWeight as number) ?? 500} onChange={(v) => setContent({ fontWeight: v })} min={300} max={900} step={50} />
    </Section>
  );
}

export function TickerContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const items = (c.items as string[]) ?? [];
  const text = items.join("\n");
  return (
    <Section title="Faixa (ticker)">
      <TextareaField
        label="Mensagens (uma por linha)"
        value={text}
        onChange={(v) =>
          setContent({
            items: v
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
        rows={5}
        placeholder={"Linha 1\nLinha 2\nLinha 3"}
      />
      <NumberField label="Segundos por ciclo (velocidade)" value={(c.speed as number) ?? 25} onChange={(v) => setContent({ speed: v })} min={8} max={90} />
      <SelectField
        label="Direção"
        value={(c.direction as string) ?? "left"}
        options={[
          { value: "left", label: "← Esquerda" },
          { value: "right", label: "Direita →" },
        ]}
        onChange={(v) => setContent({ direction: v })}
      />
      <TextField label="Separador entre itens" value={(c.separator as string) ?? "•"} onChange={(v) => setContent({ separator: v })} />
      <NumberField label="Tamanho do texto" value={(c.fontSize as number) ?? 16} onChange={(v) => setContent({ fontSize: v })} min={10} max={28} />
      <ColorField label="Cor do texto" value={(c.color as string) ?? "#0f172a"} onChange={(v) => setContent({ color: v })} />
      <ColorField label="Fundo da faixa" value={(c.bg as string) ?? "transparent"} onChange={(v) => setContent({ bg: v })} />
      <NumberField label="Padding vertical" value={(c.paddingY as number) ?? 12} onChange={(v) => setContent({ paddingY: v })} min={4} max={32} />
      <NumberField label="Espaço entre mensagens" value={(c.gap as number) ?? 40} onChange={(v) => setContent({ gap: v })} min={16} max={80} />
    </Section>
  );
}

export function InfoBoxContentEditor({
  content: c,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  return (
    <>
      <Section title="Ícone (lucide-react)">
        <TextField
          label="Nome do ícone"
          value={(c.iconName as string) ?? "sparkles"}
          onChange={(v) => setContent({ iconName: v.toLowerCase().trim() })}
          placeholder="sparkles, shield, zap…"
        />
        <ColorField label="Cor do ícone" value={(c.iconColor as string) ?? "#e63946"} onChange={(v) => setContent({ iconColor: v })} />
        <ColorField label="Fundo do ícone" value={(c.iconBg as string) ?? "#fef2f2"} onChange={(v) => setContent({ iconBg: v })} />
        <SelectField
          label="Forma do fundo"
          value={(c.iconShape as string) ?? "circle"}
          options={[
            { value: "circle", label: "Círculo" },
            { value: "square", label: "Quadrado" },
            { value: "none", label: "Nenhum" },
          ]}
          onChange={(v) => setContent({ iconShape: v })}
        />
      </Section>
      <Section title="Conteúdo">
        <TextField label="Título" value={(c.title as string) ?? ""} onChange={(v) => setContent({ title: v })} />
        <TextareaField label="Descrição" value={(c.description as string) ?? ""} onChange={(v) => setContent({ description: v })} rows={3} />
        <TextField label="Texto do link" value={(c.ctaText as string) ?? ""} onChange={(v) => setContent({ ctaText: v })} />
        <TextField label="URL do link" value={(c.ctaHref as string) ?? ""} onChange={(v) => setContent({ ctaHref: v })} />
      </Section>
      <Section title="Layout">
        <SelectField
          label="Disposição"
          value={(c.layout as string) ?? "stacked"}
          options={[
            { value: "stacked", label: "Empilhado" },
            { value: "side", label: "Ícone ao lado (desktop)" },
          ]}
          onChange={(v) => setContent({ layout: v })}
        />
        <SelectField
          label="Alinhamento"
          value={(c.align as string) ?? "center"}
          options={[
            { value: "left", label: "Esquerda" },
            { value: "center", label: "Centro" },
            { value: "right", label: "Direita" },
          ]}
          onChange={(v) => setContent({ align: v })}
        />
        <ColorField label="Cor do título" value={(c.titleColor as string) ?? "#0f172a"} onChange={(v) => setContent({ titleColor: v })} />
        <ColorField label="Cor da descrição" value={(c.descColor as string) ?? "#475569"} onChange={(v) => setContent({ descColor: v })} />
        <ColorField label="Cor do link" value={(c.ctaColor as string) ?? "#e63946"} onChange={(v) => setContent({ ctaColor: v })} />
        <ColorField label="Fundo do bloco" value={(c.bg as string) ?? "transparent"} onChange={(v) => setContent({ bg: v })} />
        <NumberField label="Raio dos cantos" value={(c.borderRadius as number) ?? 0} onChange={(v) => setContent({ borderRadius: v })} min={0} max={24} />
      </Section>
    </>
  );
}
