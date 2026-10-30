import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCustomDomainHttpsPendingForPresell } from "@/lib/publicPresellOrigin";
import type { CustomDomainDto } from "@/types/api";

describe("sync_health FE wiring", () => {
  it("Resultados e Integrações montam SyncHealthBanner", () => {
    const results = readFileSync(join(process.cwd(), "src/pages/ResultsOverviewPage.tsx"), "utf8");
    const integrations = readFileSync(join(process.cwd(), "src/pages/IntegrationsHubPage.tsx"), "utf8");
    const tracking = readFileSync(join(process.cwd(), "src/pages/TrackingDashboard.tsx"), "utf8");
    expect(results).toContain("SyncHealthBanner");
    expect(results).toContain("sync_health");
    expect(integrations).toContain("SyncHealthBanner");
    expect(integrations).toContain("domain_https");
    expect(tracking).toContain("SyncHealthBanner");
    expect(tracking).toContain("syncHealth=");
  });

  it("PresellDashboard liga customDomainHttpsPending", () => {
    const dash = readFileSync(join(process.cwd(), "src/pages/PresellDashboard.tsx"), "utf8");
    expect(dash).toContain("isCustomDomainHttpsPendingForPresell");
    expect(dash).toContain("customDomainHttpsPending");
  });

  it("BE analytics devolve sync_health; accountHealth tem domain_https", () => {
    const analytics = readFileSync(
      join(process.cwd(), "../backend/src/controllers/analytics.controller.ts"),
      "utf8",
    );
    const health = readFileSync(join(process.cwd(), "../backend/src/lib/accountHealth.ts"), "utf8");
    expect(analytics).toContain("sync_health");
    expect(analytics).toContain("google_ads_failed");
    expect(analytics).toContain("meta_capi_skipped_no_fbclid");
    expect(analytics).toContain("tiktok_events_skipped_no_ttclid");
    expect(health).toContain('id: "domain_https"');
    expect(health).toContain("/resultados/relatorios/conversoes");
  });

  it("HTTPS pending só para Vercel verificado sem https_ready", () => {
    const domains: CustomDomainDto[] = [
      {
        id: "d1",
        hostname: "offers.example.com",
        verification_token: "t",
        status: "verified",
        verified_at: null,
        is_default: true,
        purpose: "both",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        vercel_domain_registered: true,
        ssl_state: "ssl_provisioning",
        https_ready: false,
      },
    ];
    expect(isCustomDomainHttpsPendingForPresell(domains, "d1")).toBe(true);
    expect(isCustomDomainHttpsPendingForPresell(domains, null)).toBe(false);
  });
});
