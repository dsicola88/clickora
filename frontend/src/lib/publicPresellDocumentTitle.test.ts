import { describe, expect, it } from "vitest";
import type { Presell } from "@/types/api";
import {
  getPresellSeoPrimaryTitle,
  resolvePublicPresellDocumentTitle,
} from "./publicPresellDocumentTitle";

function page(over: Partial<Presell> & { content?: Record<string, unknown> }): Presell {
  return {
    id: "1",
    title: "Campanha interna Clickora",
    slug: "x",
    type: "cookies",
    category: "sem",
    language: "en",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    content: {},
    settings: {},
    tracking: {},
    created_at: "",
    updated_at: "",
    ...over,
  };
}

describe("título público da presell", () => {
  it("usa o título oficial da origem, não o da app nem o hostname", () => {
    const p = page({
      title: "Visivra White cookies",
      content: {
        productName: "Visivra",
        sourcePageTitle: "Visivra™ | Official Website | Support Clear Vision and Eye Health",
      },
    });
    expect(getPresellSeoPrimaryTitle(p)).toBe(
      "Visivra™ | Official Website | Support Clear Vision and Eye Health",
    );
    expect(resolvePublicPresellDocumentTitle(p)).toBe(
      "Visivra™ | Official Website | Support Clear Vision and Eye Health",
    );
  });

  it("ignora título da app e cai no nome do produto", () => {
    const p = page({
      title: "dclickora — Presell pages, rastreamento de conversões e ferramenta para afiliados",
      content: { productName: "Visivra" },
    });
    expect(getPresellSeoPrimaryTitle(p)).toBe("Visivra");
  });
});
