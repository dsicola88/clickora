import { describe, expect, it } from "vitest";
import {
  buildYoutubeEmbedUrlForPresell,
  isEmbedPlayerVideoUrl,
  resolveManualPresellVideoUrl,
  resolveVideoEmbedSrc,
} from "./youtubeEmbed";

describe("resolveVideoEmbedSrc (VSL público)", () => {
  it("YouTube → nocookie embed", () => {
    const out = resolveVideoEmbedSrc("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(out).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(buildYoutubeEmbedUrlForPresell("https://youtu.be/dQw4w9WgXcQ")).toContain(
      "youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });

  it("Bunny play → mediadelivery embed", () => {
    const out = resolveVideoEmbedSrc(
      "https://video.bunnycdn.com/play/12345/abcdef01-2345-6789-abcd-ef0123456789",
    );
    expect(out).toBe(
      "https://iframe.mediadelivery.net/embed/12345/abcdef01-2345-6789-abcd-ef0123456789",
    );
  });

  it("Bunny iframe já embed passa directo", () => {
    const src = "https://iframe.mediadelivery.net/embed/1/vid";
    expect(resolveVideoEmbedSrc(src)).toBe(src);
  });

  it("MP4 fica html5-ready", () => {
    expect(resolveVideoEmbedSrc("https://cdn.example.com/vsl.mp4")).toBe(
      "https://cdn.example.com/vsl.mp4",
    );
  });
});

describe("isEmbedPlayerVideoUrl + resolveManualPresellVideoUrl (wizard/dashboard)", () => {
  it("Bunny e YouTube são iframe; MP4 não", () => {
    expect(isEmbedPlayerVideoUrl("https://iframe.mediadelivery.net/embed/1/v")).toBe(true);
    expect(
      isEmbedPlayerVideoUrl(
        "https://video.bunnycdn.com/play/1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      ),
    ).toBe(true);
    expect(isEmbedPlayerVideoUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(true);
    expect(isEmbedPlayerVideoUrl("https://cdn.example.com/vsl.mp4")).toBe(false);
  });

  it("manual: YouTube + Bunny play → embed; lixo → null", () => {
    expect(resolveManualPresellVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toContain(
      "youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(
      resolveManualPresellVideoUrl(
        "https://video.bunnycdn.com/play/9/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      ),
    ).toBe("https://iframe.mediadelivery.net/embed/9/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(resolveManualPresellVideoUrl("https://cdn.example.com/v.mp4")).toBe(
      "https://cdn.example.com/v.mp4",
    );
    expect(resolveManualPresellVideoUrl("https://example.com/not-a-video-page")).toBeNull();
    expect(resolveManualPresellVideoUrl("")).toBeNull();
  });
});

