import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { apiClient } from "@/lib/apiClient";

/** Integração real AuthProvider + authService + apiClient (só o `fetch` é simulado). */

const storedUser = { id: "u1", email: "e2e@clickora.test", role: "user" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function Probe({ onRender }: { onRender: (u: unknown, loading: boolean) => void }) {
  const { user, loading } = useAuth();
  onRender(user, loading);
  return null;
}

function renderWithAuth(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AuthProvider + apiClient — fim de sessão com 401 real", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    localStorage.setItem("clickora_token", "jwt-de-teste");
    localStorage.setItem("clickora_user", JSON.stringify(storedUser));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("/auth/me com 401 (token expirado, assinatura inválida ou conta apagada) limpa o token e termina a sessão", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Token inválido ou expirado" }));
    const seen: Array<{ user: unknown; loading: boolean }> = [];
    renderWithAuth(<Probe onRender={(user, loading) => seen.push({ user, loading })} />);
    await waitFor(() => expect(seen.at(-1)?.loading).toBe(false));
    expect(seen.at(-1)?.user).toBeNull();
    expect(localStorage.getItem("clickora_token")).toBeNull();
    expect(localStorage.getItem("clickora_user")).toBeNull();
  });

  it("401 num pedido posterior (token revogado a meio da sessão) desliga o utilizador", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, storedUser));
    const seen: Array<{ user: unknown; loading: boolean }> = [];
    renderWithAuth(<Probe onRender={(user, loading) => seen.push({ user, loading })} />);
    await waitFor(() => expect(seen.at(-1)?.loading).toBe(false));
    expect(seen.at(-1)?.user).toMatchObject({ id: "u1" });

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "Token inválido ou expirado" }));
    await act(async () => {
      await apiClient.get("/presells");
    });
    await waitFor(() => expect(seen.at(-1)?.user).toBeNull());
    expect(localStorage.getItem("clickora_token")).toBeNull();
  });

  it("503 transitório de /auth/me mantém sessão e token (só 401 termina a sessão)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: "Serviço indisponível" }));
    const seen: Array<{ user: unknown; loading: boolean }> = [];
    renderWithAuth(<Probe onRender={(user, loading) => seen.push({ user, loading })} />);
    await waitFor(() => expect(seen.at(-1)?.loading).toBe(false));
    expect(seen.at(-1)?.user).toMatchObject({ id: "u1" });
    expect(localStorage.getItem("clickora_token")).toBe("jwt-de-teste");
  });
});
