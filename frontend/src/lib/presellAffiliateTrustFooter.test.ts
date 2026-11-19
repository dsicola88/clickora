import { describe, expect, it } from "vitest";
import { isAffiliateTrustFooterEnabled } from "./presellAffiliateTrustFooter";

describe("isAffiliateTrustFooterEnabled", () => {
  it("sem a chave = rodapé desligado (opt-in explícito)", () => {
    expect(isAffiliateTrustFooterEnabled(undefined)).toBe(false);
    expect(isAffiliateTrustFooterEnabled({})).toBe(false);
  });

  it("respeita o interruptor explícito", () => {
    expect(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: false })).toBe(false);
    expect(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: true })).toBe(true);
    expect(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: "false" })).toBe(false);
  });
});
