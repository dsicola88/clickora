import { describe, expect, it } from "vitest";
import { isSafeLessonEmbed } from "./lessonsService";

describe("isSafeLessonEmbed", () => {
  it("aceita só os embeds que a API monta", () => {
    expect(isSafeLessonEmbed("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0")).toBe(true);
    expect(isSafeLessonEmbed("https://iframe.mediadelivery.net/embed/1/abcdefgh")).toBe(true);
    expect(isSafeLessonEmbed("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(false);
    expect(isSafeLessonEmbed("javascript:alert(1)")).toBe(false);
    expect(isSafeLessonEmbed(null)).toBe(false);
  });
});
