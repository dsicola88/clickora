import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLocaleProvider } from "@/i18n/AppLocaleProvider";
import { APP_LOCALE_STORAGE_KEY } from "@/i18n/types";
import type { ContinuityOverviewDto } from "@/types/api";

const getOverview = vi.fn();

vi.mock("@/services/continuityService", () => ({
  CONTINUITY_SCHEMA_PENDING: "CONTINUITY_SCHEMA_PENDING",
  continuityService: { getOverview: (...a: unknown[]) => getOverview(...a) },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", tenant_user_id: "u1" } }),
}));

import { DomainContinuityPanel } from "./DomainContinuityPanel";

function overview(patch: Partial<ContinuityOverviewDto> = {}): ContinuityOverviewDto {
  return {
    generated_at: new Date().toISOString(),
    monitor: {
      enabled: true,
      check_interval_min: 10,
      recheck_interval_min: 2,
      fail_threshold: 3,
      auto_failover_enabled: true,
      auto_recovery_hold_min: 10,
      alerts_enabled: true,
    },
    account_canonical_domain_id: "d1",
    domains: [
      {
        id: "d1",
        hostname: "lp.example.com",
        status: "verified",
        purpose: "both",
        is_default: true,
        is_default_tracking: true,
        is_active: true,
        routing_role: "primary",
        routing_priority: 10,
        health_status: "down",
        consecutive_failures: 3,
        auto_recover: true,
        last_health_check_at: null,
        last_health_error: "HTTP: 502",
        last_http_status: 502,
        disabled_reason: null,
        uptime_24h: 0.9876,
        uptime_7d: null,
        presell_count: 2,
      },
    ],
    presells: [
      {
        id: "p1",
        title: "Presell Risco",
        slug: "risco",
        status: "published",
        canonical_domain_id: "d1",
        canonical_hostname: "lp.example.com",
        primary_domain_id: "d1",
        primary_hostname: "lp.example.com",
        backup_count: 0,
        selection_reason: "primary",
        risk: "primary_down",
      },
      {
        id: "p2",
        title: "Presell Saudavel",
        slug: "ok",
        status: "published",
        canonical_domain_id: "d1",
        canonical_hostname: "lp.example.com",
        primary_domain_id: "d1",
        primary_hostname: "lp.example.com",
        backup_count: 1,
        selection_reason: "primary",
        risk: "ok",
      },
    ],
    ads: {
      available: true,
      suggestions: [
        {
          rsaId: "r1",
          externalAdId: "123",
          campaignName: "Camp A",
          adGroupName: "Grupo 1",
          currentUrl: "https://lp.example.com/risco",
          currentHost: "lp.example.com",
          issue: "domain_down",
          severity: "critical",
          presellId: "p1",
          presellTitle: "Presell Risco",
          suggestedUrl: "https://backup.example.com/risco",
          suggestedHost: "backup.example.com",
        },
      ],
    },
    recent_events: [],
    metrics: {
      checks_total: 10,
      checks_failed: 3,
      failovers: 1,
      recoveries: 0,
      failover_latency: { samples: 1, p50_ms: 120_000, p95_ms: 120_000, max_ms: 120_000 },
      last_tick: null,
    },
    ...patch,
  };
}

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AppLocaleProvider>
        <DomainContinuityPanel />
      </AppLocaleProvider>
    </QueryClientProvider>,
  );
}

describe("DomainContinuityPanel", () => {
  beforeEach(() => {
    getOverview.mockReset();
    localStorage.setItem(APP_LOCALE_STORAGE_KEY, "en");
  });

  it("mostra domínios, só presells em risco e a sugestão de Final URL sem mutações", async () => {
    getOverview.mockResolvedValue({ data: overview(), error: null });
    renderPanel();

    expect(await screen.findByText("Domain continuity")).toBeTruthy();
    expect(await screen.findByText("98.76%")).toBeTruthy();
    expect(screen.getAllByText("Offline").length).toBeGreaterThan(0);

    expect(screen.getByText("Presell Risco")).toBeTruthy();
    expect(screen.queryByText("Presell Saudavel")).toBeNull();
    expect(screen.getByText("Configured domain offline")).toBeTruthy();

    expect(screen.getByText("https://backup.example.com/risco")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Open Google Ads/i });
    expect(link.getAttribute("href")).toContain("ads.google.com");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(getOverview).toHaveBeenCalledTimes(1);
  });

  it("mostra aviso de migração pendente quando a API responde CONTINUITY_SCHEMA_PENDING", async () => {
    getOverview.mockResolvedValue({
      data: null,
      error: "Migração de continuidade ainda não aplicada.",
      errorCode: "CONTINUITY_SCHEMA_PENDING",
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText(/migration pending/i)).toBeTruthy());
    expect(getOverview).toHaveBeenCalledTimes(1);
  });

  it("mostra estados vazios sem sugestões nem presells em risco", async () => {
    getOverview.mockResolvedValue({
      data: overview({ presells: [], ads: { available: true, suggestions: [] }, domains: [] }),
      error: null,
    });
    renderPanel();
    expect(await screen.findByText("All presells are on a healthy domain.")).toBeTruthy();
    expect(screen.getByText("No Final URL needs attention.")).toBeTruthy();
    expect(screen.getByText("No custom domains yet.")).toBeTruthy();
  });
});
