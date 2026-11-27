import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenantRoot } from "./TenantRoot";

const getRoot = vi.fn();

vi.mock("@/services/presellService", () => ({
  presellService: { getRootPresellIdForHost: (...a: unknown[]) => getRoot(...a) },
}));
vi.mock("@/pages/PublicPresell", () => ({
  default: ({ presellId }: { presellId?: string }) => <div data-testid="public-presell">presell:{presellId}</div>,
}));

function Where() {
  const loc = useLocation();
  return <span data-testid="where">{loc.pathname}{loc.search}</span>;
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/?gclid=G1"]}>
        <Where />
        <Routes>
          <Route path="/" element={<TenantRoot />} />
          <Route path="*" element={<div data-testid="elsewhere" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TenantRoot — raiz do domínio do assinante", () => {
  beforeEach(() => {
    getRoot.mockReset();
  });

  it("presell escolhida: renderiza na própria raiz, sem redirecionar (URL e query intactos)", async () => {
    getRoot.mockResolvedValue({
      data: { id: "11111111-1111-4111-8111-111111111111", slug: "minha-oferta" },
      error: null,
    });
    setup();
    expect(await screen.findByTestId("public-presell")).toHaveTextContent("presell:11111111-1111-4111-8111-111111111111");
    expect(screen.getByTestId("where")).toHaveTextContent("/?gclid=G1");
    expect(screen.queryByTestId("elsewhere")).toBeNull();
  });

  it("sem escolha (ROOT_PRESELL_NONE): página neutra, sem links e sem redirecionar", async () => {
    getRoot.mockResolvedValue({ data: null, error: "Nenhuma presell escolhida", errorCode: "ROOT_PRESELL_NONE" });
    const { container } = setup();
    expect(await screen.findByTestId("tenant-root-neutral")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Portal" })).toBeInTheDocument();
    expect(container.querySelectorAll("a, form, iframe, script").length).toBe(0);
    expect(screen.getByTestId("where")).toHaveTextContent("/?gclid=G1");
    expect(screen.queryByTestId("public-presell")).toBeNull();
  });

  it("domínio só de tracking: página neutra", async () => {
    getRoot.mockResolvedValue({ data: { id: null, purpose: "tracking" }, error: null });
    setup();
    expect(await screen.findByTestId("tenant-root-neutral")).toBeInTheDocument();
    expect(screen.queryByTestId("public-presell")).toBeNull();
  });

  it("erro de rede: aviso neutro, nunca presell", async () => {
    getRoot.mockResolvedValue({ data: null, error: "boom", errorCode: "X" });
    setup();
    await waitFor(() => expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.queryByTestId("public-presell")).toBeNull();
  });
});
