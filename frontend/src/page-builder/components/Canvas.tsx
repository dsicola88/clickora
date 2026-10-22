import { useLayoutEffect, useRef, useState } from "react";
import type { SelectionTarget } from "../types";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useBuilder, resolveResponsive } from "../store";
import type {
  ColumnNode,
  DeviceType,
  SectionNode,
  WidgetNode,
} from "../types";
import { WIDGET_REGISTRY } from "../widget-registry";
import { NestedRenderProvider } from "../nested-render";
import { columnFlexItem, isSectionStacked, sectionColumnsGrid, sectionDirectionFor, stylesToCss, stylesToCssWidgetShell } from "../style-utils";
import { WidgetInlineStyle } from "../widget-custom-css";
import { InlineEditProvider } from "../inline-edit";
import {
  Plus,
  Copy,
  Trash2,
  GripVertical,
  Columns3,
  ChevronUp,
  ChevronDown,
  Blocks,
  LayoutTemplate,
} from "lucide-react";
import { SectionBackgroundVideo } from "./SectionBackgroundVideo";
import { SECTION_LAYOUTS } from "../section-layouts";
import { BlocksModal } from "./BlocksModal";
import { TemplatesModal } from "./TemplatesModal";

const DEVICE_WIDTHS: Record<DeviceType, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export function Canvas() {
  const doc = useBuilder((s) => s.doc);
  const device = useBuilder((s) => s.device);
  const preview = useBuilder((s) => s.preview);
  const select = useBuilder((s) => s.select);
  const addSectionLayout = useBuilder((s) => s.addSectionLayout);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!layoutOpen) return;
    layoutRef.current?.scrollIntoView({ block: "nearest" });
  }, [layoutOpen]);
  const [menu, setMenu] = useState<{ x: number; y: number; target: Exclude<SelectionTarget, null> } | null>(
    null,
  );

  const openMenu = (event: React.MouseEvent, target: Exclude<SelectionTarget, null>) => {
    event.preventDefault();
    event.stopPropagation();
    select(target);
    setMenu({ x: event.clientX, y: event.clientY, target });
  };

  return (
    <div
      className="editor-scrollbar h-full min-h-0 min-w-0 overflow-auto bg-editor-canvas"
      onClick={() => {
        if (!preview) select(null);
        setLayoutOpen(false);
        setMenu(null);
      }}
    >
      <div className={`flex min-h-full justify-center ${preview ? "p-0" : "p-6"}`}>
        <div
          className="flex min-h-full flex-col bg-white shadow-2xl transition-[width] duration-200"
          style={{
            width: DEVICE_WIDTHS[device],
            maxWidth: "100%",
            background: doc.settings.background ?? "#ffffff",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {doc.sections.length === 0 ? (
            <EmptyCanvasDropZone
              onAddLayout={(widths) => addSectionLayout(widths)}
              onOpenBlocks={() => setBlocksOpen(true)}
              onOpenTemplates={() => setTemplatesOpen(true)}
            />
          ) : (
            doc.sections.map((section, idx) => (
              <SectionView
                key={section.id}
                section={section}
                index={idx}
                count={doc.sections.length}
                device={device}
                preview={preview}
                onContextMenu={openMenu}
              />
            ))
          )}

          {!preview && doc.sections.length > 0 && (
            <div className="relative mx-4 mb-6 mt-auto pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLayoutOpen((v) => !v);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-editor-accent hover:text-editor-accent"
              >
                <Plus className="h-4 w-4" /> Adicionar secção
              </button>
              {layoutOpen ? (
                <div
                  ref={layoutRef}
                  className="mt-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Estrutura
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {SECTION_LAYOUTS.map((layout) => (
                      <button
                        key={layout.label}
                        type="button"
                        title={layout.widths.join(" / ")}
                        onClick={() => {
                          addSectionLayout(layout.widths);
                          setLayoutOpen(false);
                        }}
                        className="flex h-12 items-center gap-0.5 rounded-md border border-slate-200 px-1.5 hover:border-editor-accent"
                      >
                        {layout.widths.map((w, i) => (
                          <span
                            key={i}
                            className="h-7 rounded-sm bg-slate-200"
                            style={{ flex: w }}
                          />
                        ))}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {menu && !preview ? <CanvasContextMenu menu={menu} onClose={() => setMenu(null)} /> : null}
      <BlocksModal open={blocksOpen} onClose={() => setBlocksOpen(false)} />
      <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
    </div>
  );
}

function EmptyCanvasDropZone({
  onAddLayout,
  onOpenBlocks,
  onOpenTemplates,
}: {
  onAddLayout: (widths: number[]) => void;
  onOpenBlocks: () => void;
  onOpenTemplates: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas:empty",
    data: { kind: "canvas-empty" },
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[70vh] flex-col items-center justify-center gap-5 p-8 text-center transition-colors sm:p-12 ${
        isOver ? "bg-rose-50" : "bg-white"
      }`}
    >
      <div className="rounded-full bg-slate-100 p-5">
        <Columns3 className="h-9 w-9 text-slate-400" />
      </div>
      <div className="max-w-lg">
        <h3 className="mb-1 text-lg font-semibold text-slate-900">Monte a página do zero</h3>
        <p className="text-sm leading-relaxed text-slate-500">
          Fluxo tipo Elementor: escolha a estrutura de colunas, arraste widgets da esquerda e estilize no
          painel direito. Ou use blocos / modelo e edite tudo depois.
        </p>
      </div>

      <div className="w-full max-w-md">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Estrutura da primeira secção
        </p>
        <div className="grid grid-cols-4 gap-2">
          {SECTION_LAYOUTS.map((layout) => (
            <button
              key={layout.label}
              type="button"
              title={layout.title}
              onClick={() => onAddLayout(layout.widths)}
              className="flex h-14 flex-col items-center justify-center gap-1 rounded-md border border-slate-200 px-1.5 hover:border-editor-accent hover:bg-slate-50"
            >
              <span className="flex h-7 w-full items-stretch gap-0.5 px-0.5">
                {layout.widths.map((w, i) => (
                  <span key={i} className="rounded-sm bg-slate-300" style={{ flex: w }} />
                ))}
              </span>
              <span className="text-[9px] font-medium text-slate-500">{layout.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onOpenBlocks}
          className="inline-flex items-center gap-2 rounded-md bg-editor-accent px-4 py-2 text-sm font-medium text-editor-accent-fg hover:opacity-90"
        >
          <Blocks className="h-4 w-4" /> Blocos DTC
        </button>
        <button
          type="button"
          onClick={onOpenTemplates}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-editor-accent"
        >
          <LayoutTemplate className="h-4 w-4" /> Modelos
        </button>
      </div>
      <p className="max-w-sm text-[11px] text-slate-400">
        Também pode arrastar «Menu», «Botão», «Lista com ícones» ou «Banner de cookies» da barra esquerda.
      </p>
    </div>
  );
}

function SectionView({
  section,
  index,
  count,
  device,
  preview,
  onContextMenu,
}: {
  section: SectionNode;
  index: number;
  count: number;
  device: DeviceType;
  preview: boolean;
  onContextMenu: (event: React.MouseEvent, target: Exclude<SelectionTarget, null>) => void;
}) {
  const selection = useBuilder((s) => s.selection);
  const select = useBuilder((s) => s.select);
  const removeSection = useBuilder((s) => s.removeSection);
  const duplicateSection = useBuilder((s) => s.duplicateSection);
  const moveSection = useBuilder((s) => s.moveSection);
  const addColumn = useBuilder((s) => s.addColumn);
  const setColumnWidths = useBuilder((s) => s.setColumnWidths);
  const [liveWidths, setLiveWidths] = useState<number[] | null>(null);

  const isSelected =
    selection?.kind === "section" &&
    (selection as Extract<SelectionTarget, { kind: "section" }>).id === section.id;
  const sectionStyle = stylesToCss(section.styles, device);
  const gap = resolveResponsive(section.columnGap, device) ?? 20;
  const bgVideo = (section.backgroundVideoUrl ?? "").trim();
  const hasBgVideo = bgVideo.length > 0;
  const isStickyOrFixed =
    resolveResponsive(section.styles.position, device) === "sticky" ||
    resolveResponsive(section.styles.position, device) === "fixed";
  const widths =
    liveWidths ?? section.columns.map((c) => resolveResponsive(c.widthPercent, device) ?? 100);
  const direction = sectionDirectionFor(section.flex?.direction, device, section.columns.length);
  const stacked = isSectionStacked(direction);

  return (
    <div
      className={`group/section ${isStickyOrFixed ? "" : "relative"} ${!preview ? "transition-shadow" : ""}`}
      data-header={isStickyOrFixed ? "1" : undefined}
      onContextMenu={(event) => onContextMenu(event, { kind: "section", id: section.id })}
      style={{
        ...sectionStyle,
        ...(hasBgVideo && !isStickyOrFixed
          ? { position: "relative", overflow: "hidden" as const }
          : {}),
        ...(isStickyOrFixed
          ? {
              position: sectionStyle.position ?? "sticky",
              top: sectionStyle.top ?? 0,
              zIndex: sectionStyle.zIndex ?? 200,
              width: "100%",
            }
          : {}),
      }}
      onClick={(e) => {
        if (preview) return;
        e.stopPropagation();
        select({ kind: "section", id: section.id });
      }}
    >
      {hasBgVideo ? <SectionBackgroundVideo rawUrl={bgVideo} pointerEventsNone /> : null}

      {!preview && (
        <div
          className={`pointer-events-none absolute inset-0 z-[5] border-2 transition-colors ${
            isSelected ? "border-editor-section" : "border-transparent group-hover/section:border-editor-section/40"
          }`}
        />
      )}

      {!preview && (
        <div
          className={`absolute left-2 top-2 z-20 flex items-center gap-0.5 rounded-md bg-editor-section px-1 py-0.5 text-white shadow-sm transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover/section:opacity-100"
          }`}
        >
          <span className="px-1 text-[10px] font-semibold uppercase tracking-wider" data-pb-hint-chip>
            Secção · layout
          </span>
          <ToolbarBtn
            title="Mover para cima"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              moveSection(index, index - 1);
            }}
          >
            <ChevronUp className="h-3 w-3" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Mover para baixo"
            disabled={index >= count - 1}
            onClick={(e) => {
              e.stopPropagation();
              moveSection(index, index + 1);
            }}
          >
            <ChevronDown className="h-3 w-3" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Adicionar coluna"
            onClick={(e) => {
              e.stopPropagation();
              addColumn(section.id);
            }}
          >
            <Plus className="h-3 w-3" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Duplicar"
            onClick={(e) => {
              e.stopPropagation();
              duplicateSection(section.id);
            }}
          >
            <Copy className="h-3 w-3" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Excluir"
            onClick={(e) => {
              e.stopPropagation();
              removeSection(section.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </ToolbarBtn>
        </div>
      )}

      <div
        className="relative z-[1] mx-auto"
        style={{
          maxWidth: section.layout === "boxed" ? `${section.contentWidth}px` : "100%",
          ...sectionColumnsGrid(widths, device, gap, {
            direction,
            justify: resolveResponsive(section.flex?.justify, device),
            align: resolveResponsive(section.flex?.align, device),
            wrap: resolveResponsive(section.flex?.wrap, device),
          }),
        }}
      >
        {section.columns.map((column, columnIndex) => (
          <ColumnView
            key={column.id}
            section={section}
            column={column}
            device={device}
            preview={preview}
            stacked={stacked}
            widthPercent={widths[columnIndex] ?? 100}
            onContextMenu={onContextMenu}
          />
        ))}
        {!preview && !stacked && section.columns.length > 1
          ? section.columns.slice(0, -1).map((_, leftIndex) => {
              const total = widths.reduce((sum, width) => sum + width, 0) || 1;
              const left = widths.slice(0, leftIndex + 1).reduce((sum, width) => sum + width, 0);
              return (
                <div
                  key={`resize-${leftIndex}`}
                  role="separator"
                  aria-orientation="vertical"
                  title="Arrastar para mudar a largura"
                  className="absolute top-0 z-30 h-full w-3 -translate-x-1/2 cursor-col-resize"
                  style={{ left: `${(left / total) * 100}%` }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const startX = event.clientX;
                    const start = widths.slice();
                    const pair = start[leftIndex] + start[leftIndex + 1];
                    const bounds = (event.currentTarget.parentElement?.getBoundingClientRect().width ?? 1);
                    const move = (ev: PointerEvent) => {
                      const delta = ((ev.clientX - startX) / bounds) * 100;
                      let nextLeft = start[leftIndex] + delta;
                      nextLeft = Math.max(12, Math.min(pair - 12, nextLeft));
                      const next = start.slice();
                      next[leftIndex] = nextLeft;
                      next[leftIndex + 1] = pair - nextLeft;
                      setLiveWidths(next);
                    };
                    const up = (ev: PointerEvent) => {
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", up);
                      const delta = ((ev.clientX - startX) / bounds) * 100;
                      let nextLeft = start[leftIndex] + delta;
                      nextLeft = Math.max(12, Math.min(pair - 12, nextLeft));
                      const next = start.slice();
                      next[leftIndex] = nextLeft;
                      next[leftIndex + 1] = pair - nextLeft;
                      setLiveWidths(null);
                      setColumnWidths(section.id, next, device);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <span className="absolute inset-y-2 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-editor-column/70 opacity-0 transition-opacity hover:opacity-100" />
                </div>
              );
            })
          : null}
      </div>
    </div>
  );
}

function ColumnView({
  section,
  column,
  device,
  preview,
  stacked,
  widthPercent,
  onContextMenu,
}: {
  section: SectionNode;
  column: ColumnNode;
  device: DeviceType;
  preview: boolean;
  stacked: boolean;
  widthPercent: number;
  onContextMenu: (event: React.MouseEvent, target: Exclude<SelectionTarget, null>) => void;
}) {
  const selection = useBuilder((s) => s.selection);
  const select = useBuilder((s) => s.select);
  const removeColumn = useBuilder((s) => s.removeColumn);

  const isSelected =
    selection?.kind === "column" &&
    (selection as Extract<SelectionTarget, { kind: "column" }>).id === column.id;
  const colStyle = stylesToCss(column.styles, device);

  const { setNodeRef, isOver } = useDroppable({
    id: `col:${column.id}`,
    data: { kind: "column", sectionId: section.id, columnId: column.id },
    disabled: preview,
  });

  return (
    <div
      ref={setNodeRef}
      className="group/column relative min-h-[48px] min-w-0"
      style={{
        ...columnFlexItem(widthPercent, stacked),
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        ...colStyle,
      }}
      onClick={(e) => {
        if (preview) return;
        e.stopPropagation();
        select({ kind: "column", sectionId: section.id, id: column.id });
      }}
      onContextMenu={(event) =>
        onContextMenu(event, { kind: "column", sectionId: section.id, id: column.id })
      }
    >
      {!preview && (
        <div
          className={`pointer-events-none absolute inset-0 border border-dashed transition-colors ${
            isSelected
              ? "border-editor-column"
              : isOver
                ? "border-editor-accent bg-rose-50/80"
                : "border-transparent group-hover/column:border-editor-column/40"
          }`}
        />
      )}

      {!preview && (
        <div
          className={`absolute left-1 top-1 z-10 flex items-center gap-0.5 rounded-md bg-editor-column px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover/column:opacity-100"
          }`}
          data-pb-hint-chip
        >
          <span>Coluna</span>
          {section.columns.length > 1 ? (
            <ToolbarBtn
              title="Excluir coluna"
              onClick={(e) => {
                e.stopPropagation();
                removeColumn(section.id, column.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </ToolbarBtn>
          ) : null}
        </div>
      )}

      {column.widgets.length === 0 && !preview ? (
        <div className="m-2 flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
          <span className="font-medium text-slate-600">Largue um elemento aqui</span>
          <span className="text-[10px] text-slate-400">Título, texto ou botão na barra à esquerda</span>
        </div>
      ) : (
        column.widgets.map((widget, index) =>
          preview ? (
            <StaticWidget
              key={widget.id}
              widget={widget}
              device={device}
            />
          ) : (
            <EditableWidget
              key={widget.id}
              section={section}
              column={column}
              widget={widget}
              index={index}
              device={device}
              depth={0}
              onContextMenu={onContextMenu}
            />
          ),
        )
      )}
    </div>
  );
}

function StaticWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const def = WIDGET_REGISTRY[widget.type];
  if (!def) return null;
  const shell = stylesToCssWidgetShell(widget.styles, device);
  const wid = widget.cssId?.trim();
  const wcls = widget.cssClasses?.trim();
  return (
    <div
      className={wcls || undefined}
      id={wid || undefined}
      style={{ ...shell, minWidth: shell.flexShrink === 0 ? "auto" : 0 }}
    >
      <WidgetInlineStyle widget={widget} />
      <def.Render widget={widget} device={device} />
    </div>
  );
}

function EditableWidget({
  section,
  column,
  widget,
  index,
  device,
  depth,
  containerId,
  onContextMenu,
}: {
  section: SectionNode;
  column: ColumnNode;
  widget: WidgetNode;
  index: number;
  device: DeviceType;
  depth: number;
  containerId?: string;
  onContextMenu: (event: React.MouseEvent, target: Exclude<SelectionTarget, null>) => void;
}) {
  const selection = useBuilder((s) => s.selection);
  const select = useBuilder((s) => s.select);
  const removeWidget = useBuilder((s) => s.removeWidget);
  const duplicateWidget = useBuilder((s) => s.duplicateWidget);
  const updateWidget = useBuilder((s) => s.updateWidget);

  const def = WIDGET_REGISTRY[widget.type];
  const shell = stylesToCssWidgetShell(widget.styles, device);
  const isSelected =
    selection?.kind === "widget" &&
    (selection as Extract<SelectionTarget, { kind: "widget" }>).id === widget.id;

  const wid = widget.cssId?.trim();
  const wcls = widget.cssClasses?.trim();

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot:${widget.id}`,
    data: {
      kind: "widget-slot",
      sectionId: section.id,
      columnId: column.id,
      index,
      containerId,
      depth,
    },
  });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `canvas:${widget.id}`,
    data: {
      source: "canvas-widget",
      sectionId: section.id,
      columnId: column.id,
      widgetId: widget.id,
    },
  });

  if (!def) return null;

  const body = (
    <>
      <InlineEditProvider
        value={(patch) =>
          updateWidget(section.id, column.id, widget.id, {
            content: { ...widget.content, ...patch },
          })
        }
      >
        <WidgetInlineStyle widget={widget} />
        <def.Render widget={widget} device={device} />
      </InlineEditProvider>
    </>
  );

  return (
    <div
      ref={widget.type === "container" ? undefined : setDropRef}
      className={`group/widget relative${wcls ? ` ${wcls}` : ""}${isDragging ? " opacity-40" : ""}`}
      id={wid || undefined}
      style={{
        ...shell,
        minWidth: containerId ? (shell.flexShrink === 0 ? "auto" : 0) : shell.minWidth,
      }}
      onClick={(e) => {
        e.stopPropagation();
        select({
          kind: "widget",
          sectionId: section.id,
          columnId: column.id,
          id: widget.id,
        });
      }}
      onContextMenu={(event) =>
        onContextMenu(event, {
          kind: "widget",
          sectionId: section.id,
          columnId: column.id,
          id: widget.id,
        })
      }
    >
      {widget.type === "container" ? (
        <div ref={setDropRef} className="absolute inset-x-0 -top-1 z-40 h-2" />
      ) : null}
      {isOver ? <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 bg-editor-accent" /> : null}
      <div
        className={`pointer-events-none absolute inset-0 z-10 transition-shadow ${
          isSelected
            ? "shadow-[inset_0_0_0_2px_var(--editor-widget)]"
            : "group-hover/widget:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--editor-widget)_55%,transparent)]"
        }`}
      />
      {/* Handle tipo Elementor: canto superior esquerdo — deixa claro que é o ELEMENTO, não a secção */}
      <div
        className={`absolute -left-px -top-px z-20 flex items-stretch overflow-hidden rounded-br-md bg-editor-widget text-white shadow-md transition-opacity ${
          isSelected || isDragging ? "opacity-100" : "opacity-0 group-hover/widget:opacity-100"
        }`}
      >
        <button
          type="button"
          title="Arrastar elemento"
          ref={setDragRef}
          {...listeners}
          {...attributes}
          className="flex w-6 cursor-grab items-center justify-center bg-black/15 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-0.5 px-1.5 py-0.5">
          <span className="max-w-[7rem] truncate px-0.5 text-[10px] font-semibold uppercase tracking-wider">
            {def.label}
          </span>
          <ToolbarBtn
            title="Duplicar"
            onClick={(e) => {
              e.stopPropagation();
              duplicateWidget(section.id, column.id, widget.id);
            }}
          >
            <Copy className="h-3 w-3" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Excluir"
            onClick={(e) => {
              e.stopPropagation();
              removeWidget(section.id, column.id, widget.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </ToolbarBtn>
        </div>
      </div>

      {widget.type === "container" ? (
        <NestedRenderProvider
          value={{
            depth: depth + 1,
            sectionId: section.id,
            columnId: column.id,
            containerId: widget.id,
            render: (child, childIndex) => (
              <EditableWidget
                key={child.id}
                section={section}
                column={column}
                widget={child}
                index={childIndex}
                device={device}
                depth={depth + 1}
                containerId={widget.id}
                onContextMenu={onContextMenu}
              />
            ),
          }}
        >
          {body}
        </NestedRenderProvider>
      ) : (
        body
      )}
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function CanvasContextMenu({
  menu,
  onClose,
}: {
  menu: { x: number; y: number; target: Exclude<SelectionTarget, null> };
  onClose: () => void;
}) {
  const clipboard = useBuilder((s) => s.clipboard);
  const styleClipboard = useBuilder((s) => s.styleClipboard);
  const copySelection = useBuilder((s) => s.copySelection);
  const pasteClipboard = useBuilder((s) => s.pasteClipboard);
  const copyStyle = useBuilder((s) => s.copyStyle);
  const pasteStyle = useBuilder((s) => s.pasteStyle);
  const deleteSelection = useBuilder((s) => s.deleteSelection);
  const duplicateSelection = useBuilder((s) => s.duplicateSelection);
  const doc = useBuilder((s) => s.doc);
  const moveSection = useBuilder((s) => s.moveSection);

  const sectionIndex =
    menu.target.kind === "section" ? doc.sections.findIndex((section) => section.id === menu.target.id) : -1;

  const run = (action: () => void) => {
    action();
    onClose();
  };

  const items: Array<{ label: string; hint?: string; disabled?: boolean; action: () => void; danger?: boolean }> = [
    {
      label: "Duplicar",
      hint: "⌘D",
      disabled: menu.target.kind === "column",
      action: () => duplicateSelection(),
    },
    {
      label: "Copiar",
      hint: "⌘C",
      disabled: menu.target.kind !== "widget",
      action: () => copySelection(),
    },
    {
      label: "Colar",
      hint: "⌘V",
      disabled: !clipboard,
      action: () => pasteClipboard(),
    },
    {
      label: "Copiar estilo",
      hint: "⇧⌘C",
      action: () => copyStyle(),
    },
    {
      label: "Colar estilo",
      hint: "⇧⌘V",
      disabled: !styleClipboard,
      action: () => pasteStyle(),
    },
  ];
  if (menu.target.kind === "section") {
    items.push(
      {
        label: "Mover para cima",
        disabled: sectionIndex <= 0,
        action: () => moveSection(sectionIndex, sectionIndex - 1),
      },
      {
        label: "Mover para baixo",
        disabled: sectionIndex < 0 || sectionIndex >= doc.sections.length - 1,
        action: () => moveSection(sectionIndex, sectionIndex + 1),
      },
    );
  }
  items.push({
    label: "Eliminar",
    hint: "⌫",
    danger: true,
    action: () => deleteSelection(),
  });

  return (
    <div className="fixed inset-0 z-[280]" onClick={onClose} onContextMenu={(event) => event.preventDefault()}>
      <div
        className="absolute min-w-[11rem] overflow-hidden rounded-md border border-editor-border bg-editor-panel py-1 text-editor-fg shadow-2xl"
        style={{ left: menu.x, top: menu.y }}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={() => run(item.action)}
            className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-xs hover:bg-editor-border disabled:cursor-not-allowed disabled:opacity-40 ${
              item.danger ? "text-red-300" : ""
            }`}
          >
            <span>{item.label}</span>
            {item.hint ? <span className="text-[10px] text-editor-fg-muted">{item.hint}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
