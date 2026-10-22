import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  corsCredentialsForPath,
  isAllowedOrigin,
  isPublicTrackingPath,
  isWebPageOrigin,
} from "./corsPolicy";

const emptyVerified = () => false;
const ctx = (path: string, env: string[] = [], verified: (o: string) => boolean = emptyVerified) => ({
  path,
  envAllowedOrigins: env,
  isVerifiedCustomDomainOrigin: verified,
});

describe("corsPolicy", () => {
  it("marca /api/track como tracking público", () => {
    assert.equal(isPublicTrackingPath("/api/track/event"), true);
    assert.equal(isPublicTrackingPath("/api/track/click"), true);
    assert.equal(isPublicTrackingPath("/api/track/r/abc"), true);
    assert.equal(isPublicTrackingPath("/api/auth/login"), false);
    assert.equal(isPublicTrackingPath("/api/integrations/affiliate-webhook"), false);
  });

  it("tracking público aceita lander de oferta (tryvisivra) e domínio próprio", () => {
    assert.equal(isAllowedOrigin("https://tryvisivra.com", ctx("/api/track/event")), true);
    assert.equal(isAllowedOrigin("https://proj3184329.webhooks1.online", ctx("/api/track/click")), true);
    assert.equal(isAllowedOrigin("https://honestverdictguide.online", ctx("/api/track/impression")), true);
  });

  it("rotas autenticadas rejeitam lander se não estiver no allowlist", () => {
    assert.equal(isAllowedOrigin("https://tryvisivra.com", ctx("/api/auth/login", [])), false);
    assert.equal(
      isAllowedOrigin("https://tryvisivra.com", ctx("/api/analytics/summary", ["https://www.dclickora.com"])),
      false,
    );
  });

  it("domínio personalizado verificado passa em rotas da app", () => {
    assert.equal(
      isAllowedOrigin(
        "https://honestverdictguide.online",
        ctx("/api/presells", [], (o) => o === "https://honestverdictguide.online"),
      ),
      true,
    );
  });

  it("tracking público não pede credentials", () => {
    assert.equal(corsCredentialsForPath("/api/track/event"), false);
    assert.equal(corsCredentialsForPath("/api/auth/login"), true);
  });

  it("isWebPageOrigin", () => {
    assert.equal(isWebPageOrigin("https://a.com"), true);
    assert.equal(isWebPageOrigin("http://localhost:5173"), true);
    assert.equal(isWebPageOrigin("file:///tmp/x"), false);
    assert.equal(isWebPageOrigin("not-a-url"), false);
  });
});
