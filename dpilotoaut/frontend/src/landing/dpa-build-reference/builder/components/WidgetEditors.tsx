import { nanoid } from "nanoid";
import {
  ColorField,
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from "./PropertyControls";

const labelCls = "block text-[11px] font-medium text-editor-fg-muted mb-1";

/* Local helpers (kept here to avoid circular imports with PropertyPanel) */
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

function BoolField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <SelectField
      label={label}
      value={value ? "yes" : "no"}
      options={[
        { value: "yes", label: "Sim" },
        { value: "no", label: "Não" },
      ]}
      onChange={(v) => onChange(v === "yes")}
    />
  );
}

interface ListItem {
  id: string;
  [k: string]: unknown;
}

function MiniListEditor<T extends ListItem>({
  title,
  items,
  onChange,
  newItem,
  renderFields,
  itemLabel,
}: {
  title: string;
  items: T[];
  onChange: (next: T[]) => void;
  newItem: () => T;
  renderFields: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  itemLabel: (item: T, idx: number) => string;
}) {
  const update = (idx: number, patch: Partial<T>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const t = idx + dir;
    if (t < 0 || t >= items.length) return;
    const next = [...items];
    [next[idx], next[t]] = [next[t], next[idx]];
    onChange(next);
  };
  return (
    <Section title={title}>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded bg-editor-panel-2 p-3 text-center text-[11px] text-editor-fg-muted">
            Nenhum item.
          </p>
        )}
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="space-y-2 rounded border border-editor-border bg-editor-panel-2 p-2.5"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-editor-fg">
                {itemLabel(item, idx)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="rounded px-1 text-editor-fg-muted hover:text-editor-fg disabled:opacity-30"
                  title="Subir"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="rounded px-1 text-editor-fg-muted hover:text-editor-fg disabled:opacity-30"
                  title="Descer"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="rounded p-1 text-editor-fg-muted hover:bg-destructive/20 hover:text-destructive"
                  title="Remover"
                >
                  ✕
                </button>
              </div>
            </div>
            {renderFields(item, (patch) => update(idx, patch))}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, newItem()])}
          className="w-full rounded border border-dashed border-editor-border py-2 text-[11px] font-medium text-editor-fg-muted transition-colors hover:border-editor-accent hover:text-editor-accent"
        >
          + Adicionar
        </button>
      </div>
    </Section>
  );
}

type SetContent = (p: Record<string, unknown>) => void;

/* ============================================================
 * PHASE 1 — CONTENT WIDGETS
 * ============================================================ */

export function CarouselEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  const slides =
    (content.slides as Array<{ id: string; src: string; alt: string; caption?: string; link?: string }>) ?? [];
  return (
    <>
      <MiniListEditor
        title="Slides"
        items={slides}
        onChange={(next) => setContent({ slides: next })}
        itemLabel={(it, i) => it.alt || `Slide ${i + 1}`}
        newItem={() => ({
          id: `s_${nanoid(6)}`,
          src: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600&q=80",
          alt: "Novo slide",
          caption: "",
          link: "",
        })}
        renderFields={(item, update) => (
          <>
            <TextField label="URL da imagem" value={item.src} onChange={(v) => update({ src: v })} />
            <TextField label="Texto alternativo" value={item.alt} onChange={(v) => update({ alt: v })} />
            <TextField label="Legenda" value={item.caption ?? ""} onChange={(v) => update({ caption: v })} />
            <TextField label="Link (opcional)" value={item.link ?? ""} onChange={(v) => update({ link: v })} />
          </>
        )}
      />
      <Section title="Comportamento">
        <BoolField label="Auto-play" value={(content.autoplay as boolean) ?? true} onChange={(v) => setContent({ autoplay: v })} />
        <NumberField
          label="Intervalo (ms)"
          value={(content.intervalMs as number) ?? 4000}
          min={1000}
          max={20000}
          step={500}
          onChange={(v) => setContent({ intervalMs: v })}
        />
        <BoolField label="Loop" value={(content.loop as boolean) ?? true} onChange={(v) => setContent({ loop: v })} />
        <BoolField label="Mostrar setas" value={(content.showArrows as boolean) ?? true} onChange={(v) => setContent({ showArrows: v })} />
        <BoolField label="Mostrar pontos" value={(content.showDots as boolean) ?? true} onChange={(v) => setContent({ showDots: v })} />
      </Section>
      <Section title="Aparência">
        <SelectField
          label="Proporção"
          value={(content.aspectRatio as string) ?? "landscape"}
          options={[
            { value: "landscape", label: "16:9" },
            { value: "square", label: "1:1" },
            { value: "portrait", label: "3:4" },
            { value: "wide", label: "21:9" },
          ]}
          onChange={(v) => setContent({ aspectRatio: v })}
        />
        <NumberField
          label="Raio das bordas (px)"
          value={(content.borderRadius as number) ?? 8}
          min={0}
          max={48}
          onChange={(v) => setContent({ borderRadius: v })}
        />
        <ColorField label="Cor das setas" value={(content.arrowColor as string) ?? "#ffffff"} onChange={(v) => setContent({ arrowColor: v })} />
        <ColorField label="Cor dos pontos" value={(content.dotColor as string) ?? "#ffffff"} onChange={(v) => setContent({ dotColor: v })} />
      </Section>
    </>
  );
}

export function TabsEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  const items = (content.items as Array<{ id: string; title: string; content: string }>) ?? [];
  return (
    <>
      <MiniListEditor
        title="Abas"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it, i) => it.title || `Aba ${i + 1}`}
        newItem={() => ({ id: `tab_${nanoid(6)}`, title: "Nova aba", content: "<p>Conteúdo...</p>" })}
        renderFields={(item, update) => (
          <>
            <TextField label="Título" value={item.title} onChange={(v) => update({ title: v })} />
            <TextareaField label="Conteúdo (HTML)" value={item.content} onChange={(v) => update({ content: v })} rows={4} />
          </>
        )}
      />
      <Section title="Aparência">
        <SelectField
          label="Orientação"
          value={(content.orientation as string) ?? "horizontal"}
          options={[
            { value: "horizontal", label: "Horizontal" },
            { value: "vertical", label: "Vertical" },
          ]}
          onChange={(v) => setContent({ orientation: v })}
        />
        <ColorField label="Cor ativa" value={(content.activeColor as string) ?? "#e63946"} onChange={(v) => setContent({ activeColor: v })} />
        <ColorField label="Cor inativa" value={(content.inactiveColor as string) ?? "#6b7280"} onChange={(v) => setContent({ inactiveColor: v })} />
        <ColorField label="Fundo das abas" value={(content.bg as string) ?? "#f9fafb"} onChange={(v) => setContent({ bg: v })} />
        <ColorField label="Fundo do conteúdo" value={(content.contentBg as string) ?? "#ffffff"} onChange={(v) => setContent({ contentBg: v })} />
        <ColorField label="Cor do conteúdo" value={(content.contentColor as string) ?? "#1f2937"} onChange={(v) => setContent({ contentColor: v })} />
        <NumberField label="Raio (px)" value={(content.borderRadius as number) ?? 8} min={0} max={32} onChange={(v) => setContent({ borderRadius: v })} />
      </Section>
    </>
  );
}

export function InfoBoxEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  return (
    <>
      <Section title="Conteúdo">
        <TextField label="Nome do ícone (lucide)" value={(content.iconName as string) ?? "Sparkles"} onChange={(v) => setContent({ iconName: v })} />
        <TextField label="Título" value={(content.title as string) ?? ""} onChange={(v) => setContent({ title: v })} />
        <TextareaField label="Descrição" value={(content.description as string) ?? ""} onChange={(v) => setContent({ description: v })} rows={3} />
        <TextField label="Texto do CTA" value={(content.ctaText as string) ?? ""} onChange={(v) => setContent({ ctaText: v })} />
        <TextField label="Link do CTA" value={(content.ctaHref as string) ?? "#"} onChange={(v) => setContent({ ctaHref: v })} />
      </Section>
      <Section title="Layout">
        <SelectField
          label="Disposição"
          value={(content.layout as string) ?? "stacked"}
          options={[
            { value: "stacked", label: "Empilhado" },
            { value: "inline", label: "Lado a lado" },
          ]}
          onChange={(v) => setContent({ layout: v })}
        />
        <SelectField
          label="Alinhamento"
          value={(content.align as string) ?? "center"}
          options={[
            { value: "left", label: "Esquerda" },
            { value: "center", label: "Centro" },
            { value: "right", label: "Direita" },
          ]}
          onChange={(v) => setContent({ align: v })}
        />
        <SelectField
          label="Forma do ícone"
          value={(content.iconShape as string) ?? "square"}
          options={[
            { value: "square", label: "Quadrado" },
            { value: "circle", label: "Círculo" },
            { value: "none", label: "Sem fundo" },
          ]}
          onChange={(v) => setContent({ iconShape: v })}
        />
      </Section>
      <Section title="Cores">
        <ColorField label="Cor do ícone" value={(content.iconColor as string) ?? "#e63946"} onChange={(v) => setContent({ iconColor: v })} />
        <ColorField label="Fundo do ícone" value={(content.iconBg as string) ?? "#fef2f2"} onChange={(v) => setContent({ iconBg: v })} />
        <ColorField label="Cor do título" value={(content.titleColor as string) ?? "#0f172a"} onChange={(v) => setContent({ titleColor: v })} />
        <ColorField label="Cor da descrição" value={(content.descColor as string) ?? "#475569"} onChange={(v) => setContent({ descColor: v })} />
        <ColorField label="Cor do CTA" value={(content.ctaColor as string) ?? "#e63946"} onChange={(v) => setContent({ ctaColor: v })} />
        <ColorField label="Fundo do box" value={(content.bg as string) ?? "transparent"} onChange={(v) => setContent({ bg: v })} />
        <NumberField label="Raio (px)" value={(content.borderRadius as number) ?? 0} min={0} max={48} onChange={(v) => setContent({ borderRadius: v })} />
      </Section>
    </>
  );
}

export function CreativeButtonEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  return (
    <>
      <Section title="Botão">
        <TextField label="Texto" value={(content.text as string) ?? ""} onChange={(v) => setContent({ text: v })} />
        <TextField label="Link" value={(content.href as string) ?? "#"} onChange={(v) => setContent({ href: v })} />
        <SelectField
          label="Abrir em"
          value={(content.target as string) ?? "_self"}
          options={[
            { value: "_self", label: "Mesma aba" },
            { value: "_blank", label: "Nova aba" },
          ]}
          onChange={(v) => setContent({ target: v })}
        />
        <SelectField
          label="Efeito de hover"
          value={(content.effect as string) ?? "slide"}
          options={[
            { value: "slide", label: "Slide" },
            { value: "shine", label: "Brilho" },
            { value: "expand", label: "Expandir" },
            { value: "lift", label: "Elevar" },
            { value: "outline", label: "Contorno" },
          ]}
          onChange={(v) => setContent({ effect: v })}
        />
      </Section>
      <Section title="Cores">
        <ColorField label="Fundo (normal)" value={(content.bg as string) ?? "#e63946"} onChange={(v) => setContent({ bg: v })} />
        <ColorField label="Cor do texto" value={(content.color as string) ?? "#ffffff"} onChange={(v) => setContent({ color: v })} />
        <ColorField label="Fundo (hover)" value={(content.hoverBg as string) ?? "#0f172a"} onChange={(v) => setContent({ hoverBg: v })} />
        <ColorField label="Cor do texto (hover)" value={(content.hoverColor as string) ?? "#ffffff"} onChange={(v) => setContent({ hoverColor: v })} />
      </Section>
      <Section title="Forma">
        <NumberField label="Raio (px)" value={(content.borderRadius as number) ?? 8} min={0} max={50} onChange={(v) => setContent({ borderRadius: v })} />
        <NumberField label="Padding vertical" value={(content.paddingY as number) ?? 14} min={4} max={40} onChange={(v) => setContent({ paddingY: v })} />
        <NumberField label="Padding horizontal" value={(content.paddingX as number) ?? 28} min={4} max={80} onChange={(v) => setContent({ paddingX: v })} />
        <NumberField label="Tamanho da fonte" value={(content.fontSize as number) ?? 16} min={10} max={32} onChange={(v) => setContent({ fontSize: v })} />
        <NumberField label="Peso da fonte" value={(content.fontWeight as number) ?? 600} min={300} max={900} step={100} onChange={(v) => setContent({ fontWeight: v })} />
      </Section>
    </>
  );
}

export function ImageAccordionEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  const items = (content.items as Array<{ id: string; src: string; title: string; subtitle?: string }>) ?? [];
  return (
    <>
      <MiniListEditor
        title="Painéis"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it, i) => it.title || `Painel ${i + 1}`}
        newItem={() => ({
          id: `ia_${nanoid(6)}`,
          src: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&q=80",
          title: "Novo painel",
          subtitle: "",
        })}
        renderFields={(item, update) => (
          <>
            <TextField label="URL da imagem" value={item.src} onChange={(v) => update({ src: v })} />
            <TextField label="Título" value={item.title} onChange={(v) => update({ title: v })} />
            <TextField label="Subtítulo" value={item.subtitle ?? ""} onChange={(v) => update({ subtitle: v })} />
          </>
        )}
      />
      <Section title="Layout">
        <NumberField label="Altura (px)" value={(content.height as number) ?? 380} min={160} max={800} onChange={(v) => setContent({ height: v })} />
        <NumberField label="Espaço entre painéis" value={(content.gap as number) ?? 8} min={0} max={32} onChange={(v) => setContent({ gap: v })} />
        <NumberField label="Raio das bordas" value={(content.borderRadius as number) ?? 8} min={0} max={32} onChange={(v) => setContent({ borderRadius: v })} />
        <ColorField label="Cor da sobreposição" value={(content.overlayColor as string) ?? "rgba(0,0,0,0.45)"} onChange={(v) => setContent({ overlayColor: v })} />
      </Section>
    </>
  );
}

export function StickyVideoEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  return (
    <>
      <Section title="Vídeo">
        <TextField label="URL do YouTube" value={(content.url as string) ?? ""} onChange={(v) => setContent({ url: v })} />
      </Section>
      <Section title="Comportamento de fixar">
        <SelectField
          label="Posição quando fixo"
          value={(content.position as string) ?? "bottom-right"}
          options={[
            { value: "bottom-right", label: "Inferior direita" },
            { value: "bottom-left", label: "Inferior esquerda" },
            { value: "top-right", label: "Superior direita" },
            { value: "top-left", label: "Superior esquerda" },
          ]}
          onChange={(v) => setContent({ position: v })}
        />
        <NumberField label="Largura (px) quando fixo" value={(content.width as number) ?? 320} min={200} max={600} onChange={(v) => setContent({ width: v })} />
        <NumberField label="Altura inline (px)" value={(content.inlineHeight as number) ?? 360} min={180} max={720} onChange={(v) => setContent({ inlineHeight: v })} />
        <SelectField
          label="Proporção"
          value={(content.aspectRatio as string) ?? "16/9"}
          options={[
            { value: "16/9", label: "16:9" },
            { value: "4/3", label: "4:3" },
            { value: "1/1", label: "1:1" },
            { value: "9/16", label: "9:16 (vertical)" },
          ]}
          onChange={(v) => setContent({ aspectRatio: v })}
        />
        <NumberField label="Raio (px)" value={(content.borderRadius as number) ?? 8} min={0} max={32} onChange={(v) => setContent({ borderRadius: v })} />
        <BoolField label="Botão de fechar" value={(content.showCloseButton as boolean) ?? true} onChange={(v) => setContent({ showCloseButton: v })} />
      </Section>
    </>
  );
}

export function TickerEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  const items = (content.items as string[]) ?? [];
  return (
    <>
      <Section title="Conteúdo">
        <TextareaField
          label="Itens (um por linha)"
          value={items.join("\n")}
          onChange={(v) => setContent({ items: v.split("\n").map((s) => s.trim()).filter(Boolean) })}
          rows={6}
        />
        <TextField label="Separador" value={(content.separator as string) ?? "•"} onChange={(v) => setContent({ separator: v })} />
      </Section>
      <Section title="Animação">
        <SelectField
          label="Direção"
          value={(content.direction as string) ?? "left"}
          options={[
            { value: "left", label: "Esquerda" },
            { value: "right", label: "Direita" },
          ]}
          onChange={(v) => setContent({ direction: v })}
        />
        <NumberField label="Velocidade (s para uma volta)" value={(content.speed as number) ?? 25} min={5} max={120} onChange={(v) => setContent({ speed: v })} />
        <NumberField label="Espaçamento entre itens (px)" value={(content.gap as number) ?? 40} min={8} max={120} onChange={(v) => setContent({ gap: v })} />
      </Section>
      <Section title="Aparência">
        <ColorField label="Cor do texto" value={(content.color as string) ?? "#0f172a"} onChange={(v) => setContent({ color: v })} />
        <ColorField label="Fundo" value={(content.bg as string) ?? "#fef9c3"} onChange={(v) => setContent({ bg: v })} />
        <NumberField label="Tamanho da fonte (px)" value={(content.fontSize as number) ?? 16} min={10} max={32} onChange={(v) => setContent({ fontSize: v })} />
        <NumberField label="Padding vertical (px)" value={(content.paddingY as number) ?? 12} min={0} max={48} onChange={(v) => setContent({ paddingY: v })} />
      </Section>
    </>
  );
}

export function LogoEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  return (
    <Section title="Logo">
      <TextField label="URL da imagem" value={(content.src as string) ?? ""} onChange={(v) => setContent({ src: v })} />
      <TextField label="Texto alternativo" value={(content.alt as string) ?? "Logo"} onChange={(v) => setContent({ alt: v })} />
      <TextField label="Link" value={(content.link as string) ?? "/"} onChange={(v) => setContent({ link: v })} />
      <NumberField label="Largura (px)" value={(content.width as number) ?? 140} min={40} max={600} onChange={(v) => setContent({ width: v })} />
    </Section>
  );
}

/* ============================================================
 * PHASE 2 — NAVIGATION WIDGETS
 * ============================================================ */

export function NavMenuEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  const items = (content.items as Array<{ id: string; label: string; href: string }>) ?? [];
  return (
    <>
      <MiniListEditor
        title="Itens do menu"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.label || "Item"}
        newItem={() => ({ id: `n_${nanoid(6)}`, label: "Novo item", href: "/" })}
        renderFields={(item, update) => (
          <>
            <TextField label="Rótulo" value={item.label} onChange={(v) => update({ label: v })} />
            <TextField label="URL" value={item.href} onChange={(v) => update({ href: v })} />
          </>
        )}
      />
      <Section title="Aparência">
        <SelectField
          label="Alinhamento"
          value={(content.align as string) ?? "left"}
          options={[
            { value: "left", label: "Esquerda" },
            { value: "center", label: "Centro" },
            { value: "right", label: "Direita" },
          ]}
          onChange={(v) => setContent({ align: v })}
        />
        <ColorField label="Cor" value={(content.color as string) ?? "#0f172a"} onChange={(v) => setContent({ color: v })} />
        <ColorField label="Cor (hover)" value={(content.hoverColor as string) ?? "#e63946"} onChange={(v) => setContent({ hoverColor: v })} />
        <NumberField label="Tamanho da fonte" value={(content.fontSize as number) ?? 15} min={10} max={28} onChange={(v) => setContent({ fontSize: v })} />
        <NumberField label="Peso da fonte" value={(content.fontWeight as number) ?? 500} min={300} max={900} step={100} onChange={(v) => setContent({ fontWeight: v })} />
        <NumberField label="Espaço entre itens (px)" value={(content.gap as number) ?? 24} min={4} max={64} onChange={(v) => setContent({ gap: v })} />
        <BoolField label="Sublinhado no hover" value={(content.underlineOnHover as boolean) ?? true} onChange={(v) => setContent({ underlineOnHover: v })} />
      </Section>
    </>
  );
}

export function MegaMenuEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  const cols =
    (content.columns as Array<{
      id: string;
      title: string;
      items: Array<{ id: string; label: string; href: string; description?: string }>;
    }>) ?? [];
  return (
    <>
      <Section title="Gatilho">
        <TextField label="Rótulo do trigger" value={(content.triggerLabel as string) ?? ""} onChange={(v) => setContent({ triggerLabel: v })} />
      </Section>
      <MiniListEditor
        title="Colunas"
        items={cols}
        onChange={(next) => setContent({ columns: next })}
        itemLabel={(it) => it.title || "Coluna"}
        newItem={() => ({
          id: `mc_${nanoid(6)}`,
          title: "Nova coluna",
          items: [{ id: `mi_${nanoid(6)}`, label: "Item", href: "#" }],
        })}
        renderFields={(col, update) => (
          <>
            <TextField label="Título da coluna" value={col.title} onChange={(v) => update({ title: v })} />
            <div>
              <label className={labelCls}>Itens (um por linha — formato: Rótulo | URL)</label>
              <textarea
                rows={4}
                value={col.items.map((it) => `${it.label} | ${it.href}`).join("\n")}
                onChange={(e) => {
                  const next = e.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const [label, href] = line.split("|").map((p) => p.trim());
                      return { id: `mi_${nanoid(6)}`, label: label || "Item", href: href || "#" };
                    });
                  update({ items: next });
                }}
                className="w-full rounded border border-editor-border bg-editor-panel px-2 py-1.5 text-xs text-editor-fg focus:outline-none focus:ring-1 focus:ring-editor-accent"
              />
            </div>
          </>
        )}
      />
      <Section title="Card promocional (opcional)">
        <TextField label="Título" value={(content.ctaTitle as string) ?? ""} onChange={(v) => setContent({ ctaTitle: v })} />
        <TextareaField label="Descrição" value={(content.ctaDescription as string) ?? ""} onChange={(v) => setContent({ ctaDescription: v })} rows={2} />
        <TextField label="Texto do botão" value={(content.ctaButtonText as string) ?? ""} onChange={(v) => setContent({ ctaButtonText: v })} />
        <TextField label="Link do botão" value={(content.ctaButtonHref as string) ?? "#"} onChange={(v) => setContent({ ctaButtonHref: v })} />
      </Section>
      <Section title="Cores">
        <ColorField label="Fundo do painel" value={(content.panelBg as string) ?? "#ffffff"} onChange={(v) => setContent({ panelBg: v })} />
        <ColorField label="Cor do texto" value={(content.textColor as string) ?? "#1f2937"} onChange={(v) => setContent({ textColor: v })} />
        <ColorField label="Cor de destaque" value={(content.accentColor as string) ?? "#e63946"} onChange={(v) => setContent({ accentColor: v })} />
      </Section>
    </>
  );
}

export function OnepageNavEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  const items = (content.items as Array<{ id: string; label: string; targetId: string }>) ?? [];
  return (
    <>
      <MiniListEditor
        title="Âncoras"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.label || "Item"}
        newItem={() => ({ id: `op_${nanoid(6)}`, label: "Nova seção", targetId: "secao" })}
        renderFields={(item, update) => (
          <>
            <TextField label="Rótulo" value={item.label} onChange={(v) => update({ label: v })} />
            <TextField label="ID alvo (sem #)" value={item.targetId} onChange={(v) => update({ targetId: v.replace(/[^a-zA-Z0-9_-]/g, "") })} />
          </>
        )}
      />
      <Section title="Aparência">
        <SelectField
          label="Posição"
          value={(content.position as string) ?? "fixed-right"}
          options={[
            { value: "fixed-right", label: "Fixo à direita" },
            { value: "fixed-left", label: "Fixo à esquerda" },
          ]}
          onChange={(v) => setContent({ position: v })}
        />
        <ColorField label="Cor ativa" value={(content.activeColor as string) ?? "#e63946"} onChange={(v) => setContent({ activeColor: v })} />
        <ColorField label="Cor inativa" value={(content.inactiveColor as string) ?? "#cbd5e1"} onChange={(v) => setContent({ inactiveColor: v })} />
        <BoolField label="Mostrar rótulos" value={(content.showLabels as boolean) ?? true} onChange={(v) => setContent({ showLabels: v })} />
      </Section>
    </>
  );
}

export function OffCanvasEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  const items = (content.items as Array<{ id: string; label: string; href: string }>) ?? [];
  return (
    <>
      <Section title="Trigger">
        <TextField label="Rótulo do trigger" value={(content.triggerLabel as string) ?? "Menu"} onChange={(v) => setContent({ triggerLabel: v })} />
        <BoolField label="Mostrar ícone hambúrguer" value={(content.triggerIcon as boolean) ?? true} onChange={(v) => setContent({ triggerIcon: v })} />
        <ColorField label="Fundo do trigger" value={(content.triggerBg as string) ?? "transparent"} onChange={(v) => setContent({ triggerBg: v })} />
        <ColorField label="Cor do trigger" value={(content.triggerColor as string) ?? "#0f172a"} onChange={(v) => setContent({ triggerColor: v })} />
      </Section>
      <MiniListEditor
        title="Itens do menu"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.label || "Item"}
        newItem={() => ({ id: `oc_${nanoid(6)}`, label: "Novo item", href: "/" })}
        renderFields={(item, update) => (
          <>
            <TextField label="Rótulo" value={item.label} onChange={(v) => update({ label: v })} />
            <TextField label="URL" value={item.href} onChange={(v) => update({ href: v })} />
          </>
        )}
      />
      <Section title="Painel">
        <SelectField
          label="Lado"
          value={(content.side as string) ?? "right"}
          options={[
            { value: "left", label: "Esquerda" },
            { value: "right", label: "Direita" },
          ]}
          onChange={(v) => setContent({ side: v })}
        />
        <NumberField label="Largura (px)" value={(content.width as number) ?? 320} min={200} max={600} onChange={(v) => setContent({ width: v })} />
        <ColorField label="Fundo do painel" value={(content.bg as string) ?? "#0f172a"} onChange={(v) => setContent({ bg: v })} />
        <ColorField label="Cor do texto" value={(content.textColor as string) ?? "#ffffff"} onChange={(v) => setContent({ textColor: v })} />
        <ColorField label="Cor da sobreposição" value={(content.overlayColor as string) ?? "rgba(0,0,0,0.5)"} onChange={(v) => setContent({ overlayColor: v })} />
      </Section>
    </>
  );
}

export function BackToTopEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  return (
    <Section title="Botão voltar ao topo">
      <NumberField
        label="Aparece após (px de scroll)"
        value={(content.threshold as number) ?? 300}
        min={50}
        max={2000}
        step={50}
        onChange={(v) => setContent({ threshold: v })}
      />
      <SelectField
        label="Posição"
        value={(content.position as string) ?? "right"}
        options={[
          { value: "right", label: "Inferior direita" },
          { value: "left", label: "Inferior esquerda" },
        ]}
        onChange={(v) => setContent({ position: v })}
      />
      <SelectField
        label="Forma"
        value={(content.shape as string) ?? "circle"}
        options={[
          { value: "circle", label: "Círculo" },
          { value: "square", label: "Quadrado" },
        ]}
        onChange={(v) => setContent({ shape: v })}
      />
      <NumberField label="Tamanho (px)" value={(content.size as number) ?? 48} min={32} max={96} onChange={(v) => setContent({ size: v })} />
      <ColorField label="Fundo" value={(content.bg as string) ?? "#0f172a"} onChange={(v) => setContent({ bg: v })} />
      <ColorField label="Cor do ícone" value={(content.color as string) ?? "#ffffff"} onChange={(v) => setContent({ color: v })} />
    </Section>
  );
}

/* ============================================================
 * PHASE 3 — UTILITY WIDGETS
 * ============================================================ */

export function PhoneCallEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  return (
    <>
      <Section title="Click-to-Call">
        <TextField
          label="Número (com DDI)"
          value={(content.number as string) ?? ""}
          placeholder="+5511999999999"
          onChange={(v) => setContent({ number: v.replace(/[^+0-9]/g, "") })}
        />
        <TextField label="Texto exibido" value={(content.displayText as string) ?? ""} onChange={(v) => setContent({ displayText: v })} />
      </Section>
      <Section title="Aparência">
        <SelectField
          label="Variante"
          value={(content.variant as string) ?? "button"}
          options={[
            { value: "button", label: "Botão" },
            { value: "link", label: "Link de texto" },
            { value: "floating", label: "Flutuante" },
          ]}
          onChange={(v) => setContent({ variant: v })}
        />
        <SelectField
          label="Posição (flutuante)"
          value={(content.position as string) ?? "right"}
          options={[
            { value: "right", label: "Inferior direita" },
            { value: "left", label: "Inferior esquerda" },
          ]}
          onChange={(v) => setContent({ position: v })}
        />
        <BoolField label="Mostrar ícone" value={(content.showIcon as boolean) ?? true} onChange={(v) => setContent({ showIcon: v })} />
        <NumberField label="Tamanho da fonte" value={(content.fontSize as number) ?? 16} min={10} max={28} onChange={(v) => setContent({ fontSize: v })} />
        <ColorField label="Fundo" value={(content.bg as string) ?? "#10b981"} onChange={(v) => setContent({ bg: v })} />
        <ColorField label="Cor do texto" value={(content.color as string) ?? "#ffffff"} onChange={(v) => setContent({ color: v })} />
        <NumberField label="Raio (px)" value={(content.borderRadius as number) ?? 8} min={0} max={48} onChange={(v) => setContent({ borderRadius: v })} />
      </Section>
    </>
  );
}

export function LottieEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  return (
    <Section title="Lottie">
      <TextField
        label="URL do JSON"
        placeholder="https://assets10.lottiefiles.com/.../data.json"
        value={(content.url as string) ?? ""}
        onChange={(v) => setContent({ url: v })}
      />
      <NumberField label="Largura (px)" value={(content.width as number) ?? 280} min={40} max={1000} onChange={(v) => setContent({ width: v })} />
      <NumberField label="Velocidade" value={(content.speed as number) ?? 1} min={0.1} max={5} step={0.1} onChange={(v) => setContent({ speed: v })} />
      <BoolField label="Loop" value={(content.loop as boolean) ?? true} onChange={(v) => setContent({ loop: v })} />
      <BoolField label="Auto-play" value={(content.autoplay as boolean) ?? true} onChange={(v) => setContent({ autoplay: v })} />
    </Section>
  );
}

export function PopupTriggerEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  return (
    <>
      <Section title="Quando abrir">
        <SelectField
          label="Tipo de gatilho"
          value={(content.triggerType as string) ?? "click"}
          options={[
            { value: "click", label: "Clique no botão" },
            { value: "delay", label: "Após X segundos" },
            { value: "scroll", label: "Após scroll %" },
            { value: "exit", label: "Intenção de sair" },
          ]}
          onChange={(v) => setContent({ triggerType: v })}
        />
        <NumberField label="Delay (s)" value={(content.delaySeconds as number) ?? 5} min={1} max={120} onChange={(v) => setContent({ delaySeconds: v })} />
        <NumberField label="Scroll %" value={(content.scrollPercent as number) ?? 50} min={10} max={95} onChange={(v) => setContent({ scrollPercent: v })} />
        <BoolField label="Mostrar apenas uma vez" value={(content.showOnce as boolean) ?? false} onChange={(v) => setContent({ showOnce: v })} />
      </Section>
      <Section title="Trigger (botão)">
        <TextField label="Rótulo do botão" value={(content.triggerLabel as string) ?? ""} onChange={(v) => setContent({ triggerLabel: v })} />
        <ColorField label="Fundo do botão" value={(content.triggerBg as string) ?? "#e63946"} onChange={(v) => setContent({ triggerBg: v })} />
        <ColorField label="Cor do botão" value={(content.triggerColor as string) ?? "#ffffff"} onChange={(v) => setContent({ triggerColor: v })} />
      </Section>
      <Section title="Conteúdo do popup">
        <TextField label="Título" value={(content.popupTitle as string) ?? ""} onChange={(v) => setContent({ popupTitle: v })} />
        <TextareaField label="Descrição" value={(content.popupContent as string) ?? ""} onChange={(v) => setContent({ popupContent: v })} rows={4} />
        <TextField label="Texto do CTA" value={(content.popupCtaText as string) ?? ""} onChange={(v) => setContent({ popupCtaText: v })} />
        <TextField label="Link do CTA" value={(content.popupCtaHref as string) ?? "#"} onChange={(v) => setContent({ popupCtaHref: v })} />
      </Section>
      <Section title="Cores do popup">
        <ColorField label="Fundo" value={(content.popupBg as string) ?? "#ffffff"} onChange={(v) => setContent({ popupBg: v })} />
        <ColorField label="Cor do texto" value={(content.popupColor as string) ?? "#0f172a"} onChange={(v) => setContent({ popupColor: v })} />
        <ColorField label="Fundo do CTA" value={(content.ctaBg as string) ?? "#e63946"} onChange={(v) => setContent({ ctaBg: v })} />
        <ColorField label="Cor do CTA" value={(content.ctaColor as string) ?? "#ffffff"} onChange={(v) => setContent({ ctaColor: v })} />
      </Section>
    </>
  );
}

export function ReadingProgressEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  return (
    <Section title="Barra de progresso de leitura">
      <SelectField
        label="Posição"
        value={(content.position as string) ?? "top"}
        options={[
          { value: "top", label: "Topo" },
          { value: "bottom", label: "Rodapé" },
        ]}
        onChange={(v) => setContent({ position: v })}
      />
      <NumberField label="Altura (px)" value={(content.height as number) ?? 4} min={2} max={20} onChange={(v) => setContent({ height: v })} />
      <ColorField label="Cor de fundo" value={(content.bg as string) ?? "transparent"} onChange={(v) => setContent({ bg: v })} />
      <ColorField label="Cor de preenchimento" value={(content.fillColor as string) ?? "#e63946"} onChange={(v) => setContent({ fillColor: v })} />
    </Section>
  );
}

export function DateEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  const fixedDate = (content.fixedDate as string) ?? new Date().toISOString();
  const dt = new Date(fixedDate);
  const isoLocal = !isNaN(dt.getTime())
    ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
    : "";

  return (
    <>
      <Section title="Data">
        <SelectField
          label="Origem"
          value={(content.source as string) ?? "now"}
          options={[
            { value: "now", label: "Agora (atualiza a cada visita)" },
            { value: "fixed", label: "Data fixa" },
          ]}
          onChange={(v) => setContent({ source: v })}
        />
        {(content.source as string) === "fixed" && (
          <div>
            <label className={labelCls}>Data fixa</label>
            <input
              type="datetime-local"
              value={isoLocal}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) setContent({ fixedDate: d.toISOString() });
              }}
              className="w-full rounded border border-editor-border bg-editor-panel-2 px-2 py-1.5 text-xs text-editor-fg focus:outline-none focus:ring-1 focus:ring-editor-accent"
            />
          </div>
        )}
        <SelectField
          label="Formato"
          value={(content.format as string) ?? "long"}
          options={[
            { value: "long", label: "Longo (15 de janeiro de 2026)" },
            { value: "medium", label: "Médio (15 de jan. de 2026)" },
            { value: "short", label: "Curto (15/01/2026)" },
            { value: "weekday", label: "Dia da semana (sexta)" },
          ]}
          onChange={(v) => setContent({ format: v })}
        />
        <TextField label="Locale" value={(content.locale as string) ?? "pt-BR"} onChange={(v) => setContent({ locale: v })} />
        <TextField label="Prefixo" value={(content.prefix as string) ?? ""} onChange={(v) => setContent({ prefix: v })} />
        <TextField label="Sufixo" value={(content.suffix as string) ?? ""} onChange={(v) => setContent({ suffix: v })} />
      </Section>
      <Section title="Aparência">
        <NumberField label="Tamanho da fonte" value={(content.fontSize as number) ?? 16} min={10} max={48} onChange={(v) => setContent({ fontSize: v })} />
        <NumberField label="Peso da fonte" value={(content.fontWeight as number) ?? 500} min={300} max={900} step={100} onChange={(v) => setContent({ fontWeight: v })} />
        <ColorField label="Cor" value={(content.color as string) ?? "#0f172a"} onChange={(v) => setContent({ color: v })} />
      </Section>
    </>
  );
}

export function ImageScrollEditor({ content, setContent }: { content: Record<string, unknown>; setContent: SetContent }) {
  return (
    <Section title="Image Scroll (long screenshot)">
      <TextField label="URL da imagem" value={(content.src as string) ?? ""} onChange={(v) => setContent({ src: v })} />
      <TextField label="Texto alternativo" value={(content.alt as string) ?? ""} onChange={(v) => setContent({ alt: v })} />
      <NumberField label="Altura visível (px)" value={(content.height as number) ?? 360} min={120} max={800} onChange={(v) => setContent({ height: v })} />
      <SelectField
        label="Direção do scroll"
        value={(content.direction as string) ?? "vertical"}
        options={[
          { value: "vertical", label: "Vertical" },
          { value: "horizontal", label: "Horizontal" },
        ]}
        onChange={(v) => setContent({ direction: v })}
      />
      <NumberField label="Velocidade" value={(content.speed as number) ?? 1} min={0.2} max={5} step={0.1} onChange={(v) => setContent({ speed: v })} />
      <NumberField label="Raio das bordas (px)" value={(content.borderRadius as number) ?? 8} min={0} max={32} onChange={(v) => setContent({ borderRadius: v })} />
    </Section>
  );
}
