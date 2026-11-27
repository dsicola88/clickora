import { describe, expect, it } from "vitest";
import {
  isAnyPublicPresellPathname,
  isReservedBarePresellSegment,
  isTenantRootPathname,
  isTenantBarePresellPathname,
  parseBarePresellSegment,
} from "./publicPresellBarePath";

describe("publicPresellBarePath", () => {
  it("parseia um segmento", () => {
    expect(parseBarePresellSegment("/kerassentials")).toBe("kerassentials");
    expect(parseBarePresellSegment("/kerassentials/")).toBe("kerassentials");
    expect(parseBarePresellSegment("/p/foo")).toBe(null);
    expect(parseBarePresellSegment("/")).toBe(null);
  });

  it("reserva rotas da app", () => {
    expect(isReservedBarePresellSegment("auth")).toBe(true);
    expect(isReservedBarePresellSegment("kerassentials")).toBe(false);
  });

  it("bare só em tenant", () => {
    expect(isTenantBarePresellPathname("/kerassentials", "go.afiliado.com")).toBe(true);
    expect(isTenantBarePresellPathname("/kerassentials", "www.dclickora.com")).toBe(false);
    expect(isTenantBarePresellPathname("/auth", "go.afiliado.com")).toBe(false);
    expect(isTenantBarePresellPathname("/kerassentials", "localhost")).toBe(false);
  });

  it("isAnyPublicPresellPathname inclui /p/, /l/ e bare", () => {
    expect(isAnyPublicPresellPathname("/p/x", "www.dclickora.com")).toBe(true);
    expect(isAnyPublicPresellPathname("/l/u", "www.dclickora.com")).toBe(true);
    expect(isAnyPublicPresellPathname("/toenail-care", "offer.shop")).toBe(true);
    expect(isAnyPublicPresellPathname("/planos", "offer.shop")).toBe(false);
  });

  it("isTenantRootPathname: só a raiz de domínio de assinante", () => {
    expect(isTenantRootPathname("/", "go.afiliado.com")).toBe(true);
    expect(isTenantRootPathname("", "go.afiliado.com")).toBe(true);
    expect(isTenantRootPathname("/kerassentials", "go.afiliado.com")).toBe(false);
    expect(isTenantRootPathname("/", "www.dclickora.com")).toBe(false);
    expect(isTenantRootPathname("/", "localhost")).toBe(false);
    expect(isTenantRootPathname("/", "app.vercel.app")).toBe(false);
  });
});