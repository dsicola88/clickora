import { describe, expect, it } from "vitest";
import {
  parsePresellBuilderPageDocument,
  parsePresellEditorWorkingDocument,
  pickPresellEditorDocument,
} from "./presellBuilderContent";
import type { PageDocument } from "@/page-builder/types";

function doc(name: string, updatedAt: number): PageDocument {
  return {
    id: name,
    name,
    sections: [{ id: "s", layout: "boxed", contentWidth: 1140, columns: [] }],
    settings: { maxContentWidth: 1140, background: "#fff" },
    updatedAt,
  } as PageDocument;
}

describe("pickPresellEditorDocument", () => {
  it("prioriza o rascunho na BD sobre o localStorage do browser", () => {
    const published = doc("pub", 100);
    const working = doc("work", 120);
    const local = doc("local", 999);
    const picked = pickPresellEditorDocument({ published, working, local });
    expect(picked?.name).toBe("work");
  });

  it("usa a publicada na BD quando não há working (ignora local mais novo)", () => {
    const published = doc("pub", 100);
    const local = doc("local", 200);
    const picked = pickPresellEditorDocument({ published, working: null, local });
    expect(picked?.name).toBe("pub");
  });

  it("recupera o working do servidor se o local estiver vazio", () => {
    const published = doc("pub", 100);
    const working = doc("work", 150);
    const picked = pickPresellEditorDocument({ published, working, local: null });
    expect(picked?.name).toBe("work");
  });

  it("usa a publicada quando não há rascunho", () => {
    const published = doc("pub", 100);
    expect(pickPresellEditorDocument({ published, working: null, local: null })?.name).toBe("pub");
  });

  it("usa local só se a BD ainda não tiver documento", () => {
    const local = doc("local", 50);
    expect(pickPresellEditorDocument({ published: null, working: null, local })?.name).toBe("local");
  });
});

describe("parse working/published", () => {
  it("lê pageDocument e editorWorkingDocument", () => {
    const published = doc("pub", 1);
    const working = doc("work", 2);
    expect(parsePresellBuilderPageDocument({ pageDocument: published })?.name).toBe("pub");
    expect(parsePresellEditorWorkingDocument({ editorWorkingDocument: working })?.name).toBe("work");
  });
});
