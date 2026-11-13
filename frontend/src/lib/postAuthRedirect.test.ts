import { describe, expect, it } from "vitest";
import {
  mergeRedirectSearch,
  postAuthPathFromLocationState,
  resolvePostAuthRedirect,
} from "./postAuthRedirect";

describe("resolvePostAuthRedirect", () => {
  it("aceita paths internos com query/hash", () => {
    expect(resolvePostAuthRedirect("/integracoes/google-ads?ok=1")).toBe(
      "/integracoes/google-ads?ok=1",
    );
    expect(resolvePostAuthRedirect("/presell/builder/abc#x")).toBe("/presell/builder/abc#x");
  });

  it("rejeita open redirects", () => {
    expect(resolvePostAuthRedirect("//evil.com")).toBe("/inicio");
    expect(resolvePostAuthRedirect("https://evil.com")).toBe("/inicio");
    expect(resolvePostAuthRedirect("auth")).toBe("/inicio");
    expect(resolvePostAuthRedirect("/\\evil")).toBe("/inicio");
  });

  it("evita loop em /auth", () => {
    expect(resolvePostAuthRedirect("/auth")).toBe("/inicio");
    expect(resolvePostAuthRedirect("/auth?trial=1")).toBe("/inicio");
  });
});

describe("postAuthPathFromLocationState", () => {
  it("prefere state.from a ?redirect=", () => {
    expect(
      postAuthPathFromLocationState(
        { from: { pathname: "/campanhas", search: "?id=1" } },
        "/conta",
      ),
    ).toBe("/campanhas?id=1");
  });

  it("usa ?redirect= quando não há state", () => {
    expect(postAuthPathFromLocationState(null, "/resultados")).toBe("/resultados");
  });
});

describe("mergeRedirectSearch", () => {
  it("preserva aba= ao migrar /presell/dashboard", () => {
    expect(mergeRedirectSearch("/presells", "?aba=rastreamento")).toBe(
      "/presells?aba=rastreamento",
    );
  });

  it("destino ganha em chaves duplicadas (focus=meta)", () => {
    expect(mergeRedirectSearch("/integracoes/pixels?focus=meta", "?focus=tiktok&x=1")).toBe(
      "/integracoes/pixels?focus=meta&x=1",
    );
  });

  it("preserva hash da origem se destino não tiver", () => {
    expect(mergeRedirectSearch("/resultados", "", "#sec")).toBe("/resultados#sec");
  });
});
