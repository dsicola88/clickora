import { describe, expect, it } from "vitest";
import { resolveComplianceJump } from "./complianceJump";

describe("resolveComplianceJump", () => {
  it("prioriza privacy mesmo se o texto tiver URL https", () => {
    const jump = resolveComplianceJump("Add privacy policy URL https://example.com/privacy");
    expect(jump?.anchorId).toBe("compliance-privacy");
    expect(jump?.enableFooter).toBe(true);
  });

  it("mapeia DT-* para destination sem confundir com https", () => {
    expect(resolveComplianceJump("DT-01 destination probe failed")?.anchorId).toBe(
      "compliance-destination",
    );
    expect(resolveComplianceJump("Use https only on your landing")).toBeNull();
  });

  it("mapeia identity / disclosure", () => {
    expect(resolveComplianceJump("business name missing")?.anchorId).toBe("compliance-business");
    expect(resolveComplianceJump("affiliate disclosure required")?.anchorId).toBe(
      "compliance-affiliate",
    );
  });
});
