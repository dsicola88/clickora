import { describe, expect, it } from "vitest";
import {
  isEssentialsImportPresentation,
  resolveImportPresentationFromContent,
} from "./presellImportPresentation";

describe("presellImportPresentation", () => {
  it("essentials ignora espelho legado", () => {
    expect(
      isEssentialsImportPresentation({
        importPresentation: "essentials",
        importMirrorSrcDoc: "<html>" + "x".repeat(900) + "</html>",
      }),
    ).toBe(true);
  });

  it("resolve sem flag: espelho longo → mirror", () => {
    expect(
      resolveImportPresentationFromContent(
        { importMirrorSrcDoc: "a".repeat(900) },
        "white",
      ),
    ).toBe("mirror");
  });

  it("resolve sem flag: sem espelho → essentials", () => {
    expect(resolveImportPresentationFromContent({}, "white")).toBe("essentials");
  });
});