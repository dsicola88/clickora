import { useDroppable } from "@dnd-kit/core";
import { useBuilder, resolveResponsive } from "../store";
import type {
  ColumnNode,
  DeviceType,
  SectionNode,
  SelectionTarget,
  WidgetNode,
} from "../types";
import { WIDGET_REGISTRY } from "../widget-registry";
import { stylesToCss, stylesToCssWidgetShell } from "../style-utils";
import { WidgetInlineStyle } from "../widget-custom-css";
import { Plus, Copy, Trash2, GripVertical, Columns3 } from "lucide-react";
import { SectionBackgroundVideo } from "./SectionBackgroundVideo";

const DEVICE_WIDTHS: Record<DeviceType, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

export function Canvas() {
  const doc = useBuilder((s) => s.doc);
  const device = useBuilder((s) => s.device);
  const preview = useBuilder((s) => s.preview);
  const select = useBuilder((s) => s.select);
  const addSection = useBuilder((s) => s.addSection);

  return (
    <div
      className="editor-scrollbar min-h-0 min-w-0 flex-1 overflow-auto bg-editor-canvas"
      onClick={() => select(null)}
    >
      <div className="flex min-h-full justify-center p-4">
        <div
          className="min-h-full bg-white shadow-xl transition-all"
          style={{
            width: DEVICE_WIDTHS[device],
            maxWidth: "100%",
            background: doc.settings.background ?? "#ffffff",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {doc.sections.length === 0 ? (
            <EmptyCanvasDropZone onAdd={() => addSection(1)} />
          ) : (
            doc.sections.map((section, idx) => (
              <SectionView
                key={section.id}
                section={section}
                index={idx}
                device={device}
                preview={preview}
              />
            ))
          )}

          {!preview && doc.sections.length > 0 && (
            <button
              type="button"
              onClick={() => addSection(1)}
              className="m-4 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded border-2 border-dashed border-editor-accent/40 bg-editor-accent/5 py-4 text-sm font-medium text-editor-accent transition-all hover:border-editor-accent hover:bg-editor-accent/10"
            >
              <Plus className="h-4 w-4" /> Adicionar nova seção
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyCanvasDropZone({ onAdd }: { onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas:empty",
    data: { kind: "canvas-empty" },
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[60vh] flex-col items-center justify-center gap-4 p-12 text-center transition-colors ${
        isOver ? "bg-editor-accent/5" : ""
      }`}
    >
      <div className="rounded-full bg-editor-canvas p-6">
        <Columns3 className="h-10 w-10 text-editor-fg-muted" />
      </div>
      <div>
        <h3 className="mb-1 text-lg font-semibold text-foreground">Comece a construir</h3>
        <p className="text-sm text-muted-foreground">
          Arraste um widget aqui ou adicione uma seção para começar.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 rounded bg-editor-accent px-4 py-2 text-sm font-medium text-editor-accent-fg hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Adicionar seção
      </button>
    </div>
  );
}

function SectionView({
  section,
  device,
  preview,
}: {
  section: SectionNode;
  index: number;
  device: DeviceType;
  preview: boolean;
}) {
  const selection = useBuilder((s) => s.selection);
  const select = useBuilder((s) => s.select);
  const removeSection = useBuilder((s) => s.removeSection);
  const duplicateSection = useBuilder((s) => s.duplicateSection);
  const addColumn = useBuilder((s) => s.addColumn);

  const isSelected =
    selection?.kind === "section" && (selection as Extract<SelectionTarget, { kind: "section" }>).id === section.id;
  const sectionStyle = stylesToCss(section.styles, device);
  const gap = resolveResponsive(section.columnGap, device) ?? 20;
  const bgVideo = (section.backgroundVideoUrl ?? "").trim();
  const hasBgVideo = bgVideo.length > 0;

  return (
    <div
      className={`group/section relative ${!preview ? "transition-all" : ""}`}
      style={{
        ...sectionStyle,
        ...(hasBgVideo ? { position: "relative", overflow: "hidden" as const } : {}),
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
            isSelected
              ? "border-editor-section"
              : "border-transparent group-hover/section:border-editor-section/40"
          }`}
        />
      )}

      {!preview && (
        <div
          className={`absolute -top-px left-0 z-20 flex items-center gap-0.5 rounded-br bg-editor-section px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover/section:opacity-100"
          }`}
        >
          <GripVertical className="h-3 w-3" />
          Seção
        </div>
      )}

      {!preview && (
        <div
          className={`absolute -top-px right-0 z-20 flex items-center gap-0.5 rounded-bl bg-editor-section px-1 py-0.5 text-white transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover/section:opacity-100"
          }`}
        >
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
        className="relative z-[1] mx-auto flex"
        style={{
          maxWidth: section.layout === "boxed" ? `${section.contentWidth}px` : "100%",
          gap: `${gap}px`,
          flexDirection: device === "mobile" ? "column" : "row",
        }}
      >
        {section.columns.map((column) => (
          <ColumnView
            key={column.id}
            section={section}
            column={column}
            device={device}
            preview={preview}
          />
        ))}
      </div>
    </div>
  );
}

function ColumnView({
  section,
  column,
  device,
  preview,
}: {
  section: SectionNode;
  column: ColumnNode;
  device: DeviceType;
  preview: boolean;
}) {
  const selection = useBuilder((s) => s.selection);
  const select = useBuilder((s) => s.select);
  const removeColumn = useBuilder((s) => s.removeColumn);

  const widthPct = resolveResponsive(column.widthPercent, device) ?? 100;
  const isSelected =
    selection?.kind === "column" &&
    (selection as Extract<SelectionTarget, { kind: "column" }>).id === column.id;
  const colStyle = stylesToCss(column.styles, device);

  const { setNodeRef, isOver } = useDroppable({
    id: `col:${column.id}`,
    data: { kind: "column", sectionId: section.id, columnId: column.id },
  });

  return (
    <div
      ref={setNodeRef}
      className="group/column relative min-h-[60px]"
      style={{
        flexBasis: device === "mobile" ? "100%" : `${widthPct}%`,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        minWidth: 0,
        ...colStyle,
      }}
      onClick={(e) => {
        if (preview) return;
        e.stopPropagation();
        select({ kind: "column", sectionId: section.id, id: column.id });
      }}
    >
      {!preview && (
        <div
          className={`pointer-events-none absolute inset-0 border border-dashed transition-colors ${
            isSelected
              ? "border-editor-column"
              : isOver
                ? "border-editor-accent bg-editor-accent/5"
                : "border-transparent group-hover/column:border-editor-column/50"
          }`}
        />
      )}

      {!preview && (
        <div
          className={`absolute -top-px left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-b bg-editor-column px-1 py-0.5 text-[10px] text-white transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover/column:opacity-100"
          }`}
        >
          <ToolbarBtn
            title="Excluir coluna"
            onClick={(e) => {
              e.stopPropagation();
              removeColumn(section.id, column.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </ToolbarBtn>
        </div>
      )}

      {column.widgets.length === 0 && !preview ? (
        <div className="flex min-h-[80px] items-center justify-center rounded border-2 border-dashed border-editor-fg-muted/20 bg-editor-canvas/50 p-4 text-xs text-editor-fg-muted">
          Arraste widgets para esta coluna
        </div>
      ) : (
        column.widgets.map((widget) => (
          <WidgetView
            key={widget.id}
            section={section}
            column={column}
            widget={widget}
            device={device}
            preview={preview}
          />
        ))
      )}
    </div>
  );
}

function WidgetView({
  section,
  column,
  widget,
  device,
  preview,
}: {
  section: SectionNode;
  column: ColumnNode;
  widget: WidgetNode;
  device: DeviceType;
  preview: boolean;
}) {
  const selection = useBuilder((s) => s.selection);
  const select = useBuilder((s) => s.select);
  const removeWidget = useBuilder((s) => s.removeWidget);
  const duplicateWidget = useBuilder((s) => s.duplicateWidget);

  const def = WIDGET_REGISTRY[widget.type];
  const shell = stylesToCssWidgetShell(widget.styles, device);
  const isSelected =
    selection?.kind === "widget" &&
    (selection as Extract<SelectionTarget, { kind: "widget" }>).id === widget.id;

  const wid = widget.cssId?.trim();
  const wcls = widget.cssClasses?.trim();

  return (
    <div
      className={`group/widget relative${wcls ? ` ${wcls}` : ""}`}
      id={wid || undefined}
      style={shell}
      onClick={(e) => {
        if (preview) return;
        e.stopPropagation();
        select({
          kind: "widget",
          sectionId: section.id,
          columnId: column.id,
          id: widget.id,
        });
      }}
    >
      {!preview && (
        <div
          className={`pointer-events-none absolute inset-0 z-10 border transition-colors ${
            isSelected
              ? "border-editor-widget"
              : "border-transparent group-hover/widget:border-editor-widget/50"
          }`}
        />
      )}

      {!preview && (
        <div
          className={`absolute -top-px right-0 z-20 flex items-center gap-0.5 rounded-bl bg-editor-widget px-1 py-0.5 text-white transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover/widget:opacity-100"
          }`}
        >
          <span className="px-1 text-[10px] font-semibold uppercase tracking-wider">
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
      )}

      <WidgetInlineStyle widget={widget} />
      <def.Render widget={widget} device={device} />
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-white/20"
    >
      {children}
    </button>
  );
}
