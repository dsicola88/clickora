import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
});
