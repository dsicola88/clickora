import { describe, expect, it } from "vitest";
import { resolvePageBuilderVideoUrl, embedUrlWithPlayback } from "./videoEmbed";

describe("resolvePageBuilderVideoUrl", () => {
  it("resolve YouTube watch e embed", () => {
    expect(resolvePageBuilderVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.kind).toBe(
      "youtube",
    );
    expect(resolvePageBuilderVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")?.kind).toBe(
      "youtube",
    );
  });

  it("aceita youtube-nocookie embed já persistido pelo wizard (ex. Qr / DbVOLSyjP5I)", () => {
    const raw =
      "https://www.youtube-nocookie.com/embed/DbVOLSyjP5I?modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&fs=1";
    const out = resolvePageBuilderVideoUrl(raw);
    expect(out?.kind).toBe("youtube");
    expect(out?.embedUrl).toBe("https://www.youtube-nocookie.com/embed/DbVOLSyjP5I");
    expect(resolvePageBuilderVideoUrl("https://www.youtube.com/watch?v=DbVOLSyjP5I")?.embedUrl).toBe(
      "https://www.youtube.com/embed/DbVOLSyjP5I",
    );
  });

  it("resolve MP4/WebM directo para html5 (combo VSL de sales pages)", () => {
    const mp4 = resolvePageBuilderVideoUrl("https://cdn.example.com/assets/videos/vsl.mp4");
    expect(mp4).toEqual({ kind: "html5", embedUrl: "https://cdn.example.com/assets/videos/vsl.mp4" });
    const webm = resolvePageBuilderVideoUrl("https://cdn.example.com/a.webm?x=1");
    expect(webm?.kind).toBe("html5");
  });

  it("embedUrlWithPlayback mantém src html5", () => {
    const r = resolvePageBuilderVideoUrl("https://cdn.example.com/v.mp4")!;
    expect(embedUrlWithPlayback(r, { controls: true })).toBe("https://cdn.example.com/v.mp4");
  });

  it("resolve Bunny play e iframe mediadelivery (VSL combo)", () => {
    const play = resolvePageBuilderVideoUrl(
      "https://video.bunnycdn.com/play/12345/abcdef01-2345-6789-abcd-ef0123456789",
    );
    expect(play).toEqual({
      kind: "iframe",
      embedUrl: "https://iframe.mediadelivery.net/embed/12345/abcdef01-2345-6789-abcd-ef0123456789",
    });
    const embed = resolvePageBuilderVideoUrl(
      "https://iframe.mediadelivery.net/embed/99/vid-uuid-001",
    );
    expect(embed?.kind).toBe("iframe");
    expect(embed?.embedUrl).toContain("iframe.mediadelivery.net/embed/99/");
  });

  it("Bunny: mediadelivery /play → /embed; query string não parte o id", () => {
    expect(
      resolvePageBuilderVideoUrl(
        "https://iframe.mediadelivery.net/play/55/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?autoplay=true",
      ),
    ).toEqual({
      kind: "iframe",
      embedUrl: "https://iframe.mediadelivery.net/embed/55/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(
      resolvePageBuilderVideoUrl(
        "https://video.bunnycdn.com/play/9/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee/?x=1",
      )?.embedUrl,
    ).toBe("https://iframe.mediadelivery.net/embed/9/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee");
  });

  it("resolve YouTube Shorts e youtu.be", () => {
    expect(resolvePageBuilderVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.embedUrl).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(resolvePageBuilderVideoUrl("https://youtu.be/dQw4w9WgXcQ")?.embedUrl).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });
});
