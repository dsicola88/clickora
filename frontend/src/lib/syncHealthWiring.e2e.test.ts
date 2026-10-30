import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCustomDomainHttpsPendingForPresell } from "@/lib/publicPresellOrigin";
import type { CustomDomainDto } from "@/types/api";

describe("sync_health FE wiring", () => {
  it("Superfície FE monta SyncHealthBanner (Resultados→Agency)", () => {
    const pages = [
      "ResultsOverviewPage.tsx",
      "IntegrationsHubPage.tsx",
      "TrackingDashboard.tsx",
      "Vendas.tsx",
      "Relatorios.tsx",
      "Home.tsx",
      "AgencyReadyPage.tsx",
    ];
    for (const file of pages) {
      const src = readFileSync(join(process.cwd(), "src/pages", file), "utf8");
      expect(src, file).toContain("SyncHealthBanner");
    }
    const integrations = readFileSync(join(process.cwd(), "src/pages/IntegrationsHubPage.tsx"), "utf8");
    expect(integrations).toContain("domain_https");
    expect(integrations).toContain("ads_upload");
    expect(integrations).toContain("cost_sync");
    const relatorios = readFileSync(join(process.cwd(), "src/pages/Relatorios.tsx"), "utf8");
    expect(relatorios).toContain("google_ads_skipped_no_gclid");
  });

  it("PresellDashboard liga customDomainHttpsPending", () => {
    const dash = readFileSync(join(process.cwd(), "src/pages/PresellDashboard.tsx"), "utf8");
    expect(dash).toContain("isCustomDomainHttpsPendingForPresell");
    expect(dash).toContain("customDomainHttpsPending");
  });

  it("BE analytics devolve sync_health; accountHealth tem domain_https + ads_upload", () => {
    const analytics = readFileSync(
      join(process.cwd(), "../backend/src/controllers/analytics.controller.ts"),
      "utf8",
    );
    const syncLib = readFileSync(join(process.cwd(), "../backend/src/lib/syncHealth.ts"), "utf8");
    const health = readFileSync(join(process.cwd(), "../backend/src/lib/accountHealth.ts"), "utf8");
    expect(analytics).toContain("sync_health");
    expect(analytics).toContain("loadSyncHealth");
    expect(analytics).toContain("...funnel, sync_health");
    expect(syncLib).toContain("meta_capi_skipped_no_fbclid");
    expect(syncLib).toContain("tiktok_events_skipped_no_ttclid");
    expect(health).toContain('id: "domain_https"');
    expect(health).toContain('id: "ads_upload"');
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
