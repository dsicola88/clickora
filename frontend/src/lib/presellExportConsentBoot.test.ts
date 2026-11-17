import { describe, expect, it } from "vitest";
import {
  buildExportConsentAwareSnippets,
  buildExportCookieModalBindingsScript,
  buildGoogleConsentModeDefaultScript,
} from "./presellExportConsentBoot";

describe("presellExportConsentBoot", () => {
  it("sem gate: marketing vai no head/body de imediato", () => {
    const out = buildExportConsentAwareSnippets({
      cookieGate: false,
      clickoraHead: "<script>/*clickora*/</script>",
      marketing: {
        headHtml: "<script>fbq('init')</script>",
        bodyHtml: "<script>ttq.load()</script>",
        footerHtml: "<!--foot-->",
      },
    });
    expect(out.earlyHead).toContain("clickora");
    expect(out.earlyHead).toContain("fbq");
    expect(out.bodyStart).toContain("ttq");
    expect(out.bodyEnd).toContain("foot");
    expect(out.cookieBootInline).toBe(false);
  });

  it("com gate: marketing diferido + GCM default denied", () => {
    const out = buildExportConsentAwareSnippets({
      cookieGate: true,
      clickoraHead: "<script>/*clickora*/</script>",
      marketing: {
        headHtml: "<script>fbq('init')</script>",
        bodyHtml: "<script>ttq.load()</script>",
        footerHtml: "",
      },
    });
    expect(out.earlyHead).toContain("ad_storage");
    expect(out.earlyHead).toContain("denied");
    expect(out.earlyHead).toContain("clickora");
    expect(out.earlyHead).toContain("__clickoraCookieConsent");
    expect(out.earlyHead).toContain("fbq");
    expect(out.bodyStart).toBe("");
    expect(out.bodyEnd).toBe("");
    expect(out.cookieBootInline).toBe(true);
    // Marketing só no PAYLOAD do boot — não como tag solta a executar no parse.
    expect(out.earlyHead).toMatch(/PAYLOAD[\s\S]*fbq/);
    expect(out.earlyHead).toContain('unlockMarketing');
    expect(buildGoogleConsentModeDefaultScript()).toContain("consent");
    expect(buildExportCookieModalBindingsScript()).toContain("pe-cookie-allow");
  });
});
