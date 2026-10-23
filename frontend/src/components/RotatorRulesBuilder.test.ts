import { describe, expect, it } from "vitest";
import {
  draftsToPolicy,
  emptyRuleDraft,
  policyToDrafts,
} from "@/components/RotatorRulesBuilder";

describe("RotatorRulesBuilder policy roundtrip", () => {
  it("draftsToPolicy → policyToDrafts preserva geo e acção", () => {
    const drafts = [
      {
        ...emptyRuleDraft(),
        name: "US only",
        countries_allow: "US, CA",
        device: "mobile" as const,
        action: "block" as const,
      },
    ];
    const policy = draftsToPolicy(drafts);
    expect(policy?.version).toBe(1);
    expect(policy?.rules[0]?.when.countries_allow).toEqual(["US", "CA"]);
    expect(policy?.rules[0]?.action).toEqual({ type: "block" });
    const back = policyToDrafts(policy);
    expect(back[0]?.countries_allow).toContain("US");
    expect(back[0]?.action).toBe("block");
  });

  it("redirect sem URL é ignorado", () => {
    const drafts = [
      {
        ...emptyRuleDraft(),
        action: "redirect" as const,
        redirect_url: "not-a-url",
      },
    ];
    expect(draftsToPolicy(drafts)).toBeNull();
  });
});
