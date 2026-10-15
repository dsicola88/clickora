import { create } from "zustand";
import type {
  ColumnNode,
  DeviceType,
  PageDocument,
  PageSeo,
  PageTrackingConfig,
  SectionNode,
  SelectionTarget,
  WidgetNode,
  WidgetType,
} from "./types";
import { syncLibraryDocument } from "./library-storage";
import { createColumn, createEmptyPage, createSection, createWidget, id } from "./factory";
import { locateWidget, parentContainerId, reIdWidget, widgetContains } from "./widget-tree";

const DEFAULT_STORAGE_KEY = "clickora:page-builder:doc:v1";
let activeStorageKey = DEFAULT_STORAGE_KEY;
const HISTORY_LIMIT = 50;

/** Chave localStorage por sessão (ex.: rascunho vs presell em edição). */
export function setPageBuilderStorageKey(key: string) {
  activeStorageKey = key || DEFAULT_STORAGE_KEY;
}

export interface HydrateDocumentOptions {
  /** Se definido, alterações sincronizam esta entrada da biblioteca local. */
  linkedLibraryId?: string | null;
}

interface BuilderState {
  doc: PageDocument;
  selection: SelectionTarget;
  device: DeviceType;
  preview: boolean;
  /** Painel «Estrutura» (árvore) entre canvas e propriedades. */
  structurePanelOpen: boolean;
  history: PageDocument[];
  historyLabels: string[];
  future: PageDocument[];
  futureLabels: string[];
  /** Última gravação no armazenamento local (autosave). */
  lastPersistedAt: number;
  /** Biblioteca local: entrada ligada para sincronizar a cada edição. */
  linkedLibraryId: string | null;
  /** Elemento copiado para colar noutro sítio da página. */
  clipboard: WidgetNode | null;
  /** Estilos copiados (conteúdo fica de fora). */
  styleClipboard: WidgetNode["styles"] | null;
  setLinkedLibraryId: (id: string | null) => void;
  setColumnWidths: (sectionId: string, widths: number[], device: DeviceType) => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  copyStyle: () => void;
  pasteStyle: () => void;
  jumpToHistory: (keep: number) => void;
  jumpForward: (steps: number) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;

  // Mutators
  setDevice: (d: DeviceType) => void;
  togglePreview: () => void;
  toggleStructurePanel: () => void;
  select: (s: SelectionTarget) => void;

  addSection: (columnCount?: number, atIndex?: number) => string;
  /** Secção com larguras explícitas (ex.: [67, 33]). Uma só entrada no histórico. */
  addSectionLayout: (widths: number[], atIndex?: number) => string;
  /** Reaplica a estrutura de colunas numa secção existente (widgets extras vão para a última coluna). */
  applySectionLayout: (sectionId: string, widths: number[]) => void;
  /** Insere um widget da paleta na seleção atual, ou numa secção nova. */
  insertPaletteWidget: (type: WidgetType) => void;
  removeSection: (sectionId: string) => void;
  duplicateSection: (sectionId: string) => void;
  moveSection: (fromIndex: number, toIndex: number) => void;
  updateSection: (sectionId: string, patch: Partial<SectionNode>) => void;

  addColumn: (sectionId: string) => void;
  removeColumn: (sectionId: string, columnId: string) => void;
  updateColumn: (sectionId: string, columnId: string, patch: Partial<ColumnNode>) => void;

  addWidget: (
    sectionId: string,
    columnId: string,
    type: WidgetType,
    atIndex?: number,
  ) => string;
  insertWidgetNode: (
    sectionId: string,
    columnId: string,
    widget: WidgetNode,
    atIndex?: number,
    containerId?: string,
  ) => void;
  removeWidget: (sectionId: string, columnId: string, widgetId: string) => void;
  duplicateWidget: (sectionId: string, columnId: string, widgetId: string) => void;
  moveWidget: (
    from: { sectionId: string; columnId: string; widgetId: string },
    to: { sectionId: string; columnId: string; index: number; containerId?: string },
  ) => void;
  updateWidget: (
    sectionId: string,
    columnId: string,
    widgetId: string,
    patch: Partial<WidgetNode>,
  ) => void;

  // Bulk section operations (templates)
  replaceSections: (sections: SectionNode[]) => void;
  appendSections: (sections: SectionNode[]) => void;

  // Page-level
  updateName: (name: string) => void;
  updateSeo: (seo: PageSeo) => void;
  updateTracking: (tracking: PageTrackingConfig) => void;
  updateSettings: (patch: Partial<PageDocument["settings"]>) => void;

  // History
  undo: () => void;
  redo: () => void;
  reset: () => void;
  loadFromStorage: () => void;
  /** Substitui o documento (ex.: ao abrir presell «builder» guardada no Clickora). */
  hydrateDocument: (doc: PageDocument, options?: HydrateDocumentOptions) => void;
}

function storageKey() {
  return activeStorageKey;
}

function loadInitial(): PageDocument {
  if (typeof window === "undefined") return createEmptyPage();
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (raw) return JSON.parse(raw) as PageDocument;
  } catch {
    /* ignore */
  }
  // Seed with a friendly starter section so the canvas isn't blank.
  const doc = createEmptyPage("Minha primeira página");
  const section = createSection(1);
  const heading = createWidget("heading");
  (heading.content as Record<string, unknown>).text = "Bem-vindo ao seu novo Page Builder";
  const text = createWidget("text");
  (text.content as Record<string, unknown>).html =
    "<p>Arraste widgets do painel à esquerda para começar a construir. Clique em qualquer elemento para editá-lo no painel à direita.</p>";
  const button = createWidget("button");
  section.columns[0].widgets = [heading, text, button];
  doc.sections = [section];
  return doc;
}

function persist(doc: PageDocument) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(doc));
  } catch {
    /* ignore */
  }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const useBuilder = create<BuilderState>((set, get) => {
  const initialDoc = loadInitial();

  /** Wrap a mutation with history snapshot + persistence. */
  const mutate = (fn: (doc: PageDocument) => void, label = "Edição") => {
    const prev = get().doc;
    const next = clone(prev);
    fn(next);
    next.updatedAt = Date.now();
    const history = [...get().history, prev].slice(-HISTORY_LIMIT);
    const historyLabels = [...get().historyLabels, label].slice(-HISTORY_LIMIT);
    persist(next);
    const libId = get().linkedLibraryId;
    if (libId) {
      syncLibraryDocument(libId, next, true);
    }
    set({ doc: next, history, historyLabels, future: [], futureLabels: [], lastPersistedAt: Date.now() });
  };

  const destinationList = (
    doc: PageDocument,
    sectionId: string,
    columnId: string,
    containerId?: string,
  ) => {
    const column = findColumn(doc, sectionId, columnId);
    if (!column) return null;
    if (!containerId) return column.widgets;
    const located = locateWidget(column.widgets, containerId);
    const container = located ? located.list[located.index] : undefined;
    if (!container || container.type !== "container") return null;
    const content = container.content as { widgets?: WidgetNode[] };
    if (!Array.isArray(content.widgets)) content.widgets = [];
    return content.widgets;
  };

  const findSection = (doc: PageDocument, sectionId: string) =>
    doc.sections.find((s) => s.id === sectionId);

  const findColumn = (doc: PageDocument, sectionId: string, columnId: string) =>
    findSection(doc, sectionId)?.columns.find((c) => c.id === columnId);

  return {
    doc: initialDoc,
    selection: null,
    device: "desktop",
    preview: false,
    structurePanelOpen: false,
    history: [],
    historyLabels: [],
    future: [],
    futureLabels: [],
    lastPersistedAt: initialDoc.updatedAt ?? Date.now(),
    linkedLibraryId: null,
    clipboard: null,
    styleClipboard: null,
    setLinkedLibraryId: (linkedLibraryId) => set({ linkedLibraryId }),
    setColumnWidths: (sectionId, widths, device) =>
      mutate((doc) => {
        const section = findSection(doc, sectionId);
        if (!section) return;
        section.columns.forEach((column, index) => {
          const width = widths[index];
          if (width == null) return;
          column.widthPercent = { ...column.widthPercent, [device]: Math.round(width) };
        });
      }),
    copySelection: () => {
      const { selection, doc } = get();
      if (selection?.kind !== "widget") return;
      const column = findColumn(doc, selection.sectionId, selection.columnId);
      const located = column ? locateWidget(column.widgets, selection.id) : null;
      const widget = located ? located.list[located.index] : undefined;
      if (!widget) return;
      set({ clipboard: clone(widget) });
    },
    copyStyle: () => {
      const { selection, doc } = get();
      if (!selection) return;
      if (selection.kind === "widget") {
        const column = findColumn(doc, selection.sectionId, selection.columnId);
        const located = column ? locateWidget(column.widgets, selection.id) : null;
        const widget = located ? located.list[located.index] : undefined;
        if (widget) set({ styleClipboard: clone(widget.styles) });
        return;
      }
      if (selection.kind === "column") {
        const column = findColumn(doc, selection.sectionId, selection.id);
        if (column) set({ styleClipboard: clone(column.styles) });
        return;
      }
      const section = findSection(doc, selection.id);
      if (section) set({ styleClipboard: clone(section.styles) });
    },
    pasteStyle: () => {
      const clip = get().styleClipboard;
      const selection = get().selection;
      if (!clip || !selection) return;
      const styles = clone(clip);
      if (selection.kind === "widget") {
        get().updateWidget(selection.sectionId, selection.columnId, selection.id, { styles });
        return;
      }
      if (selection.kind === "column") {
        get().updateColumn(selection.sectionId, selection.id, { styles });
        return;
      }
      get().updateSection(selection.id, { styles });
    },
    pasteClipboard: () => {
      const clip = get().clipboard;
      if (!clip) return;
      const widget: WidgetNode = { ...clone(clip), id: id("w_") };
      const { selection, doc } = get();
      const selectPasted = (sectionId: string, columnId: string) => {
        get().insertWidgetNode(sectionId, columnId, widget);
        set({ selection: { kind: "widget", sectionId, columnId, id: widget.id } });
      };
      if (selection?.kind === "widget") {
        const column = findColumn(doc, selection.sectionId, selection.columnId);
        const located = column ? locateWidget(column.widgets, selection.id) : null;
        const index = located ? located.index : -1;
        const containerId = column ? parentContainerId(column.widgets, selection.id) : undefined;
        get().insertWidgetNode(selection.sectionId, selection.columnId, widget, index + 1, containerId);
        set({
          selection: {
            kind: "widget",
            sectionId: selection.sectionId,
            columnId: selection.columnId,
            id: widget.id,
          },
        });
        return;
      }
      if (selection?.kind === "column") {
        selectPasted(selection.sectionId, selection.id);
        return;
      }
      if (selection?.kind === "section") {
        const column = doc.sections.find((section) => section.id === selection.id)?.columns[0];
        if (column) selectPasted(selection.id, column.id);
        return;
      }
      const last = doc.sections[doc.sections.length - 1];
      const column = last?.columns[0];
      if (last && column) selectPasted(last.id, column.id);
    },
    deleteSelection: () => {
      const { selection } = get();
      if (!selection) return;
      if (selection.kind === "widget") {
        get().removeWidget(selection.sectionId, selection.columnId, selection.id);
      } else if (selection.kind === "column") {
        get().removeColumn(selection.sectionId, selection.id);
      } else {
        get().removeSection(selection.id);
      }
      set({ selection: null });
    },
    duplicateSelection: () => {
      const { selection } = get();
      if (!selection) return;
      if (selection.kind === "widget") {
        get().duplicateWidget(selection.sectionId, selection.columnId, selection.id);
      } else if (selection.kind === "section") {
        get().duplicateSection(selection.id);
      }
    },

    setDevice: (d) => set({ device: d }),
    togglePreview: () =>
      set((s) => ({
        preview: !s.preview,
        selection: null,
        structurePanelOpen: s.preview ? s.structurePanelOpen : false,
      })),
    toggleStructurePanel: () =>
      set((s) => ({ structurePanelOpen: !s.structurePanelOpen })),
    select: (s) => set({ selection: s }),

    addSection: (columnCount = 1, atIndex) => {
      const section = createSection(columnCount);
      mutate((doc) => {
        if (atIndex == null) doc.sections.push(section);
        else doc.sections.splice(atIndex, 0, section);
      });
      return section.id;
    },
    addSectionLayout: (widths, atIndex) => {
      const safe = widths.filter((n) => n > 0);
      const cols = safe.length > 0 ? safe : [100];
      const section = createSection(cols.length);
      section.columns.forEach((c, i) => {
        c.widthPercent = {
          desktop: cols[i] ?? Math.floor(100 / cols.length),
          tablet: cols.length > 1 ? 100 : cols[i],
          mobile: 100,
        };
      });
      mutate((doc) => {
        if (atIndex == null) doc.sections.push(section);
        else doc.sections.splice(atIndex, 0, section);
      });
      return section.id;
    },
    applySectionLayout: (sectionId, widths) =>
      mutate((doc) => {
        const s = findSection(doc, sectionId);
        if (!s) return;
        const target = widths.filter((n) => n > 0);
        const cols = target.length > 0 ? target : [100];
        while (s.columns.length < cols.length) {
          s.columns.push(createColumn(cols[s.columns.length] ?? 25));
        }
        while (s.columns.length > cols.length) {
          const removed = s.columns.pop();
          if (removed && s.columns.length > 0) {
            s.columns[s.columns.length - 1].widgets.push(...removed.widgets);
          }
        }
        s.columns.forEach((c, i) => {
          const pct = cols[i] ?? Math.floor(100 / cols.length);
          c.widthPercent = { desktop: pct, tablet: cols.length > 1 ? 100 : pct, mobile: 100 };
        });
      }),
    insertPaletteWidget: (type) => {
      const place = (sectionId: string, columnId: string) => {
        const widgetId = get().addWidget(sectionId, columnId, type);
        set({
          selection: { kind: "widget", sectionId, columnId, id: widgetId },
        });
      };
      const { selection, doc } = get();
      if (selection?.kind === "column") {
        place(selection.sectionId, selection.id);
        return;
      }
      if (selection?.kind === "widget") {
        const column = doc.sections
          .find((section) => section.id === selection.sectionId)
          ?.columns.find((item) => item.id === selection.columnId);
        const located = column ? locateWidget(column.widgets, selection.id) : null;
        const current = located ? located.list[located.index] : undefined;
        if (current?.type === "container") {
          const widget = createWidget(type);
          get().insertWidgetNode(selection.sectionId, selection.columnId, widget, undefined, current.id);
          set({ selection: { kind: "widget", sectionId: selection.sectionId, columnId: selection.columnId, id: widget.id } });
          return;
        }
        if (located && column) {
          const widget = createWidget(type);
          const containerId = parentContainerId(column.widgets, selection.id);
          get().insertWidgetNode(selection.sectionId, selection.columnId, widget, located.index + 1, containerId);
          set({ selection: { kind: "widget", sectionId: selection.sectionId, columnId: selection.columnId, id: widget.id } });
          return;
        }
        place(selection.sectionId, selection.columnId);
        return;
      }
      if (selection?.kind === "section") {
        const sec = doc.sections.find((s) => s.id === selection.id);
        const col = sec?.columns[0];
        if (sec && col) {
          place(sec.id, col.id);
          return;
        }
      }
      const last = doc.sections[doc.sections.length - 1];
      const lastCol = last?.columns[0];
      if (last && lastCol) {
        place(last.id, lastCol.id);
        return;
      }
      const sectionId = get().addSectionLayout([100]);
      const created = get().doc.sections.find((s) => s.id === sectionId);
      const createdCol = created?.columns[0];
      if (created && createdCol) place(created.id, createdCol.id);
    },
    removeSection: (sectionId) =>
      mutate((doc) => {
        doc.sections = doc.sections.filter((s) => s.id !== sectionId);
      }),
    duplicateSection: (sectionId) =>
      mutate((doc) => {
        const idx = doc.sections.findIndex((s) => s.id === sectionId);
        if (idx === -1) return;
        const copy = clone(doc.sections[idx]);
        // Re-id everything to avoid collisions
        copy.id = id("sec_");
        copy.columns = copy.columns.map((c) => ({
          ...c,
          id: id("col_"),
          widgets: c.widgets.map((w) => reIdWidget(w, id)),
        }));
        doc.sections.splice(idx + 1, 0, copy);
      }),
    moveSection: (fromIndex, toIndex) =>
      mutate((doc) => {
        if (fromIndex === toIndex) return;
        const [s] = doc.sections.splice(fromIndex, 1);
        doc.sections.splice(toIndex, 0, s);
      }),
    updateSection: (sectionId, patch) =>
      mutate((doc) => {
        const s = findSection(doc, sectionId);
        if (s) Object.assign(s, patch);
      }),

    addColumn: (sectionId) =>
      mutate((doc) => {
        const s = findSection(doc, sectionId);
        if (!s) return;
        const newCount = s.columns.length + 1;
        const eq = Math.floor(100 / newCount);
        s.columns.forEach((c) => (c.widthPercent = { desktop: eq }));
        s.columns.push(createColumn(eq));
      }),
    removeColumn: (sectionId, columnId) =>
      mutate((doc) => {
        const s = findSection(doc, sectionId);
        if (!s) return;
        s.columns = s.columns.filter((c) => c.id !== columnId);
        if (s.columns.length > 0) {
          const eq = Math.floor(100 / s.columns.length);
          s.columns.forEach((c) => (c.widthPercent = { desktop: eq }));
        }
      }),
    updateColumn: (sectionId, columnId, patch) =>
      mutate((doc) => {
        const c = findColumn(doc, sectionId, columnId);
        if (c) Object.assign(c, patch);
      }),

    addWidget: (sectionId, columnId, type, atIndex) => {
      const w = createWidget(type);
      mutate((doc) => {
        const c = findColumn(doc, sectionId, columnId);
        if (!c) return;
        if (atIndex == null) c.widgets.push(w);
        else c.widgets.splice(atIndex, 0, w);
      }, "Inserir elemento");
      return w.id;
    },
    insertWidgetNode: (sectionId, columnId, widget, atIndex, containerId) =>
      mutate((doc) => {
        const list = destinationList(doc, sectionId, columnId, containerId);
        if (!list) return;
        if (atIndex == null) list.push(widget);
        else list.splice(Math.max(0, Math.min(atIndex, list.length)), 0, widget);
      }, "Inserir elemento"),
    removeWidget: (sectionId, columnId, widgetId) =>
      mutate((doc) => {
        const column = findColumn(doc, sectionId, columnId);
        const located = column ? locateWidget(column.widgets, widgetId) : null;
        if (!located) return;
        located.list.splice(located.index, 1);
      }, "Eliminar elemento"),
    duplicateWidget: (sectionId, columnId, widgetId) =>
      mutate((doc) => {
        const column = findColumn(doc, sectionId, columnId);
        const located = column ? locateWidget(column.widgets, widgetId) : null;
        if (!located) return;
        const copy = reIdWidget(clone(located.list[located.index]), id);
        located.list.splice(located.index + 1, 0, copy);
      }, "Duplicar elemento"),
    moveWidget: (from, to) =>
      mutate((doc) => {
        const fromCol = findColumn(doc, from.sectionId, from.columnId);
        const located = fromCol ? locateWidget(fromCol.widgets, from.widgetId) : null;
        if (!fromCol || !located) return;
        const moving = located.list[located.index];
        if (to.containerId && widgetContains(moving, to.containerId)) return;
        const dest = destinationList(doc, to.sectionId, to.columnId, to.containerId);
        if (!dest) return;
        if (located.list === dest && (located.index === to.index || located.index + 1 === to.index)) return;
        const [widget] = located.list.splice(located.index, 1);
        let index = to.index;
        if (located.list === dest && located.index < index) index -= 1;
        dest.splice(Math.max(0, Math.min(index, dest.length)), 0, widget);
      }, "Mover elemento"),
    updateWidget: (sectionId, columnId, widgetId, patch) =>
      mutate((doc) => {
        const column = findColumn(doc, sectionId, columnId);
        const located = column ? locateWidget(column.widgets, widgetId) : null;
        const widget = located ? located.list[located.index] : undefined;
        if (widget) Object.assign(widget, patch);
      }),

    replaceSections: (sections) =>
      mutate((doc) => {
        doc.sections = sections;
      }),
    appendSections: (sections) =>
      mutate((doc) => {
        doc.sections.push(...sections);
      }),

    updateName: (name) =>
      mutate((doc) => {
        doc.name = name;
      }),
    updateSeo: (seo) =>
      mutate((doc) => {
        doc.seo = seo;
      }),
    updateTracking: (tracking) =>
      mutate((doc) => {
        doc.tracking = tracking;
      }),
    updateSettings: (patch) =>
      mutate((doc) => {
        doc.settings = { ...doc.settings, ...patch };
      }),

    undo: () => {
      const { history, historyLabels, doc, future, futureLabels, linkedLibraryId } = get();
      if (history.length === 0) return;
      const prev = history[history.length - 1];
      const label = historyLabels[historyLabels.length - 1] ?? "Edição";
      persist(prev);
      if (linkedLibraryId) {
        syncLibraryDocument(linkedLibraryId, prev, true);
      }
      set({
        doc: prev,
        history: history.slice(0, -1),
        historyLabels: historyLabels.slice(0, -1),
        future: [doc, ...future].slice(0, HISTORY_LIMIT),
        futureLabels: [label, ...futureLabels].slice(0, HISTORY_LIMIT),
        lastPersistedAt: Date.now(),
      });
    },
    redo: () => {
      const { history, historyLabels, doc, future, futureLabels, linkedLibraryId } = get();
      if (future.length === 0) return;
      const [next, ...rest] = future;
      const [label, ...restLabels] = futureLabels;
      persist(next);
      if (linkedLibraryId) {
        syncLibraryDocument(linkedLibraryId, next, true);
      }
      set({
        doc: next,
        history: [...history, doc].slice(-HISTORY_LIMIT),
        historyLabels: [...historyLabels, label ?? "Edição"].slice(-HISTORY_LIMIT),
        future: rest,
        futureLabels: restLabels,
        lastPersistedAt: Date.now(),
      });
    },
    jumpToHistory: (keep) => {
      const state = get();
      let history = state.history.slice();
      let historyLabels = state.historyLabels.slice();
      let future = state.future.slice();
      let futureLabels = state.futureLabels.slice();
      let doc = state.doc;
      const target = Math.max(0, Math.min(keep, history.length));
      while (history.length > target) {
        const label = historyLabels[historyLabels.length - 1] ?? "Edição";
        future = [doc, ...future].slice(0, HISTORY_LIMIT);
        futureLabels = [label, ...futureLabels].slice(0, HISTORY_LIMIT);
        doc = history[history.length - 1];
        history = history.slice(0, -1);
        historyLabels = historyLabels.slice(0, -1);
      }
      persist(doc);
      if (state.linkedLibraryId) syncLibraryDocument(state.linkedLibraryId, doc, true);
      set({ doc, history, historyLabels, future, futureLabels, lastPersistedAt: Date.now() });
    },
    jumpForward: (steps) => {
      const state = get();
      let history = state.history.slice();
      let historyLabels = state.historyLabels.slice();
      let future = state.future.slice();
      let futureLabels = state.futureLabels.slice();
      let doc = state.doc;
      const count = Math.max(0, Math.min(steps, future.length));
      for (let i = 0; i < count; i += 1) {
        const next = future[0];
        const label = futureLabels[0] ?? "Edição";
        future = future.slice(1);
        futureLabels = futureLabels.slice(1);
        history = [...history, doc].slice(-HISTORY_LIMIT);
        historyLabels = [...historyLabels, label].slice(-HISTORY_LIMIT);
        doc = next;
      }
      if (count === 0) return;
      persist(doc);
      if (state.linkedLibraryId) syncLibraryDocument(state.linkedLibraryId, doc, true);
      set({ doc, history, historyLabels, future, futureLabels, lastPersistedAt: Date.now() });
    },
    reset: () => {
      const fresh = createEmptyPage();
      persist(fresh);
      set({
        doc: fresh,
        history: [],
        historyLabels: [],
        future: [],
        futureLabels: [],
        selection: null,
        structurePanelOpen: false,
        linkedLibraryId: null,
        lastPersistedAt: Date.now(),
      });
    },
    loadFromStorage: () =>
      set({ doc: loadInitial(), linkedLibraryId: null, lastPersistedAt: Date.now() }),
    hydrateDocument: (doc, options) => {
      const next = clone(doc);
      next.updatedAt = Date.now();
      persist(next);
      const linked =
        options && "linkedLibraryId" in options ? options.linkedLibraryId ?? null : null;
      if (linked) {
        syncLibraryDocument(linked, next, true);
      }
      set({
        doc: next,
        history: [],
        historyLabels: [],
        future: [],
        futureLabels: [],
        selection: null,
        structurePanelOpen: false,
        linkedLibraryId: linked,
        lastPersistedAt: Date.now(),
      });
    },
  };
});

/** Resolve a responsive value with desktop fallback. */
export function resolveResponsive<T>(
  v: { desktop: T; tablet?: T; mobile?: T } | undefined,
  device: DeviceType,
): T | undefined {
  if (!v) return undefined;
  if (device === "mobile") return v.mobile ?? v.tablet ?? v.desktop;
  if (device === "tablet") return v.tablet ?? v.desktop;
  return v.desktop;
}
