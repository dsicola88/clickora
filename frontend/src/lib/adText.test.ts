import { describe, expect, it } from "vitest";
import { adTextLength, adsToCsv, finalExportBlockReason } from "./adText";

describe("adTextLength", () => {
  it("conta caracteres e CJK", () => {
    expect(adTextLength("Buy now")).toBe(7);
    expect(adTextLength("中")).toBe(2);
  });
});

describe("finalExportBlockReason", () => {
  it("bloqueia inválidos e não trata avisos como prontos para exportação final", () => {
    expect(finalExportBlockReason([{ level: "warning" }])).toBeNull();
    expect(finalExportBlockReason([{ level: "invalid" }])).toMatch(/bloqueada/);
  });
});

describe("adsToCsv", () => {
  it("escapa vírgulas e inclui BOM", () => {
    const csv = adsToCsv([{ kind: "headline", text: "Buy, now", pin: "", url: "", platform: "google" }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Buy, now"');
  });
});
