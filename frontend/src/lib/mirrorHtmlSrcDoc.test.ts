import { describe, expect, it } from "vitest";
import { normalizeBrokenViewportMeta, wrapMirrorFoldAsFullSrcDoc } from "./mirrorHtmlSrcDoc";

describe("mirrorHtmlSrcDoc", () => {
  it("repara meta viewport sem content", () => {
    const fixed = normalizeBrokenViewportMeta('<meta name="viewport" c>');
    expect(fixed).toMatch(/content="width=device-width/i);
  });

  it("envolve fragmento head+body em documento iframe", () => {
    const frag =
      '<link rel="stylesheet" href="https://cdn.example/a.css"><section id="hero">Trimoryn</section>';
    const doc = wrapMirrorFoldAsFullSrcDoc(frag);
    expect(doc).toMatch(/<!DOCTYPE html>/i);
    expect(doc).toContain('href="https://cdn.example/a.css"');
    expect(doc).toContain("<body>");
    expect(doc).toContain('id="hero"');
  });
});