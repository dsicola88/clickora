import { afterEach, describe, expect, it, vi } from "vitest";
import type { CustomDomainDto } from "@/types/api";
import {
  getPublicPresellFullUrl,
  getPublicPresellOriginForPresell,
  getPublicPresellTechnicalOrigin,
  hasPublicPresellOrigin,
  isHostingCapableDomain,
  listVerifiedHostingDomains,
  resolveDefaultCustomDomainIdForAccount,
} from "./publicPresellOrigin";

function domain(partial: Partial<CustomDomainDto> & Pick<CustomDomainDto, "id" | "hostname">): CustomDomainDto {
  return {
    verification_token: "t",
    status: "verified",
    verified_at: null,
    is_default: false,
    purpose: "both",
    is_default_tracking: false,
    root_presell_id: null,
    vercel_domain_registered: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("publicPresellOrigin hosting vs tracking", () => {
  it("excludes tracking-only from hosting lists", () => {
    expect(isHostingCapableDomain({ purpose: "tracking" })).toBe(false);
    expect(isHostingCapableDomain({ purpose: "both" })).toBe(true);
    const list = listVerifiedHostingDomains([
      domain({ id: "1", hostname: "go.x.com", purpose: "tracking", is_default: true }),
      domain({ id: "2", hostname: "www.x.com", purpose: "hosting" }),
    ]);
    expect(list.map((d) => d.id)).toEqual(["2"]);
  });

  it("default lander ignores tracking-only even if marked is_default", () => {
    const id = resolveDefaultCustomDomainIdForAccount([
      domain({ id: "go", hostname: "go.x.com", purpose: "tracking", is_default: true }),
      domain({ id: "www", hostname: "www.x.com", purpose: "both", is_default: false }),
    ]);
    expect(id).toBe("www");
  });

  it("public URL falls back when presell points at tracking-only domain", () => {
    const url = getPublicPresellFullUrl(
      [
        domain({ id: "go", hostname: "go.x.com", purpose: "tracking" }),
        domain({ id: "www", hostname: "www.x.com", purpose: "hosting", is_default: true }),
      ],
      "go",
      { id: "page-1" },
    );
    expect(url).toBe("https://www.x.com/p/page-1");
  });

  it("review com slug usa /{slug}; sem slug usa /l/; cookies usa /p/", () => {
    const domains = [domain({ id: "www", hostname: "www.x.com", purpose: "hosting", is_default: true })];
    expect(getPublicPresellFullUrl(domains, "www", { id: "a", type: "review", slug: "kerassentials" })).toBe(
      "https://www.x.com/kerassentials",
    );
    expect(getPublicPresellFullUrl(domains, "www", { id: "a", type: "review" })).toBe(
      "https://www.x.com/l/a",
    );
    expect(getPublicPresellFullUrl(domains, "www", { id: "b", type: "cookies" })).toBe(
      "https://www.x.com/p/b",
    );
  });

  it("com slug no domínio publica em /{slug} (sem /p/)", () => {
    const domains = [domain({ id: "www", hostname: "truefindlab.blog", purpose: "hosting", is_default: true })];
    const url = getPublicPresellFullUrl(domains, "www", {
      id: "11df2eb9-63d3-4d8e-9f99-0e19906bd2f1",
      slug: "trimoryn",
      type: "builder",
    });
    expect(url).toBe("https://truefindlab.blog/trimoryn");
  });

  it("mantém UUID em origem dclickora mesmo com slug definido", () => {
    const uuid = "11df2eb9-63d3-4d8e-9f99-0e19906bd2f1";
    const url = getPublicPresellFullUrl(null, null, { id: uuid, slug: "trimoryn", type: "builder" });
    expect(url).toContain(`/p/${uuid}`);
    expect(url).not.toContain("trimoryn");
  });

  it("com SSL pending não grava localhost se houver hostname verificado", () => {
    const domains = [
      domain({
        id: "hv",
        hostname: "honestverdictguide.online",
        purpose: "hosting",
        is_default: true,
        vercel_domain_registered: true,
        https_ready: false,
        ssl_state: "ssl_provisioning",
      }),
    ];
    const url = getPublicPresellFullUrl(domains, "hv", { id: "page-ab", type: "tsl" });
    expect(url).toBe("https://honestverdictguide.online/l/page-ab");
    expect(url).not.toContain("localhost");
  });
});

describe("domínio principal NÃO é origem de presells públicas", () => {
  afterEach(() => vi.unstubAllEnvs());

  const PROD_SITE = "https://www.dclickora.com";

  it("sem domínio próprio e sem domínio técnico → URL vazia (nunca www.dclickora.com)", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_ORIGIN", PROD_SITE);
    vi.stubEnv("VITE_PUBLIC_PRESELL_HOST", "");
    expect(getPublicPresellOriginForPresell([], null)).toBe("");
    expect(getPublicPresellOriginForPresell(null, null)).toBe("");
    expect(hasPublicPresellOrigin([], null)).toBe(false);
    const url = getPublicPresellFullUrl([], null, { id: "page-1", type: "cookies" });
    expect(url).toBe("");
    expect(url).not.toContain("dclickora.com");
  });

  it("domínio técnico isolado é usado quando não há domínio próprio", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_ORIGIN", PROD_SITE);
    vi.stubEnv("VITE_PUBLIC_PRESELL_HOST", "pages.isolado-exemplo.com");
    expect(getPublicPresellTechnicalOrigin()).toBe("https://pages.isolado-exemplo.com");
    expect(getPublicPresellFullUrl([], null, { id: "page-1", type: "cookies" })).toBe(
      "https://pages.isolado-exemplo.com/p/page-1",
    );
    expect(hasPublicPresellOrigin([], null)).toBe(true);
  });

  it("VITE_PUBLIC_PRESELL_HOST apontado ao domínio principal é ignorado", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_ORIGIN", PROD_SITE);
    for (const bad of ["www.dclickora.com", "https://dclickora.com", "clickora.com"]) {
      vi.stubEnv("VITE_PUBLIC_PRESELL_HOST", bad);
      expect(getPublicPresellTechnicalOrigin()).toBeNull();
      expect(getPublicPresellFullUrl([], null, { id: "p" })).toBe("");
    }
  });

  it("domínio próprio verificado e pronto tem prioridade sobre o técnico", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_ORIGIN", PROD_SITE);
    vi.stubEnv("VITE_PUBLIC_PRESELL_HOST", "pages.isolado-exemplo.com");
    const domains = [domain({ id: "d", hostname: "oferta.cliente.com", purpose: "hosting", is_default: true })];
    expect(getPublicPresellFullUrl(domains, "d", { id: "x", slug: "kera", type: "builder" })).toBe(
      "https://oferta.cliente.com/kera",
    );
  });

  it("domínio verificado com SSL a provisionar serve de último recurso (nunca o principal)", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_ORIGIN", PROD_SITE);
    vi.stubEnv("VITE_PUBLIC_PRESELL_HOST", "");
    const domains = [
      domain({
        id: "p",
        hostname: "novo.cliente.com",
        purpose: "hosting",
        vercel_domain_registered: true,
        https_ready: false,
        ssl_state: "ssl_provisioning",
      }),
    ];
    expect(getPublicPresellOriginForPresell(domains, "p")).toBe("https://novo.cliente.com");
  });
});
