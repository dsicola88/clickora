import { describe, expect, it } from "vitest";
import {
  isEmbedPlayerVideoUrl,
  resolveManualPresellVideoUrl,
  resolveVideoEmbedSrc,
} from "./youtubeEmbed";
import { resolvePageBuilderVideoUrl } from "@/page-builder/videoEmbed";

/**
 * Contrato profissional VSL: todos os formatos aceites têm de resolver
 * no page-builder (VideoWidget) e no caminho wizard/export.
 */
const CASES: Array<{
  name: string;
  raw: string;
  expectKind: "youtube" | "iframe" | "html5";
  expectEmbed: RegExp;
}> = [
  {
    name: "YouTube watch",
    raw: "https://www.youtube.com/watch?v=DbVOLSyjP5I",
    expectKind: "youtube",
    expectEmbed: /youtube\.com\/embed\/DbVOLSyjP5I/,
  },
  {
    name: "YouTube nocookie persistido (wizard)",
    raw: "https://www.youtube-nocookie.com/embed/DbVOLSyjP5I?modestbranding=1&rel=0",
    expectKind: "youtube",
    expectEmbed: /youtube-nocookie\.com\/embed\/DbVOLSyjP5I/,
  },
  {
    name: "youtu.be",
    raw: "https://youtu.be/DbVOLSyjP5I",
    expectKind: "youtube",
    expectEmbed: /youtube\.com\/embed\/DbVOLSyjP5I/,
  },
  {
    name: "Bunny play",
    raw: "https://video.bunnycdn.com/play/12345/abcdef01-2345-6789-abcd-ef0123456789",
    expectKind: "iframe",
    expectEmbed: /^https:\/\/iframe\.mediadelivery\.net\/embed\/12345\/abcdef01-2345-6789-abcd-ef0123456789$/,
  },
  {
    name: "Bunny mediadelivery embed",
    raw: "https://iframe.mediadelivery.net/embed/99/vid-uuid-001",
    expectKind: "iframe",
    expectEmbed: /iframe\.mediadelivery\.net\/embed\/99\/vid-uuid-001/,
  },
  {
    name: "Bunny mediadelivery play",
    raw: "https://iframe.mediadelivery.net/play/55/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?autoplay=true",
    expectKind: "iframe",
    expectEmbed: /^https:\/\/iframe\.mediadelivery\.net\/embed\/55\/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee$/,
  },
  {
    name: "MP4 directo (Melara-style)",
    raw: "https://melaramax.com/assets/videos/soft-like-clouds.mp4",
    expectKind: "html5",
    expectEmbed: /^https:\/\/melaramax\.com\/assets\/videos\/soft-like-clouds\.mp4$/,
  },
];

describe("contrato VSL YouTube/Bunny/MP4 (matriz profissional)", () => {
  for (const c of CASES) {
    it(`${c.name}: page-builder resolve`, () => {
      const pb = resolvePageBuilderVideoUrl(c.raw);
      expect(pb?.kind, c.name).toBe(c.expectKind);
      expect(pb?.embedUrl, c.name).toMatch(c.expectEmbed);
    });

    it(`${c.name}: wizard/export não devolve null nem URL lixo`, () => {
      const manual = resolveManualPresellVideoUrl(c.raw);
      expect(manual, c.name).toBeTruthy();
      const src = resolveVideoEmbedSrc(c.raw);
      expect(src.length).toBeGreaterThan(8);
      if (c.expectKind === "html5") {
        expect(isEmbedPlayerVideoUrl(src)).toBe(false);
        expect(src).toMatch(/\.mp4(\?|#|$)/i);
      } else {
        expect(isEmbedPlayerVideoUrl(src)).toBe(true);
      }
    });
  }

  it("URL inválida: page-builder null; manual null; export não inventa player", () => {
    expect(resolvePageBuilderVideoUrl("https://example.com/not-a-video")).toBeNull();
    expect(resolveManualPresellVideoUrl("https://example.com/not-a-video")).toBeNull();
  });
});
