import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const me = vi.fn();
const isAuthenticated = vi.fn();
const getStoredUser = vi.fn();

vi.mock("@/services/authService", () => ({
  authService: {
    me: (...a: unknown[]) => me(...a),
    isAuthenticated: (...a: unknown[]) => isAuthenticated(...a),
    getStoredUser: (...a: unknown[]) => getStoredUser(...a),
    logout: vi.fn(async () => undefined),
  },
}));

import { AuthProvider, useAuth } from "./AuthContext";

const storedUser = { id: "u1", email: "e2e@clickora.test", role: "user" } as const;

function Probe({ onRender }: { onRender: (u: unknown, loading: boolean) => void }) {
  const { user, loading } = useAuth();
  onRender(user, loading);
  return null;
}

function wrap(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}

describe("AuthProvider — arranque da sessão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStoredUser.mockReturnValue(storedUser);
  });

  it("falha transitória de /auth/me (rede/5xx) mantém a sessão e não desloga", async () => {
    isAuthenticated.mockReturnValue(true);
    me.mockResolvedValue({ data: null, error: "Erro de conexão com o servidor" });
    const seen: Array<{ user: unknown; loading: boolean }> = [];
    render(wrap(<Probe onRender={(user, loading) => seen.push({ user, loading })} />));
    await waitFor(() => expect(seen.at(-1)?.loading).toBe(false));
    expect(seen.at(-1)?.user).toEqual(storedUser);
  });

  it("token invalidado (401 já limpou o token) termina a sessão", async () => {
    isAuthenticated.mockReturnValue(false);
    me.mockResolvedValue({ data: null, error: "Não autenticado" });
    const seen: Array<{ user: unknown; loading: boolean }> = [];
    render(wrap(<Probe onRender={(user, loading) => seen.push({ user, loading })} />));
    await waitFor(() => expect(seen.at(-1)?.loading).toBe(false));
    expect(seen.at(-1)?.user).toBeNull();
  });
});
