export type EditorChromeThemeId =
  | "studio-dark"
  | "studio-light"
  | "slate-pro"
  | "graphite"
  | "ivory";

export type EditorChromeTheme = {
  id: EditorChromeThemeId;
  label: string;
  description: string;
  /** Preview swatches for the picker */
  swatches: [string, string, string];
};

export const EDITOR_CHROME_THEMES: EditorChromeTheme[] = [
  {
    id: "studio-dark",
    label: "Studio escuro",
    description: "Painéis escuros, canvas claro — visual de estúdio",
    swatches: ["#1e2128", "#2a2e38", "#e11d48"],
  },
  {
    id: "studio-light",
    label: "Studio claro",
    description: "Profissional claro — ideal para longas sessões",
    swatches: ["#f4f6f9", "#ffffff", "#e11d48"],
  },
  {
    id: "slate-pro",
    label: "Ardósia Pro",
    description: "Escuro frio azul-cinza, acento índigo",
    swatches: ["#0f172a", "#1e293b", "#6366f1"],
  },
  {
    id: "graphite",
    label: "Grafite",
    description: "Carvão neutro com acento teal",
    swatches: ["#18181b", "#27272a", "#14b8a6"],
  },
  {
    id: "ivory",
    label: "Marfim",
    description: "Claro quente, tipografia editorial",
    swatches: ["#faf7f2", "#ffffff", "#c2410c"],
  },
];

export const DEFAULT_EDITOR_CHROME_THEME: EditorChromeThemeId = "studio-dark";
export const EDITOR_CHROME_THEME_STORAGE_KEY = "clickora:editor-chrome-theme";

export function isEditorChromeThemeId(v: unknown): v is EditorChromeThemeId {
  return EDITOR_CHROME_THEMES.some((t) => t.id === v);
}

export function readStoredEditorChromeTheme(): EditorChromeThemeId {
  if (typeof window === "undefined") return DEFAULT_EDITOR_CHROME_THEME;
  try {
    const raw = window.localStorage.getItem(EDITOR_CHROME_THEME_STORAGE_KEY);
    if (isEditorChromeThemeId(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_EDITOR_CHROME_THEME;
}

export function writeStoredEditorChromeTheme(id: EditorChromeThemeId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EDITOR_CHROME_THEME_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Aplica o tema no contentor do editor e no :root (menus portados). */
export function applyEditorChromeTheme(
  id: EditorChromeThemeId,
  scopeEl?: HTMLElement | null,
) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-editor-theme", id);
  if (scopeEl) scopeEl.setAttribute("data-editor-theme", id);
  document.querySelectorAll(".page-builder-scope").forEach((el) => {
    el.setAttribute("data-editor-theme", id);
  });
}

export function clearEditorChromeThemeAttr() {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute("data-editor-theme");
}
