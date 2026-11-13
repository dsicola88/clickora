import { describe, expect, it } from "vitest";
import { buildPresellStandaloneHtml } from "./presellExportHtml";
import type { Presell } from "@/types/api";

const exportOpts = {
  apiBase: "https://api.example.com",
  publicPageUrl: "https://app.example.com/p/e2e-vsl-export",
  format: "document" as const,
};

function baseVsl(overrides: Partial<Presell> & { video_url: string; type?: string }): Presell {
  return {
    id: "e2e-vsl-export",
    title: "Export VSL",
    slug: "export-vsl",
    type: (overrides.type as Presell["type"]) || "vsl",
    category: "health",
    language: "pt",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    video_url: overrides.video_url,
    settings: {},
    tracking: { offerUrl: "https://example.com/offer" },
    footer_branding: false,
    created_at: "2026-11-13T00:00:00.000Z",
    updated_at: "2026-11-13T00:00:00.000Z",
    content: {
      title: "Produto",
      productName: "Produto",
      salesText: "Texto de venda.",
      ctaText: "Ver oferta",
      affiliateLink: "https://example.com/offer",
      images: [],
    },
    ...overrides,
  } as Presell;
}

describe("buildPresellStandaloneHtml — VSL Bunny/YouTube", () => {
  it("YouTube → iframe nocookie (não <video>)", () => {
    const html = buildPresellStandaloneHtml(
      baseVsl({ video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
      exportOpts,
    );
    expect(html).toMatch(/iframe[^>]+src="[^"]*youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    expect(html).not.toMatch(/<video[^>]+src="[^"]*youtube/);
  });

  it("Bunny play → iframe mediadelivery", () => {
    const html = buildPresellStandaloneHtml(
      baseVsl({
        video_url: "https://video.bunnycdn.com/play/12345/abcdef01-2345-6789-abcd-ef0123456789",
      }),
      exportOpts,
    );
    expect(html).toMatch(
      /iframe[^>]+src="https:\/\/iframe\.mediadelivery\.net\/embed\/12345\/abcdef01-2345-6789-abcd-ef0123456789/,
    );
    expect(html).not.toMatch(/<video[^>]+src="[^"]*bunny/);
  });

  it("vsl_tsl + MP4 → <video controls>", () => {
    const html = buildPresellStandaloneHtml(
      baseVsl({
        type: "vsl_tsl",
        video_url: "https://cdn.example.com/vsl.mp4",
      }),
      exportOpts,
    );
    expect(html).toMatch(/<video[^>]+src="https:\/\/cdn\.example\.com\/vsl\.mp4"/);
  });
});
