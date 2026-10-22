import { createContext, useContext, type ReactNode } from "react";
import type { EditorChromeThemeId } from "./editorChromeTheme";
import { useEditorChromeTheme } from "./useEditorChromeTheme";

type Ctx = {
  themeId: EditorChromeThemeId;
  setThemeId: (id: EditorChromeThemeId) => void;
};

const EditorChromeThemeContext = createContext<Ctx | null>(null);

export function EditorChromeThemeProvider({ children }: { children: ReactNode }) {
  const value = useEditorChromeTheme();
  return (
    <EditorChromeThemeContext.Provider value={value}>{children}</EditorChromeThemeContext.Provider>
  );
}

export function useEditorChromeThemeContext() {
  const ctx = useContext(EditorChromeThemeContext);
  if (!ctx) {
    throw new Error("useEditorChromeThemeContext requires EditorChromeThemeProvider");
  }
  return ctx;
}

export function useEditorChromeThemeContextOptional() {
  return useContext(EditorChromeThemeContext);
}
