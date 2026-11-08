import { describe, expect, it } from "vitest";
import { isAffiliateTrustFooterEnabled } from "./presellAffiliateTrustFooter";

describe("isAffiliateTrustFooterEnabled", () => {
  it("páginas antigas sem a chave mantêm o rodapé", () => {
    expect(isAffiliateTrustFooterEnabled(undefined)).toBe(true);
    expect(isAffiliateTrustFooterEnabled({})).toBe(true);
  });

  it("respeita o interruptor explícito", () => {
    expect(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: false })).toBe(false);
    expect(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: true })).toBe(true);
    expect(isAffiliateTrustFooterEnabled({ showAffiliateTrustFooter: "false" })).toBe(false);
  });
});
