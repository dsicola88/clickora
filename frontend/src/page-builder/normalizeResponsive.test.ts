import { describe, expect, it } from "vitest";
import { createColumn, createSection } from "./factory";
import {
  applyResponsiveColumnWidths,
  normalizePageDocumentResponsive,
  normalizeSectionResponsive,
} from "./normalizeResponsive";
import type { PageDocument } from "./types";

describe("normalizeResponsive", () => {
  it("força mobile 100% em multi-coluna sem override", () => {
    const sec = createSection(4);
    for (const col of sec.columns) {
      col.widthPercent = { desktop: 25 };
    }
    normalizeSectionResponsive(sec);
    for (const col of sec.columns) {
      expect(col.widthPercent?.mobile).toBe(100);
      expect(col.widthPercent?.tablet).toBe(100);
      expect(col.widthPercent?.desktop).toBe(25);
    }
  });

  it("documento legado sem mobile fica empilhável", () => {
    const doc: PageDocument = {
      id: "p1",
      name: "Legado",
      settings: { maxContentWidth: 1140, background: "#fff" },
      sections: [
        {
          ...createSection(3),
          columns: [25, 25, 50].map((w) => {
            const c = createColumn(w);
            c.widthPercent = { desktop: w };
            return c;
          }),
        },
      ],
      updatedAt: 1,
    };
    const next = normalizePageDocumentResponsive(doc);
    expect(next.sections[0].columns.every((c) => c.widthPercent?.mobile === 100)).toBe(true);
  });

  it("applyResponsiveColumnWidths define tablet/mobile ao criar colunas", () => {
    const cols = [createColumn(50), createColumn(50)];
    applyResponsiveColumnWidths(cols, [50, 50]);
    expect(cols[0].widthPercent).toEqual({ desktop: 50, tablet: 100, mobile: 100 });
  });
});
