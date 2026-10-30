import { describe, expect, it } from "vitest";
import { resolveSslBadge, shouldPollCustomDomainSsl } from "./customDomainSslDisplay";

describe("customDomainSslDisplay", () => {
  it("HTTPS pronto não faz poll", () => {
    expect(
      shouldPollCustomDomainSsl({
        status: "verified",
        ssl_state: "https_ready",
        https_ready: true,
        vercel_domain_registered: true,
      }),
    ).toBe(false);
    expect(
      resolveSslBadge({
        status: "verified",
        ssl_state: "https_ready",
        https_ready: true,
        ssl_label: "HTTPS pronto",
      })?.tone,
    ).toBe("emerald");
  });

  it("ssl_provisioning faz poll", () => {
    expect(
      shouldPollCustomDomainSsl({
        status: "verified",
        ssl_state: "ssl_provisioning",
        https_ready: false,
        vercel_domain_registered: true,
      }),
    ).toBe(true);
    expect(
      resolveSslBadge({
        status: "verified",
        ssl_state: "ssl_provisioning",
        https_ready: false,
        ssl_label: "SSL a provisionar",
      })?.tone,
    ).toBe("amber");
  });

  it("pending não mostra badge SSL", () => {
    expect(
      resolveSslBadge({
        status: "pending",
        ssl_state: "pending_dns",
        https_ready: false,
      }),
    ).toBeNull();
  });
});
