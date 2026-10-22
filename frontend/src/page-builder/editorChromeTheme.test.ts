import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDITOR_CHROME_THEME,
  EDITOR_CHROME_THEMES,
  isEditorChromeThemeId,
} from "./editorChromeTheme";

describe("editorChromeTheme", () => {
  it("exposes light + professional chrome themes", () => {
    const ids = EDITOR_CHROME_THEMES.map((t) => t.id);
    expect(ids).toContain("studio-dark");
    expect(ids).toContain("studio-light");
    expect(ids).toContain("slate-pro");
    expect(ids).toContain("graphite");
    expect(ids).toContain("ivory");
    expect(ids).toHaveLength(5);
  });

  it("validates theme ids", () => {
    expect(isEditorChromeThemeId("studio-light")).toBe(true);
    expect(isEditorChromeThemeId("nope")).toBe(false);
    expect(DEFAULT_EDITOR_CHROME_THEME).toBe("studio-dark");
  });
});
