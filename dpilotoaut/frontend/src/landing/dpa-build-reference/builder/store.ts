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
import { createColumn, createEmptyPage, createSection, createWidget, id } from "./factory";

const STORAGE_KEY = "lov:builder:doc:v1";
const HISTORY_LIMIT = 50;

interface BuilderState {
  doc: PageDocument;
  selection: SelectionTarget;
  device: DeviceType;
  preview: boolean;
  history: PageDocument[];
  future: PageDocument[];

  // Mutators
  setDevice: (d: DeviceType) => void;
  togglePreview: () => void;
  select: (s: SelectionTarget) => void;

  addSection: (columnCount?: number, atIndex?: number) => string;
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
  ) => void;
  removeWidget: (sectionId: string, columnId: string, widgetId: string) => void;
  duplicateWidget: (sectionId: string, columnId: string, widgetId: string) => void;
  moveWidget: (
    from: { sectionId: string; columnId: string; widgetId: string },
    to: { sectionId: string; columnId: string; index: number },
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
}

function loadInitial(): PageDocument {
  if (typeof window === "undefined") return createEmptyPage();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* ignore */
  }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const useBuilder = create<BuilderState>((set, get) => {
  /** Wrap a mutation with history snapshot + persistence. */
  const mutate = (fn: (doc: PageDocument) => void) => {
    const prev = get().doc;
    const next = clone(prev);
    fn(next);
    next.updatedAt = Date.now();
    const history = [...get().history, prev].slice(-HISTORY_LIMIT);
    persist(next);
    set({ doc: next, history, future: [] });
  };

  const findSection = (doc: PageDocument, sectionId: string) =>
    doc.sections.find((s) => s.id === sectionId);

  const findColumn = (doc: PageDocument, sectionId: string, columnId: string) =>
    findSection(doc, sectionId)?.columns.find((c) => c.id === columnId);

  return {
    doc: loadInitial(),
    selection: null,
    device: "desktop",
    preview: false,
    history: [],
    future: [],

    setDevice: (d) => set({ device: d }),
    togglePreview: () => set({ preview: !get().preview, selection: null }),
    select: (s) => set({ selection: s }),

    addSection: (columnCount = 1, atIndex) => {
      const section = createSection(columnCount);
      mutate((doc) => {
        if (atIndex == null) doc.sections.push(section);
        else doc.sections.splice(atIndex, 0, section);
      });
      return section.id;
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
          widgets: c.widgets.map((w) => ({ ...w, id: id("w_") })),
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
      });
      return w.id;
    },
    insertWidgetNode: (sectionId, columnId, widget, atIndex) =>
      mutate((doc) => {
        const c = findColumn(doc, sectionId, columnId);
        if (!c) return;
        if (atIndex == null) c.widgets.push(widget);
        else c.widgets.splice(atIndex, 0, widget);
      }),
    removeWidget: (sectionId, columnId, widgetId) =>
      mutate((doc) => {
        const c = findColumn(doc, sectionId, columnId);
        if (c) c.widgets = c.widgets.filter((w) => w.id !== widgetId);
      }),
    duplicateWidget: (sectionId, columnId, widgetId) =>
      mutate((doc) => {
        const c = findColumn(doc, sectionId, columnId);
        if (!c) return;
        const idx = c.widgets.findIndex((w) => w.id === widgetId);
        if (idx === -1) return;
        const copy: WidgetNode = { ...clone(c.widgets[idx]), id: id("w_") };
        c.widgets.splice(idx + 1, 0, copy);
      }),
    moveWidget: (from, to) =>
      mutate((doc) => {
        const fromCol = findColumn(doc, from.sectionId, from.columnId);
        const toCol = findColumn(doc, to.sectionId, to.columnId);
        if (!fromCol || !toCol) return;
        const idx = fromCol.widgets.findIndex((w) => w.id === from.widgetId);
        if (idx === -1) return;
        const [w] = fromCol.widgets.splice(idx, 1);
        const insertAt = Math.max(0, Math.min(to.index, toCol.widgets.length));
        toCol.widgets.splice(insertAt, 0, w);
      }),
    updateWidget: (sectionId, columnId, widgetId, patch) =>
      mutate((doc) => {
        const c = findColumn(doc, sectionId, columnId);
        if (!c) return;
        const w = c.widgets.find((w) => w.id === widgetId);
        if (w) Object.assign(w, patch);
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
      const { history, doc, future } = get();
      if (history.length === 0) return;
      const prev = history[history.length - 1];
      const newHistory = history.slice(0, -1);
      persist(prev);
      set({ doc: prev, history: newHistory, future: [doc, ...future].slice(0, HISTORY_LIMIT) });
    },
    redo: () => {
      const { history, doc, future } = get();
      if (future.length === 0) return;
      const [next, ...rest] = future;
      persist(next);
      set({ doc: next, history: [...history, doc].slice(-HISTORY_LIMIT), future: rest });
    },
    reset: () => {
      const fresh = createEmptyPage();
      persist(fresh);
      set({ doc: fresh, history: [], future: [], selection: null });
    },
    loadFromStorage: () => set({ doc: loadInitial() }),
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
