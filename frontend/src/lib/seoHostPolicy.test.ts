import { describe, expect, it } from "vitest";
import {
  isMainMarketingHostname,
  isPublicPresellPath,
  shouldNoindexCurrentLocation,
} from "./seoHostPolicy";

describe("seoHostPolicy", () => {
  it("trata www/apex/preview como marketing", () => {
    expect(isMainMarketingHostname("www.dclickora.com")).toBe(true);
    expect(isMainMarketingHostname("dclickora.com")).toBe(true);
    expect(isMainMarketingHostname("clickora-five.vercel.app")).toBe(true);
    expect(isMainMarketingHostname("localhost")).toBe(true);
  });

  it("trata domínios de assinantes como não-marketing", () => {
    expect(isMainMarketingHostname("go.meudominio.com")).toBe(false);
    expect(isMainMarketingHostname("oferta.afiliado.net")).toBe(false);
  });

  it("identifica landers /p/", () => {
    expect(isPublicPresellPath("/p/abc-uuid")).toBe(true);
    expect(isPublicPresellPath("/planos")).toBe(false);
  });

  it("exige noindex em landers e hosts de assinante", () => {
    expect(shouldNoindexCurrentLocation("www.dclickora.com", "/p/x")).toBe(true);
    expect(shouldNoindexCurrentLocation("go.tenant.com", "/")).toBe(true);
    expect(shouldNoindexCurrentLocation("www.dclickora.com", "/")).toBe(false);
    expect(shouldNoindexCurrentLocation("www.dclickora.com", "/super-presell")).toBe(false);
  });
});
