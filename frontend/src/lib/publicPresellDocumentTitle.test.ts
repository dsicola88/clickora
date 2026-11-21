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
        generationNiche: "white",
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

  it("black EN: ignora sourcePageTitle agressivo PT e usa o produto", () => {
    const p = page({
      language: "en",
      title: "KW Melara black cookies",
      content: {
        generationNiche: "black",
        productName: "Melara Max",
        sourcePageTitle: "Adquira seu Melara Max hoje mesmo | Melara Max",
      },
    });
    expect(getPresellSeoPrimaryTitle(p)).toBe("Melara Max");
    expect(resolvePublicPresellDocumentTitle(p)).toBe("Melara Max");
  });

  it("manual builder: usa H1/H2 do canvas quando o espelho não tem <title>", () => {
    const p = page({
      type: "builder",
      title: "Página sem título",
      content: {
        generationNiche: "white",
        pageDocument: {
          id: "p1",
          name: "Página sem título",
          sections: [
            {
              id: "s1",
              layout: "full",
              contentWidth: 1440,
              columns: [
                {
                  id: "c1",
                  widthPercent: { desktop: 100 },
                  widgets: [
                    {
                      id: "w1",
                      type: "heading",
                      content: { text: "Trimoryn", tag: "h1" },
                      styles: {},
                    },
                  ],
                },
              ],
            },
          ],
          settings: {},
          seo: { title: "Página sem título" },
          updatedAt: 1,
        },
      },
    });
    expect(getPresellSeoPrimaryTitle(p)).toBe("Trimoryn");
  });

  it("ignora nome default do builder e usa produto / espelho", () => {
    const mirror = `<!DOCTYPE html><html><head><title>Trimoryn — Daily Metabolism Support</title></head><body></body></html>`;
    const p = page({
      language: "en",
      content: {
        generationNiche: "white",
        productName: "Trimoryn",
        importMirrorSrcDoc: mirror,
        pageDocument: {
          id: "p1",
          name: "Página sem título",
          sections: [{ id: "s1", columns: [{ id: "c1", widgets: [] }] }],
          settings: {},
          seo: { title: "Página sem título" },
          updatedAt: 1,
        },
      },
    });
    expect(getPresellSeoPrimaryTitle(p)).toBe("Trimoryn — Daily Metabolism Support");
  });

  it("white: mantém título oficial da origem quando não é sales agressivo", () => {
    const p = page({
      language: "en",
      content: {
        generationNiche: "white",
        productName: "Visivra",
        sourcePageTitle: "Visivra™ | Official Website | Support Clear Vision and Eye Health",
      },
    });
    expect(getPresellSeoPrimaryTitle(p)).toBe(
      "Visivra™ | Official Website | Support Clear Vision and Eye Health",
    );
  });
});
