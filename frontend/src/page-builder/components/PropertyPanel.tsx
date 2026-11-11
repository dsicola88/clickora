import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useBuilder, resolveResponsive } from "../store";
import type {
  BaseStyles,
  ColumnNode,
  DeviceType,
  FlexAlign,
  FlexDirection,
  FlexJustify,
  FlexWrapMode,
  ResponsiveStyles,
  ResponsiveValue,
  SectionNode,
  ShapeDividerConfig,
  SpacingValue,
  TypographyValue,
  WidgetNode,
  WidgetType,
} from "../types";
import { SHAPE_DIVIDER_PRESETS } from "../section-chrome";
import { WIDGET_NAME_KEY, WIDGET_REGISTRY } from "../widget-registry";
import { locateWidget } from "../widget-tree";
import { Settings2, Trash2, Plus, GripVertical, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { decomposeMirrorHtmlToWidgets } from "@/lib/mirrorHtmlToEditableWidgets";
import { useHtmlFoldEdit } from "../htmlFoldEdit";
import type { FormField } from "../widgets/FormWidget";
import type { SocialNetwork } from "../widgets/SocialIconsWidget";
import type { TabItem } from "../widgets/TabsWidget";
import { ButtonWidgetEditor } from "./editors/ButtonWidgetEditor";
import { WidgetEffectsEditor } from "./WidgetEffectsEditor";
import { WidgetInteractionsEditor } from "./WidgetInteractionsEditor";
import { WidgetConditionsEditor, WidgetMaskEditor } from "./WidgetConditionsEditor";
import type { WidgetConditions, WidgetEffects, WidgetInteraction } from "../types";
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
  CookieBannerContentEditor,
  DateContentEditor,
  InfoBoxContentEditor,
  PhoneCallContentEditor,
  ReadingProgressContentEditor,
  StickyVideoContentEditor,
  TickerContentEditor,
} from "./extra-widgets-editors";
import type { NavItem, NavStickyMode } from "../widgets/NavMenuWidget";
import {
  TYPOGRAPHY_FONT_PRESETS,
  TYPOGRAPHY_SIZE_PRESETS,
  TYPOGRAPHY_WEIGHT_LABELS,
  ensureFontFamilyLoaded,
  matchFontPresetId,
} from "../typography-presets";

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

  const located = locateWidget(column.widgets, selection.id);
  const widget = located ? located.list[located.index] : undefined;
  if (!widget) return <EmptyPanel />;
  return <WidgetPanel section={section} column={column} widget={widget} device={device} />;
}

function EmptyPanel() {
  const { t } = useAppLocale();
  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-4 border-l border-editor-border bg-editor-panel p-6 text-center text-editor-fg-muted">
      <div className="rounded-full bg-editor-panel-2 p-4">
        <Settings2 className="h-6 w-6" />
      </div>
      <div className="space-y-2 max-w-[220px]">
        <p className="text-sm font-medium text-editor-fg">{t("pages.pageBuilder.panel.nothingSelected")}</p>
        <p className="text-[11px] leading-relaxed">
          {t("pages.pageBuilder.panel.emptyBeforeWidget")}{" "}
          <span className="font-semibold text-editor-fg">{t("pages.pageBuilder.panel.widgetWord")}</span>{" "}
          {t("pages.pageBuilder.panel.emptyAfterWidget")}
        </p>
        <p className="text-[11px] leading-relaxed">
          {t("pages.pageBuilder.panel.emptyFrameBefore")}{" "}
          <span className="font-semibold text-editor-section">{t("pages.pageBuilder.panel.emptyGreen")}</span>{" "}
          {t("pages.pageBuilder.panel.emptyFrameMid")}{" "}
          <span className="font-semibold text-editor-widget">{t("pages.pageBuilder.panel.emptyRed")}</span>{" "}
          {t("pages.pageBuilder.panel.emptyFrameAfter")}
        </p>
      </div>
    </aside>
  );
}

type BreadcrumbCrumb = {
  label: string;
  color: string;
  onClick?: () => void;
};

function SelectionBreadcrumb({ crumbs }: { crumbs: BreadcrumbCrumb[] }) {
  const { t } = useAppLocale();
  if (crumbs.length === 0) return null;
  return (
    <nav
      aria-label={t("pages.pageBuilder.panel.breadcrumbAria")}
      className="flex flex-wrap items-center gap-1 border-b border-editor-border bg-editor-panel-2/50 px-3 py-1.5"
    >
      {crumbs.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-1">
          {i > 0 ? <span className="text-[10px] text-editor-fg-muted">›</span> : null}
          {c.onClick ? (
            <button
              type="button"
              onClick={c.onClick}
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
              style={{ background: c.color }}
              title={fill(t("pages.pageBuilder.panel.selectCrumb"), { label: c.label })}
            >
              {c.label}
            </button>
          ) : (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
              style={{ background: c.color }}
            >
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
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
  breadcrumb,
  hint,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  tabs: Array<{ id: Tab; label: string }>;
  active: Tab;
  onTab: (t: Tab) => void;
  children: React.ReactNode;
  breadcrumb?: BreadcrumbCrumb[];
  hint?: React.ReactNode;
}) {
  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-editor-border bg-editor-panel text-editor-fg">
      {breadcrumb ? <SelectionBreadcrumb crumbs={breadcrumb} /> : null}
      <div className="border-b border-editor-border p-3">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            style={{ background: badgeColor }}
          >
            {badge}
          </span>
          <h3 className="text-sm font-medium truncate">{title}</h3>
        </div>
        {hint ? <div className="mt-2">{hint}</div> : null}
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

/** Lista rápida de widgets da secção — evita ficar preso só nas opções de layout. */
function SectionElementsPicker({ section }: { section: SectionNode }) {
  const { t } = useAppLocale();
  const select = useBuilder((s) => s.select);
  const items: Array<{
    id: string;
    columnId: string;
    label: string;
    type: WidgetType;
  }> = [];
  for (const col of section.columns) {
    for (const w of col.widgets) {
      const def = WIDGET_REGISTRY[w.type];
      items.push({
        id: w.id,
        columnId: col.id,
        label: def ? t(WIDGET_NAME_KEY[w.type]) : w.type,
        type: w.type,
      });
    }
  }
  if (items.length === 0) {
    return (
      <Section title={t("pages.pageBuilder.panel.elementsInSection")}>
        <p className="text-[11px] leading-relaxed text-editor-fg-muted">
          {t("pages.pageBuilder.panel.elementsEmpty")}
        </p>
      </Section>
    );
  }
  return (
    <Section title={t("pages.pageBuilder.panel.elementsInSection")}>
      <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1 mb-1.5">
        {t("pages.pageBuilder.panel.elementsHint")}
      </p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() =>
                select({
                  kind: "widget",
                  sectionId: section.id,
                  columnId: it.columnId,
                  id: it.id,
                })
              }
              className="flex w-full items-center gap-2 rounded-md border border-editor-border bg-editor-panel-2 px-2.5 py-2 text-left transition-colors hover:border-editor-widget hover:bg-editor-widget/10"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-editor-widget/20 text-[10px] font-bold text-editor-widget">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-editor-fg">{it.label}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-editor-fg-muted">{it.type}</span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
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
  const { t } = useAppLocale();
  const [tab, setTab] = useState<Tab>("content");
  const updateWidget = useBuilder((s) => s.updateWidget);

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

  const select = useBuilder((s) => s.select);
  const removeWidget = useBuilder((s) => s.removeWidget);
  const insertWidgetNode = useBuilder((s) => s.insertWidgetNode);
  const colIndex = Math.max(0, section.columns.findIndex((c) => c.id === column.id));
  const foldSelection = useHtmlFoldEdit((s) => s.selection);
  const foldApply = useHtmlFoldEdit((s) => s.applyPatch);
  const foldActive = widget.type === "html" && foldSelection?.widgetId === widget.id;

  const updateSettings = useBuilder((s) => s.updateSettings);
  const convertHtmlToBlocks = () => {
    if (widget.type !== "html") return;
    const ok = window.confirm(t("pages.pageBuilder.panel.convertConfirm"));
    if (!ok) return;
    const code = String(widget.content.code ?? "");
    const parts = decomposeMirrorHtmlToWidgets(code);
    const natives = parts.filter((w) =>
      ["heading", "text", "image", "button", "video", "divider"].includes(w.type),
    );
    if (natives.length < 1) {
      toast.error(t("pages.pageBuilder.panel.convertFailed"));
      return;
    }
    const idx = column.widgets.findIndex((w) => w.id === widget.id);
    removeWidget(section.id, column.id, widget.id);
    parts.forEach((part, i) => {
      insertWidgetNode(section.id, column.id, part, idx < 0 ? undefined : idx + i);
    });
    updateSettings({ htmlFoldMode: "blocks" });
    const first = parts[0];
    if (first) {
      select({
        kind: "widget",
        id: first.id,
        sectionId: section.id,
        columnId: column.id,
      });
    }
    toast.message(t("pages.pageBuilder.panel.converted"));
  };

  return (
    <PanelShell
      title={t(WIDGET_NAME_KEY[widget.type])}
      badge={t("pages.pageBuilder.element")}
      badgeColor="var(--editor-widget)"
      breadcrumb={[
        {
          label: t("pages.pageBuilder.section"),
          color: "var(--editor-section)",
          onClick: () => select({ kind: "section", id: section.id }),
        },
        {
          label: fill(t("pages.pageBuilder.columnN"), { n: colIndex + 1 }),
          color: "var(--editor-column)",
          onClick: () =>
            select({ kind: "column", sectionId: section.id, id: column.id }),
        },
        { label: t(WIDGET_NAME_KEY[widget.type]), color: "var(--editor-widget)" },
      ]}
      hint={
        <p className="text-[10px] leading-relaxed text-editor-fg-muted">
          {t("pages.pageBuilder.panel.editingHint")}
        </p>
      }
      tabs={[
        { id: "content", label: t("pages.pageBuilder.content") },
        { id: "style", label: t("pages.pageBuilder.style") },
        { id: "advanced", label: t("pages.pageBuilder.advanced") },
      ]}
      active={tab}
      onTab={setTab}
    >
      {tab === "content" && (
        <WidgetContentTab
          widget={widget}
          section={section}
          setContent={setContent}
          onConvertHtmlToBlocks={widget.type === "html" ? convertHtmlToBlocks : undefined}
          foldSelection={foldActive ? foldSelection : null}
          onFoldPatch={foldActive ? foldApply : null}
        />
      )}
      {tab === "style" && (
        <WidgetStyleTab widget={widget} device={device} setStyles={setStyles} />
      )}
      {tab === "advanced" && (
        <AdvancedTab
          styles={widget.styles}
          cssId={widget.cssId}
          cssClasses={widget.cssClasses}
          widgetCustomCss={widget.customCss}
          device={device}
          onStyles={setStyles}
          onCssId={(v) => updateWidget(section.id, column.id, widget.id, { cssId: v })}
          onClasses={(v) =>
            updateWidget(section.id, column.id, widget.id, { cssClasses: v })
          }
          onWidgetCustomCss={(v) =>
            updateWidget(section.id, column.id, widget.id, { customCss: v })
          }
          showLayout
          effects={widget.effects}
          onEffects={(effects) =>
            updateWidget(section.id, column.id, widget.id, { effects })
          }
          effectsWidget={widget}
          interactions={widget.interactions}
          onInteractions={(interactions) =>
            updateWidget(section.id, column.id, widget.id, { interactions })
          }
          conditions={widget.conditions}
          onConditions={(conditions) =>
            updateWidget(section.id, column.id, widget.id, { conditions })
          }
          cssMask={widget.cssMask}
          cssMaskCustom={widget.cssMaskCustom}
          onMask={(patch) => updateWidget(section.id, column.id, widget.id, patch)}
        />
      )}
    </PanelShell>
  );
}

function WidgetContentTab({
  widget,
  section,
  setContent,
  onConvertHtmlToBlocks,
  foldSelection,
  onFoldPatch,
}: {
  widget: WidgetNode;
  section: SectionNode;
  setContent: (p: Record<string, unknown>) => void;
  onConvertHtmlToBlocks?: () => void;
  foldSelection?: ReturnType<typeof useHtmlFoldEdit.getState>["selection"];
  onFoldPatch?: ((patch: { text?: string; href?: string; src?: string; alt?: string; color?: string; background?: string }) => void) | null;
}) {
  const c = widget.content;
  const { t } = useAppLocale();
  switch (widget.type) {
    case "heading":
      return (
        <Section title={t("pages.pageBuilder.widgets.fields.title")}>
          <TextareaField
            label={t("pages.pageBuilder.widgets.fields.title")}
            value={(c.text as string) ?? ""}
            onChange={(v) => setContent({ text: v })}
            placeholder={t("pages.pageBuilder.widgets.content.headingPh")}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.fields.linkOptional")}
            value={(c.link as string) ?? ""}
            onChange={(v) => setContent({ link: v })}
            placeholder="https://…"
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.openLink")}
            value={((c.linkTarget as string) ?? "_self") as string}
            options={[
              { value: "_self", label: t("pages.pageBuilder.widgets.opt.sameWindow") },
              { value: "_blank", label: t("pages.pageBuilder.widgets.opt.newWindow") },
            ]}
            onChange={(v) => setContent({ linkTarget: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.nofollow")}
            value={(c.linkNofollow as boolean) ? "yes" : "no"}
            options={[
              { value: "no", label: t("common.no") },
              { value: "yes", label: t("pages.pageBuilder.widgets.opt.nofollowYes") },
            ]}
            onChange={(v) => setContent({ linkNofollow: v === "yes" })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.htmlTag")}
            value={(c.tag as string) ?? "h2"}
            options={[
              ...["h1", "h2", "h3", "h4", "h5", "h6"].map((t) => ({ value: t, label: t.toUpperCase() })),
              { value: "p", label: "P" },
              { value: "div", label: "DIV" },
              { value: "span", label: "SPAN" },
            ]}
            onChange={(v) => setContent({ tag: v })}
          />
        </Section>
      );
    case "text":
      return (
        <Section title={t("pages.pageBuilder.content")}>
          <TextareaField
            label={t("pages.pageBuilder.widgets.content.textHtml")}
            value={(c.html as string) ?? ""}
            onChange={(v) => setContent({ html: v })}
            rows={8}
          />
        </Section>
      );
    case "image":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.image")}>
          <BuilderImageUrlField
            label={t("pages.pageBuilder.widgets.content.imageUrl")}
            value={(c.src as string) ?? ""}
            onChange={(v) => setContent({ src: v })}
            placeholder="https://…"
          />
          <TextField
            label={t("pages.pageBuilder.widgets.content.alt")}
            value={(c.alt as string) ?? ""}
            onChange={(v) => setContent({ alt: v })}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.content.caption")}
            value={(c.caption as string) ?? ""}
            onChange={(v) => setContent({ caption: v })}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.fields.linkOptional")}
            value={(c.link as string) ?? ""}
            onChange={(v) => setContent({ link: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.objectFit")}
            value={(c.objectFit as string) ?? "cover"}
            options={[
              { value: "cover", label: t("pages.pageBuilder.widgets.opt.fitCover") },
              { value: "contain", label: t("pages.pageBuilder.widgets.opt.fitContain") },
              { value: "fill", label: t("pages.pageBuilder.widgets.opt.fitFill") },
              { value: "none", label: t("pages.pageBuilder.widgets.opt.fitNone") },
              { value: "scale-down", label: t("pages.pageBuilder.widgets.opt.fitScale") },
            ]}
            onChange={(v) => setContent({ objectFit: v })}
          />
          <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
            {t("pages.pageBuilder.widgets.content.imageHint")}
          </p>
        </Section>
      );
    case "button":
      return <ButtonWidgetEditor widget={widget} setContent={setContent} />;
    case "video":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.video")}>
          <p className="text-[11px] leading-relaxed text-editor-fg-muted -mt-1 mb-1">
            {t("pages.pageBuilder.widgets.content.videoWhere")}{" "}
            <span className="font-semibold text-editor-fg">{t("pages.pageBuilder.content")}</span>.
          </p>
          <TextareaField
            label={t("pages.pageBuilder.widgets.content.videoUrl")}
            value={(c.url as string) ?? ""}
            onChange={(v) => setContent({ url: v })}
            rows={4}
            placeholder={t("pages.pageBuilder.widgets.content.videoPh")}
          />
          <p className="text-[10px] leading-relaxed text-editor-fg-muted">
            <span className="font-semibold text-editor-fg">{t("pages.pageBuilder.widgets.content.ytLabel")}</span>{" "}
            {t("pages.pageBuilder.widgets.content.ytBody")}{" "}
            <span className="font-semibold text-editor-fg">{t("pages.pageBuilder.widgets.content.bunnyLabel")}</span>{" "}
            {t("pages.pageBuilder.widgets.content.bunnyBody")}
          </p>
          <SelectField
            label={t("pages.pageBuilder.widgets.content.autoplay")}
            value={(c.autoplay as boolean) ? "yes" : "no"}
            options={[
              { value: "no", label: t("common.no") },
              { value: "yes", label: t("pages.pageBuilder.widgets.opt.autoplayMuted") },
            ]}
            onChange={(v) => setContent({ autoplay: v === "yes" })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.controls")}
            value={(c.controls as boolean) !== false ? "yes" : "no"}
            options={[
              { value: "yes", label: t("pages.pageBuilder.widgets.opt.visible") },
              { value: "no", label: t("pages.pageBuilder.widgets.opt.hidden") },
            ]}
            onChange={(v) => setContent({ controls: v === "yes" })}
          />
          <p className="text-[10px] leading-relaxed text-editor-fg-muted">
            {t("pages.pageBuilder.widgets.content.videoAlign")}
          </p>
        </Section>
      );
    case "icon":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.icon")}>
          <TextField
            label={t("pages.pageBuilder.widgets.content.iconName")}
            value={(c.name as string) ?? ""}
            onChange={(v) => setContent({ name: v })}
            placeholder={t("pages.pageBuilder.widgets.content.iconPh")}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.fields.sizePx")}
            value={(c.size as number) ?? 48}
            onChange={(v) => setContent({ size: v })}
            min={8}
            max={256}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.fields.linkOptional")}
            value={(c.link as string) ?? ""}
            onChange={(v) => setContent({ link: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.fields.shape")}
            value={(c.shape as string) ?? "none"}
            options={[
              { value: "none", label: t("pages.pageBuilder.widgets.opt.noneFem") },
              { value: "circle", label: t("pages.pageBuilder.widgets.opt.circle") },
              { value: "square", label: t("pages.pageBuilder.widgets.opt.square") },
            ]}
            onChange={(v) => setContent({ shape: v })}
          />
          {(c.shape as string) === "circle" || (c.shape as string) === "square" ? (
            <ColorField
              label={t("pages.pageBuilder.widgets.content.shapeBg")}
              value={(c.shapeBg as string) ?? "#f1f5f9"}
              onChange={(v) => setContent({ shapeBg: v })}
            />
          ) : null}
        </Section>
      );
    case "divider":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.divider")}>
          <SelectField
            label={t("pages.pageBuilder.style")}
            value={(c.style as string) ?? "solid"}
            options={[
              { value: "solid", label: t("pages.pageBuilder.widgets.opt.solid") },
              { value: "dashed", label: t("pages.pageBuilder.widgets.opt.dashed") },
              { value: "dotted", label: t("pages.pageBuilder.widgets.opt.dotted") },
            ]}
            onChange={(v) => setContent({ style: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.content.thickness")}
            value={(c.weight as number) ?? 1}
            onChange={(v) => setContent({ weight: v })}
            min={1}
            max={20}
          />
        </Section>
      );
    case "spacer":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.spacer")}>
          <p className="text-xs text-editor-fg-muted">{t("pages.pageBuilder.widgets.content.spacerHint")}</p>
        </Section>
      );
    case "html":
      return (
        <>
          <Section title={t("pages.pageBuilder.widgets.content.faithful")}>
            <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
              {t("pages.pageBuilder.widgets.content.faithfulHint")}
            </p>
            {!foldSelection ? (
              <p className="rounded-md border border-dashed border-editor-border bg-editor-panel/50 px-2 py-2 text-[10px] text-editor-fg-muted">
                {t("pages.pageBuilder.widgets.content.faithfulEmpty")}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-editor-fg-muted">
                  {foldSelection.kind} · {foldSelection.tagName}
                </p>
                {(foldSelection.kind === "heading" ||
                  foldSelection.kind === "text" ||
                  foldSelection.kind === "button" ||
                  foldSelection.kind === "link") && (
                  <TextareaField
                    label={t("pages.pageBuilder.widgets.fields.text")}
                    value={foldSelection.text}
                    onChange={(v) => onFoldPatch?.({ text: v })}
                    rows={3}
                  />
                )}
                {(foldSelection.kind === "button" || foldSelection.kind === "link") && (
                  <TextField
                    label={t("pages.pageBuilder.widgets.content.href")}
                    value={foldSelection.href}
                    onChange={(v) => onFoldPatch?.({ href: v })}
                    placeholder="https://…"
                  />
                )}
                {foldSelection.kind === "image" && (
                  <>
                    <BuilderImageUrlField
                      label={t("pages.pageBuilder.widgets.content.replaceImage")}
                      value={foldSelection.src}
                      onChange={(v) => onFoldPatch?.({ src: v })}
                      placeholder={t("pages.pageBuilder.widgets.content.replaceImagePh")}
                    />
                    <TextField
                      label={t("pages.pageBuilder.widgets.content.alt")}
                      value={foldSelection.alt}
                      onChange={(v) => onFoldPatch?.({ alt: v })}
                    />
                  </>
                )}
                <ColorField
                  label={t("pages.pageBuilder.panel.textColor")}
                  value={foldSelection.color}
                  onChange={(v) => onFoldPatch?.({ color: v })}
                />
                <ColorField
                  label={t("pages.pageBuilder.widgets.content.bgColor")}
                  value={foldSelection.background}
                  onChange={(v) => onFoldPatch?.({ background: v })}
                />
              </div>
            )}
          </Section>
          <Section title={t("pages.pageBuilder.widgets.content.advancedHtml")}>
            {onConvertHtmlToBlocks ? (
              <button
                type="button"
                onClick={onConvertHtmlToBlocks}
                className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-editor-border bg-editor-panel px-3 py-2 text-[11px] font-medium text-editor-fg-muted hover:bg-editor-hover hover:text-editor-fg"
              >
                <Wand2 className="h-3.5 w-3.5" />
                {t("pages.pageBuilder.widgets.content.decompose")}
              </button>
            ) : null}
            <TextareaField
              label={t("pages.pageBuilder.widgets.content.htmlCode")}
              value={(c.code as string) ?? ""}
              onChange={(v) => setContent({ code: v })}
              rows={8}
            />
          </Section>
        </>
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
    case "livePlans":
      return <LivePlansContentEditor content={c} setContent={setContent} />;
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
      return (
        <NavMenuContentEditor content={c} setContent={setContent} section={section} />
      );
    case "ticker":
      return <TickerContentEditor content={c} setContent={setContent} />;
    case "infoBox":
      return <InfoBoxContentEditor content={c} setContent={setContent} />;
    case "imageBox":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.imageBox")}>
          <BuilderImageUrlField
            label={t("pages.pageBuilder.widgets.content.imageUrl")}
            value={(c.src as string) ?? ""}
            onChange={(v) => setContent({ src: v })}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.content.alt")}
            value={(c.alt as string) ?? ""}
            onChange={(v) => setContent({ alt: v })}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.fields.title")}
            value={(c.title as string) ?? ""}
            onChange={(v) => setContent({ title: v })}
          />
          <TextareaField
            label={t("pages.pageBuilder.widgets.fields.description")}
            value={(c.description as string) ?? ""}
            onChange={(v) => setContent({ description: v })}
            rows={3}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.fields.linkOptional")}
            value={(c.href as string) ?? ""}
            onChange={(v) => setContent({ href: v })}
            placeholder="https://…"
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.content.imageHeight")}
            value={(c.imageHeight as number) ?? 200}
            min={80}
            max={800}
            onChange={(v) => setContent({ imageHeight: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.objectFit")}
            value={(c.objectFit as string) ?? "cover"}
            options={[
              { value: "cover", label: t("pages.pageBuilder.widgets.opt.coverShort") },
              { value: "contain", label: t("pages.pageBuilder.widgets.opt.containShort") },
            ]}
            onChange={(v) => setContent({ objectFit: v })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.fields.titleColor")}
            value={(c.titleColor as string) ?? "#0f172a"}
            onChange={(v) => setContent({ titleColor: v })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.fields.descColor")}
            value={(c.descColor as string) ?? "#64748b"}
            onChange={(v) => setContent({ descColor: v })}
          />
        </Section>
      );
    case "starRating":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.rating")}>
          <TextField
            label={t("pages.pageBuilder.widgets.content.titleOptional")}
            value={(c.title as string) ?? ""}
            onChange={(v) => setContent({ title: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.content.score")}
            value={(c.rating as number) ?? 4.5}
            min={0}
            max={10}
            step={0.1}
            onChange={(v) => setContent({ rating: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.content.maxStars")}
            value={(c.max as number) ?? 5}
            min={1}
            max={10}
            onChange={(v) => setContent({ max: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.fields.sizePx")}
            value={(c.size as number) ?? 22}
            min={12}
            max={48}
            onChange={(v) => setContent({ size: v })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.content.filled")}
            value={(c.color as string) ?? "#f59e0b"}
            onChange={(v) => setContent({ color: v })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.content.empty")}
            value={(c.emptyColor as string) ?? "#e5e7eb"}
            onChange={(v) => setContent({ emptyColor: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.showScore")}
            value={(c.showScore as boolean) !== false ? "yes" : "no"}
            options={[
              { value: "yes", label: t("common.yes") },
              { value: "no", label: t("common.no") },
            ]}
            onChange={(v) => setContent({ showScore: v === "yes" })}
          />
        </Section>
      );
    case "counter":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.counter")}>
          <NumberField
            label={t("pages.pageBuilder.widgets.content.start")}
            value={(c.start as number) ?? 0}
            onChange={(v) => setContent({ start: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.content.end")}
            value={(c.end as number) ?? 1000}
            onChange={(v) => setContent({ end: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.fields.durationMs")}
            value={(c.durationMs as number) ?? 1600}
            min={200}
            max={10000}
            onChange={(v) => setContent({ durationMs: v })}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.fields.prefix")}
            value={(c.prefix as string) ?? ""}
            onChange={(v) => setContent({ prefix: v })}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.fields.suffix")}
            value={(c.suffix as string) ?? ""}
            onChange={(v) => setContent({ suffix: v })}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.fields.title")}
            value={(c.title as string) ?? ""}
            onChange={(v) => setContent({ title: v })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.content.numberColor")}
            value={(c.numberColor as string) ?? "#0f172a"}
            onChange={(v) => setContent({ numberColor: v })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.fields.titleColor")}
            value={(c.titleColor as string) ?? "#64748b"}
            onChange={(v) => setContent({ titleColor: v })}
          />
        </Section>
      );
    case "googleMaps":
      return (
        <Section title="Google Maps">
          <TextField
            label={t("pages.pageBuilder.widgets.content.address")}
            value={(c.query as string) ?? ""}
            onChange={(v) => setContent({ query: v })}
            placeholder={t("pages.pageBuilder.widgets.content.addressPh")}
          />
          <NumberField
            label="Zoom"
            value={(c.zoom as number) ?? 14}
            min={1}
            max={21}
            onChange={(v) => setContent({ zoom: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.fields.heightPx")}
            value={(c.height as number) ?? 320}
            min={120}
            max={800}
            onChange={(v) => setContent({ height: v })}
          />
          <TextareaField
            label={t("pages.pageBuilder.widgets.content.embed")}
            value={(c.embedUrl as string) ?? ""}
            onChange={(v) => setContent({ embedUrl: v })}
            rows={3}
            placeholder={t("pages.pageBuilder.widgets.content.embedPh")}
          />
        </Section>
      );
    case "menuAnchor":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.anchor")}>
          <p className="text-[11px] leading-relaxed text-editor-fg-muted -mt-1">
            {t("pages.pageBuilder.widgets.content.anchorBefore")}{" "}<span className="font-mono">#oferta</span>{t("pages.pageBuilder.widgets.content.anchorAfter")}{" "}<span className="font-mono">#oferta</span>.
          </p>
          <TextField
            label={t("pages.pageBuilder.widgets.content.anchorId")}
            value={(c.anchorId as string) ?? "oferta"}
            onChange={(v) => setContent({ anchorId: v })}
            placeholder="oferta"
          />
        </Section>
      );
    case "cookieBanner":
      return <CookieBannerContentEditor content={c} setContent={setContent} />;
    case "offCanvas":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.offCanvas")}>
          <TextField
            label={t("pages.pageBuilder.widgets.fields.buttonText")}
            value={(c.buttonLabel as string) ?? "Menu"}
            onChange={(v) => setContent({ buttonLabel: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.panelSide")}
            value={(c.side as string) ?? "right"}
            options={[
              { value: "right", label: t("pages.pageBuilder.widgets.opt.right") },
              { value: "left", label: t("pages.pageBuilder.widgets.opt.left") },
            ]}
            onChange={(v) => setContent({ side: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.buttonPos")}
            value={(c.position as string) ?? "bottom-right"}
            options={[
              { value: "bottom-right", label: t("pages.pageBuilder.popups.posBottomRight") },
              { value: "bottom-left", label: t("pages.pageBuilder.popups.posBottomLeft") },
              { value: "top-right", label: t("pages.pageBuilder.popups.posTopRight") },
              { value: "top-left", label: t("pages.pageBuilder.popups.posTopLeft") },
            ]}
            onChange={(v) => setContent({ position: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.content.panelWidth")}
            value={(c.width as number) ?? 340}
            min={240}
            max={640}
            onChange={(v) => setContent({ width: v })}
          />
          <TextareaField
            label={t("pages.pageBuilder.widgets.content.panelHtml")}
            value={(c.html as string) ?? ""}
            onChange={(v) => setContent({ html: v })}
            rows={6}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.content.panelBg")}
            value={(c.panelBg as string) ?? "#0f172a"}
            onChange={(v) => setContent({ panelBg: v })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.content.panelText")}
            value={(c.panelColor as string) ?? "#f8fafc"}
            onChange={(v) => setContent({ panelColor: v })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.fields.buttonBg")}
            value={(c.buttonBg as string) ?? "#e63946"}
            onChange={(v) => setContent({ buttonBg: v })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.fields.buttonText")}
            value={(c.buttonColor as string) ?? "#ffffff"}
            onChange={(v) => setContent({ buttonColor: v })}
          />
        </Section>
      );
    case "shareButtons":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.share")}>
          <TextField
            label={t("pages.pageBuilder.widgets.content.sharedText")}
            value={(c.text as string) ?? ""}
            onChange={(v) => setContent({ text: v })}
          />
          <TextField
            label={t("pages.pageBuilder.widgets.content.shareUrl")}
            value={(c.url as string) ?? ""}
            onChange={(v) => setContent({ url: v })}
            placeholder="https://…"
          />
          <TextareaField
            label={t("pages.pageBuilder.widgets.content.networks")}
            value={JSON.stringify((c.networks as string[]) ?? ["whatsapp", "facebook", "twitter", "copy"])}
            onChange={(v) => {
              try {
                const parsed = JSON.parse(v) as unknown;
                if (Array.isArray(parsed)) setContent({ networks: parsed });
              } catch {
                /* ignore invalid while typing */
              }
            }}
            rows={2}
          />
          <p className="text-[10px] text-editor-fg-muted">
            {t("pages.pageBuilder.widgets.content.networksHint")}
          </p>
          <ColorField
            label={t("pages.pageBuilder.widgets.content.buttonsBg")}
            value={(c.buttonBg as string) ?? "#0f172a"}
            onChange={(v) => setContent({ buttonBg: v })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.content.buttonsFg")}
            value={(c.buttonColor as string) ?? "#ffffff"}
            onChange={(v) => setContent({ buttonColor: v })}
          />
        </Section>
      );
    case "tableOfContents":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.toc")}>
          <TextField
            label={t("pages.pageBuilder.widgets.fields.title")}
            value={(c.title as string) ?? t("pages.pageBuilder.defaults.tocTitle")}
            placeholder={t("pages.pageBuilder.defaults.tocTitle")}
            onChange={(v) => setContent({ title: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.autoToc")}
            value={(c.auto as boolean) !== false ? "yes" : "no"}
            options={[
              { value: "yes", label: t("common.yes") },
              { value: "no", label: t("pages.pageBuilder.widgets.opt.manualOnly") },
            ]}
            onChange={(v) => setContent({ auto: v === "yes" })}
          />
          <ColorField
            label={t("pages.pageBuilder.widgets.content.linkColor")}
            value={(c.linkColor as string) ?? "#0f172a"}
            onChange={(v) => setContent({ linkColor: v })}
          />
          <ColorField
            label="Hover"
            value={(c.hoverColor as string) ?? "#e63946"}
            onChange={(v) => setContent({ hoverColor: v })}
          />
        </Section>
      );
    case "lottie":
      return (
        <Section title="Lottie">
          <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
            {t("pages.pageBuilder.widgets.content.lottieHint")}
          </p>
          <TextareaField
            label={t("pages.pageBuilder.widgets.content.jsonUrl")}
            value={(c.src as string) ?? ""}
            onChange={(v) => setContent({ src: v })}
            rows={3}
            placeholder="https://assets….lottiefiles.com/….json"
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.content.widthPx")}
            value={(c.width as number) ?? 280}
            min={40}
            max={1200}
            onChange={(v) => setContent({ width: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.content.speed")}
            value={(c.speed as number) ?? 1}
            min={0.1}
            max={5}
            step={0.1}
            onChange={(v) => setContent({ speed: v })}
          />
          <SelectField
            label="Loop"
            value={(c.loop as boolean) !== false ? "yes" : "no"}
            options={[
              { value: "yes", label: t("common.yes") },
              { value: "no", label: t("common.no") },
            ]}
            onChange={(v) => setContent({ loop: v === "yes" })}
          />
          <SelectField
            label="Autoplay"
            value={(c.autoplay as boolean) !== false ? "yes" : "no"}
            options={[
              { value: "yes", label: t("common.yes") },
              { value: "no", label: t("common.no") },
            ]}
            onChange={(v) => setContent({ autoplay: v === "yes" })}
          />
        </Section>
      );
    case "container":
      return (
        <Section title={t("pages.pageBuilder.widgets.content.container")}>
          <p className="text-[11px] leading-relaxed text-editor-fg-muted -mt-1">
            {t("pages.pageBuilder.widgets.content.containerHint")}
          </p>
          <SelectField
            label={t("pages.pageBuilder.widgets.content.direction")}
            value={(c.direction as string) ?? "row"}
            options={[
              { value: "row", label: t("pages.pageBuilder.panel.row") },
              { value: "column", label: t("pages.pageBuilder.panel.columnDir") },
              { value: "row-reverse", label: t("pages.pageBuilder.panel.rowReverse") },
              { value: "column-reverse", label: t("pages.pageBuilder.panel.columnReverse") },
            ]}
            onChange={(v) => setContent({ direction: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.justify")}
            value={(c.justify as string) ?? "flex-start"}
            options={[
              { value: "flex-start", label: t("pages.pageBuilder.panel.flexStart") },
              { value: "center", label: t("pages.pageBuilder.panel.center") },
              { value: "flex-end", label: t("pages.pageBuilder.panel.flexEnd") },
              { value: "space-between", label: t("pages.pageBuilder.panel.spaceBetween") },
              { value: "space-around", label: t("pages.pageBuilder.panel.spaceAround") },
              { value: "space-evenly", label: t("pages.pageBuilder.panel.spaceEvenly") },
            ]}
            onChange={(v) => setContent({ justify: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.align")}
            value={(c.align as string) ?? "stretch"}
            options={[
              { value: "stretch", label: t("pages.pageBuilder.panel.stretch") },
              { value: "flex-start", label: t("pages.pageBuilder.panel.flexStart") },
              { value: "center", label: t("pages.pageBuilder.panel.center") },
              { value: "flex-end", label: t("pages.pageBuilder.panel.flexEnd") },
            ]}
            onChange={(v) => setContent({ align: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.widgets.content.wrap")}
            value={(c.wrap as string) ?? "nowrap"}
            options={[
              { value: "nowrap", label: t("pages.pageBuilder.panel.nowrap") },
              { value: "wrap", label: t("pages.pageBuilder.panel.wrapLine") },
            ]}
            onChange={(v) => setContent({ wrap: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.content.gap")}
            value={(c.gap as number) ?? 16}
            min={0}
            max={80}
            onChange={(v) => setContent({ gap: v })}
          />
        </Section>
      );
    default: {
      const keys = Object.keys(c);
      return (
        <Section title={t("pages.pageBuilder.content")}>
          <p className="text-[11px] leading-relaxed text-editor-fg-muted -mt-1">
            {t("pages.pageBuilder.widgets.content.freeHint")}
          </p>
          {keys.length === 0 ? (
            <p className="text-xs text-editor-fg-muted">{t("pages.pageBuilder.widgets.content.noFields")}</p>
          ) : (
            keys.map((key) => {
              const val = c[key];
              if (typeof val === "boolean") {
                return (
                  <SelectField
                    key={key}
                    label={key}
                    value={val ? "yes" : "no"}
                    options={[
                      { value: "yes", label: t("common.yes") },
                      { value: "no", label: t("common.no") },
                    ]}
                    onChange={(v) => setContent({ [key]: v === "yes" })}
                  />
                );
              }
              if (typeof val === "number") {
                return (
                  <NumberField
                    key={key}
                    label={key}
                    value={val}
                    onChange={(v) => setContent({ [key]: v })}
                  />
                );
              }
              if (typeof val === "string") {
                return val.length > 80 ? (
                  <TextareaField
                    key={key}
                    label={key}
                    value={val}
                    onChange={(v) => setContent({ [key]: v })}
                    rows={4}
                  />
                ) : (
                  <TextField
                    key={key}
                    label={key}
                    value={val}
                    onChange={(v) => setContent({ [key]: v })}
                  />
                );
              }
              return (
                <TextareaField
                  key={key}
                  label={key}
                  value={JSON.stringify(val, null, 2)}
                  onChange={(v) => {
                    try {
                      setContent({ [key]: JSON.parse(v) });
                    } catch {
                      /* ignore invalid json while typing */
                    }
                  }}
                  rows={4}
                />
              );
            })
          )}
        </Section>
      );
    }
  }
}

/**
 * Estilo completo — igual para TODOS os widgets (independente do tipo).
 * Conteúdo específico fica na aba Conteúdo; motion/hover avançado na aba Avançado.
 */
function WidgetStyleTab({
  widget,
  device,
  setStyles,
}: {
  widget: WidgetNode;
  device: DeviceType;
  setStyles: (p: Partial<BaseStyles & ResponsiveStyles>) => void;
}) {
  const { t } = useAppLocale();
  const setBorder = (patch: Partial<NonNullable<BaseStyles["border"]>>) =>
    setStyles({
      border: {
        width: widget.styles.border?.width ?? 0,
        style: widget.styles.border?.style ?? "solid",
        color: widget.styles.border?.color ?? "#000000",
        radius: widget.styles.border?.radius ?? 0,
        ...patch,
      },
    });

  return (
    <>
      <div className="border-b border-editor-border px-3 py-2">
        <p className="text-[10px] leading-relaxed text-editor-fg-muted">
          {t("pages.pageBuilder.panel.styleDeviceBefore")}{" "}
          <span className="font-semibold text-editor-fg">{device}</span>.{" "}
          {t("pages.pageBuilder.panel.styleDeviceAfter")}
        </p>
      </div>

      <Section title={fill(t("pages.pageBuilder.panel.sizeDevice"), { device })}>
        <TextField
          label={t("pages.pageBuilder.panel.width")}
          value={(resolveResponsive(widget.styles.width, device) as string) ?? ""}
          onChange={(v) => {
            const next = v.trim();
            if (!next) setStyles({ width: undefined });
            else setStyles({ width: setResponsive(widget.styles.width, device, next) });
          }}
          placeholder="auto, 100%, 320px…"
        />
        <TextField
          label={t("pages.pageBuilder.panel.height")}
          value={
            (resolveResponsive(widget.styles.height, device) as string) ??
            (widget.type === "spacer" ? "50px" : "")
          }
          onChange={(v) => {
            const next = v.trim();
            if (!next) setStyles({ height: undefined });
            else setStyles({ height: setResponsive(widget.styles.height, device, next) });
          }}
          placeholder={widget.type === "spacer" ? "50px" : "auto, 200px…"}
        />
      </Section>

      <Section title={t("pages.pageBuilder.colors")}>
        <ColorField
          label={t("pages.pageBuilder.panel.textColor")}
          value={widget.styles.color ?? ""}
          onChange={(v) => setStyles({ color: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.background")}
          value={widget.styles.background ?? ""}
          onChange={(v) => setStyles({ background: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.panel.opacity")}
          value={typeof widget.styles.opacity === "number" ? widget.styles.opacity : 1}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => setStyles({ opacity: v })}
        />
      </Section>

      <TypographySection styles={widget.styles} device={device} setStyles={setStyles} />

      <SpacingSection styles={widget.styles} device={device} setStyles={setStyles} />

      <Section title={t("pages.pageBuilder.panel.border")}>
        <NumberField
          label={t("pages.pageBuilder.panel.thickness")}
          value={widget.styles.border?.width ?? 0}
          min={0}
          max={40}
          onChange={(v) => setBorder({ width: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.panel.borderStyle")}
          value={widget.styles.border?.style ?? "solid"}
          options={[
            { value: "none", label: t("pages.pageBuilder.panel.borderNone") },
            { value: "solid", label: t("pages.pageBuilder.panel.borderSolid") },
            { value: "dashed", label: t("pages.pageBuilder.panel.borderDashed") },
            { value: "dotted", label: t("pages.pageBuilder.panel.borderDotted") },
          ]}
          onChange={(v) =>
            setBorder({ style: v as NonNullable<BaseStyles["border"]>["style"] })
          }
        />
        <ColorField
          label={t("pages.pageBuilder.panel.borderColor")}
          value={widget.styles.border?.color ?? "#000000"}
          onChange={(v) => setBorder({ color: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.panel.radius")}
          value={widget.styles.border?.radius ?? 0}
          min={0}
          max={999}
          onChange={(v) => setBorder({ radius: v })}
        />
      </Section>

      <Section title={t("pages.pageBuilder.panel.shadow")}>
        <TextareaField
          label={t("pages.pageBuilder.panel.shadowCss")}
          value={widget.styles.boxShadow ?? ""}
          onChange={(v) => setStyles({ boxShadow: v.trim() ? v : undefined })}
          rows={2}
          placeholder="0 4px 14px rgba(15, 23, 42, 0.12)"
        />
      </Section>

      <Section title={t("pages.pageBuilder.panel.blockAlign")}>
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-2 mb-1">
          {t("pages.pageBuilder.panel.blockAlignHint")}
        </p>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { value: "left" as const, label: t("pages.pageBuilder.panel.alignLeft") },
              { value: "center" as const, label: t("pages.pageBuilder.panel.alignCenter") },
              { value: "right" as const, label: t("pages.pageBuilder.panel.alignRight") },
            ]
          ).map((opt) => {
            const current = (resolveResponsive(widget.styles.align, device) as string) ?? "left";
            const active = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setStyles({
                    align: setResponsive(widget.styles.align, device, opt.value),
                  })
                }
                className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-editor-accent bg-editor-accent/15 text-editor-accent"
                    : "border-editor-border bg-editor-panel-2 text-editor-fg-muted hover:text-editor-fg"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Section>
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
  const { t } = useAppLocale();
  const [tab, setTab] = useState<Tab>("style");
  useEffect(() => {
    setTab("style");
  }, [column.id]);
  const updateColumn = useBuilder((s) => s.updateColumn);
  const setStyles = (patch: Partial<BaseStyles & ResponsiveStyles>) =>
    updateColumn(section.id, column.id, { styles: { ...column.styles, ...patch } });

  const select = useBuilder((s) => s.select);
  const colIndex = Math.max(0, section.columns.findIndex((c) => c.id === column.id));

  return (
    <PanelShell
      title={fill(t("pages.pageBuilder.columnN"), { n: colIndex + 1 })}
      badge={t("pages.pageBuilder.column")}
      badgeColor="var(--editor-column)"
      breadcrumb={[
        {
          label: t("pages.pageBuilder.section"),
          color: "var(--editor-section)",
          onClick: () => select({ kind: "section", id: section.id }),
        },
        { label: fill(t("pages.pageBuilder.columnN"), { n: colIndex + 1 }), color: "var(--editor-column)" },
      ]}
      hint={
        <p className="text-[10px] leading-relaxed text-editor-fg-muted">
          {t("pages.pageBuilder.panel.columnHint")}
        </p>
      }
      tabs={[
        { id: "content", label: t("pages.pageBuilder.disposition") },
        { id: "style", label: t("pages.pageBuilder.style") },
        { id: "advanced", label: t("pages.pageBuilder.advanced") },
      ]}
      active={tab}
      onTab={setTab}
    >
      {tab === "content" && (
        <>
          <Section title={t("pages.pageBuilder.panel.widthSection")}>
            <NumberField
              label={fill(t("pages.pageBuilder.panel.widthPercent"), { device })}
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
          <Section title={t("pages.pageBuilder.panel.verticalAlign")}>
            <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-2 mb-1">
              {t("pages.pageBuilder.panel.verticalAlignHint")}
            </p>
            <SelectField
              label={fill(t("pages.pageBuilder.panel.vertical"), { device })}
              value={(resolveResponsive(column.styles.justifyContent, device) as string) ?? "flex-start"}
              options={[
                { value: "flex-start", label: t("pages.pageBuilder.panel.top") },
                { value: "center", label: t("pages.pageBuilder.panel.center") },
                { value: "flex-end", label: t("pages.pageBuilder.panel.bottom") },
                { value: "space-between", label: t("pages.pageBuilder.panel.spaceBetween") },
                { value: "space-around", label: t("pages.pageBuilder.panel.spaceAround") },
                { value: "space-evenly", label: t("pages.pageBuilder.panel.spaceEvenly") },
              ]}
              onChange={(v) =>
                setStyles({
                  justifyContent: setResponsive(
                    column.styles.justifyContent,
                    device,
                    v as NonNullable<typeof column.styles.justifyContent>["desktop"],
                  ),
                })
              }
            />
          </Section>
          {column.widgets.length > 0 ? (
            <Section title={t("pages.pageBuilder.panel.elementsInColumn")}>
              <ul className="space-y-1">
                {column.widgets.map((w) => {
                  const label = WIDGET_REGISTRY[w.type] ? t(WIDGET_NAME_KEY[w.type]) : w.type;
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() =>
                          select({
                            kind: "widget",
                            sectionId: section.id,
                            columnId: column.id,
                            id: w.id,
                          })
                        }
                        className="flex w-full items-center justify-between rounded-md border border-editor-border bg-editor-panel-2 px-2.5 py-2 text-left text-xs transition-colors hover:border-editor-widget"
                      >
                        <span className="font-medium text-editor-fg">{label}</span>
                        <span className="text-[10px] text-editor-fg-muted">{t("pages.pageBuilder.panel.editArrow")}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}
        </>
      )}
      {tab === "style" && (
        <>
          <Section title={t("pages.pageBuilder.colors")}>
            <ColorField
              label={t("pages.pageBuilder.background")}
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
          showLayout
        />
      )}
    </PanelShell>
  );
}

function SectionPanel({ section, device }: { section: SectionNode; device: DeviceType }) {
  const { t } = useAppLocale();
  const [tab, setTab] = useState<Tab>("content");
  useEffect(() => {
    setTab("content");
  }, [section.id]);
  const updateSection = useBuilder((s) => s.updateSection);
  const applySectionLayout = useBuilder((s) => s.applySectionLayout);
  const setStyles = (patch: Partial<BaseStyles & ResponsiveStyles>) =>
    updateSection(section.id, { styles: { ...section.styles, ...patch } });

  return (
    <PanelShell
      title={t("pages.pageBuilder.section")}
      badge={t("pages.pageBuilder.section")}
      badgeColor="var(--editor-section)"
      breadcrumb={[{ label: t("pages.pageBuilder.section"), color: "var(--editor-section)" }]}
      hint={
        <p className="rounded-md border border-editor-section/40 bg-editor-section/10 px-2 py-1.5 text-[10px] leading-relaxed text-editor-fg">
          {t("pages.pageBuilder.panel.sectionHintLead")} <strong>{t("pages.pageBuilder.section")}</strong>{" "}
          {t("pages.pageBuilder.panel.sectionHintTail")}
        </p>
      }
      tabs={[
        { id: "content", label: t("pages.pageBuilder.disposition") },
        { id: "style", label: t("pages.pageBuilder.style") },
        { id: "advanced", label: t("pages.pageBuilder.advanced") },
      ]}
      active={tab}
      onTab={setTab}
    >
      {tab === "content" && (
        <>
          <SectionElementsPicker section={section} />
          <Section title={t("pages.pageBuilder.panel.columnStructure")}>
            <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
              {t("pages.pageBuilder.panel.columnStructureHint")}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { label: "1", widths: [100] },
                  { label: "2", widths: [50, 50] },
                  { label: "3", widths: [33, 34, 33] },
                  { label: "4", widths: [25, 25, 25, 25] },
                  { label: "1/3", widths: [33, 67] },
                  { label: "2/3", widths: [67, 33] },
                  { label: "20/60", widths: [20, 60, 20] },
                  { label: "45/55", widths: [45, 55] },
                ] as const
              ).map((layout) => (
                <button
                  key={layout.label}
                  type="button"
                  title={layout.widths.join(" / ")}
                  onClick={() => applySectionLayout(section.id, [...layout.widths])}
                  className="flex h-10 items-center gap-0.5 rounded-md border border-editor-border px-1 hover:border-editor-accent"
                >
                  {layout.widths.map((w, i) => (
                    <span key={i} className="h-5 rounded-sm bg-editor-panel-2" style={{ flex: w }} />
                  ))}
                </button>
              ))}
            </div>
          </Section>
          <Section title={t("pages.pageBuilder.disposition")}>
            <SelectField
              label={t("pages.pageBuilder.panel.contentWidth")}
              value={section.layout}
              options={[
                { value: "boxed", label: t("pages.pageBuilder.panel.boxed") },
                { value: "full", label: t("pages.pageBuilder.panel.fullWidth") },
              ]}
              onChange={(v) => updateSection(section.id, { layout: v as "boxed" | "full" })}
            />
            {section.layout === "boxed" && (
              <NumberField
                label={t("pages.pageBuilder.panel.maxWidthPx")}
                value={section.contentWidth}
                onChange={(v) => updateSection(section.id, { contentWidth: v })}
                min={320}
                max={1920}
              />
            )}
            <NumberField
              label={fill(t("pages.pageBuilder.panel.columnGap"), { device })}
              value={resolveResponsive(section.columnGap, device) ?? 20}
              onChange={(v) =>
                updateSection(section.id, {
                  columnGap: setResponsive(section.columnGap, device, v),
                })
              }
              min={0}
              max={120}
            />
            <SelectField
              label={fill(t("pages.pageBuilder.panel.direction"), { device })}
              value={resolveResponsive(section.flex?.direction, device) ?? (device === "mobile" ? "column" : "row")}
              options={[
                { value: "row", label: t("pages.pageBuilder.panel.row") },
                { value: "column", label: t("pages.pageBuilder.panel.columnDir") },
                { value: "row-reverse", label: t("pages.pageBuilder.panel.rowReverse") },
                { value: "column-reverse", label: t("pages.pageBuilder.panel.columnReverse") },
              ]}
              onChange={(v) =>
                updateSection(section.id, {
                  flex: {
                    ...section.flex,
                    direction: setResponsive(section.flex?.direction, device, v as FlexDirection),
                  },
                })
              }
            />
            <SelectField
              label={fill(t("pages.pageBuilder.panel.justify"), { device })}
              value={resolveResponsive(section.flex?.justify, device) ?? "flex-start"}
              options={[
                { value: "flex-start", label: t("pages.pageBuilder.panel.flexStart") },
                { value: "center", label: t("pages.pageBuilder.panel.center") },
                { value: "flex-end", label: t("pages.pageBuilder.panel.flexEnd") },
                { value: "space-between", label: t("pages.pageBuilder.panel.spaceBetween") },
                { value: "space-around", label: t("pages.pageBuilder.panel.spaceAround") },
                { value: "space-evenly", label: t("pages.pageBuilder.panel.spaceEvenly") },
              ]}
              onChange={(v) =>
                updateSection(section.id, {
                  flex: {
                    ...section.flex,
                    justify: setResponsive(section.flex?.justify, device, v as FlexJustify),
                  },
                })
              }
            />
            <SelectField
              label={fill(t("pages.pageBuilder.panel.align"), { device })}
              value={resolveResponsive(section.flex?.align, device) ?? "stretch"}
              options={[
                { value: "flex-start", label: t("pages.pageBuilder.panel.flexStart") },
                { value: "center", label: t("pages.pageBuilder.panel.center") },
                { value: "flex-end", label: t("pages.pageBuilder.panel.flexEnd") },
                { value: "stretch", label: t("pages.pageBuilder.panel.stretch") },
              ]}
              onChange={(v) =>
                updateSection(section.id, {
                  flex: {
                    ...section.flex,
                    align: setResponsive(section.flex?.align, device, v as FlexAlign),
                  },
                })
              }
            />
            <SelectField
              label={fill(t("pages.pageBuilder.panel.wrap"), { device })}
              value={resolveResponsive(section.flex?.wrap, device) ?? "nowrap"}
              options={[
                { value: "nowrap", label: t("pages.pageBuilder.panel.nowrap") },
                { value: "wrap", label: t("pages.pageBuilder.panel.wrapLine") },
              ]}
              onChange={(v) =>
                updateSection(section.id, {
                  flex: {
                    ...section.flex,
                    wrap: setResponsive(section.flex?.wrap, device, v as FlexWrapMode),
                  },
                })
              }
            />
          </Section>
        </>
      )}
      {tab === "style" && (
        <>
          <Section title={t("pages.pageBuilder.colors")}>
            <ColorField
              label={t("pages.pageBuilder.background")}
              value={section.styles.background ?? ""}
              onChange={(v) => setStyles({ background: v })}
            />
          </Section>
          <Section title={t("pages.pageBuilder.panel.backgroundImage")}>
            <BuilderImageUrlField
              label={t("pages.pageBuilder.panel.imageUrl")}
              value={section.backgroundImageUrl ?? ""}
              onChange={(v) =>
                updateSection(section.id, {
                  backgroundImageUrl: v.trim() ? v : undefined,
                })
              }
              placeholder="https://…"
            />
            <SelectField
              label={t("pages.pageBuilder.panel.size")}
              value={section.backgroundImageSize ?? "cover"}
              options={[
                { value: "cover", label: t("pages.pageBuilder.panel.cover") },
                { value: "contain", label: t("pages.pageBuilder.panel.contain") },
                { value: "auto", label: t("pages.pageBuilder.panel.auto") },
              ]}
              onChange={(v) =>
                updateSection(section.id, {
                  backgroundImageSize: v as "cover" | "contain" | "auto",
                })
              }
            />
            <TextField
              label={t("pages.pageBuilder.panel.position")}
              value={section.backgroundImagePosition ?? "center center"}
              onChange={(v) =>
                updateSection(section.id, {
                  backgroundImagePosition: v.trim() || undefined,
                })
              }
              placeholder="center center"
            />
            <TextareaField
              label={t("pages.pageBuilder.sectionChrome.slideshow")}
              value={(section.backgroundSlideshow ?? []).join("\n")}
              onChange={(v) =>
                updateSection(section.id, {
                  backgroundSlideshow: v
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={3}
              placeholder={"https://…/1.jpg\nhttps://…/2.jpg"}
            />
            {(section.backgroundSlideshow ?? []).length > 0 ? (
              <NumberField
                label={t("pages.pageBuilder.sectionChrome.slideshowInterval")}
                value={section.backgroundSlideshowMs ?? 5000}
                min={1500}
                max={60000}
                onChange={(v) => updateSection(section.id, { backgroundSlideshowMs: v })}
              />
            ) : null}
          </Section>
          <Section title={t("pages.pageBuilder.panel.backgroundOverlay")}>
            <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
              {t("pages.pageBuilder.panel.overlayHint")}
            </p>
            <ColorField
              label={t("pages.pageBuilder.panel.overlayColor")}
              value={section.backgroundOverlay?.color ?? ""}
              onChange={(v) =>
                updateSection(section.id, {
                  backgroundOverlay: {
                    ...section.backgroundOverlay,
                    color: v.trim() ? v : undefined,
                  },
                })
              }
            />
            <NumberField
              label={t("pages.pageBuilder.panel.overlayOpacity")}
              value={section.backgroundOverlay?.opacity ?? 50}
              min={0}
              max={100}
              onChange={(v) =>
                updateSection(section.id, {
                  backgroundOverlay: {
                    ...section.backgroundOverlay,
                    opacity: v,
                    color: section.backgroundOverlay?.color || "rgba(0,0,0,1)",
                  },
                })
              }
            />
            <SelectField
              label="Blend mode"
              value={section.backgroundOverlay?.blendMode ?? "normal"}
              options={[
                { value: "normal", label: "Normal" },
                { value: "multiply", label: "Multiply" },
                { value: "screen", label: "Screen" },
                { value: "overlay", label: "Overlay" },
                { value: "darken", label: "Darken" },
                { value: "lighten", label: "Lighten" },
                { value: "soft-light", label: "Soft light" },
              ]}
              onChange={(v) =>
                updateSection(section.id, {
                  backgroundOverlay: {
                    ...section.backgroundOverlay,
                    blendMode: v,
                    color: section.backgroundOverlay?.color || "rgba(0,0,0,1)",
                  },
                })
              }
            />
          </Section>
          <Section title={t("pages.pageBuilder.panel.backgroundVideo")}>
            <TextareaField
              label={t("pages.pageBuilder.panel.videoUrl")}
              value={(section.backgroundVideoUrl as string | undefined) ?? ""}
              onChange={(v) =>
                updateSection(section.id, {
                  backgroundVideoUrl: v.trim() ? v : undefined,
                })
              }
              rows={3}
              placeholder={t("pages.pageBuilder.widgets.stickyVideo.urlPh")}
            />
            <p className="text-[10px] leading-relaxed text-editor-fg-muted">
              {t("pages.pageBuilder.sectionChrome.videoHint")}
            </p>
          </Section>
          <ShapeDividerFields
            title={t("pages.pageBuilder.shape.top")}
            config={section.shapeDividerTop}
            onChange={(shapeDividerTop) => updateSection(section.id, { shapeDividerTop })}
          />
          <ShapeDividerFields
            title={t("pages.pageBuilder.shape.bottom")}
            config={section.shapeDividerBottom}
            onChange={(shapeDividerBottom) => updateSection(section.id, { shapeDividerBottom })}
          />
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
          showLayout
        />
      )}
    </PanelShell>
  );
}

function ShapeDividerFields({
  title,
  config,
  onChange,
}: {
  title: string;
  config: ShapeDividerConfig | undefined;
  onChange: (next: ShapeDividerConfig | undefined) => void;
}) {
  const { t } = useAppLocale();
  const shapeLabel = {
    none: "pages.pageBuilder.shape.none",
    waves: "pages.pageBuilder.shape.waves",
    "waves-brush": "pages.pageBuilder.shape.wavesBrush",
    curve: "pages.pageBuilder.shape.curve",
    "curve-asym": "pages.pageBuilder.shape.curveAsym",
    tilt: "pages.pageBuilder.shape.tilt",
    triangle: "pages.pageBuilder.shape.triangle",
    "triangle-asym": "pages.pageBuilder.shape.triangleAsym",
    mountains: "pages.pageBuilder.shape.mountains",
    drops: "pages.pageBuilder.shape.drops",
    zigzag: "pages.pageBuilder.shape.zigzag",
  } as const;
  const c = config ?? {};
  const preset = c.preset ?? "none";
  const patch = (partial: Partial<ShapeDividerConfig>) => {
    const next = { ...c, ...partial };
    if ((next.preset ?? "none") === "none") {
      onChange(undefined);
      return;
    }
    onChange(next);
  };
  return (
    <Section title={title}>
      <SelectField
        label={t("pages.pageBuilder.widgets.fields.shape")}
        value={preset}
        options={SHAPE_DIVIDER_PRESETS.map((preset) => ({ value: preset.value, label: t(shapeLabel[preset.value]) }))}
        onChange={(v) => patch({ preset: v, color: c.color || "#ffffff", heightPx: c.heightPx ?? 80 })}
      />
      {preset !== "none" ? (
        <>
          <ColorField
            label={t("pages.pageBuilder.widgets.fields.color")}
            value={c.color ?? "#ffffff"}
            onChange={(v) => patch({ color: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.widgets.fields.heightPx")}
            value={c.heightPx ?? 80}
            min={8}
            max={400}
            onChange={(v) => patch({ heightPx: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.shape.invert")}
            value={c.invert ? "yes" : "no"}
            options={[
              { value: "no", label: t("common.no") },
              { value: "yes", label: t("common.yes") },
            ]}
            onChange={(v) => patch({ invert: v === "yes" })}
          />
          <SelectField
            label={t("pages.pageBuilder.shape.mirror")}
            value={c.flip ? "yes" : "no"}
            options={[
              { value: "no", label: t("common.no") },
              { value: "yes", label: t("common.yes") },
            ]}
            onChange={(v) => patch({ flip: v === "yes" })}
          />
          <SelectField
            label={t("pages.pageBuilder.shape.front")}
            value={c.bringToFront ? "yes" : "no"}
            options={[
              { value: "no", label: t("common.no") },
              { value: "yes", label: t("common.yes") },
            ]}
            onChange={(v) => patch({ bringToFront: v === "yes" })}
          />
        </>
      ) : null}
    </Section>
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
  const { t } = useAppLocale();
  const typo = (resolveResponsive(styles.typography, device) as TypographyValue | undefined) ?? {
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
    textAlign: "left" as const,
    textTransform: "none" as const,
    fontStyle: "normal" as const,
    textDecoration: "none" as const,
    wordSpacing: 0,
  };
  const update = (patch: Partial<TypographyValue>) => {
    if (patch.fontFamily) ensureFontFamilyLoaded(patch.fontFamily);
    setStyles({
      typography: setResponsive(styles.typography, device, { ...typo, ...patch }),
    });
  };

  const lineUnit = typo.lineHeightUnit ?? "";
  const fsUnit = typo.fontSizeUnit ?? "px";
  const presetId = matchFontPresetId(typo.fontFamily);

  return (
    <Section title={fill(t("pages.pageBuilder.chrome.typeTitle"), { device })}>
      <SelectField
        label={t("pages.pageBuilder.chrome.fontFamily")}
        value={presetId === "custom" ? "custom" : presetId}
        options={[
          ...TYPOGRAPHY_FONT_PRESETS.map((p) => ({
            value: p.id,
            label: `${p.id === "system" ? t("pages.pageBuilder.chrome.fontSystem") : p.label}${p.category !== "system" ? ` · ${p.category}` : ""}`,
          })),
          { value: "custom", label: t("pages.pageBuilder.chrome.fontCustom") },
        ]}
        onChange={(v) => {
          if (v === "custom") {
            update({
              fontFamily:
                typo.fontFamily && matchFontPresetId(typo.fontFamily) === "custom"
                  ? typo.fontFamily
                  : "inherit",
            });
            return;
          }
          const preset = TYPOGRAPHY_FONT_PRESETS.find((p) => p.id === v);
          if (!preset) return;
          ensureFontFamilyLoaded(preset.value);
          update({ fontFamily: preset.value });
        }}
      />
      {presetId === "custom" ? (
        <TextField
          label={t("pages.pageBuilder.chrome.fontCss")}
          value={typo.fontFamily === "inherit" ? "" : (typo.fontFamily ?? "")}
          onChange={(v) => update({ fontFamily: v.trim() ? v : "inherit" })}
          placeholder={t("pages.pageBuilder.chrome.fontCssPh")}
        />
      ) : (
        <p
          className="rounded-md border border-editor-border bg-editor-panel-2 px-2.5 py-2 text-xs text-editor-fg"
          style={{ fontFamily: typo.fontFamily }}
        >
          Aa Bb Cc — {TYPOGRAPHY_FONT_PRESETS.find((p) => p.id === presetId)?.label ?? t("pages.pageBuilder.chrome.fontFallback")}
        </p>
      )}

      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-editor-fg-muted">
          {t("pages.pageBuilder.chrome.quickSize")}
        </p>
        <div className="mb-2 flex flex-wrap gap-1">
          {TYPOGRAPHY_SIZE_PRESETS.map((s) => {
            const active = fsUnit === "px" && typo.fontSize === s.px;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => update({ fontSize: s.px, fontSizeUnit: "px" })}
                className={`rounded border px-1.5 py-1 text-[10px] font-semibold transition-colors ${
                  active
                    ? "border-editor-accent bg-editor-accent/15 text-editor-accent"
                    : "border-editor-border bg-editor-panel-2 text-editor-fg-muted hover:text-editor-fg"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <NumberField label={t("pages.pageBuilder.chrome.size")} value={typo.fontSize} min={0} max={500} onChange={(v) => update({ fontSize: v })} />
        <SelectField
          label={t("pages.pageBuilder.chrome.unit")}
          value={fsUnit}
          options={[
            { value: "px", label: "px" },
            { value: "em", label: "em" },
            { value: "rem", label: "rem" },
            { value: "vw", label: "vw" },
          ]}
          onChange={(v) => update({ fontSizeUnit: v as TypographyValue["fontSizeUnit"] })}
        />
      </div>
      <SelectField
        label={t("pages.pageBuilder.chrome.weight")}
        value={String(typo.fontWeight)}
        options={[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => ({
          value: String(w),
          label: TYPOGRAPHY_WEIGHT_LABELS[w] ?? String(w),
        }))}
        onChange={(v) => update({ fontWeight: Number(v) })}
      />
      <SelectField
        label={t("pages.pageBuilder.chrome.transform")}
        value={typo.textTransform}
        options={[
          { value: "none", label: t("pages.pageBuilder.chrome.caseNormal") },
          { value: "uppercase", label: t("pages.pageBuilder.chrome.uppercase") },
          { value: "lowercase", label: t("pages.pageBuilder.chrome.lowercase") },
          { value: "capitalize", label: t("pages.pageBuilder.chrome.capitalize") },
        ]}
        onChange={(v) => update({ textTransform: v as TypographyValue["textTransform"] })}
      />
      <SelectField
        label={t("pages.pageBuilder.chrome.fontStyle")}
        value={typo.fontStyle ?? "normal"}
        options={[
          { value: "normal", label: t("pages.pageBuilder.chrome.caseNormal") },
          { value: "italic", label: t("pages.pageBuilder.chrome.italic") },
          { value: "oblique", label: t("pages.pageBuilder.chrome.oblique") },
        ]}
        onChange={(v) => update({ fontStyle: v as TypographyValue["fontStyle"] })}
      />
      <SelectField
        label={t("pages.pageBuilder.chrome.decoration")}
        value={typo.textDecoration ?? "none"}
        options={[
          { value: "none", label: t("pages.pageBuilder.widgets.opt.noneFem") },
          { value: "underline", label: t("pages.pageBuilder.chrome.underline") },
          { value: "overline", label: t("pages.pageBuilder.chrome.overline") },
          { value: "line-through", label: t("pages.pageBuilder.chrome.strike") },
        ]}
        onChange={(v) => update({ textDecoration: v as TypographyValue["textDecoration"] })}
      />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <NumberField
          label={t("pages.pageBuilder.chrome.lineHeight")}
          value={typo.lineHeight}
          min={0}
          max={lineUnit === "" ? 4 : 200}
          step={lineUnit === "" ? 0.05 : 1}
          onChange={(v) => update({ lineHeight: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.unit")}
          value={lineUnit === "" ? "unitless" : lineUnit}
          options={[
            { value: "unitless", label: t("pages.pageBuilder.chrome.unitless") },
            { value: "px", label: "px" },
            { value: "em", label: "em" },
            { value: "rem", label: "rem" },
          ]}
          onChange={(v) =>
            update({
              lineHeightUnit: v === "unitless" ? "" : (v as TypographyValue["lineHeightUnit"]),
            })
          }
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <NumberField
          label={t("pages.pageBuilder.chrome.letterSpacing")}
          value={typo.letterSpacing}
          min={-20}
          max={40}
          step={0.5}
          onChange={(v) => update({ letterSpacing: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.unit")}
          value={typo.letterSpacingUnit ?? "px"}
          options={[
            { value: "px", label: "px" },
            { value: "em", label: "em" },
          ]}
          onChange={(v) => update({ letterSpacingUnit: v as TypographyValue["letterSpacingUnit"] })}
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <NumberField
          label={t("pages.pageBuilder.chrome.wordSpacing")}
          value={typo.wordSpacing ?? 0}
          min={-20}
          max={80}
          step={0.5}
          onChange={(v) => update({ wordSpacing: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.unit")}
          value={typo.wordSpacingUnit ?? "px"}
          options={[
            { value: "px", label: "px" },
            { value: "em", label: "em" },
          ]}
          onChange={(v) => update({ wordSpacingUnit: v as TypographyValue["wordSpacingUnit"] })}
        />
      </div>

      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-editor-fg-muted">
          {t("pages.pageBuilder.chrome.textAlign")}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              { value: "left", label: t("pages.pageBuilder.panel.alignLeft") },
              { value: "center", label: t("pages.pageBuilder.panel.center") },
              { value: "right", label: t("pages.pageBuilder.panel.alignRight") },
              { value: "justify", label: t("pages.pageBuilder.chrome.justifyShort") },
            ] as const
          ).map((opt) => {
            const active = typo.textAlign === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const textAlign = opt.value;
                  const patch: Partial<BaseStyles & ResponsiveStyles> = {
                    typography: setResponsive(styles.typography, device, { ...typo, textAlign }),
                  };
                  if (textAlign === "left" || textAlign === "center" || textAlign === "right") {
                    patch.align = setResponsive(styles.align, device, textAlign);
                  }
                  setStyles(patch);
                }}
                className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-editor-accent bg-editor-accent/15 text-editor-accent"
                    : "border-editor-border bg-editor-panel-2 text-editor-fg-muted hover:text-editor-fg"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
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
  const { t } = useAppLocale();
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
    <Section title={fill(t("pages.pageBuilder.chrome.spacingTitle"), { device })}>
      <SpacingField
        label={t("pages.pageBuilder.chrome.padding")}
        value={padding}
        onChange={(v) => setStyles({ padding: setResponsive(styles.padding, device, v) })}
      />
      <SpacingField
        label={t("pages.pageBuilder.chrome.margin")}
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
  cssId,
  onCssId,
  cssClasses,
  onClasses,
  widgetCustomCss,
  onWidgetCustomCss,
  hideClasses,
  showLayout,
  effects,
  onEffects,
  effectsWidget,
  interactions,
  onInteractions,
  conditions,
  onConditions,
  cssMask,
  cssMaskCustom,
  onMask,
}: {
  styles: BaseStyles & ResponsiveStyles;
  device: DeviceType;
  onStyles: (p: Partial<BaseStyles & ResponsiveStyles>) => void;
  cssId?: string;
  onCssId?: (v: string) => void;
  cssClasses: string | undefined;
  onClasses: (v: string) => void;
  widgetCustomCss?: string;
  onWidgetCustomCss?: (v: string) => void;
  hideClasses?: boolean;
  /** Controles de layout (largura, posição, flex) — widgets de página. */
  showLayout?: boolean;
  effects?: WidgetEffects;
  onEffects?: (effects: WidgetEffects) => void;
  effectsWidget?: WidgetNode;
  interactions?: WidgetInteraction[];
  onInteractions?: (interactions: WidgetInteraction[]) => void;
  conditions?: WidgetConditions;
  onConditions?: (conditions: WidgetConditions | undefined) => void;
  cssMask?: string;
  cssMaskCustom?: string;
  onMask?: (patch: { cssMask?: string; cssMaskCustom?: string }) => void;
}) {
  const { t } = useAppLocale();
  const clearableZ = resolveResponsive(styles.zIndex, device);
  const zStr =
    clearableZ !== undefined && clearableZ !== null && !Number.isNaN(clearableZ)
      ? String(clearableZ)
      : "";

  return (
    <>
      {effectsWidget && onEffects ? (
        <WidgetEffectsEditor
          widget={{ ...effectsWidget, effects }}
          onChange={onEffects}
        />
      ) : null}
      {effectsWidget && onInteractions ? (
        <WidgetInteractionsEditor
          widget={{ ...effectsWidget, interactions }}
          onChange={onInteractions}
        />
      ) : null}
      {effectsWidget && onConditions ? (
        <WidgetConditionsEditor
          widget={{ ...effectsWidget, conditions }}
          onChange={onConditions}
        />
      ) : null}
      {effectsWidget && onMask ? (
        <WidgetMaskEditor
          widget={{ ...effectsWidget, cssMask, cssMaskCustom }}
          onChange={onMask}
        />
      ) : null}
      {showLayout ? (
        <Section title={t("pages.pageBuilder.disposition")}>
          <TextField
            label={fill(t("pages.pageBuilder.chrome.widthDevice"), { device })}
            value={(resolveResponsive(styles.width, device) as string) ?? ""}
            onChange={(v) => {
              const t = v.trim();
              if (!t) onStyles({ width: undefined });
              else onStyles({ width: setResponsive(styles.width, device, t) });
            }}
            placeholder={t("pages.pageBuilder.chrome.widthPh")}
          />
          <TextField
            label={fill(t("pages.pageBuilder.chrome.heightDevice"), { device })}
            value={(resolveResponsive(styles.height, device) as string) ?? ""}
            onChange={(v) => {
              const t = v.trim();
              if (!t) onStyles({ height: undefined });
              else onStyles({ height: setResponsive(styles.height, device, t) });
            }}
            placeholder={t("pages.pageBuilder.chrome.heightPh")}
          />
          <SelectField
            label={fill(t("pages.pageBuilder.chrome.positionDevice"), { device })}
            value={(resolveResponsive(styles.position, device) as string) ?? "static"}
            options={[
              { value: "static", label: t("pages.pageBuilder.chrome.posStatic") },
              { value: "relative", label: t("pages.pageBuilder.chrome.posRelative") },
              { value: "absolute", label: t("pages.pageBuilder.chrome.posAbsolute") },
              { value: "fixed", label: t("pages.pageBuilder.chrome.posFixed") },
              { value: "sticky", label: t("pages.pageBuilder.chrome.posSticky") },
            ]}
            onChange={(v) => {
              const stickyOrFixed = v === "sticky" || v === "fixed";
              const patch: Partial<BaseStyles & ResponsiveStyles> = {
                position: setResponsive(
                  styles.position,
                  device,
                  v as NonNullable<typeof styles.position>["desktop"],
                ),
              };
              if (stickyOrFixed) {
                if (!resolveResponsive(styles.top, device)) {
                  patch.top = setResponsive(styles.top, device, "0");
                }
                if (resolveResponsive(styles.zIndex, device) == null) {
                  patch.zIndex = setResponsive(styles.zIndex, device, 200);
                }
                if (!styles.background) {
                  patch.background = "#ffffff";
                }
              }
              onStyles(patch);
            }}
          />
          <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
            {t("pages.pageBuilder.chrome.stickyHint")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label={fill(t("pages.pageBuilder.chrome.topDevice"), { device })}
              value={(resolveResponsive(styles.top, device) as string) ?? ""}
              onChange={(v) => {
                const t = v.trim();
                if (!t) onStyles({ top: undefined });
                else onStyles({ top: setResponsive(styles.top, device, t) });
              }}
              placeholder="0 / 12px / 10%"
            />
            <TextField
              label={fill(t("pages.pageBuilder.chrome.rightDevice"), { device })}
              value={(resolveResponsive(styles.right, device) as string) ?? ""}
              onChange={(v) => {
                const t = v.trim();
                if (!t) onStyles({ right: undefined });
                else onStyles({ right: setResponsive(styles.right, device, t) });
              }}
              placeholder="auto / 0 / 24px"
            />
            <TextField
              label={fill(t("pages.pageBuilder.chrome.bottomDevice"), { device })}
              value={(resolveResponsive(styles.bottom, device) as string) ?? ""}
              onChange={(v) => {
                const t = v.trim();
                if (!t) onStyles({ bottom: undefined });
                else onStyles({ bottom: setResponsive(styles.bottom, device, t) });
              }}
              placeholder="auto / 0 / 24px"
            />
            <TextField
              label={fill(t("pages.pageBuilder.chrome.leftDevice"), { device })}
              value={(resolveResponsive(styles.left, device) as string) ?? ""}
              onChange={(v) => {
                const t = v.trim();
                if (!t) onStyles({ left: undefined });
                else onStyles({ left: setResponsive(styles.left, device, t) });
              }}
              placeholder="auto / 0 / 24px"
            />
          </div>
          <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
            {t("pages.pageBuilder.chrome.offsetHint")}
          </p>
          <TextField
            label={fill(t("pages.pageBuilder.chrome.zIndex"), { device })}
            value={zStr}
            onChange={(v) => {
              const t = v.trim();
              if (!t) {
                onStyles({ zIndex: undefined });
                return;
              }
              const n = Number(t);
              if (!Number.isNaN(n)) onStyles({ zIndex: setResponsive(styles.zIndex, device, n) });
            }}
            placeholder={t("pages.pageBuilder.chrome.zIndexPh")}
          />
          <SelectField
            label={fill(t("pages.pageBuilder.chrome.alignSelf"), { device })}
            value={(resolveResponsive(styles.alignSelf, device) as string) ?? "auto"}
            options={[
              { value: "auto", label: t("pages.pageBuilder.panel.auto") },
              { value: "flex-start", label: t("pages.pageBuilder.panel.flexStart") },
              { value: "center", label: t("pages.pageBuilder.panel.center") },
              { value: "flex-end", label: t("pages.pageBuilder.panel.flexEnd") },
              { value: "stretch", label: t("pages.pageBuilder.panel.stretch") },
            ]}
            onChange={(v) =>
              onStyles({
                alignSelf: setResponsive(
                  styles.alignSelf,
                  device,
                  v as NonNullable<typeof styles.alignSelf>["desktop"],
                ),
              })
            }
          />
          <NumberField
            label={fill(t("pages.pageBuilder.chrome.order"), { device })}
            value={resolveResponsive(styles.order, device) ?? 0}
            min={-999}
            max={9999}
            onChange={(v) => onStyles({ order: setResponsive(styles.order, device, v) })}
          />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label={fill(t("pages.pageBuilder.chrome.flexGrow"), { device })}
              value={resolveResponsive(styles.flexGrow, device) ?? 0}
              min={0}
              max={99}
              onChange={(v) => onStyles({ flexGrow: setResponsive(styles.flexGrow, device, v) })}
            />
            <NumberField
              label={fill(t("pages.pageBuilder.chrome.flexShrink"), { device })}
              value={resolveResponsive(styles.flexShrink, device) ?? 1}
              min={0}
              max={99}
              onChange={(v) => onStyles({ flexShrink: setResponsive(styles.flexShrink, device, v) })}
            />
          </div>
        </Section>
      ) : null}
      <Section title={t("pages.pageBuilder.chrome.borders")}>
        <NumberField
          label={t("pages.pageBuilder.chrome.thickness")}
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
          label={t("pages.pageBuilder.widgets.fields.color")}
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
          label={t("pages.pageBuilder.chrome.radiusPx")}
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
      <Section title={t("pages.pageBuilder.chrome.visibility")}>
        <SelectField
          label={fill(t("pages.pageBuilder.chrome.visibleOn"), { device })}
          value={
            (resolveResponsive(styles.visibility, device) ?? true) ? "show" : "hide"
          }
          options={[
            { value: "show", label: t("pages.pageBuilder.chrome.show") },
            { value: "hide", label: t("pages.pageBuilder.chrome.hide") },
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
          {onCssId ? (
            <TextField
              label={t("pages.pageBuilder.chrome.cssId")}
              value={cssId ?? ""}
              onChange={onCssId}
              placeholder={t("pages.pageBuilder.chrome.cssIdPh")}
            />
          ) : null}
          <TextField
            label={t("pages.pageBuilder.chrome.cssClasses")}
            value={cssClasses ?? ""}
            onChange={onClasses}
          />
          {onWidgetCustomCss ? (
            <TextareaField
              label={t("pages.pageBuilder.chrome.customCss")}
              value={widgetCustomCss ?? ""}
              onChange={onWidgetCustomCss}
              rows={5}
              placeholder={t("pages.pageBuilder.chrome.customCssPh")}
            />
          ) : null}
          {onWidgetCustomCss ? (
            <p className="text-[10px] leading-relaxed text-editor-fg-muted">
              {t("pages.pageBuilder.chrome.customCssHint")}
            </p>
          ) : null}
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
  const { t } = useAppLocale();
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
      label: t("pages.pageBuilder.defaults.newField"),
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
      <Section title={t("pages.pageBuilder.chrome.formFields")}>
        <div className="space-y-2">
          {fields.length === 0 && (
            <p className="rounded bg-editor-panel-2 p-3 text-center text-[11px] text-editor-fg-muted">
              {t("pages.pageBuilder.chrome.formEmpty")}
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
                    title={t("pages.pageBuilder.chrome.moveUp")}
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
                  title={t("pages.pageBuilder.chrome.removeField")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <SelectField
                label={t("pages.pageBuilder.widgets.fields.type")}
                value={field.type}
                options={[
                  { value: "text", label: t("pages.pageBuilder.widgets.fields.text") },
                  { value: "email", label: "E-mail" },
                  { value: "tel", label: t("pages.pageBuilder.chrome.phone") },
                  { value: "number", label: t("pages.pageBuilder.chrome.number") },
                  { value: "textarea", label: t("pages.pageBuilder.chrome.longText") },
                ]}
                onChange={(v) => updateField(idx, { type: v as FormField["type"] })}
              />
              <TextField
                label={t("pages.pageBuilder.chrome.fieldLabel")}
                value={field.label}
                onChange={(v) => updateField(idx, { label: v })}
              />
              <TextField
                label={t("pages.pageBuilder.chrome.payloadKey")}
                value={field.name}
                onChange={(v) => updateField(idx, { name: v.replace(/[^a-zA-Z0-9_]/g, "_") })}
              />
              <TextField
                label={t("pages.pageBuilder.chrome.placeholder")}
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
                {t("common.required")}
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={addField}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-editor-border py-2 text-[11px] font-medium text-editor-fg-muted transition-colors hover:border-editor-accent hover:text-editor-accent"
          >
            <Plus className="h-3.5 w-3.5" /> {t("pages.pageBuilder.chrome.addField")}
          </button>
        </div>
      </Section>

      <Section title={t("pages.pageBuilder.chrome.submitSection")}>
        <TextField
          label={t("pages.pageBuilder.widgets.fields.buttonText")}
          value={(content.submitText as string) ?? "Enviar"}
          onChange={(v) => setContent({ submitText: v })}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.webhook")}
          value={(content.webhookUrl as string) ?? ""}
          placeholder="https://hooks.exemplo.com/..."
          onChange={(v) => setContent({ webhookUrl: v })}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.redirectAfter")}
          value={(content.redirectUrl as string) ?? ""}
          placeholder="https://..."
          onChange={(v) => setContent({ redirectUrl: v })}
        />
        <TextareaField
          label={t("pages.pageBuilder.chrome.successMsg")}
          value={(content.successMessage as string) ?? ""}
          onChange={(v) => setContent({ successMessage: v })}
          rows={2}
        />
        <TextareaField
          label={t("pages.pageBuilder.chrome.errorMsg")}
          value={(content.errorMessage as string) ?? ""}
          onChange={(v) => setContent({ errorMessage: v })}
          rows={2}
        />
      </Section>

      <Section title={t("pages.pageBuilder.chrome.fieldStyle")}>
        <ColorField
          label={t("pages.pageBuilder.chrome.fieldBg")}
          value={(content.inputBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ inputBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.panel.borderColor")}
          value={(content.inputBorderColor as string) ?? "#d0d5dd"}
          onChange={(v) => setContent({ inputBorderColor: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.borderRadius")}
          value={(content.inputRadius as number) ?? 6}
          onChange={(v) => setContent({ inputRadius: v })}
          min={0}
          max={32}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.labelColor")}
          value={(content.labelColor as string) ?? "#1a1a1a"}
          onChange={(v) => setContent({ labelColor: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.fieldGap")}
          value={(content.fieldGap as number) ?? 12}
          onChange={(v) => setContent({ fieldGap: v })}
          min={0}
          max={48}
        />
      </Section>

      <Section title={t("pages.pageBuilder.chrome.buttonStyle")}>
        <ColorField
          label={t("pages.pageBuilder.background")}
          value={(content.buttonBg as string) ?? "#e63946"}
          onChange={(v) => setContent({ buttonBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.panel.textColor")}
          value={(content.buttonColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ buttonColor: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.panel.radius")}
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
  const { t } = useAppLocale();
  const update = (idx: number, patch: Partial<T>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  return (
    <Section title={title}>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="rounded bg-editor-panel-2 p-3 text-center text-[11px] text-editor-fg-muted">
            {t("pages.pageBuilder.chrome.listEmpty")}
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
          <Plus className="h-3.5 w-3.5" /> {t("common.add")}
        </button>
      </div>
    </Section>
  );
}

function NavMenuContentEditor({
  content,
  setContent,
  section,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
  section: SectionNode;
}) {
  const { t } = useAppLocale();
  const updateSection = useBuilder((s) => s.updateSection);
  const items = (content.items as NavItem[]) ?? [];
  const stickyMode = ((content.stickyMode as NavStickyMode) ?? "none") as NavStickyMode;
  const pointer =
    (content.pointer as string) ??
    ((content.underlineOnHover as boolean) === false ? "none" : "underline");

  const applySticky = (mode: NavStickyMode) => {
    setContent({ stickyMode: mode });
    if (mode === "none") {
      updateSection(section.id, {
        styles: {
          ...section.styles,
          position: setResponsive(section.styles.position, "desktop", "static"),
        },
      });
      return;
    }
    // Sticky/fixed na secção da barra — conteúdo sobe por baixo.
    updateSection(section.id, {
      styles: {
        ...section.styles,
        position: setResponsive(section.styles.position, "desktop", mode),
        top: setResponsive(section.styles.top, "desktop", "0"),
        zIndex: setResponsive(section.styles.zIndex, "desktop", 200),
        background: section.styles.background || "#ffffff",
        boxShadow: section.styles.boxShadow || "0 1px 0 rgba(15, 23, 42, 0.12)",
      },
    });
  };

  return (
    <>
      <ListEditor<NavItem & ListItem>
        title={t("pages.pageBuilder.chrome.menuLinks")}
        items={items as Array<NavItem & ListItem>}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.label || t("pages.pageBuilder.chrome.linkFallback")}
        newItem={() => ({ id: `nav_${nanoid(6)}`, label: t("pages.pageBuilder.defaults.newLink"), href: "#" })}
        renderFields={(item, update) => {
          const children = (item.children as NavItem[] | undefined) ?? [];
          return (
            <>
              <TextField label={t("pages.pageBuilder.widgets.fields.text")} value={item.label} onChange={(v) => update({ label: v })} />
              <TextField label={t("pages.pageBuilder.chrome.urlAnchor")} value={item.href} onChange={(v) => update({ href: v })} />
              <div className="space-y-1.5 rounded border border-dashed border-editor-border/80 p-2">
                <p className="text-[10px] font-semibold text-editor-fg-muted">{t("pages.pageBuilder.chrome.submenu")}</p>
                {children.map((child, ci) => (
                  <div key={child.id} className="grid gap-1.5 rounded bg-editor-panel p-1.5">
                    <TextField
                      label={t("pages.pageBuilder.widgets.fields.text")}
                      value={child.label}
                      onChange={(v) => {
                        const next = children.map((ch, i) => (i === ci ? { ...ch, label: v } : ch));
                        update({ children: next });
                      }}
                    />
                    <TextField
                      label="URL"
                      value={child.href}
                      onChange={(v) => {
                        const next = children.map((ch, i) => (i === ci ? { ...ch, href: v } : ch));
                        update({ children: next });
                      }}
                    />
                    <button
                      type="button"
                      className="text-[10px] text-destructive"
                      onClick={() => update({ children: children.filter((_, i) => i !== ci) })}
                    >
                      {t("pages.pageBuilder.chrome.removeSub")}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-[10px] font-medium text-editor-accent"
                  onClick={() =>
                    update({
                      children: [
                        ...children,
                        { id: `nav_${nanoid(6)}`, label: t("pages.pageBuilder.defaults.subLink"), href: "#" },
                      ],
                    })
                  }
                >
                  {t("pages.pageBuilder.chrome.addSub")}
                </button>
              </div>
            </>
          );
        }}
      />

      <Section title={t("pages.pageBuilder.disposition")}>
        <SelectField
          label={t("pages.pageBuilder.disposition")}
          value={(content.layout as string) ?? "horizontal"}
          options={[
            { value: "horizontal", label: t("pages.pageBuilder.chrome.horizontal") },
            { value: "vertical", label: t("pages.pageBuilder.chrome.vertical") },
            { value: "dropdown", label: t("pages.pageBuilder.chrome.dropdown") },
            { value: "mega", label: t("pages.pageBuilder.chrome.mega") },
          ]}
          onChange={(v) => setContent({ layout: v })}
        />
        {(content.layout as string) === "mega" ? (
          <>
            <NumberField
              label={t("pages.pageBuilder.chrome.megaWidth")}
              value={(content.megaWidth as number) ?? 720}
              min={320}
              max={1200}
              onChange={(v) => setContent({ megaWidth: v })}
            />
            <NumberField
              label={t("pages.pageBuilder.chrome.columns")}
              value={(content.megaColumns as number) ?? 3}
              min={2}
              max={6}
              onChange={(v) => setContent({ megaColumns: v })}
            />
          </>
        ) : null}
        <SelectField
          label={t("pages.pageBuilder.widgets.fields.alignment")}
          value={(content.align as string) ?? "center"}
          options={[
            { value: "left", label: t("pages.pageBuilder.widgets.opt.left") },
            { value: "center", label: t("pages.pageBuilder.panel.center") },
            { value: "right", label: t("pages.pageBuilder.widgets.opt.right") },
          ]}
          onChange={(v) => setContent({ align: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.pointer")}
          value={pointer}
          options={[
            { value: "none", label: t("pages.pageBuilder.widgets.opt.noneMasc") },
            { value: "underline", label: t("pages.pageBuilder.chrome.underline") },
            { value: "overline", label: t("pages.pageBuilder.chrome.overline") },
            { value: "double-line", label: t("pages.pageBuilder.chrome.doubleLine") },
            { value: "framed", label: t("pages.pageBuilder.chrome.framed") },
            { value: "background", label: t("pages.pageBuilder.background") },
          ]}
          onChange={(v) =>
            setContent({
              pointer: v,
              underlineOnHover: v !== "none",
            })
          }
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.stickyBar")}
          value={stickyMode}
          options={[
            { value: "none", label: t("pages.pageBuilder.chrome.stickyNone") },
            { value: "sticky", label: t("pages.pageBuilder.chrome.stickyUnder") },
            { value: "fixed", label: t("pages.pageBuilder.chrome.fixedUnder") },
          ]}
          onChange={(v) => applySticky(v as NavStickyMode)}
        />
        <p className="text-[10px] leading-relaxed text-editor-fg-muted -mt-1">
          {t("pages.pageBuilder.chrome.navStickyNote")}
        </p>
      </Section>

      <Section title={t("pages.pageBuilder.chrome.linkStyle")}>
        <ColorField
          label={t("pages.pageBuilder.chrome.colorNormal")}
          value={(content.color as string) ?? "#0f172a"}
          onChange={(v) => setContent({ color: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.colorHover")}
          value={(content.hoverColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ hoverColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.colorActive")}
          value={(content.activeColor as string) ?? (content.hoverColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ activeColor: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.fontSize")}
          value={(content.fontSize as number) ?? 15}
          onChange={(v) => setContent({ fontSize: v })}
          min={10}
          max={28}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.fontWeight")}
          value={(content.fontWeight as number) ?? 500}
          onChange={(v) => setContent({ fontWeight: v })}
          min={300}
          max={900}
          step={100}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.linkGap")}
          value={(content.gap as number) ?? 24}
          onChange={(v) => setContent({ gap: v })}
          min={0}
          max={64}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.padX")}
          value={(content.itemPaddingX as number) ?? 4}
          onChange={(v) => setContent({ itemPaddingX: v })}
          min={0}
          max={32}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.padY")}
          value={(content.itemPaddingY as number) ?? 6}
          onChange={(v) => setContent({ itemPaddingY: v })}
          min={0}
          max={32}
        />
      </Section>

      <Section title={t("pages.pageBuilder.chrome.dropdownSection")}>
        <ColorField
          label={t("pages.pageBuilder.chrome.submenuBg")}
          value={(content.submenuBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ submenuBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.panel.textColor")}
          value={(content.submenuColor as string) ?? "#0f172a"}
          onChange={(v) => setContent({ submenuColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.colorHover")}
          value={(content.submenuHoverColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ submenuHoverColor: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.minWidth")}
          value={(content.submenuMinWidth as number) ?? 180}
          onChange={(v) => setContent({ submenuMinWidth: v })}
          min={120}
          max={400}
        />
      </Section>

      <Section title={t("pages.pageBuilder.chrome.mobile")}>
        <NumberField
          label={t("pages.pageBuilder.chrome.breakpoint")}
          value={(content.mobileBreakpoint as number) ?? 767}
          onChange={(v) => setContent({ mobileBreakpoint: v })}
          min={320}
          max={1200}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.mobileAlign")}
          value={(content.mobileAlign as string) ?? "left"}
          options={[
            { value: "left", label: t("pages.pageBuilder.widgets.opt.left") },
            { value: "center", label: t("pages.pageBuilder.panel.center") },
            { value: "right", label: t("pages.pageBuilder.widgets.opt.right") },
          ]}
          onChange={(v) => setContent({ mobileAlign: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.hamburger")}
          value={(content.toggleColor as string) ?? "#0f172a"}
          onChange={(v) => setContent({ toggleColor: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.iconSize")}
          value={(content.toggleSize as number) ?? 28}
          onChange={(v) => setContent({ toggleSize: v })}
          min={18}
          max={48}
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
  const { t } = useAppLocale();
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
        title={t("pages.pageBuilder.chrome.quotes")}
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.name || t("pages.pageBuilder.chrome.unnamed")}
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
            <TextField label={t("common.name")} value={item.name} onChange={(v) => update({ name: v })} />
            <TextField label={t("pages.pageBuilder.chrome.role")} value={item.role} onChange={(v) => update({ role: v })} />
            <BuilderImageUrlField
              label={t("pages.pageBuilder.chrome.avatarUrl")}
              value={item.avatar}
              onChange={(v) => update({ avatar: v })}
              placeholder="https://…"
            />
            <TextareaField label={t("pages.pageBuilder.chrome.quote")} value={item.quote} onChange={(v) => update({ quote: v })} rows={3} />
            <NumberField
              label={t("pages.pageBuilder.chrome.stars")}
              value={item.rating}
              min={0}
              max={5}
              onChange={(v) => update({ rating: Math.max(0, Math.min(5, v)) })}
            />
          </>
        )}
      />
      <Section title={t("pages.pageBuilder.chrome.carousel")}>
        <SelectField
          label={t("pages.pageBuilder.widgets.content.autoplay")}
          value={(content.autoplay as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
          ]}
          onChange={(v) => setContent({ autoplay: v === "yes" })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.interval")}
          value={(content.intervalMs as number) ?? 5000}
          min={1500}
          max={20000}
          step={500}
          onChange={(v) => setContent({ intervalMs: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.chrome.appearance")}>
        <ColorField
          label={t("pages.pageBuilder.chrome.cardBg")}
          value={(content.cardBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ cardBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.panel.textColor")}
          value={(content.textColor as string) ?? "#1a1a1a"}
          onChange={(v) => setContent({ textColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.accentStars")}
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
  const { t } = useAppLocale();
  const items =
    (content.items as Array<{ id: string; question: string; answer: string }>) ?? [];
  return (
    <>
      <ListEditor
        title={t("pages.pageBuilder.chrome.questions")}
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.question || t("pages.pageBuilder.chrome.questionFallback")}
        newItem={() => ({
          id: `q_${nanoid(6)}`,
          question: "Nova pergunta?",
          answer: "<p>Resposta...</p>",
        })}
        renderFields={(item, update) => (
          <>
            <TextField
              label={t("pages.pageBuilder.chrome.question")}
              value={item.question}
              onChange={(v) => update({ question: v })}
            />
            <TextareaField
              label={t("pages.pageBuilder.chrome.answerHtml")}
              value={item.answer}
              onChange={(v) => update({ answer: v })}
              rows={3}
            />
          </>
        )}
      />
      <Section title={t("pages.pageBuilder.chrome.behavior")}>
        <SelectField
          label={t("pages.pageBuilder.chrome.allowMultiple")}
          value={(content.allowMultiple as boolean) ? "yes" : "no"}
          options={[
            { value: "no", label: t("common.no") },
            { value: "yes", label: t("common.yes") },
          ]}
          onChange={(v) => setContent({ allowMultiple: v === "yes" })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.chrome.appearance")}>
        <ColorField
          label={t("pages.pageBuilder.chrome.itemBg")}
          value={(content.itemBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ itemBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.panel.borderColor")}
          value={(content.itemBorderColor as string) ?? "#e5e7eb"}
          onChange={(v) => setContent({ itemBorderColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.questionColor")}
          value={(content.questionColor as string) ?? "#111827"}
          onChange={(v) => setContent({ questionColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.answerColor")}
          value={(content.answerColor as string) ?? "#4b5563"}
          onChange={(v) => setContent({ answerColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.accent")}
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
  const { t } = useAppLocale();
  const deadline = (content.deadline as string) ?? new Date(Date.now() + 86400000).toISOString();
  const dt = new Date(deadline);
  // datetime-local needs YYYY-MM-DDTHH:MM
  const isoLocal = !isNaN(dt.getTime())
    ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
    : "";

  return (
    <>
      <Section title={t("pages.pageBuilder.chrome.targetDate")}>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-editor-fg-muted">
            {t("pages.pageBuilder.chrome.expires")}
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
          label={t("pages.pageBuilder.chrome.expiredLabel")}
          value={(content.expiredMessage as string) ?? "A oferta expirou!"}
          onChange={(v) => setContent({ expiredMessage: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.chrome.display")}>
        <SelectField
          label={t("pages.pageBuilder.chrome.showDays")}
          value={(content.showDays as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
          ]}
          onChange={(v) => setContent({ showDays: v === "yes" })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.showLabels")}
          value={(content.showLabels as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
          ]}
          onChange={(v) => setContent({ showLabels: v === "yes" })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.digitSize")}
          value={(content.digitSize as number) ?? 48}
          min={20}
          max={120}
          onChange={(v) => setContent({ digitSize: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.colors")}>
        <ColorField
          label={t("pages.pageBuilder.chrome.digitBg")}
          value={(content.digitBg as string) ?? "#0f172a"}
          onChange={(v) => setContent({ digitBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.digitColor")}
          value={(content.digitColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ digitColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.labelColor")}
          value={(content.labelColor as string) ?? "#475569"}
          onChange={(v) => setContent({ labelColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.separatorColor")}
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
  const { t } = useAppLocale();
  return (
    <>
      <Section title={t("pages.pageBuilder.content")}>
        <SelectField
          label={t("pages.pageBuilder.widgets.fields.type")}
          value={(content.variant as string) ?? "info"}
          options={[
            { value: "info", label: t("pages.pageBuilder.chrome.variantInfo") },
            { value: "success", label: t("pages.pageBuilder.chrome.variantSuccess") },
            { value: "warning", label: t("pages.pageBuilder.chrome.variantWarning") },
            { value: "danger", label: t("pages.pageBuilder.chrome.variantDanger") },
          ]}
          onChange={(v) => setContent({ variant: v })}
        />
        <TextField label={t("pages.pageBuilder.widgets.fields.title")} value={(content.title as string) ?? ""} onChange={(v) => setContent({ title: v })} />
        <TextareaField
          label={t("pages.pageBuilder.chrome.messageHtml")}
          value={(content.message as string) ?? ""}
          onChange={(v) => setContent({ message: v })}
          rows={5}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.showIcon")}
          value={((content.showIcon as boolean) ?? true) ? "yes" : "no"}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
          ]}
          onChange={(v) => setContent({ showIcon: v === "yes" })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.dismiss")}
          value={((content.dismissible as boolean) ?? false) ? "yes" : "no"}
          options={[
            { value: "no", label: t("common.no") },
            { value: "yes", label: t("common.yes") },
          ]}
          onChange={(v) => setContent({ dismissible: v === "yes" })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.borderRadius")}
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
  const { t } = useAppLocale();
  const tabs = (content.tabs as TabItem[]) ?? [];
  return (
    <>
      <ListEditor
        title={t("pages.pageBuilder.chrome.tabsTitle")}
        items={tabs}
        onChange={(next) => setContent({ tabs: next })}
        itemLabel={(it) => it.label || t("pages.pageBuilder.chrome.tabFallback")}
        newItem={() => ({
          id: `tab_${nanoid(6)}`,
          label: t("pages.pageBuilder.defaults.newSeparator"),
          html: `<p>${t("pages.pageBuilder.defaults.tabBody")}</p>`,
        })}
        renderFields={(item, update) => (
          <>
            <TextField label={t("pages.pageBuilder.chrome.fieldLabel")} value={item.label} onChange={(v) => update({ label: v })} />
            <TextareaField
              label={t("pages.pageBuilder.chrome.htmlContent")}
              value={item.html}
              onChange={(v) => update({ html: v })}
              rows={4}
            />
          </>
        )}
      />
      <Section title={t("pages.pageBuilder.colors")}>
        <ColorField
          label={t("pages.pageBuilder.chrome.inactiveBg")}
          value={(content.tabBg as string) ?? "#f1f5f9"}
          onChange={(v) => setContent({ tabBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.activeBg")}
          value={(content.tabActiveBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ tabActiveBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.inactiveText")}
          value={(content.tabTextColor as string) ?? "#64748b"}
          onChange={(v) => setContent({ tabTextColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.activeText")}
          value={(content.tabActiveTextColor as string) ?? "#0f172a"}
          onChange={(v) => setContent({ tabActiveTextColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.accentBar")}
          value={(content.accentColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ accentColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.panelBg")}
          value={(content.panelBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ panelBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.panelText")}
          value={(content.panelTextColor as string) ?? "#334155"}
          onChange={(v) => setContent({ panelTextColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.border")}
          value={(content.borderColor as string) ?? "#e2e8f0"}
          onChange={(v) => setContent({ borderColor: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.radiusGeneral")}
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
  const { t } = useAppLocale();
  const items =
    (content.items as Array<{ id: string; network: SocialNetwork; url: string }>) ?? [];
  return (
    <>
      <ListEditor
        title={t("pages.pageBuilder.chrome.socialLinks")}
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) =>
          it.network === "email"
            ? t("pages.pageBuilder.chrome.email")
            : it.network === "link"
              ? t("pages.pageBuilder.chrome.website")
              : (SOCIAL_NETWORK_OPTIONS.find((o) => o.value === it.network)?.label ??
                t("pages.pageBuilder.chrome.networkFallback"))
        }
        newItem={() => ({
          id: `soc_${nanoid(6)}`,
          network: "instagram" as SocialNetwork,
          url: "",
        })}
        renderFields={(item, update) => (
          <>
            <SelectField
              label={t("pages.pageBuilder.chrome.network")}
              value={item.network}
              options={SOCIAL_NETWORK_OPTIONS.map((o) => o.value === "email" ? { ...o, label: t("pages.pageBuilder.chrome.email") } : o.value === "link" ? { ...o, label: t("pages.pageBuilder.chrome.website") } : o)}
              onChange={(v) => update({ network: v as SocialNetwork })}
            />
            <TextField
              label={t("pages.pageBuilder.chrome.urlContact")}
              value={item.url}
              onChange={(v) => update({ url: v })}
              placeholder={t("pages.pageBuilder.chrome.urlContactPh")}
            />
          </>
        )}
      />
      <Section title={t("pages.pageBuilder.chrome.icons")}>
        <NumberField
          label={t("pages.pageBuilder.widgets.fields.sizePx")}
          value={(content.iconSize as number) ?? 22}
          min={14}
          max={40}
          onChange={(v) => setContent({ iconSize: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.iconGap")}
          value={(content.gap as number) ?? 16}
          min={4}
          max={40}
          onChange={(v) => setContent({ gap: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.fontStyle")}
          value={(content.variant as string) ?? "filled"}
          options={[
            { value: "filled", label: t("pages.pageBuilder.chrome.filled") },
            { value: "outline", label: t("pages.pageBuilder.chrome.outline") },
            { value: "mono", label: t("pages.pageBuilder.chrome.mono") },
          ]}
          onChange={(v) => setContent({ variant: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.filledBg")}
          value={(content.iconBg as string) ?? "#0f172a"}
          onChange={(v) => setContent({ iconBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.fields.iconColor")}
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
  const { t } = useAppLocale();
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
        title={t("pages.pageBuilder.chrome.items")}
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => it.title || t("pages.pageBuilder.chrome.itemFallback")}
        newItem={() => ({
          id: `il_${nanoid(6)}`,
          iconName: "check",
          title: t("pages.pageBuilder.defaults.newItem"),
          description: `<p>${t("pages.pageBuilder.defaults.itemBody")}</p>`,
          href: "",
        })}
        renderFields={(item, update) => (
          <>
            <TextField
              label={t("pages.pageBuilder.chrome.iconLucide")}
              value={item.iconName}
              onChange={(v) => update({ iconName: v })}
              placeholder={t("pages.pageBuilder.chrome.iconPh")}
            />
            <TextField label={t("pages.pageBuilder.widgets.fields.title")} value={item.title} onChange={(v) => update({ title: v })} />
            <TextareaField
              label={t("pages.pageBuilder.chrome.descHtml")}
              value={item.description}
              onChange={(v) => update({ description: v })}
              rows={3}
            />
            <TextField
              label={t("pages.pageBuilder.widgets.fields.linkOptional")}
              value={item.href}
              onChange={(v) => update({ href: v })}
              placeholder="https://…"
            />
          </>
        )}
      />
      <Section title={t("pages.pageBuilder.chrome.appearance")}>
        <NumberField
          label={t("pages.pageBuilder.chrome.iconSize")}
          value={(content.iconSize as number) ?? 22}
          min={12}
          max={40}
          onChange={(v) => setContent({ iconSize: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.itemGap")}
          value={(content.gap as number) ?? 16}
          min={4}
          max={40}
          onChange={(v) => setContent({ gap: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.fields.iconColor")}
          value={(content.iconColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ iconColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.circleBg")}
          value={(content.iconBg as string) ?? ""}
          onChange={(v) => setContent({ iconBg: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.iconShape")}
          value={(content.iconShape as string) ?? "circle"}
          options={[
            { value: "circle", label: t("pages.pageBuilder.widgets.opt.circle") },
            { value: "rounded", label: t("pages.pageBuilder.chrome.rounded") },
          ]}
          onChange={(v) => setContent({ iconShape: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.fields.titleColor")}
          value={(content.titleColor as string) ?? "#0f172a"}
          onChange={(v) => setContent({ titleColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.fields.descColor")}
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
  const { t } = useAppLocale();
  const images =
    (content.images as Array<{ id: string; src: string; alt: string; caption?: string }>) ?? [];
  const isDedicatedCarousel = widgetType === "imageCarousel";
  const isCarousel = (content.layout as string) === "carousel" || isDedicatedCarousel;
  return (
    <>
      <div className="border-b border-editor-border px-3 py-2.5">
        <p className="text-[11px] leading-relaxed text-editor-fg-muted">
          <span className="font-semibold text-editor-fg">{t("pages.pageBuilder.chrome.galleryLead")}</span>{" "}
          {t("pages.pageBuilder.chrome.galleryMid")}{" "}
          <span className="font-mono text-[10px]">https://…</span>{" "}
          {t("pages.pageBuilder.chrome.galleryOr")}{" "}
          <span className="font-semibold text-editor-fg">{t("pages.pageBuilder.upload.fromPc")}</span>{" "}
          {t("pages.pageBuilder.chrome.galleryEnd")}
        </p>
      </div>
      <ListEditor
        title={t("pages.pageBuilder.chrome.images")}
        items={images}
        onChange={(next) => setContent({ images: next })}
        itemLabel={(it, i) => it.alt || (it.src ? fill(t("pages.pageBuilder.chrome.imageN"), { n: i + 1 }) : fill(t("pages.pageBuilder.chrome.slideEmpty"), { n: i + 1 }))}
        newItem={() => ({
          id: `g_${nanoid(6)}`,
          src: "",
          alt: "",
          caption: "",
        })}
        renderFields={(item, update) => (
          <>
            <BuilderImageUrlField
              label={t("pages.pageBuilder.panel.imageUrl")}
              value={item.src}
              onChange={(v) => update({ src: v })}
              placeholder={t("pages.pageBuilder.chrome.imagePh")}
            />
            <TextField label={t("pages.pageBuilder.widgets.content.alt")} value={item.alt} onChange={(v) => update({ alt: v })} />
            <TextField
              label={t("pages.pageBuilder.widgets.content.caption")}
              value={item.caption ?? ""}
              onChange={(v) => update({ caption: v })}
            />
          </>
        )}
      />
      <Section title={t("pages.pageBuilder.chrome.displayMode")}>
        {isDedicatedCarousel ? (
          <p className="text-xs leading-relaxed text-editor-fg-muted">
            {t("pages.pageBuilder.chrome.carouselOnly")}
          </p>
        ) : (
          <SelectField
            label={t("pages.pageBuilder.widgets.fields.type")}
            value={isCarousel ? "carousel" : "grid"}
            options={[
              { value: "grid", label: t("pages.pageBuilder.chrome.grid") },
              { value: "carousel", label: t("pages.pageBuilder.chrome.carousel") },
            ]}
            onChange={(v) => setContent({ layout: v })}
          />
        )}
      </Section>
      {!isCarousel ? (
        <Section title={t("pages.pageBuilder.chrome.grid")}>
          <NumberField
            label={t("pages.pageBuilder.chrome.columns")}
            value={(content.columns as number) ?? 3}
            min={1}
            max={6}
            onChange={(v) => setContent({ columns: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.chrome.imageGap")}
            value={(content.gap as number) ?? 12}
            min={0}
            max={48}
            onChange={(v) => setContent({ gap: v })}
          />
        </Section>
      ) : (
        <Section title={t("pages.pageBuilder.chrome.carousel")}>
          <NumberField
            label={t("pages.pageBuilder.chrome.slideGap")}
            value={(content.gap as number) ?? 12}
            min={0}
            max={48}
            onChange={(v) => setContent({ gap: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.chrome.navigation")}
            value={(() => {
              const a = (content.carouselShowArrows as boolean) !== false;
              const d = (content.carouselShowDots as boolean) !== false;
              if (a && d) return "both";
              if (a) return "arrows";
              if (d) return "dots";
              return "none";
            })()}
            options={[
              { value: "both", label: t("pages.pageBuilder.chrome.arrowsDots") },
              { value: "arrows", label: t("pages.pageBuilder.chrome.arrowsOnly") },
              { value: "dots", label: t("pages.pageBuilder.chrome.dotsOnly") },
              { value: "none", label: t("pages.pageBuilder.widgets.opt.noneFem") },
            ]}
            onChange={(v) => {
              if (v === "both") setContent({ carouselShowArrows: true, carouselShowDots: true });
              else if (v === "arrows") setContent({ carouselShowArrows: true, carouselShowDots: false });
              else if (v === "dots") setContent({ carouselShowArrows: false, carouselShowDots: true });
              else setContent({ carouselShowArrows: false, carouselShowDots: false });
            }}
          />
          <NumberField
            label={t("pages.pageBuilder.chrome.slidesDesktop")}
            value={(content.carouselSlidesDesktop as number) ?? 1}
            min={1}
            max={12}
            onChange={(v) => setContent({ carouselSlidesDesktop: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.chrome.slidesTablet")}
            value={(content.carouselSlidesTablet as number) ?? 1}
            min={1}
            max={8}
            onChange={(v) => setContent({ carouselSlidesTablet: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.chrome.slidesMobile")}
            value={(content.carouselSlidesMobile as number) ?? 1}
            min={1}
            max={4}
            onChange={(v) => setContent({ carouselSlidesMobile: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.chrome.slidesScroll")}
            value={(content.carouselSlidesToScroll as number) ?? 1}
            min={1}
            max={6}
            onChange={(v) => setContent({ carouselSlidesToScroll: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.chrome.fillSlide")}
            value={(content.carouselObjectFit as string) === "contain" ? "contain" : "cover"}
            options={[
              { value: "cover", label: t("pages.pageBuilder.chrome.fillYes") },
              { value: "contain", label: t("pages.pageBuilder.chrome.fillNo") },
            ]}
            onChange={(v) => setContent({ carouselObjectFit: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.chrome.thumbWidth")}
            value={(content.carouselThumbWidthPx as number) ?? 0}
            min={0}
            max={400}
            onChange={(v) => setContent({ carouselThumbWidthPx: v })}
          />
          <p className="text-[10px] leading-relaxed text-editor-fg-muted">
            {t("pages.pageBuilder.chrome.thumbHint")}
          </p>
          <SelectField
            label={t("pages.pageBuilder.chrome.autoAdvance")}
            value={((content.carouselAutoplay as boolean) ?? true) ? "yes" : "no"}
            options={[
              { value: "yes", label: t("common.yes") },
              { value: "no", label: t("common.no") },
            ]}
            onChange={(v) => setContent({ carouselAutoplay: v === "yes" })}
          />
          <NumberField
            label={t("pages.pageBuilder.chrome.interval")}
            value={(content.carouselIntervalMs as number) ?? 4500}
            min={2000}
            max={12000}
            step={500}
            onChange={(v) => setContent({ carouselIntervalMs: v })}
          />
          <NumberField
            label={t("pages.pageBuilder.chrome.transition")}
            value={(content.carouselTransitionMs as number) ?? 450}
            min={100}
            max={2000}
            step={50}
            onChange={(v) => setContent({ carouselTransitionMs: v })}
          />
          <SelectField
            label={t("pages.pageBuilder.chrome.pauseHover")}
            value={((content.carouselPauseOnHover as boolean) ?? true) ? "yes" : "no"}
            options={[
              { value: "yes", label: t("common.yes") },
              { value: "no", label: t("common.no") },
            ]}
            onChange={(v) => setContent({ carouselPauseOnHover: v === "yes" })}
          />
        </Section>
      )}
      <Section title={t("pages.pageBuilder.chrome.appearance")}>
        <NumberField
          label={t("pages.pageBuilder.chrome.borderRadius")}
          value={(content.borderRadius as number) ?? 8}
          min={0}
          max={32}
          onChange={(v) => setContent({ borderRadius: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.aspect")}
          value={(content.aspectRatio as string) ?? "square"}
          options={[
            { value: "auto", label: t("pages.pageBuilder.chrome.original") },
            { value: "square", label: t("pages.pageBuilder.chrome.square") },
            { value: "landscape", label: t("pages.pageBuilder.chrome.landscape") },
            { value: "portrait", label: t("pages.pageBuilder.chrome.portrait") },
          ]}
          onChange={(v) => setContent({ aspectRatio: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.lightbox")}
          value={((content.enableLightbox as boolean) ?? true) ? "yes" : "no"}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
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
  const { t } = useAppLocale();
  const words = (content.rotatingWords as string[]) ?? [];
  return (
    <>
      <Section title={t("pages.pageBuilder.widgets.fields.text")}>
        <TextField
          label={t("pages.pageBuilder.widgets.fields.prefix")}
          value={(content.prefix as string) ?? ""}
          onChange={(v) => setContent({ prefix: v })}
        />
        <TextareaField
          label={t("pages.pageBuilder.chrome.rotating")}
          value={words.join("\n")}
          onChange={(v) => setContent({ rotatingWords: v.split("\n").filter(Boolean) })}
          rows={4}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.fields.suffix")}
          value={(content.suffix as string) ?? ""}
          onChange={(v) => setContent({ suffix: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.widgets.content.htmlTag")}
          value={(content.tag as string) ?? "h2"}
          options={[
            { value: "h1", label: "H1" },
            { value: "h2", label: "H2" },
            { value: "h3", label: "H3" },
          ]}
          onChange={(v) => setContent({ tag: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.chrome.animation")}>
        <SelectField
          label={t("pages.pageBuilder.widgets.fields.type")}
          value={(content.animation as string) ?? "fade"}
          options={[
            { value: "fade", label: t("pages.pageBuilder.chrome.animFade") },
            { value: "slide", label: t("pages.pageBuilder.chrome.animSlide") },
            { value: "typed", label: t("pages.pageBuilder.chrome.animTyped") },
            { value: "highlight", label: t("pages.pageBuilder.chrome.animHighlight") },
          ]}
          onChange={(v) => setContent({ animation: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.interval")}
          value={(content.intervalMs as number) ?? 2200}
          min={800}
          max={10000}
          step={200}
          onChange={(v) => setContent({ intervalMs: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.accent")}
          value={(content.highlightColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ highlightColor: v })}
        />
      </Section>
    </>
  );
}

function LivePlansContentEditor({
  content,
  setContent,
}: {
  content: Record<string, unknown>;
  setContent: (p: Record<string, unknown>) => void;
}) {
  const { t } = useAppLocale();
  return (
    <>
      <Section title={t("pages.pageBuilder.chrome.liveTitle")}>
        <p className="text-[11px] leading-snug text-editor-fg-muted">
          {t("pages.pageBuilder.chrome.liveHint")}
        </p>
        <label className="flex items-center gap-2 text-xs text-editor-fg">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-editor-border"
            checked={content.showHeader !== false}
            onChange={(e) => setContent({ showHeader: e.target.checked })}
          />
          {t("pages.pageBuilder.chrome.showHeader")}
        </label>
        <TextField
          label={t("pages.pageBuilder.chrome.eyebrow")}
          value={(content.sectionLabel as string) ?? ""}
          onChange={(v) => setContent({ sectionLabel: v })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.fields.title")}
          value={(content.title as string) ?? ""}
          onChange={(v) => setContent({ title: v })}
        />
        <TextareaField
          label={t("pages.pageBuilder.chrome.subtitle")}
          value={(content.subtitle as string) ?? ""}
          onChange={(v) => setContent({ subtitle: v })}
          rows={3}
        />
      </Section>
      <Section title={t("pages.pageBuilder.colors")}>
        <ColorField
          label={t("pages.pageBuilder.chrome.accentShort")}
          value={(content.accentColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ accentColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.cardBg")}
          value={(content.cardBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ cardBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.widgets.fields.text")}
          value={(content.textColor as string) ?? "#0f172a"}
          onChange={(v) => setContent({ textColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.buttonBg")}
          value={(content.ctaBg as string) ?? "#e63946"}
          onChange={(v) => setContent({ ctaBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.buttonFg")}
          value={(content.ctaColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ ctaColor: v })}
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
  const { t } = useAppLocale();
  const features =
    (content.features as Array<{ id: string; text: string; included: boolean }>) ?? [];
  return (
    <>
      <Section title={t("pages.pageBuilder.chrome.header")}>
        <TextField
          label={t("pages.pageBuilder.chrome.badgeOpt")}
          value={(content.badge as string) ?? ""}
          onChange={(v) => setContent({ badge: v })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.fields.title")}
          value={(content.title as string) ?? ""}
          onChange={(v) => setContent({ title: v })}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.subtitle")}
          value={(content.subtitle as string) ?? ""}
          onChange={(v) => setContent({ subtitle: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.chrome.price")}>
        <TextField
          label={t("pages.pageBuilder.chrome.currency")}
          value={(content.currency as string) ?? "R$"}
          onChange={(v) => setContent({ currency: v })}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.amount")}
          value={(content.price as string) ?? ""}
          onChange={(v) => setContent({ price: v })}
        />
        <TextField
          label={t("common.period")}
          value={(content.period as string) ?? t("pages.pageBuilder.livePlans.perMonth")}
          onChange={(v) => setContent({ period: v })}
        />
      </Section>
      <ListEditor
        title={t("pages.pageBuilder.chrome.features")}
        items={features}
        onChange={(next) => setContent({ features: next })}
        itemLabel={(it) => it.text || t("pages.pageBuilder.chrome.featureFallback")}
        newItem={() => ({ id: `pf_${nanoid(6)}`, text: t("pages.pageBuilder.defaults.newFeature"), included: true })}
        renderFields={(item, update) => (
          <>
            <TextField label={t("pages.pageBuilder.widgets.fields.text")} value={item.text} onChange={(v) => update({ text: v })} />
            <SelectField
              label={t("pages.pageBuilder.chrome.included")}
              value={item.included ? "yes" : "no"}
              options={[
                { value: "yes", label: t("pages.pageBuilder.chrome.yesCheck") },
                { value: "no", label: t("pages.pageBuilder.chrome.noCross") },
              ]}
              onChange={(v) => update({ included: v === "yes" })}
            />
          </>
        )}
      />
      <Section title="CTA">
        <TextField
          label={t("pages.pageBuilder.widgets.fields.buttonText")}
          value={(content.ctaText as string) ?? ""}
          onChange={(v) => setContent({ ctaText: v })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.opt.link")}
          value={(content.ctaHref as string) ?? "#"}
          onChange={(v) => setContent({ ctaHref: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.chrome.appearance")}>
        <SelectField
          label={t("pages.pageBuilder.chrome.highlighted")}
          value={(content.highlighted as boolean) ? "yes" : "no"}
          options={[
            { value: "no", label: t("common.no") },
            { value: "yes", label: t("pages.pageBuilder.chrome.highlightedYes") },
          ]}
          onChange={(v) => setContent({ highlighted: v === "yes" })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.cardBg")}
          value={(content.cardBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ cardBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.panel.textColor")}
          value={(content.textColor as string) ?? "#1a1a1a"}
          onChange={(v) => setContent({ textColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.accent")}
          value={(content.accentColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ accentColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.ctaBg")}
          value={(content.ctaBg as string) ?? "#e63946"}
          onChange={(v) => setContent({ ctaBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.ctaColor")}
          value={(content.ctaColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ ctaColor: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.panel.radius")}
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
  const { t } = useAppLocale();
  return (
    <>
      <Section title={t("pages.pageBuilder.content")}>
        <TextField
          label={t("pages.pageBuilder.widgets.fields.title")}
          value={(content.title as string) ?? ""}
          onChange={(v) => setContent({ title: v })}
        />
        <TextareaField
          label={t("pages.pageBuilder.widgets.fields.description")}
          value={(content.description as string) ?? ""}
          onChange={(v) => setContent({ description: v })}
          rows={3}
        />
      </Section>
      <Section title={t("pages.pageBuilder.chrome.buttons")}>
        <TextField
          label={t("pages.pageBuilder.chrome.primaryText")}
          value={(content.primaryText as string) ?? ""}
          onChange={(v) => setContent({ primaryText: v })}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.primaryLink")}
          value={(content.primaryHref as string) ?? "#"}
          onChange={(v) => setContent({ primaryHref: v })}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.secondaryText")}
          value={(content.secondaryText as string) ?? ""}
          onChange={(v) => setContent({ secondaryText: v })}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.secondaryLink")}
          value={(content.secondaryHref as string) ?? "#"}
          onChange={(v) => setContent({ secondaryHref: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.disposition")}>
        <SelectField
          label={t("pages.pageBuilder.disposition")}
          value={(content.layout as string) ?? "centered"}
          options={[
            { value: "centered", label: t("pages.pageBuilder.chrome.centered") },
            { value: "split", label: t("pages.pageBuilder.chrome.split") },
          ]}
          onChange={(v) => setContent({ layout: v })}
        />
        <BuilderImageUrlField
          label={t("pages.pageBuilder.chrome.splitImage")}
          value={(content.imageUrl as string) ?? ""}
          onChange={(v) => setContent({ imageUrl: v })}
          placeholder={t("pages.pageBuilder.chrome.imagePh")}
        />
      </Section>
      <Section title={t("pages.pageBuilder.chrome.appearance")}>
        <ColorField
          label={t("pages.pageBuilder.background")}
          value={(content.background as string) ?? "#0f172a"}
          onChange={(v) => setContent({ background: v })}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.gradient")}
          value={(content.gradient as string) ?? ""}
          placeholder="linear-gradient(...)"
          onChange={(v) => setContent({ gradient: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.panel.textColor")}
          value={(content.textColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ textColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.primaryBg")}
          value={(content.primaryBg as string) ?? "#e63946"}
          onChange={(v) => setContent({ primaryBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.primaryColor")}
          value={(content.primaryColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ primaryColor: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.panel.radius")}
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
  const { t } = useAppLocale();
  return (
    <>
      <Section title={t("pages.pageBuilder.chrome.front")}>
        <TextField
          label={t("pages.pageBuilder.chrome.iconEmoji")}
          value={(content.frontIcon as string) ?? ""}
          onChange={(v) => setContent({ frontIcon: v })}
        />
        <TextField
          label={t("pages.pageBuilder.widgets.fields.title")}
          value={(content.frontTitle as string) ?? ""}
          onChange={(v) => setContent({ frontTitle: v })}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.subtitle")}
          value={(content.frontSubtitle as string) ?? ""}
          onChange={(v) => setContent({ frontSubtitle: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.background")}
          value={(content.frontBg as string) ?? "#1f2937"}
          onChange={(v) => setContent({ frontBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.panel.textColor")}
          value={(content.frontTextColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ frontTextColor: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.chrome.back")}>
        <TextField
          label={t("pages.pageBuilder.widgets.fields.title")}
          value={(content.backTitle as string) ?? ""}
          onChange={(v) => setContent({ backTitle: v })}
        />
        <TextareaField
          label={t("pages.pageBuilder.widgets.fields.description")}
          value={(content.backDescription as string) ?? ""}
          onChange={(v) => setContent({ backDescription: v })}
          rows={3}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.ctaTextOpt")}
          value={(content.backCtaText as string) ?? ""}
          onChange={(v) => setContent({ backCtaText: v })}
        />
        <TextField
          label={t("pages.pageBuilder.chrome.ctaLink")}
          value={(content.backCtaHref as string) ?? "#"}
          onChange={(v) => setContent({ backCtaHref: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.background")}
          value={(content.backBg as string) ?? "#e63946"}
          onChange={(v) => setContent({ backBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.panel.textColor")}
          value={(content.backTextColor as string) ?? "#ffffff"}
          onChange={(v) => setContent({ backTextColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.ctaBg")}
          value={(content.backCtaBg as string) ?? "#ffffff"}
          onChange={(v) => setContent({ backCtaBg: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.ctaColor")}
          value={(content.backCtaColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ backCtaColor: v })}
        />
      </Section>
      <Section title={t("pages.pageBuilder.chrome.behavior")}>
        <SelectField
          label={t("pages.pageBuilder.chrome.flipTrigger")}
          value={(content.trigger as string) ?? "hover"}
          options={[
            { value: "hover", label: t("pages.pageBuilder.chrome.onHover") },
            { value: "click", label: t("pages.pageBuilder.chrome.onClick") },
          ]}
          onChange={(v) => setContent({ trigger: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.direction")}
          value={(content.flipDirection as string) ?? "horizontal"}
          options={[
            { value: "horizontal", label: t("pages.pageBuilder.chrome.horizontal") },
            { value: "vertical", label: t("pages.pageBuilder.chrome.vertical") },
          ]}
          onChange={(v) => setContent({ flipDirection: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.widgets.fields.heightPx")}
          value={(content.height as number) ?? 280}
          min={120}
          max={600}
          onChange={(v) => setContent({ height: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.panel.radius")}
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
  const { t } = useAppLocale();
  const items =
    (content.items as Array<{ id: string; label: string; value: number; color?: string }>) ?? [];
  type PItem = { id: string; label: string; value: number; color?: string };
  return (
    <>
      <ListEditor
        title={t("pages.pageBuilder.chrome.progressItems")}
        items={items}
        onChange={(next) => setContent({ items: next })}
        itemLabel={(it) => `${it.label} — ${it.value}%`}
        newItem={() => ({ id: `pb_${nanoid(6)}`, label: "Novo", value: 50, color: "" }) as PItem}
        renderFields={(item, update) => (
          <>
            <TextField label={t("pages.pageBuilder.chrome.fieldLabel")} value={item.label} onChange={(v) => update({ label: v })} />
            <NumberField
              label={t("pages.pageBuilder.chrome.valueRange")}
              value={item.value}
              min={0}
              max={100}
              onChange={(v) => update({ value: Math.max(0, Math.min(100, v)) })}
            />
            <ColorField
              label={t("pages.pageBuilder.chrome.colorOpt")}
              value={item.color ?? ""}
              onChange={(v) => update({ color: v })}
            />
          </>
        )}
      />
      <Section title={t("pages.pageBuilder.chrome.fontStyle")}>
        <SelectField
          label={t("pages.pageBuilder.widgets.fields.type")}
          value={(content.variant as string) ?? "bar"}
          options={[
            { value: "bar", label: t("pages.pageBuilder.chrome.bars") },
            { value: "circle", label: t("pages.pageBuilder.chrome.circles") },
          ]}
          onChange={(v) => setContent({ variant: v })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.showPercent")}
          value={(content.showPercent as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
          ]}
          onChange={(v) => setContent({ showPercent: v === "yes" })}
        />
        <SelectField
          label={t("pages.pageBuilder.chrome.animateIn")}
          value={(content.animate as boolean) ?? true ? "yes" : "no"}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
          ]}
          onChange={(v) => setContent({ animate: v === "yes" })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.barHeight")}
          value={(content.height as number) ?? 10}
          min={4}
          max={40}
          onChange={(v) => setContent({ height: v })}
        />
        <NumberField
          label={t("pages.pageBuilder.chrome.itemGap")}
          value={(content.gap as number) ?? 20}
          min={4}
          max={60}
          onChange={(v) => setContent({ gap: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.trackColor")}
          value={(content.trackColor as string) ?? "#e5e7eb"}
          onChange={(v) => setContent({ trackColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.fillColor")}
          value={(content.fillColor as string) ?? "#e63946"}
          onChange={(v) => setContent({ fillColor: v })}
        />
        <ColorField
          label={t("pages.pageBuilder.chrome.labelColor")}
          value={(content.labelColor as string) ?? "#1a1a1a"}
          onChange={(v) => setContent({ labelColor: v })}
        />
      </Section>
    </>
  );
}
