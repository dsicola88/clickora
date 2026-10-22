import { useCallback, useEffect, useState } from "react";
import {
  applyEditorChromeTheme,
  clearEditorChromeThemeAttr,
  DEFAULT_EDITOR_CHROME_THEME,
  readStoredEditorChromeTheme,
  writeStoredEditorChromeTheme,
  type EditorChromeThemeId,
} from "./editorChromeTheme";

/** Tema do chrome do editor (persistido neste dispositivo). */
export function useEditorChromeTheme() {
  const [themeId, setThemeIdState] = useState<EditorChromeThemeId>(() =>
    typeof window !== "undefined" ? readStoredEditorChromeTheme() : DEFAULT_EDITOR_CHROME_THEME,
  );

  useEffect(() => {
    applyEditorChromeTheme(themeId);
    return () => {
      clearEditorChromeThemeAttr();
    };
  }, [themeId]);

  const setThemeId = useCallback((id: EditorChromeThemeId) => {
    writeStoredEditorChromeTheme(id);
    setThemeIdState(id);
    applyEditorChromeTheme(id);
  }, []);

  return { themeId, setThemeId };
}
