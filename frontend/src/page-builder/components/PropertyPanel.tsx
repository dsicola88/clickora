import { useBuilder, resolveResponsive } from "../store";
import type {
  BaseStyles,
  ColumnNode,
  DeviceType,
  ResponsiveStyles,
  ResponsiveValue,
  SectionNode,
  SpacingValue,
  TypographyValue,
  WidgetNode,
  WidgetType,
} from "../types";
import { WIDGET_REGISTRY } from "../widget-registry";
import { Settings2, Trash2, Plus, GripVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import type { FormField } from "../widgets/FormWidget";
import type { SocialNetwork } from "../widgets/SocialIconsWidget";
import type { TabItem } from "../widgets/TabsWidget";
import {
  ColorField,
  NumberField,
  SelectField,
  SpacingField,
  TextField,
  TextareaField,
  BuilderImageUrlField,
} from "./PropertyControls";
import {
  BackToTopContentEditor,
  DateContentEditor,
  InfoBoxContentEditor,
  PhoneCallContentEditor,
  ReadingProgressContentEditor,
  StickyVideoContentEditor,
  TickerContentEditor,
} from "./extra-widgets-editors";
import type { NavItem } from "../widgets/NavMenuWidget";

type Tab = "content" | "style" | "advanced";

export function PropertyPanel() {
  const selection = useBuilder((s) => s.selection);
  const doc = useBuilder((s) => s.doc);
  const device = useBuilder((s) => s.device);

  if (!selection) return <EmptyPanel />;

  const section = doc.sections.find(
    (s) =>
      s.id === (selection.kind === "section" ? selection.id : (selection as { sectionId?: string }).sectionId),
  );
  if (!section) return <EmptyPanel />;

  if (selection.kind === "section") {
    return <SectionPanel section={section} device={device} />;
  }

  const column = section.columns.find(
    (c) =>
      c.id ===
      (selection.kind === "column" ? selection.id : (selection as { columnId: string }).columnId),
  );
  if (!column) return <EmptyPanel />;

  if (selection.kind === "column") {
    return <ColumnPanel section={section} column={column} device={device} />;
  }

  const widget = column.widgets.find((w) => w.id === selection.id);
  if (!widget) return <EmptyPanel />;
  return <WidgetPanel section={section} column={column} widget={widget} device={device} />;
}

function EmptyPanel() {
  return (
    <aside className="flex w-80 shrink-0 flex-col items-center justify-center gap-3 border-l border-editor-border bg-editor-panel p-6 text-center text-editor-fg-muted">
      <div className="rounded-full bg-editor-panel-2 p-4">
        <Settings2 className="h-6 w-6" />
      </div>
      <p className="text-xs">
        Selecione um elemento no canvas para editar suas propriedades.
      </p>
    </aside>
  );
}

function PanelShell({
  title,
  badge,
  badgeColor,
  tabs,
  active,
  onTab,
  children,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  tabs: Array<{ id: Tab; label: string }>;
  active: Tab;
  onTab: (t: Tab) => void;
  children: React.ReactNode;
}) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-editor-border bg-editor-panel text-editor-fg">
      <div className="border-b border-editor-border p-3">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            style={{ background: badgeColor }}
          >
            {badge}
          </span>
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
      </div>
      <div className="flex border-b border-editor-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`flex-1 border-b-2 py-2.5 text-xs font-medium transition-colors ${
              active === t.id
                ? "border-editor-accent text-editor-fg"
                : "border-transparent text-editor-fg-muted hover:text-editor-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="editor-scrollbar flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

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

/* ----------- WIDGET PANEL ----------- */

function WidgetPanel({
  section,
  column,
  widget,
  device,
}: {
  section: SectionNode;
  column: ColumnNode;
  widget: WidgetNode;
  device: DeviceType;
}) {
  const [tab, setTab] = useState<Tab>("content");
  const updateWidget = useBuilder((s) => s.updateWidget);
  const def = WIDGET_REGISTRY[widget.type];

  /** Ao mudar de widget, o painel reutiliza o mesmo estado — voltar a «Conteúdo» para não ficar preso em «Estilo» sem o campo do vídeo/URL. */
  useEffect(() => {
    setTab("content");
  }, [widget.id]);

  const setContent = (patch: Record<string, unknown>) =>
    updateWidget(section.id, column.id, widget.id, {
      content: { ...widget.content, ...patch },
    });

  const setStyles = (patch: Partial<BaseStyles & ResponsiveStyles>) =>
    updateWidget(section.id, column.id, widget.id, {
      styles: { ...widget.styles, ...patch },
    });

  return (
    <PanelShell
      title={def.label}
      badge="Widget"
      badgeColor="var(--editor-widget)"
      tabs={[
        { id: "content", label: "Conteúdo" },
        { id: "style", label: "Estilo" },
        { id: "advanced", label: "Avançado" },
      ]}
      active={tab}
      onTab={setTab}
    >
      {tab === "content" && <WidgetContentTab widget={widget} setContent={setContent} />}
      {tab === "style" && (
        <WidgetStyleTab widget={widget} device={device} setStyles={setStyles} />
      )}
      {tab === "advanced" && (
        <AdvancedTab
          styles={widget.styles}
          cssClasses={widget.cssClasses}
          device={device}
          onStyles={setStyles}
          onClasses={(v) =>
            updateWidget(section.id, column.id, widget.id, { cssClasses: v })
          }
        />
      )}
    </PanelShell>
  );
}

function WidgetContentTab({
  widget,
  setContent,
}: {
  widget: WidgetNode;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const c = widget.content;
  switch (widget.type) {
    case "heading":
      return (
        <Section title="Conteúdo">
          <TextareaField
            label="Texto do título"
            value={(c.text as string) ?? ""}
            onChange={(v) => setContent({ text: v })}
          />
          <SelectField
            label="Tag HTML"
            value={(c.tag as string) ?? "h2"}
            options={["h1", "h2", "h3", "h4", "h5", "h6"].map((t) => ({ value: t, label: t.toUpperCase() }))}
            onChange={(v) => setContent({ tag: v })}
          />
        </Section>
      );
    case "text":
      return (
        <Section title="Conteúdo">
          <TextareaField
            label="HTML do texto"
            value={(c.html as string) ?? ""}
            onChange={(v) => setContent({ html: v })}
            rows={8}
          />
        </Section>
      );
    case "image":
      return (
        <Section title="Imagem">
          <BuilderImageUrlField
            label="URL da imagem"
            value={(c.src as string) ?? ""}
            onChange={(v) => setContent({ src: v })}
            placeholder="https://…"
          />
          <TextField
            label="Texto alternativo"
            value={(c.alt as string) ?? ""}
            onChange={(v) => setContent({ alt: v })}
          />
          <TextField
            label="Link (opcional)"
            value={(c.link as string) ?? ""}
            onChange={(v) => setContent({ link: v })}
          />
        </Section>
      );
    case "button":
      return (
        <Section title="Botão">
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
        </Section>
      );
    case "video":
      return (
        <Section title="Ligação do vídeo">
          <p className="text-[11px] leading-relaxed text-editor-fg-muted -mt-1 mb-1">
            O URL cola-se aqui no painel à direita (não no bloco no canvas). Certifica-te de que estás na aba{" "}
            <span className="font-semibold text-editor-fg">Conteúdo</span>.
          </p>
          <TextareaField
            label="YouTube ou Bunny.net (Stream)"
            value={(c.url as string) ?? ""}
            onChange={(v) => setContent({ url: v })}
            rows={4}
            placeholder="Ex.: https://www.youtube.com/watch?v=… ou https://video.bunnycdn.com/play/…/…"
          />
          <p className="text-[10px] leading-relaxed text-editor-fg-muted">
            <span className="font-semibold text-editor-fg">YouTube:</span> link do vídeo (youtube.com, youtu.be ou
            Shorts).{" "}
            <span className="font-semibold text-editor-fg">Bunny.net:</span> página Play (video.bunnycdn.com/play/…) ou
            iframe (iframe.mediadelivery.net/embed/…).
          </p>
        </Section>
      );
    case "icon":
      return (
        <Section title="Ícone">
          <TextField
            label="Nome (lucide-react)"
            value={(c.name as string) ?? ""}
            onChange={(v) => setContent({ name: v })}
          />
          <NumberField
            label="Tamanho (px)"
            value={(c.size as number) ?? 48}
            onChange={(v) => setContent({ size: v })}
            min={8}
            max={256}
          />
        </Section>
      );
    case "divider":
      return (
        <Section title="Divisor">
          <SelectField
            label="Estilo"
            value={(c.style as string) ?? "solid"}
            options={[
              { value: "solid", label: "Sólido" },
              { value: "dashed", label: "Tracejado" },
              { value: "dotted", label: "Pontilhado" },
            ]}
            onChange={(v) => setContent({ style: v })}
          />
          <NumberField
            label="Espessura"
            value={(c.weight as number) ?? 1}
            onChange={(v) => setContent({ weight: v })}
            min={1}
            max={20}
          />
        </Section>
      );
    case "spacer":
      return (
        <Section title="Espaçador">
          <p className="text-xs text-editor-fg-muted">Configure a altura na aba Estilo.</p>
        </Section>
      );
    case "html":
      return (
        <Section title="HTML">
          <TextareaField
            label="Código HTML"
            value={(c.code as string) ?? ""}
            onChange={(v) => setContent({ code: v })}
            rows={10}
          />
        </Section>
      );
    case "form":
      return <FormContentEditor content={c} setContent={setContent} />;
    case "testimonials":
      return <TestimonialsContentEditor content={c} setContent={setContent} />;
    case "faq":
      return <FaqContentEditor content={c} setContent={setContent} />;
    case "countdown":
      return <CountdownContentEditor content={c} setContent={setContent} />;
    case "gallery":
    case "imageCarousel":
      return <GalleryContentEditor widgetType={widget.type} content={c} setContent={setContent} />;
    case "animatedHeadline":
      return <AnimatedHeadlineContentEditor content={c} setContent={setContent} />;
    case "priceTable":
      return <PriceTableContentEditor content={c} setContent={setContent} />;
    case "ctaBox":
      return <CtaBoxContentEditor content={c} setContent={setContent} />;
    case "flipBox":
      return <FlipBoxContentEditor content={c} setContent={setContent} />;
    case "progressTracker":
      return <ProgressTrackerContentEditor content={c} setContent={setContent} />;
    case "alert":
      return <AlertContentEditor content={c} setContent={setContent} />;
    case "tabs":
      return <TabsContentEditor content={c} setContent={setContent} />;
    case "socialIcons":
      return <SocialIconsContentEditor content={c} setContent={setContent} />;
    case "iconList":
      return <IconListContentEditor content={c} setContent={setContent} />;
    case "backToTop":
      return <BackToTopContentEditor content={c} setContent={setContent} />;
    case "readingProgress":
      return <ReadingProgressContentEditor content={c} setContent={setContent} />;
    case "stickyVideo":
      return <StickyVideoContentEditor content={c} setContent={setContent} />;
    case "phoneCall":
      return <PhoneCallContentEditor content={c} setContent={setContent} />;
    case "dateWidget":
      return <DateContentEditor content={c} setContent={setContent} />;
    case "navMenu":
      return <NavMenuContentEditor content={c} setContent={setContent} />;
    case "ticker":
      return <TickerContentEditor content={c} setContent={setContent} />;
    case "infoBox":
      return <InfoBoxContentEditor content={c} setContent={setContent} />;
    default:
      return null;
  }
}

function WidgetStyleTab({
  widget,
  device,
  setStyles,
}: {
  widget: WidgetNode;
  device: DeviceType;
  setStyles: (p: Partial<BaseStyles & ResponsiveStyles>) => void;
}) {
  return (
    <>
      {widget.type === "spacer" ? (
        <Section title="Tamanho">
          <TextField
            label={`Altura (${device})`}
            value={(resolveResponsive(widget.styles.height, device) as string) ?? "50px"}
            onChange={(v) =>
              setStyles({ height: setResponsive(widget.styles.height, device, v) })
            }
          />
        </Section>
      ) : (
        <>
          {widget.type === "video" || widget.type === "stickyVideo" ? (
            <div className="border-b border-editor-border px-3 pb-3">
              <p className="text-[11px] leading-relaxed text-editor-fg-muted">
                <span className="font-semibold text-editor-fg">Link do YouTube ou Bunny:</span> está na aba{" "}
                <span className="font-semibold text-editor-fg">Conteúdo</span> (primeiro separador em cima). Aqui só
                defines fundo e margens do bloco.
              </p>
            </div>
          ) : null}
          <Section title="Cores">
            {widget.type !== "image" &&
            widget.type !== "video" &&
            widget.type !== "stickyVideo" &&
            widget.type !== "alert" &&
            widget.type !== "tabs" &&
            widget.type !== "socialIcons" &&
            widget.type !== "iconList" && (
              <ColorField
                label="Cor do texto"
                value={widget.styles.color ?? ""}
                onChange={(v) => setStyles({ color: v })}
              />
            )}
            <ColorField
              label="Fundo"
              value={widget.styles.background ?? ""}
              onChange={(v) => setStyles({ background: v })}
            />
          </Section>

          {(widget.type === "heading" ||
            widget.type === "text" ||
            widget.type === "button") && (
            <TypographySection styles={widget.styles} device={device} setStyles={setStyles} />
          )}

          <SpacingSection styles={widget.styles} device={device} setStyles={setStyles} />

          {(widget.type === "image" ||
            widget.type === "button" ||
            widget.type === "icon" ||
            widget.type === "divider" ||
            widget.type === "socialIcons" ||
            widget.type === "iconList" ||
            widget.type === "tabs") && (
            <Section title="Alinhamento">
              <SelectField
                label={`Alinhamento (${device})`}
                value={(resolveResponsive(widget.styles.align, device) as string) ?? "left"}
                options={[
                  { value: "left", label: "Esquerda" },
                  { value: "center", label: "Centro" },
                  { value: "right", label: "Direita" },
                ]}
                onChange={(v) =>
                  setStyles({
                    align: setResponsive(
                      widget.styles.align,
                      device,
                      v as "left" | "center" | "right",
                    ),
                  })
                }
              />
            </Section>
          )}
        </>
      )}
    </>
  );
}

/* ----------- COLUMN / SECTION PANELS ----------- */

function ColumnPanel({
  section,
  column,
  device,
}: {
  section: SectionNode;
  column: ColumnNode;
  device: DeviceType;
}) {
  const [tab, setTab] = useState<Tab>("style");
  useEffect(() => {
    setTab("style");
  }, [column.id]);
  const updateColumn = useBuilder((s) => s.updateColumn);
  const setStyles = (patch: Partial<BaseStyles & ResponsiveStyles>) =>
    updateColumn(section.id, column.id, { styles: { ...column.styles, ...patch } });

  return (
    <PanelShell
      title="Coluna"
      badge="Coluna"
      badgeColor="var(--editor-column)"
      tabs={[
        { id: "content", label: "Layout" },
        { id: "style", label: "Estilo" },
        { id: "advanced", label: "Avançado" },
      ]}
      active={tab}
      onTab={setTab}
    >
      {tab === "content" && (
        <Section title="Largura">
          <NumberField
            label={`Largura % (${device})`}
            value={resolveResponsive(column.widthPercent, device) ?? 100}
            min={5}
            max={100}
            onChange={(v) =>
              updateColumn(section.id, column.id, {
                widthPercent: setResponsive(column.widthPercent, device, v),
              })
            }
          />
        </Section>
      )}
      {tab === "style" && (
        <>
          <Section title="Cores">
            <ColorField
              label="Fundo"
              value={column.styles.background ?? ""}
              onChange={(v) => setStyles({ background: v })}
            />
          </Section>
          <SpacingSection styles={column.styles} device={device} setStyles={setStyles} />
        </>
      )}
      {tab === "advanced" && (
        <AdvancedTab
          styles={column.styles}
          device={device}
          onStyles={setStyles}
          cssClasses={undefined}
          onClasses={() => {}}
          hideClasses
        />
      )}
    </PanelShell>
  );
}

function SectionPanel({ section, device }: { section: SectionNode; device: DeviceType }) {
  const [tab, setTab] = useState<Tab>("content");
  useEffect(() => {
    setTab("content");
  }, [section.id]);
  const updateSection = useBuilder((s) => s.updateSection);
  const setStyles = (patch: Partial<BaseStyles & ResponsiveStyles>) =>
    updateSection(section.id, { styles: { ...section.styles, ...patch } });

  return (
    <PanelShell
      title="Seção"
      badge="Seção"
      badgeColor="var(--editor-section)"
      tabs={[
        { id: "content", label: "Layout" },
        { id: "style", label: "Estilo" },
        { id: "advanced", label: "Avançado" },
      ]}
      active={tab}
      onTab={setTab}
    >
      {tab === "content" && (
        <>
          <Section title="Layout">
            <SelectField
              label="Largura do conteúdo"
              value={section.layout}
              options={[
                { value: "boxed", label: "Limitado (boxed)" },
                { value: "full", label: "Largura total" },
              ]}
              onChange={(v) => updateSection(section.id, { layout: v as "boxed" | "full" })}
            />
            {section.layout === "boxed" && (
              <NumberField
                label="Largura máxima (px)"
                value={section.contentWidth}
                onChange={(v) => updateSection(section.id, { contentWidth: v })}
                min={320}
                max={1920}
              />
            )}
            <NumberField
              label={`Espaço entre colunas (${device})`}
              value={resolveResponsive(section.columnGap, device) ?? 20}
              onChange={(v) =>
                updateSection(section.id, {
                  columnGap: setResponsive(section.columnGap, device, v),
                })
              }
              min={0}
              max={120}
            />
          </Section>
        </>
      )}
      {tab === "style" && (
        <>
          <Section title="Cores">
            <ColorField
              label="Fundo"
              value={section.styles.background ?? ""}
              onChange={(v) => setStyles({ background: v })}
            />
            <p className="text-[10px] leading-relaxed text-editor-fg-muted">
              Com vídeo de fundo, podes usar um fundo semitransparente (ex.{" "}
              <span className="font-mono">rgba(0,0,0,0.45)</span>) para escurecer o vídeo por baixo do conteúdo.
            </p>
          </Section>
          <Section title="Vídeo de fundo (opcional)">
            <TextareaField
              label="YouTube ou Bunny.net"
              value={(section.backgroundVideoUrl as string | undefined) ?? ""}
              onChange={(v) =>
                updateSection(section.id, {
                  backgroundVideoUrl: v.trim() ? v : undefined,
                })
              }
              rows={3}
              placeholder="https://www.youtube.com/watch?v=… ou video.bunnycdn.com/play/…"
            />
            <p className="text-[10px] leading-relaxed text-editor-fg-muted">
              Autoplay silencioso em loop atrás das colunas (mesmos formatos que o widget Vídeo). Deixa vazio para
              desativar.
            </p>
          </Section>
          <SpacingSection styles={section.styles} device={device} setStyles={setStyles} />
        </>
      )}
      {tab === "advanced" && (
        <AdvancedTab
          styles={section.styles}
          device={device}
          onStyles={setStyles}
          cssClasses={undefined}
          onClasses={() => {}}
          hideClasses
        />
      )}
    </PanelShell>
  );
}

/* ----------- SHARED SECTIONS ----------- */

function TypographySection({
  styles,
  device,
  setStyles,
}: {
  styles: BaseStyles & ResponsiveStyles;
  device: DeviceType;
  setStyles: (p: Partial<BaseStyles & ResponsiveStyles>) => void;
}) {
  const t = (resolveResponsive(styles.typography, device) as TypographyValue | undefined) ?? {
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
    textAlign: "left" as const,
    textTransform: "none" as const,
  };
  const update = (patch: Partial<TypographyValue>) =>
    setStyles({
      typography: setResponsive(styles.typography, device, { ...t, ...patch }),
    });

  return (
    <Section title={`Tipografia (${device})`}>
      <NumberField label="Tamanho (px)" value={t.fontSize} min={8} max={200} onChange={(v) => update({ fontSize: v })} />
      <SelectField
        label="Peso"
        value={String(t.fontWeight)}
        options={[300, 400, 500, 600, 700, 800, 900].map((w) => ({
          value: String(w),
          label: String(w),
        }))}
        onChange={(v) => update({ fontWeight: Number(v) })}
      />
      <NumberField
        label="Altura da linha"
        value={t.lineHeight}
        min={0.5}
        max={3}
        step={0.1}
        onChange={(v) => update({ lineHeight: v })}
      />
      <NumberField
        label="Espaçamento de letras"
        value={t.letterSpacing}
        min={-5}
        max={20}
        step={0.5}
        onChange={(v) => update({ letterSpacing: v })}
      />
      <SelectField
        label="Alinhamento"
        value={t.textAlign}
        options={[
          { value: "left", label: "Esquerda" },
          { value: "center", label: "Centro" },
          { value: "right", label: "Direita" },
          { value: "justify", label: "Justificado" },
        ]}
        onChange={(v) => update({ textAlign: v as TypographyValue["textAlign"] })}
      />
      <SelectField
        label="Transformar"
        value={t.textTransform}
        options={[
          { value: "none", label: "Nenhum" },
          { value: "uppercase", label: "MAIÚSCULAS" },
          { value: "lowercase", label: "minúsculas" },
          { value: "capitalize", label: "Capitalizado" },
        ]}
        onChange={(v) => update({ textTransform: v as TypographyValue["textTransform"] })}
      />
    </Section>
  );
}

function SpacingSection({
  styles,
  device,
  setStyles,
}: {
  styles: BaseStyles & ResponsiveStyles;
  device: DeviceType;
  setStyles: (p: Partial<BaseStyles & ResponsiveStyles>) => void;
}) {
  const padding = (resolveResponsive(styles.padding, device) as SpacingValue | undefined) ?? {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    unit: "px" as const,
  };
  const margin = (resolveResponsive(styles.margin, device) as SpacingValue | undefined) ?? {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    unit: "px" as const,
  };
  return (
    <Section title={`Espaçamento (${device})`}>
      <SpacingField
        label="Padding"
        value={padding}
        onChange={(v) => setStyles({ padding: setResponsive(styles.padding, device, v) })}
      />
      <SpacingField
        label="Margin"
        value={margin}
        onChange={(v) => setStyles({ margin: setResponsive(styles.margin, device, v) })}
      />
    </Section>
  );
}

function AdvancedTab({
  styles,
  device,
  onStyles,
  cssClasses,
  onClasses,
  hideClasses,
}: {
  styles: BaseStyles & ResponsiveStyles;
  device: DeviceType;
  onStyles: (p: Partial<BaseStyles & ResponsiveStyles>) => void;
  cssClasses: string | undefined;
  onClasses: (v: string) => void;
  hideClasses?: boolean;
}) {
  return (
    <>
      <Section title="Bordas">
        <NumberField
          label="Espessura"
          value={styles.border?.width ?? 0}
          min={0}
          max={20}
          onChange={(v) =>
            onStyles({
              border: {
                width: v,
                style: styles.border?.style ?? "solid",
                color: styles.border?.color ?? "#000000",
                radius: styles.border?.radius ?? 0,
              },
            })
          }
        />
        <ColorField
          label="Cor"
          value={styles.border?.color ?? "#000000"}
          onChange={(v) =>
            onStyles({
              border: {
                width: styles.border?.width ?? 0,
                style: styles.border?.style ?? "solid",
                color: v,
                radius: styles.border?.radius ?? 0,
              },
            })
          }
        />
        <NumberField
          label="Raio"
          value={styles.border?.radius ?? 0}
          min={0}
          max={200}
          onChange={(v) =>
            onStyles({
              border: {
                width: styles.border?.width ?? 0,
                style: styles.border?.style ?? "solid",
                color: styles.border?.color ?? "#000000",
                radius: v,
              },
            })
          }
        />
      </Section>
      <Section title="Visibilidade">
        <SelectField
          label={`Visível em ${device}`}
          value={
            (resolveResponsive(styles.visibility, device) ?? true) ? "show" : "hide"
          }
          options={[
            { value: "show", label: "Mostrar" },
            { value: "hide", label: "Ocultar" },
          ]}
          onChange={(v) =>
            onStyles({
              visibility: setResponsive(styles.visibility, device, v === "show"),
            })
          }
        />
      </Section>
      {!hideClasses && (
        <Section title="CSS">
          <TextField
            label="Classes CSS adicionais"
            value={cssClasses ?? ""}
            onChange={onClasses}
          />
        </Section>
      )}
    </>
  );
}

/** Update a responsive value at a given device (immutable). */
function setResponsive<T>(
  v: ResponsiveValue<T> | undefined,
  device: DeviceType,
  value: T,
): ResponsiveValue<T> {
  const base: ResponsiveValue<T> = v ? { ...v } : ({ desktop: value } as ResponsiveValue<T>);
  if (device === "desktop") base.desktop = value;
  if (device === "tablet") base.tablet = value;
  if (device === "mobile") base.mobile = value;
  return base;
}

/* ----------- FORM CONTENT EDITOR ----------- */

function FormContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const fields = (content.fields as FormField[] | undefined) ?? [];

  const updateField = (idx: number, patch: Partial<FormField>) => {
    const next = fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    setContent({ fields: next });
  };

  const removeField = (idx: number) => {
    setContent({ fields: fields.filter((_, i) => i !== idx) });
  };

  const addField = () => {
    const next: FormField = {
      id: `f_${nanoid(6)}`,
      type: "text",
      name: `campo_${fields.length + 1}`,
      label: "Novo campo",
      placeholder: "",
      required: false,
    };
    setContent({ fields: [...fields, next] });
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[idx], next[target]] = [next[target], next[idx]];
    setContent({ fields: next });
  };

  return (
    <>
      <Section title="Campos do formulário">
        <div className="space-y-2">
          {fields.length === 0 && (
            <p className="rounded bg-editor-panel-2 p-3 text-center text-[11px] text-editor-fg-muted">
              Nenhum campo. Adicione um abaixo.
            </p>
          )}
          {fields.map((field, idx) => (
            <div
              key={field.id}
              className="space-y-2 rounded border border-editor-border bg-editor-panel-2 p-2.5"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveField(idx, -1)}
                    disabled={idx === 0}
                    className="text-editor-fg-muted hover:text-editor-fg disabled:opacity-30"
                    title="Mover para cima"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[11px] font-semibold text-editor-fg">
                    {field.label || field.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeField(idx)}
                  className="rounded p-1 text-editor-fg-muted hover:bg-destructive/20 hover:text-destructive"
                  title="Remover campo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <SelectField
                label="Tipo"
                value={field.type}
                options={[
                  { value: "text", label: "Texto" },
                  { value: "email", label: "E-mail" },
                  { value: "tel", label: "Telefone" },
                  { value: "number", label: "Número" },
                  { value: "textarea", label: "Texto longo" },
                ]}
                onChange={(v) => updateField(idx, { type: v as FormField["type"] })}
              />
              <TextField
                label="Rótulo"
                value={field.label}
                onChange={(v) => updateField(idx, { label: v })}
              />
              <TextField
                label="Nome (chave do payload)"
                value={field.name}
                onChange={(v) => updateField(idx, { name: v.replace(/[^a-zA-Z0-9_]/g, "_") })}
              />
              <TextField
                label="Placeholder"
                value={field.placeholder ?? ""}
                onChange={(v) => updateField(idx, { placeholder: v })}
              />
              <label className="flex items-center gap-2 text-[11px] text-editor-fg">
                <input
                  type="checkbox"
                  checked={field.required ?? false}
                  onChange={(e) => updateField(idx, { required: e.target.checked })}
                  className="h-3.5 w-3.5 accent-editor-accent"
                />
                Obrigatório
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={addField}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-editor-border py-2 text-[11px] font-medium text-editor-fg-muted transition-colors hover:border-editor-accent hover:text-editor-accent"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar campo
          </button>
        </div>
      </Section>

      <Section title="Envio">
        <TextField
          label="Texto do botão"
          value={(content.submitText as string) ?? "Enviar"}
          onChange={(v) => setContent({ submitText: v })}
        />
        <TextField
          label="URL do webhook"
          value={(content.webhookUrl as string) ?? ""}
          placeholder="https://hooks.exemplo.com/..."
          onChange={(v) => setContent({ webhookUrl: v })}
        />
        <TextField
          label="Redirecionar após envio (opcional)"
          value={(content.redirectUrl as string) ?? ""}
          placeholder="https://..."
          onChange={(v) => setContent({ redirectUrl: v })}
        />
        <TextareaField
          label="Mensagem de sucesso"
          value={(content.successMessage as string) ?? ""}
          onChange={(v) => setContent({ successMessage: v })}
          rows={2}
        />
        <TextareaField
          label="Mensagem de erro"
          value={(content.errorMessage as string) ?? ""}
          onChange={(v) => setContent({ errorMessage: v })}
          rows={2}
        />
      </Section>

      <Section title="Estilo dos campos">
        <ColorField
          label="Fundo do campo"
          value={(content.inputBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ inputBg: v })}
        />
        <ColorField
          label="Cor da borda"
          value={(content.inputBorderColor as string) ?? "#d0d5dd"}
          onChange={(v) => setContent({ inputBorderColor: v })}
        />
        <NumberField
          label="Raio da borda (px)"
          value={(content.inputRadius as number) ?? 6}
          onChange={(v) => setContent({ inputRadius: v })}
          min={0}
          max={32}
        />
        <ColorField
          label="Cor do rótulo"
          value={(content.labelColor as string) ?? "#1a1a1a"}
          onChange={(v) => setContent({ labelColor: v })}
        />
        <NumberField
          label="Espaçamento entre campos (px)"
          value={(content.fieldGap as number) ?? 12}
          onChange={(v) => setContent({ fieldGap: v })}
          min={0}
          max={48}
        />
      </Section>

      <Section title="Estilo do botão">
        <ColorField
          label="Fundo"
          value={(content.buttonBg as string) ?? "#e63946"}
          onChange={(v) => setContent({ buttonBg: v })}
        />
        <ColorField
          label="Cor do texto"
          value={(content.buttonColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ buttonColor: v })}
        />
        <NumberField
          label="Raio (px)"
          value={(content.buttonRadius as number) ?? 6}
          onChange={(v) => setContent({ buttonRadius: v })}
          min={0}
          max={32}
        />
      </Section>
    </>
  );
}

/* ----------- TESTIMONIALS / FAQ / COUNTDOWN / GALLERY EDITORS ----------- */

interface ListItem {
  id: string;
  [k: string]: unknown;
}

function ListEditor<T extends ListItem>({
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
            Nenhum item ainda.
          </p>
        )}
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="space-y-2 rounded border border-editor-border bg-editor-panel-2 p-2.5"
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="text-editor-fg-muted hover:text-editor-fg disabled:opacity-30"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] font-semibold text-editor-fg">
                  {itemLabel(item, idx)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded p-1 text-editor-fg-muted hover:bg-destructive/20 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {renderFields(item, (patch) => update(idx, patch))}
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, newItem()])}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-editor-border py-2 text-[11px] font-medium text-editor-fg-muted transition-colors hover:border-editor-accent hover:text-editor-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>
    </Section>
  );
}

function NavMenuContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const items = (content.items as NavItem[]) ?? [];
  return (
    <>
      <ListEditor
        title="Links do menu"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.label || "Link"}
        newItem={() => ({ id: `nav_${nanoid(6)}`, label: "Novo link", href: "#" })}
        renderFields={(item, update) => (
          <>
            <TextField label="Texto" value={item.label} onChange={(v) => update({ label: v })} />
            <TextField label="URL / âncora" value={item.href} onChange={(v) => update({ href: v })} />
          </>
        )}
      />
      <Section title="Aparência">
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
        <ColorField label="Cor dos links" value={(content.color as string) ?? "#0f172a"} onChange={(v) => setContent({ color: v })} />
        <ColorField label="Cor ao passar o rato" value={(content.hoverColor as string) ?? "#e63946"} onChange={(v) => setContent({ hoverColor: v })} />
        <NumberField label="Tamanho da fonte" value={(content.fontSize as number) ?? 15} onChange={(v) => setContent({ fontSize: v })} min={10} max={24} />
        <NumberField label="Peso da fonte" value={(content.fontWeight as number) ?? 500} onChange={(v) => setContent({ fontWeight: v })} min={400} max={800} step={100} />
        <NumberField label="Espaço entre links" value={(content.gap as number) ?? 24} onChange={(v) => setContent({ gap: v })} min={8} max={48} />
        <SelectField
          label="Sublinhado ao hover"
          value={(content.underlineOnHover as boolean) !== false ? "yes" : "no"}
          options={[
            { value: "yes", label: "Sim" },
            { value: "no", label: "Não" },
          ]}
          onChange={(v) => setContent({ underlineOnHover: v === "yes" })}
        />
      </Section>
    </>
  );
}

function TestimonialsContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const items =
    (content.items as Array<{
      id: string;
      name: string;
      role: string;
      avatar: string;
      quote: string;
      rating: number;
    }>) ?? [];
  return (
    <>
      <ListEditor
        title="Depoimentos"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.name || "Sem nome"}
        newItem={() => ({
          id: `t_${nanoid(6)}`,
          name: "Nome",
          role: "Cargo",
          avatar: "",
          quote: "Texto do depoimento...",
          rating: 5,
        })}
        renderFields={(item, update) => (
          <>
            <TextField label="Nome" value={item.name} onChange={(v) => update({ name: v })} />
            <TextField label="Cargo / empresa" value={item.role} onChange={(v) => update({ role: v })} />
            <BuilderImageUrlField
              label="URL do avatar"
              value={item.avatar}
              onChange={(v) => update({ avatar: v })}
              placeholder="https://…"
            />
            <TextareaField label="Depoimento" value={item.quote} onChange={(v) => update({ quote: v })} rows={3} />
            <NumberField
              label="Estrelas (0-5)"
              value={item.rating}
              min={0}
              max={5}
              onChange={(v) => update({ rating: Math.max(0, Math.min(5, v)) })}
            />
          </>
        )}
      />
      <Section title="Carrossel">
        <SelectField
          label="Auto-play"
          value={(content.autoplay as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: "Sim" },
            { value: "no", label: "Não" },
          ]}
          onChange={(v) => setContent({ autoplay: v === "yes" })}
        />
        <NumberField
          label="Intervalo (ms)"
          value={(content.intervalMs as number) ?? 5000}
          min={1500}
          max={20000}
          step={500}
          onChange={(v) => setContent({ intervalMs: v })}
        />
      </Section>
      <Section title="Aparência">
        <ColorField
          label="Fundo do card"
          value={(content.cardBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ cardBg: v })}
        />
        <ColorField
          label="Cor do texto"
          value={(content.textColor as string) ?? "#1a1a1a"}
          onChange={(v) => setContent({ textColor: v })}
        />
        <ColorField
          label="Cor de destaque (estrelas)"
          value={(content.accentColor as string) ?? "#f59e0b"}
          onChange={(v) => setContent({ accentColor: v })}
        />
      </Section>
    </>
  );
}

function FaqContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const items =
    (content.items as Array<{ id: string; question: string; answer: string }>) ?? [];
  return (
    <>
      <ListEditor
        title="Perguntas"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.question || "Pergunta"}
        newItem={() => ({
          id: `q_${nanoid(6)}`,
          question: "Nova pergunta?",
          answer: "<p>Resposta...</p>",
        })}
        renderFields={(item, update) => (
          <>
            <TextField
              label="Pergunta"
              value={item.question}
              onChange={(v) => update({ question: v })}
            />
            <TextareaField
              label="Resposta (HTML)"
              value={item.answer}
              onChange={(v) => update({ answer: v })}
              rows={3}
            />
          </>
        )}
      />
      <Section title="Comportamento">
        <SelectField
          label="Permitir múltiplas abertas"
          value={(content.allowMultiple as boolean) ? "yes" : "no"}
          options={[
            { value: "no", label: "Não" },
            { value: "yes", label: "Sim" },
          ]}
          onChange={(v) => setContent({ allowMultiple: v === "yes" })}
        />
      </Section>
      <Section title="Aparência">
        <ColorField
          label="Fundo dos itens"
          value={(content.itemBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ itemBg: v })}
        />
        <ColorField
          label="Cor da borda"
          value={(content.itemBorderColor as string) ?? "#e5e7eb"}
          onChange={(v) => setContent({ itemBorderColor: v })}
        />
        <ColorField
          label="Cor da pergunta"
          value={(content.questionColor as string) ?? "#111827"}
          onChange={(v) => setContent({ questionColor: v })}
        />
        <ColorField
          label="Cor da resposta"
          value={(content.answerColor as string) ?? "#4b5563"}
          onChange={(v) => setContent({ answerColor: v })}
        />
        <ColorField
          label="Cor de destaque"
          value={(content.accentColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ accentColor: v })}
        />
      </Section>
    </>
  );
}

function CountdownContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const deadline = (content.deadline as string) ?? new Date(Date.now() + 86400000).toISOString();
  const dt = new Date(deadline);
  // datetime-local needs YYYY-MM-DDTHH:MM
  const isoLocal = !isNaN(dt.getTime())
    ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
    : "";

  return (
    <>
      <Section title="Data alvo">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-editor-fg-muted">
            Quando expira
          </label>
          <input
            type="datetime-local"
            value={isoLocal}
            onChange={(e) => {
              const d = new Date(e.target.value);
              if (!isNaN(d.getTime())) setContent({ deadline: d.toISOString() });
            }}
            className="w-full rounded border border-editor-border bg-editor-panel-2 px-2 py-1.5 text-xs text-editor-fg focus:outline-none focus:ring-1 focus:ring-editor-accent"
          />
        </div>
        <TextField
          label="Mensagem ao expirar"
          value={(content.expiredMessage as string) ?? "A oferta expirou!"}
          onChange={(v) => setContent({ expiredMessage: v })}
        />
      </Section>
      <Section title="Exibição">
        <SelectField
          label="Mostrar dias"
          value={(content.showDays as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: "Sim" },
            { value: "no", label: "Não" },
          ]}
          onChange={(v) => setContent({ showDays: v === "yes" })}
        />
        <SelectField
          label="Mostrar rótulos"
          value={(content.showLabels as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: "Sim" },
            { value: "no", label: "Não" },
          ]}
          onChange={(v) => setContent({ showLabels: v === "yes" })}
        />
        <NumberField
          label="Tamanho dos dígitos"
          value={(content.digitSize as number) ?? 48}
          min={20}
          max={120}
          onChange={(v) => setContent({ digitSize: v })}
        />
      </Section>
      <Section title="Cores">
        <ColorField
          label="Fundo dos dígitos"
          value={(content.digitBg as string) ?? "#0f172a"}
          onChange={(v) => setContent({ digitBg: v })}
        />
        <ColorField
          label="Cor dos dígitos"
          value={(content.digitColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ digitColor: v })}
        />
        <ColorField
          label="Cor dos rótulos"
          value={(content.labelColor as string) ?? "#475569"}
          onChange={(v) => setContent({ labelColor: v })}
        />
        <ColorField
          label="Cor do separador"
          value={(content.separatorColor as string) ?? "#0f172a"}
          onChange={(v) => setContent({ separatorColor: v })}
        />
      </Section>
    </>
  );
}

const SOCIAL_NETWORK_OPTIONS: { value: SocialNetwork; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X / Twitter" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "link", label: "Website" },
];

function AlertContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  return (
    <>
      <Section title="Conteúdo">
        <SelectField
          label="Tipo"
          value={(content.variant as string) ?? "info"}
          options={[
            { value: "info", label: "Informação" },
            { value: "success", label: "Sucesso" },
            { value: "warning", label: "Aviso" },
            { value: "danger", label: "Erro / urgência" },
          ]}
          onChange={(v) => setContent({ variant: v })}
        />
        <TextField label="Título" value={(content.title as string) ?? ""} onChange={(v) => setContent({ title: v })} />
        <TextareaField
          label="Mensagem (HTML permitido)"
          value={(content.message as string) ?? ""}
          onChange={(v) => setContent({ message: v })}
          rows={5}
        />
        <SelectField
          label="Mostrar ícone"
          value={((content.showIcon as boolean) ?? true) ? "yes" : "no"}
          options={[
            { value: "yes", label: "Sim" },
            { value: "no", label: "Não" },
          ]}
          onChange={(v) => setContent({ showIcon: v === "yes" })}
        />
        <SelectField
          label="Permitir fechar"
          value={((content.dismissible as boolean) ?? false) ? "yes" : "no"}
          options={[
            { value: "no", label: "Não" },
            { value: "yes", label: "Sim" },
          ]}
          onChange={(v) => setContent({ dismissible: v === "yes" })}
        />
        <NumberField
          label="Raio das bordas (px)"
          value={(content.borderRadius as number) ?? 10}
          min={0}
          max={32}
          onChange={(v) => setContent({ borderRadius: v })}
        />
      </Section>
    </>
  );
}

function TabsContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const tabs = (content.tabs as TabItem[]) ?? [];
  return (
    <>
      <ListEditor
        title="Separadores"
        items={tabs}
        onChange={(next) => setContent({ tabs: next })}
        itemLabel={(it) => it.label || "Separador"}
        newItem={() => ({
          id: `tab_${nanoid(6)}`,
          label: "Novo separador",
          html: "<p>Conteúdo deste separador.</p>",
        })}
        renderFields={(item, update) => (
          <>
            <TextField label="Rótulo" value={item.label} onChange={(v) => update({ label: v })} />
            <TextareaField
              label="Conteúdo (HTML)"
              value={item.html}
              onChange={(v) => update({ html: v })}
              rows={4}
            />
          </>
        )}
      />
      <Section title="Cores">
        <ColorField
          label="Fundo das abas inativas"
          value={(content.tabBg as string) ?? "#f1f5f9"}
          onChange={(v) => setContent({ tabBg: v })}
        />
        <ColorField
          label="Fundo da aba ativa"
          value={(content.tabActiveBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ tabActiveBg: v })}
        />
        <ColorField
          label="Texto inativo"
          value={(content.tabTextColor as string) ?? "#64748b"}
          onChange={(v) => setContent({ tabTextColor: v })}
        />
        <ColorField
          label="Texto ativo"
          value={(content.tabActiveTextColor as string) ?? "#0f172a"}
          onChange={(v) => setContent({ tabActiveTextColor: v })}
        />
        <ColorField
          label="Destaque (barra)"
          value={(content.accentColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ accentColor: v })}
        />
        <ColorField
          label="Fundo do painel"
          value={(content.panelBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ panelBg: v })}
        />
        <ColorField
          label="Texto do painel"
          value={(content.panelTextColor as string) ?? "#334155"}
          onChange={(v) => setContent({ panelTextColor: v })}
        />
        <ColorField
          label="Borda"
          value={(content.borderColor as string) ?? "#e2e8f0"}
          onChange={(v) => setContent({ borderColor: v })}
        />
        <NumberField
          label="Raio geral (px)"
          value={(content.borderRadius as number) ?? 12}
          min={0}
          max={28}
          onChange={(v) => setContent({ borderRadius: v })}
        />
      </Section>
    </>
  );
}

function SocialIconsContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const items =
    (content.items as Array<{ id: string; network: SocialNetwork; url: string }>) ?? [];
  return (
    <>
      <ListEditor
        title="Ligações"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => SOCIAL_NETWORK_OPTIONS.find((o) => o.value === it.network)?.label ?? "Rede"}
        newItem={() => ({
          id: `soc_${nanoid(6)}`,
          network: "instagram" as SocialNetwork,
          url: "",
        })}
        renderFields={(item, update) => (
          <>
            <SelectField
              label="Rede"
              value={item.network}
              options={SOCIAL_NETWORK_OPTIONS}
              onChange={(v) => update({ network: v as SocialNetwork })}
            />
            <TextField
              label="URL ou contacto"
              value={item.url}
              onChange={(v) => update({ url: v })}
              placeholder="https://… ou e-mail / telefone (WhatsApp)"
            />
          </>
        )}
      />
      <Section title="Ícones">
        <NumberField
          label="Tamanho (px)"
          value={(content.iconSize as number) ?? 22}
          min={14}
          max={40}
          onChange={(v) => setContent({ iconSize: v })}
        />
        <NumberField
          label="Espaço entre ícones (px)"
          value={(content.gap as number) ?? 16}
          min={4}
          max={40}
          onChange={(v) => setContent({ gap: v })}
        />
        <SelectField
          label="Estilo"
          value={(content.variant as string) ?? "filled"}
          options={[
            { value: "filled", label: "Preenchido" },
            { value: "outline", label: "Contorno" },
            { value: "mono", label: "Linha simples" },
          ]}
          onChange={(v) => setContent({ variant: v })}
        />
        <ColorField
          label="Fundo (preenchido)"
          value={(content.iconBg as string) ?? "#0f172a"}
          onChange={(v) => setContent({ iconBg: v })}
        />
        <ColorField
          label="Cor do ícone"
          value={(content.iconColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ iconColor: v })}
        />
      </Section>
    </>
  );
}

function IconListContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const items =
    (content.items as Array<{
      id: string;
      iconName: string;
      title: string;
      description: string;
      href: string;
    }>) ?? [];
  return (
    <>
      <ListEditor
        title="Itens"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.title || "Item"}
        newItem={() => ({
          id: `il_${nanoid(6)}`,
          iconName: "check",
          title: "Novo item",
          description: "<p>Descrição breve.</p>",
          href: "",
        })}
        renderFields={(item, update) => (
          <>
            <TextField
              label="Ícone (lucide-react)"
              value={item.iconName}
              onChange={(v) => update({ iconName: v })}
              placeholder="check, shield, star…"
            />
            <TextField label="Título" value={item.title} onChange={(v) => update({ title: v })} />
            <TextareaField
              label="Descrição (HTML)"
              value={item.description}
              onChange={(v) => update({ description: v })}
              rows={3}
            />
            <TextField
              label="Link (opcional)"
              value={item.href}
              onChange={(v) => update({ href: v })}
              placeholder="https://…"
            />
          </>
        )}
      />
      <Section title="Aparência">
        <NumberField
          label="Tamanho do ícone"
          value={(content.iconSize as number) ?? 22}
          min={12}
          max={40}
          onChange={(v) => setContent({ iconSize: v })}
        />
        <NumberField
          label="Espaço entre itens (px)"
          value={(content.gap as number) ?? 16}
          min={4}
          max={40}
          onChange={(v) => setContent({ gap: v })}
        />
        <ColorField
          label="Cor do ícone"
          value={(content.iconColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ iconColor: v })}
        />
        <ColorField
          label="Cor do título"
          value={(content.titleColor as string) ?? "#0f172a"}
          onChange={(v) => setContent({ titleColor: v })}
        />
        <ColorField
          label="Cor da descrição"
          value={(content.descColor as string) ?? "#64748b"}
          onChange={(v) => setContent({ descColor: v })}
        />
      </Section>
    </>
  );
}

function GalleryContentEditor({
  content,
  setContent,
  widgetType,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
  widgetType: WidgetType;
}) {
  const images =
    (content.images as Array<{ id: string; src: string; alt: string; caption?: string }>) ?? [];
  const isDedicatedCarousel = widgetType === "imageCarousel";
  const isCarousel = (content.layout as string) === "carousel" || isDedicatedCarousel;
  return (
    <>
      <div className="border-b border-editor-border px-3 py-2.5">
        <p className="text-[11px] leading-relaxed text-editor-fg-muted">
          <span className="font-semibold text-editor-fg">As tuas imagens:</span> clica em «+ Adicionar» para cada
          foto. Em cada linha, cola um <span className="font-mono text-[10px]">https://…</span> ou usa{" "}
          <span className="font-semibold text-editor-fg">«Carregar do PC»</span> (é preciso sessão iniciada na conta).
          Podes repetir para várias imagens e reordenar com o ícone à esquerda.
        </p>
      </div>
      <ListEditor
        title="Imagens"
        items={images}
        onChange={(next) => setContent({ images: next })}
        itemLabel={(it, i) => it.alt || (it.src ? `Imagem ${i + 1}` : `Slide ${i + 1} (sem URL)`)}
        newItem={() => ({
          id: `g_${nanoid(6)}`,
          src: "",
          alt: "",
          caption: "",
        })}
        renderFields={(item, update) => (
          <>
            <BuilderImageUrlField
              label="URL da imagem"
              value={item.src}
              onChange={(v) => update({ src: v })}
              placeholder="https://… ou carregue do PC"
            />
            <TextField label="Texto alternativo" value={item.alt} onChange={(v) => update({ alt: v })} />
            <TextField
              label="Legenda (opcional)"
              value={item.caption ?? ""}
              onChange={(v) => update({ caption: v })}
            />
          </>
        )}
      />
      <Section title="Modo de exibição">
        {isDedicatedCarousel ? (
          <p className="text-xs leading-relaxed text-editor-fg-muted">
            Este bloco é sempre um carrossel (setas, pontos e configuração de movimento). Para grelha de imagens,
            use o widget «Galeria».
          </p>
        ) : (
          <SelectField
            label="Tipo"
            value={isCarousel ? "carousel" : "grid"}
            options={[
              { value: "grid", label: "Grelha" },
              { value: "carousel", label: "Carrossel" },
            ]}
            onChange={(v) => setContent({ layout: v })}
          />
        )}
      </Section>
      {!isCarousel ? (
        <Section title="Grelha">
          <NumberField
            label="Colunas"
            value={(content.columns as number) ?? 3}
            min={1}
            max={6}
            onChange={(v) => setContent({ columns: v })}
          />
          <NumberField
            label="Espaço entre imagens (px)"
            value={(content.gap as number) ?? 12}
            min={0}
            max={48}
            onChange={(v) => setContent({ gap: v })}
          />
        </Section>
      ) : (
        <Section title="Carrossel">
          <NumberField
            label="Espaço entre slides (px)"
            value={(content.gap as number) ?? 12}
            min={0}
            max={48}
            onChange={(v) => setContent({ gap: v })}
          />
          <SelectField
            label="Navegação"
            value={(() => {
              const a = (content.carouselShowArrows as boolean) !== false;
              const d = (content.carouselShowDots as boolean) !== false;
              if (a && d) return "both";
              if (a) return "arrows";
              if (d) return "dots";
              return "none";
            })()}
            options={[
              { value: "both", label: "Setas e pontos" },
              { value: "arrows", label: "Só setas" },
              { value: "dots", label: "Só pontos" },
              { value: "none", label: "Nenhuma" },
            ]}
            onChange={(v) => {
              if (v === "both") setContent({ carouselShowArrows: true, carouselShowDots: true });
              else if (v === "arrows") setContent({ carouselShowArrows: true, carouselShowDots: false });
              else if (v === "dots") setContent({ carouselShowArrows: false, carouselShowDots: true });
              else setContent({ carouselShowArrows: false, carouselShowDots: false });
            }}
          />
          <NumberField
            label="Slides visíveis (desktop)"
            value={(content.carouselSlidesDesktop as number) ?? 1}
            min={1}
            max={12}
            onChange={(v) => setContent({ carouselSlidesDesktop: v })}
          />
          <NumberField
            label="Slides visíveis (tablet)"
            value={(content.carouselSlidesTablet as number) ?? 1}
            min={1}
            max={8}
            onChange={(v) => setContent({ carouselSlidesTablet: v })}
          />
          <NumberField
            label="Slides visíveis (mobile)"
            value={(content.carouselSlidesMobile as number) ?? 1}
            min={1}
            max={4}
            onChange={(v) => setContent({ carouselSlidesMobile: v })}
          />
          <NumberField
            label="Slides a rolar de cada vez"
            value={(content.carouselSlidesToScroll as number) ?? 1}
            min={1}
            max={6}
            onChange={(v) => setContent({ carouselSlidesToScroll: v })}
          />
          <SelectField
            label="Preencher slide (imagem)"
            value={(content.carouselObjectFit as string) === "contain" ? "contain" : "cover"}
            options={[
              { value: "cover", label: "Sim (cobre o espaço)" },
              { value: "contain", label: "Não (miniatura, sem cortar)" },
            ]}
            onChange={(v) => setContent({ carouselObjectFit: v })}
          />
          <NumberField
            label="Largura fixa miniatura (px, 0 = automático)"
            value={(content.carouselThumbWidthPx as number) ?? 0}
            min={0}
            max={400}
            onChange={(v) => setContent({ carouselThumbWidthPx: v })}
          />
          <p className="text-[10px] leading-relaxed text-editor-fg-muted">
            Com largura fixa (ex.: 150), cabem tantas miniaturas quanto o ecrã permitir; o número de slides visíveis
            funciona como limite máximo.
          </p>
          <SelectField
            label="Avanço automático"
            value={((content.carouselAutoplay as boolean) ?? true) ? "yes" : "no"}
            options={[
              { value: "yes", label: "Sim" },
              { value: "no", label: "Não" },
            ]}
            onChange={(v) => setContent({ carouselAutoplay: v === "yes" })}
          />
          <NumberField
            label="Intervalo (ms)"
            value={(content.carouselIntervalMs as number) ?? 4500}
            min={2000}
            max={12000}
            step={500}
            onChange={(v) => setContent({ carouselIntervalMs: v })}
          />
          <NumberField
            label="Velocidade da transição (ms)"
            value={(content.carouselTransitionMs as number) ?? 450}
            min={100}
            max={2000}
            step={50}
            onChange={(v) => setContent({ carouselTransitionMs: v })}
          />
          <SelectField
            label="Pausar ao passar o rato"
            value={((content.carouselPauseOnHover as boolean) ?? true) ? "yes" : "no"}
            options={[
              { value: "yes", label: "Sim" },
              { value: "no", label: "Não" },
            ]}
            onChange={(v) => setContent({ carouselPauseOnHover: v === "yes" })}
          />
        </Section>
      )}
      <Section title="Aparência">
        <NumberField
          label="Raio das bordas (px)"
          value={(content.borderRadius as number) ?? 8}
          min={0}
          max={32}
          onChange={(v) => setContent({ borderRadius: v })}
        />
        <SelectField
          label="Proporção"
          value={(content.aspectRatio as string) ?? "square"}
          options={[
            { value: "auto", label: "Original" },
            { value: "square", label: "Quadrado 1:1" },
            { value: "landscape", label: "Paisagem 16:9" },
            { value: "portrait", label: "Retrato 3:4" },
          ]}
          onChange={(v) => setContent({ aspectRatio: v })}
        />
        <SelectField
          label="Lightbox ao clicar"
          value={((content.enableLightbox as boolean) ?? true) ? "yes" : "no"}
          options={[
            { value: "yes", label: "Sim" },
            { value: "no", label: "Não" },
          ]}
          onChange={(v) => setContent({ enableLightbox: v === "yes" })}
        />
      </Section>
    </>
  );
}

/* ----------- ANIMATED HEADLINE / PRICE TABLE / CTA BOX / FLIP BOX / PROGRESS TRACKER ----------- */

function AnimatedHeadlineContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const words = (content.rotatingWords as string[]) ?? [];
  return (
    <>
      <Section title="Texto">
        <TextField
          label="Prefixo"
          value={(content.prefix as string) ?? ""}
          onChange={(v) => setContent({ prefix: v })}
        />
        <TextareaField
          label="Palavras rotativas (uma por linha)"
          value={words.join("\n")}
          onChange={(v) => setContent({ rotatingWords: v.split("\n").filter(Boolean) })}
          rows={4}
        />
        <TextField
          label="Sufixo"
          value={(content.suffix as string) ?? ""}
          onChange={(v) => setContent({ suffix: v })}
        />
        <SelectField
          label="Tag HTML"
          value={(content.tag as string) ?? "h2"}
          options={[
            { value: "h1", label: "H1" },
            { value: "h2", label: "H2" },
            { value: "h3", label: "H3" },
          ]}
          onChange={(v) => setContent({ tag: v })}
        />
      </Section>
      <Section title="Animação">
        <SelectField
          label="Tipo"
          value={(content.animation as string) ?? "fade"}
          options={[
            { value: "fade", label: "Fade (suave)" },
            { value: "slide", label: "Slide (deslizar)" },
            { value: "typed", label: "Typed (digitando)" },
            { value: "highlight", label: "Highlight (destaque)" },
          ]}
          onChange={(v) => setContent({ animation: v })}
        />
        <NumberField
          label="Intervalo (ms)"
          value={(content.intervalMs as number) ?? 2200}
          min={800}
          max={10000}
          step={200}
          onChange={(v) => setContent({ intervalMs: v })}
        />
        <ColorField
          label="Cor de destaque"
          value={(content.highlightColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ highlightColor: v })}
        />
      </Section>
    </>
  );
}

function PriceTableContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const features =
    (content.features as Array<{ id: string; text: string; included: boolean }>) ?? [];
  return (
    <>
      <Section title="Cabeçalho">
        <TextField
          label="Badge (opcional)"
          value={(content.badge as string) ?? ""}
          onChange={(v) => setContent({ badge: v })}
        />
        <TextField
          label="Título"
          value={(content.title as string) ?? ""}
          onChange={(v) => setContent({ title: v })}
        />
        <TextField
          label="Subtítulo"
          value={(content.subtitle as string) ?? ""}
          onChange={(v) => setContent({ subtitle: v })}
        />
      </Section>
      <Section title="Preço">
        <TextField
          label="Moeda"
          value={(content.currency as string) ?? "R$"}
          onChange={(v) => setContent({ currency: v })}
        />
        <TextField
          label="Valor"
          value={(content.price as string) ?? ""}
          onChange={(v) => setContent({ price: v })}
        />
        <TextField
          label="Período"
          value={(content.period as string) ?? "/mês"}
          onChange={(v) => setContent({ period: v })}
        />
      </Section>
      <ListEditor
        title="Recursos"
        items={features}
        onChange={(next) => setContent({ features: next })}
        itemLabel={(it) => it.text || "Recurso"}
        newItem={() => ({ id: `pf_${nanoid(6)}`, text: "Novo recurso", included: true })}
        renderFields={(item, update) => (
          <>
            <TextField label="Texto" value={item.text} onChange={(v) => update({ text: v })} />
            <SelectField
              label="Incluído?"
              value={item.included ? "yes" : "no"}
              options={[
                { value: "yes", label: "Sim ✓" },
                { value: "no", label: "Não ✗" },
              ]}
              onChange={(v) => update({ included: v === "yes" })}
            />
          </>
        )}
      />
      <Section title="CTA">
        <TextField
          label="Texto do botão"
          value={(content.ctaText as string) ?? ""}
          onChange={(v) => setContent({ ctaText: v })}
        />
        <TextField
          label="Link"
          value={(content.ctaHref as string) ?? "#"}
          onChange={(v) => setContent({ ctaHref: v })}
        />
      </Section>
      <Section title="Aparência">
        <SelectField
          label="Destacado"
          value={(content.highlighted as boolean) ? "yes" : "no"}
          options={[
            { value: "no", label: "Não" },
            { value: "yes", label: "Sim (com borda colorida)" },
          ]}
          onChange={(v) => setContent({ highlighted: v === "yes" })}
        />
        <ColorField
          label="Fundo do card"
          value={(content.cardBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ cardBg: v })}
        />
        <ColorField
          label="Cor do texto"
          value={(content.textColor as string) ?? "#1a1a1a"}
          onChange={(v) => setContent({ textColor: v })}
        />
        <ColorField
          label="Cor de destaque"
          value={(content.accentColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ accentColor: v })}
        />
        <ColorField
          label="Fundo do CTA"
          value={(content.ctaBg as string) ?? "#e63946"}
          onChange={(v) => setContent({ ctaBg: v })}
        />
        <ColorField
          label="Cor do CTA"
          value={(content.ctaColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ ctaColor: v })}
        />
        <NumberField
          label="Raio (px)"
          value={(content.borderRadius as number) ?? 12}
          min={0}
          max={32}
          onChange={(v) => setContent({ borderRadius: v })}
        />
      </Section>
    </>
  );
}

function CtaBoxContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  return (
    <>
      <Section title="Conteúdo">
        <TextField
          label="Título"
          value={(content.title as string) ?? ""}
          onChange={(v) => setContent({ title: v })}
        />
        <TextareaField
          label="Descrição"
          value={(content.description as string) ?? ""}
          onChange={(v) => setContent({ description: v })}
          rows={3}
        />
      </Section>
      <Section title="Botões">
        <TextField
          label="Botão primário (texto)"
          value={(content.primaryText as string) ?? ""}
          onChange={(v) => setContent({ primaryText: v })}
        />
        <TextField
          label="Botão primário (link)"
          value={(content.primaryHref as string) ?? "#"}
          onChange={(v) => setContent({ primaryHref: v })}
        />
        <TextField
          label="Botão secundário (texto, opcional)"
          value={(content.secondaryText as string) ?? ""}
          onChange={(v) => setContent({ secondaryText: v })}
        />
        <TextField
          label="Botão secundário (link)"
          value={(content.secondaryHref as string) ?? "#"}
          onChange={(v) => setContent({ secondaryHref: v })}
        />
      </Section>
      <Section title="Layout">
        <SelectField
          label="Disposição"
          value={(content.layout as string) ?? "centered"}
          options={[
            { value: "centered", label: "Centralizado" },
            { value: "split", label: "Dividido (texto + imagem)" },
          ]}
          onChange={(v) => setContent({ layout: v })}
        />
        <BuilderImageUrlField
          label="Imagem (layout dividido)"
          value={(content.imageUrl as string) ?? ""}
          onChange={(v) => setContent({ imageUrl: v })}
          placeholder="https://… ou Carregar do PC"
        />
      </Section>
      <Section title="Aparência">
        <ColorField
          label="Fundo"
          value={(content.background as string) ?? "#0f172a"}
          onChange={(v) => setContent({ background: v })}
        />
        <TextField
          label="Gradiente CSS (opcional)"
          value={(content.gradient as string) ?? ""}
          placeholder="linear-gradient(...)"
          onChange={(v) => setContent({ gradient: v })}
        />
        <ColorField
          label="Cor do texto"
          value={(content.textColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ textColor: v })}
        />
        <ColorField
          label="Fundo do botão primário"
          value={(content.primaryBg as string) ?? "#e63946"}
          onChange={(v) => setContent({ primaryBg: v })}
        />
        <ColorField
          label="Cor do botão primário"
          value={(content.primaryColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ primaryColor: v })}
        />
        <NumberField
          label="Raio (px)"
          value={(content.borderRadius as number) ?? 16}
          min={0}
          max={48}
          onChange={(v) => setContent({ borderRadius: v })}
        />
      </Section>
    </>
  );
}

function FlipBoxContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  return (
    <>
      <Section title="Frente">
        <TextField
          label="Ícone (emoji)"
          value={(content.frontIcon as string) ?? ""}
          onChange={(v) => setContent({ frontIcon: v })}
        />
        <TextField
          label="Título"
          value={(content.frontTitle as string) ?? ""}
          onChange={(v) => setContent({ frontTitle: v })}
        />
        <TextField
          label="Subtítulo"
          value={(content.frontSubtitle as string) ?? ""}
          onChange={(v) => setContent({ frontSubtitle: v })}
        />
        <ColorField
          label="Fundo"
          value={(content.frontBg as string) ?? "#1f2937"}
          onChange={(v) => setContent({ frontBg: v })}
        />
        <ColorField
          label="Cor do texto"
          value={(content.frontTextColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ frontTextColor: v })}
        />
      </Section>
      <Section title="Verso">
        <TextField
          label="Título"
          value={(content.backTitle as string) ?? ""}
          onChange={(v) => setContent({ backTitle: v })}
        />
        <TextareaField
          label="Descrição"
          value={(content.backDescription as string) ?? ""}
          onChange={(v) => setContent({ backDescription: v })}
          rows={3}
        />
        <TextField
          label="CTA (texto, opcional)"
          value={(content.backCtaText as string) ?? ""}
          onChange={(v) => setContent({ backCtaText: v })}
        />
        <TextField
          label="CTA (link)"
          value={(content.backCtaHref as string) ?? "#"}
          onChange={(v) => setContent({ backCtaHref: v })}
        />
        <ColorField
          label="Fundo"
          value={(content.backBg as string) ?? "#e63946"}
          onChange={(v) => setContent({ backBg: v })}
        />
        <ColorField
          label="Cor do texto"
          value={(content.backTextColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ backTextColor: v })}
        />
        <ColorField
          label="Fundo do CTA"
          value={(content.backCtaBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ backCtaBg: v })}
        />
        <ColorField
          label="Cor do CTA"
          value={(content.backCtaColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ backCtaColor: v })}
        />
      </Section>
      <Section title="Comportamento">
        <SelectField
          label="Gatilho do flip"
          value={(content.trigger as string) ?? "hover"}
          options={[
            { value: "hover", label: "Hover (mouse)" },
            { value: "click", label: "Click (toque)" },
          ]}
          onChange={(v) => setContent({ trigger: v })}
        />
        <SelectField
          label="Direção"
          value={(content.flipDirection as string) ?? "horizontal"}
          options={[
            { value: "horizontal", label: "Horizontal" },
            { value: "vertical", label: "Vertical" },
          ]}
          onChange={(v) => setContent({ flipDirection: v })}
        />
        <NumberField
          label="Altura (px)"
          value={(content.height as number) ?? 280}
          min={120}
          max={600}
          onChange={(v) => setContent({ height: v })}
        />
        <NumberField
          label="Raio (px)"
          value={(content.borderRadius as number) ?? 12}
          min={0}
          max={32}
          onChange={(v) => setContent({ borderRadius: v })}
        />
      </Section>
    </>
  );
}

function ProgressTrackerContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const items =
    (content.items as Array<{ id: string; label: string; value: number; color?: string }>) ?? [];
  type PItem = { id: string; label: string; value: number; color?: string };
  return (
    <>
      <ListEditor
        title="Itens de progresso"
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => `${it.label} — ${it.value}%`}
        newItem={() => ({ id: `pb_${nanoid(6)}`, label: "Novo", value: 50, color: "" }) as PItem}
        renderFields={(item, update) => (
          <>
            <TextField label="Rótulo" value={item.label} onChange={(v) => update({ label: v })} />
            <NumberField
              label="Valor (0-100)"
              value={item.value}
              min={0}
              max={100}
              onChange={(v) => update({ value: Math.max(0, Math.min(100, v)) })}
            />
            <ColorField
              label="Cor (opcional)"
              value={item.color ?? ""}
              onChange={(v) => update({ color: v })}
            />
          </>
        )}
      />
      <Section title="Estilo">
        <SelectField
          label="Tipo"
          value={(content.variant as string) ?? "bar"}
          options={[
            { value: "bar", label: "Barras horizontais" },
            { value: "circle", label: "Círculos (SVG)" },
          ]}
          onChange={(v) => setContent({ variant: v })}
        />
        <SelectField
          label="Mostrar percentual"
          value={(content.showPercent as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: "Sim" },
            { value: "no", label: "Não" },
          ]}
          onChange={(v) => setContent({ showPercent: v === "yes" })}
        />
        <SelectField
          label="Animar ao entrar na tela"
          value={(content.animate as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: "Sim" },
            { value: "no", label: "Não" },
          ]}
          onChange={(v) => setContent({ animate: v === "yes" })}
        />
        <NumberField
          label="Altura da barra (px)"
          value={(content.height as number) ?? 10}
          min={4}
          max={40}
          onChange={(v) => setContent({ height: v })}
        />
        <NumberField
          label="Espaço entre itens (px)"
          value={(content.gap as number) ?? 20}
          min={4}
          max={60}
          onChange={(v) => setContent({ gap: v })}
        />
        <ColorField
          label="Cor do trilho"
          value={(content.trackColor as string) ?? "#e5e7eb"}
          onChange={(v) => setContent({ trackColor: v })}
        />
        <ColorField
          label="Cor do preenchimento"
          value={(content.fillColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ fillColor: v })}
        />
        <ColorField
          label="Cor do rótulo"
          value={(content.labelColor as string) ?? "#1a1a1a"}
          onChange={(v) => setContent({ labelColor: v })}
        />
      </Section>
    </>
  );
}
