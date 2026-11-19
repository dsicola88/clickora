import { describe, expect, it } from "vitest";
import {
  parsePageDocumentFromJson,
  parsePageDocumentFromJsonDetailed,
} from "./document-import";

const minimalDoc = {
  id: "page_1",
  name: "Visivra",
  sections: [{ id: "s1", columns: [] }],
  settings: { maxContentWidth: 1140 },
  updatedAt: 1,
};

describe("parsePageDocumentFromJson", () => {
  it("aceita documento plano do editor", () => {
    const doc = parsePageDocumentFromJson(JSON.stringify(minimalDoc));
    expect(doc?.name).toBe("Visivra");
    expect(doc?.sections).toHaveLength(1);
  });

  it("aceita BOM + content.pageDocument (export API)", () => {
    const wrapped = `\uFEFF${JSON.stringify({
      id: "c516c2c8-ff36-493e-ba07-dc747d8e4dea",
      title: "Visivra Fast",
      content: { pageDocument: minimalDoc, affiliateLink: "https://offer.example" },
    })}`;
    const doc = parsePageDocumentFromJson(wrapped);
    expect(doc?.name).toBe("Visivra");
  });

  it("aceita editorWorkingDocument", () => {
    const doc = parsePageDocumentFromJson(
      JSON.stringify({ content: { editorWorkingDocument: { ...minimalDoc, name: "Draft" } } }),
    );
    expect(doc?.name).toBe("Draft");
  });

  it("rejeita Elementor / JSON sem sections", () => {
    const r = parsePageDocumentFromJsonDetailed(
      JSON.stringify({ version: "0.4", title: "x", type: "page", content: [] }),
    );
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe("wrong_shape");
  });

  it("rejeita texto que não é JSON", () => {
    const r = parsePageDocumentFromJsonDetailed("not json {{{");
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe("not_json");
  });
});
