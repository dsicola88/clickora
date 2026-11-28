import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "./authService";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("authService — sessões revogadas no servidor", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    localStorage.setItem("clickora_token", "token-antigo");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    localStorage.clear();
  });

  it("troca de senha guarda o token reemitido (o antigo deixou de valer)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { message: "ok", token: "token-novo", other_sessions_revoked: true }),
    );
    const r = await authService.changePassword("atual", "nova-senha");
    expect(r.error).toBeNull();
    expect(r.data?.other_sessions_revoked).toBe(true);
    expect(localStorage.getItem("clickora_token")).toBe("token-novo");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/auth\/change-password$/);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-antigo");
  });

  it("troca de senha recusada mantém o token atual", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: "Senha atual incorreta" }));
    const r = await authService.changePassword("errada", "nova-senha");
    expect(r.error).toBe("Senha atual incorreta");
    expect(localStorage.getItem("clickora_token")).toBe("token-antigo");
  });

  it("terminar outras sessões guarda o token reemitido", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { message: "ok", token: "token-desta-sessao" }));
    const r = await authService.revokeOtherSessions();
    expect(r.error).toBeNull();
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/auth\/sessions\/revoke-others$/);
    expect(localStorage.getItem("clickora_token")).toBe("token-desta-sessao");
  });
});
