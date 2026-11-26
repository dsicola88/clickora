import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ReportsHealthPanel } from "./ReportsHealthPanel";

vi.mock("@/i18n/AppLocaleProvider", () => ({
  useAppLocale: () => ({ t: (key: string) => key }),
}));

const healthy = {
  period_days: 30,
  google_ads_failed: 0,
  google_ads_skipped_no_gclid: 0,
  meta_capi_failed: 0,
  meta_capi_skipped_no_fbclid: 0,
  tiktok_events_failed: 0,
  tiktok_events_skipped_no_ttclid: 0,
};

function renderPanel(props: Parameters<typeof ReportsHealthPanel>[0]) {
  return render(
    <MemoryRouter>
      <ReportsHealthPanel {...props} />
    </MemoryRouter>,
  );
}

describe("ReportsHealthPanel", () => {
  it("não afirma estado nenhum sem dados de saúde", () => {
    const { container } = renderPanel({ syncHealth: null, paidUntracked: 0, checks: null });
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra confirmação discreta quando tudo está bem", () => {
    renderPanel({ syncHealth: healthy, paidUntracked: 0, checks: null });
    expect(screen.getByText("pages.reports.healthOk")).toBeInTheDocument();
    expect(screen.queryByText("pages.reports.healthTitle")).not.toBeInTheDocument();
  });

  it("vendas orgânicas sem ID não aparecem como erro (contagem a zero)", () => {
    renderPanel({ syncHealth: { ...healthy, google_ads_skipped_no_gclid: 0 }, paidUntracked: 0, checks: null });
    expect(screen.queryByText("pages.syncHealth.googleNoId")).not.toBeInTheDocument();
  });

  it("só lista itens acionáveis com link para resolver", () => {
    renderPanel({
      syncHealth: { ...healthy, google_ads_skipped_no_gclid: 3, meta_capi_failed: 1 },
      paidUntracked: 0,
      checks: null,
    });
    expect(screen.getByText("pages.reports.healthTitle")).toBeInTheDocument();
    expect(screen.getByText("pages.syncHealth.googleNoId")).toBeInTheDocument();
    expect(screen.getByText("pages.syncHealth.metaFail")).toBeInTheDocument();
    expect(screen.queryByText("pages.syncHealth.tiktokFail")).not.toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(2);
    expect(links[0]).toHaveAttribute("href", "/integracoes/google-ads");
    expect(links[1]).toHaveAttribute("href", "/integracoes/pixels");
  });

  it("visitas pagas sem rastreio aparecem quando há contagem", () => {
    renderPanel({ syncHealth: healthy, paidUntracked: 2, checks: null });
    expect(screen.getByText("pages.reports.untrackedVisits")).toBeInTheDocument();
    expect(screen.queryByText("pages.reports.healthOk")).not.toBeInTheDocument();
  });
});
