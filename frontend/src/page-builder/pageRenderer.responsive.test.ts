import { describe, expect, it } from "vitest";
import {
  columnFlexItem,
  isSectionStacked,
  sectionColumnsGrid,
  sectionDirectionFor,
} from "./style-utils";

describe("PageRenderer — stacking responsivo", () => {
  it("multi-coluna empilha em tablet e mobile", () => {
    expect(sectionDirectionFor(undefined, "desktop", 4)).toBe("row");
    expect(sectionDirectionFor(undefined, "tablet", 4)).toBe("column");
    expect(sectionDirectionFor(undefined, "mobile", 4)).toBe("column");
  });

  it("coluna empilhada ocupa 100% sem flex shrink partilhado", () => {
    const stacked = columnFlexItem(25, true);
    expect(stacked.width).toBe("100%");
    expect(stacked.flex).toBe("0 0 auto");

    const side = columnFlexItem(25, false);
    expect(side.width).toBe("auto");
    expect(String(side.flex)).toContain("25");
  });

  it("grelha de secção usa column + nowrap quando stacked", () => {
    const css = sectionColumnsGrid([25, 25, 25, 25], "mobile", 16);
    expect(css.flexDirection).toBe("column");
    expect(css.flexWrap).toBe("nowrap");
    expect(isSectionStacked(css.flexDirection as "column")).toBe(true);
  });
});
