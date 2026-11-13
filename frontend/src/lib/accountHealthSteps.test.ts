import { describe, expect, it } from "vitest";
import {
  ACCOUNT_HEALTH_HUB_STEPS,
  SETUP_ASSISTANT_HEALTH_MAP,
  accountHealthCheckOk,
  getNextAccountHealthStep,
} from "./accountHealthSteps";

describe("accountHealthSteps", () => {
  it("hub inclui checks que antes ficavam órfãos", () => {
    const ids = ACCOUNT_HEALTH_HUB_STEPS.map((s) => s.id);
    expect(ids).toContain("postback_plan");
    expect(ids).toContain("attribution");
    expect(ids).toContain("macros");
    expect(ids).toContain("presell_published");
  });

  it("domain_https aponta para a página de domínio", () => {
    expect(ACCOUNT_HEALTH_HUB_STEPS.find((s) => s.id === "domain_https")?.href).toBe(
      "/configuracoes/dominio",
    );
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

  it("getNextAccountHealthStep segue a ordem do hub e respeita href override", () => {
    expect(getNextAccountHealthStep([])).toBeNull();
    expect(
      getNextAccountHealthStep([
        { id: "presell_published", ok: true },
        { id: "postback_plan", ok: true },
      ]),
    ).toBeNull();

    const next = getNextAccountHealthStep([
      { id: "presell_published", ok: true },
      { id: "google_ads", ok: false, detail: "ligar conta" },
      { id: "postback_configured", ok: false, detail: "falta postback", href: "/custom-postback" },
    ]);
    expect(next?.id).toBe("postback_configured");
    expect(next?.href).toBe("/custom-postback");
    expect(next?.detail).toBe("falta postback");
  });
});
