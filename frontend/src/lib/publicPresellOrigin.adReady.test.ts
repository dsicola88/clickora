import { describe, expect, it } from "vitest";
import type { CustomDomainDto } from "@/types/api";
import {
  getPublicPresellOriginForPresell,
  isCustomDomainAdReady,
  listAdReadyHostingDomains,
} from "./publicPresellOrigin";

function domain(partial: Partial<CustomDomainDto> & { hostname: string }): CustomDomainDto {
  return {
    id: partial.id ?? partial.hostname,
    hostname: partial.hostname,
    verification_token: "t",
    status: partial.status ?? "verified",
    verified_at: null,
    is_default: partial.is_default ?? false,
    purpose: partial.purpose ?? "both",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    vercel_domain_registered: partial.vercel_domain_registered,
    ssl_state: partial.ssl_state,
    https_ready: partial.https_ready,
  };
}

describe("publicPresellOrigin ad-ready", () => {
  it("Vercel só DNS não é ad-ready", () => {
    const d = domain({
      hostname: "offers.example.com",
      vercel_domain_registered: true,
      ssl_state: "ssl_provisioning",
      https_ready: false,
    });
    expect(isCustomDomainAdReady(d)).toBe(false);
    expect(listAdReadyHostingDomains([d])).toHaveLength(0);
  });

  it("Vercel com HTTPS pronto é ad-ready", () => {
    const d = domain({
      hostname: "offers.example.com",
      vercel_domain_registered: true,
      ssl_state: "https_ready",
      https_ready: true,
    });
    expect(isCustomDomainAdReady(d)).toBe(true);
  });

  it("SSL a provisionar não é ad-ready (Ads); em local evita localhost nos braços", () => {
    const domains = [
      domain({
        id: "d1",
        hostname: "offers.example.com",
        is_default: true,
        vercel_domain_registered: true,
        ssl_state: "ssl_provisioning",
        https_ready: false,
      }),
    ];
    expect(isCustomDomainAdReady(domains[0]!)).toBe(false);
    expect(listAdReadyHostingDomains(domains)).toHaveLength(0);
    // jsdom = origem local → hostname verificado (não grava localhost). Em produção com
    // VITE_PUBLIC_SITE_ORIGIN, getPublicPresellOrigin(null) devolve a app sem o custom.
    const origin = getPublicPresellOriginForPresell(domains, "d1");
    expect(origin).not.toContain("localhost");
  });

  it("sem Vercel (TXT) verificado usa hostname", () => {
    const domains = [
      domain({
        id: "d2",
        hostname: "land.example.com",
        vercel_domain_registered: false,
      }),
    ];
    expect(getPublicPresellOriginForPresell(domains, "d2")).toBe("https://land.example.com");
  });
});
