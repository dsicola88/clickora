import { describe, expect, it } from "vitest";
import {
  ACCOUNT_HEALTH_HUB_STEPS,
  SETUP_ASSISTANT_HEALTH_MAP,
  accountHealthCheckOk,
} from "./accountHealthSteps";

describe("accountHealthSteps", () => {
  it("hub inclui checks que antes ficavam órfãos", () => {
    const ids = ACCOUNT_HEALTH_HUB_STEPS.map((s) => s.id);
    expect(ids).toContain("postback_plan");
    expect(ids).toContain("attribution");
    expect(ids).toContain("macros");
    expect(ids).toContain("presell_published");
  });

  it("setup map aponta para IDs do account_health", () => {
    expect(SETUP_ASSISTANT_HEALTH_MAP.presell).toBe("presell_published");
    expect(SETUP_ASSISTANT_HEALTH_MAP.domain).toBe("domain_https");
  });

  it("accountHealthCheckOk", () => {
    const checks = [
      { id: "presell_published", ok: true, detail: "1" },
      { id: "google_ads", ok: false, detail: "falta" },
    ];
    expect(accountHealthCheckOk(checks, "presell_published")).toEqual({
      found: true,
      ok: true,
      detail: "1",
    });
    expect(accountHealthCheckOk(checks, "missing").found).toBe(false);
  });
});
