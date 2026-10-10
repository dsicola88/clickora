import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lessonEmbedUrl, parseLessonVideoUrl } from "./academyLesson";

describe("parseLessonVideoUrl", () => {
  it("aceita watch, youtu.be, shorts e embed do YouTube", () => {
    const id = "dQw4w9WgXcQ";
    const cases = [
      `https://www.youtube.com/watch?v=${id}&t=12s`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://m.youtube.com/watch?v=${id}`,
    ];
    for (const raw of cases) {
      const parsed = parseLessonVideoUrl(raw);
      assert.equal(parsed?.provider, "youtube");
      assert.equal(parsed?.videoId, id);
      assert.equal(parsed?.embedUrl, `https://www.youtube-nocookie.com/embed/${id}?rel=0`);
    }
  });

  it("aceita o embed e o iframe colado do Bunny Stream", () => {
    const raw = `<div style="position:relative;"><iframe src="https://iframe.mediadelivery.net/embed/239451/a1b2c3d4-e5f6-7890-abcd-ef1234567890?autoplay=true" loading="lazy"></iframe></div>`;
    const parsed = parseLessonVideoUrl(raw);
    assert.equal(parsed?.provider, "bunny");
    assert.equal(parsed?.bunnyLibraryId, "239451");
    assert.equal(parsed?.videoId, "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    assert.equal(
      parsed?.embedUrl,
      "https://iframe.mediadelivery.net/embed/239451/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    );
  });

  it("rejeita outros sites e javascript", () => {
    assert.equal(parseLessonVideoUrl("https://vimeo.com/123456789"), null);
    assert.equal(parseLessonVideoUrl("javascript:alert(1)"), null);
    assert.equal(parseLessonVideoUrl("https://www.youtube.com/watch?v=short"), null);
    assert.equal(parseLessonVideoUrl(""), null);
  });
});

describe("lessonEmbedUrl", () => {
  it("não monta embed com ids inválidos", () => {
    assert.equal(lessonEmbedUrl({ provider: "youtube", videoId: "nope", bunnyLibraryId: null }), null);
    assert.equal(
      lessonEmbedUrl({ provider: "bunny", videoId: "../evil", bunnyLibraryId: "1" }),
      null,
    );
  });
});
