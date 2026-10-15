import { describe, expect, it } from "vitest";
import {
  coercePresellTypeForNiche,
  defaultPresellTypeForNiche,
  isPresellTypeAllowedForNiche,
  presellTypeGroupsForNiche,
} from "./presellGenerationNiche";

describe("presellGenerationNiche", () => {
  it("black permite fantasma; white não", () => {
    expect(isPresellTypeAllowedForNiche("fantasma", "black")).toBe(true);
    expect(isPresellTypeAllowedForNiche("fantasma", "white")).toBe(false);
    expect(isPresellTypeAllowedForNiche("cookies", "white")).toBe(true);
  });

  it("defaults por nicho", () => {
    expect(defaultPresellTypeForNiche("black")).toBe("cookies");
    expect(defaultPresellTypeForNiche("white")).toBe("tsl");
  });

  it("white filtra grupos agressivos", () => {
    const white = presellTypeGroupsForNiche("white");
    const ids = white.flatMap((g) => g.types.map((t) => t.id));
    expect(ids).not.toContain("fantasma");
    expect(ids).toContain("tsl");
  });

  it("coerce tipo inválido no white", () => {
    expect(coercePresellTypeForNiche("fantasma", "white")).toBe("tsl");
    expect(coercePresellTypeForNiche("cookies", "black")).toBe("cookies");
  });
});
