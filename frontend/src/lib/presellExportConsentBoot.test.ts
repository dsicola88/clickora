import { describe, expect, it } from "vitest";
import {
  buildExportConsentAwareSnippets,
  buildExportCookieModalBindingsScript,
  buildGoogleConsentModeDefaultScript,
  jsonForInlineScript,
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

  it("strict sem cookie gate: GCM denied + marketing imediato", () => {
    const out = buildExportConsentAwareSnippets({
      cookieGate: false,
      applyConsentModeDefaults: true,
      consentModeDefaultDenied: true,
      clickoraHead: "<script>/*clickora*/</script>",
      marketing: { headHtml: "<script>gtag('config','G-X')</script>", bodyHtml: "", footerHtml: "" },
    });
    expect(out.earlyHead).toContain("denied");
    expect(out.earlyHead).toContain("gtag('config'");
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
    expect(out.earlyHead).toContain("unlockMarketing");
    expect(out.earlyHead).toContain("teardownMarketing");
    expect(out.earlyHead).toContain("data-clickora-mkt");
    expect(buildGoogleConsentModeDefaultScript()).toContain("consent");
    expect(buildExportCookieModalBindingsScript()).toContain("pe-cookie-allow");
  });

  it("com gate sem Google: marketing diferido sem stub GCM", () => {
    const out = buildExportConsentAwareSnippets({
      cookieGate: true,
      hasGoogleTags: false,
      clickoraHead: "<script>/*clickora*/</script>",
      marketing: {
        headHtml: "<script>fbq('init')</script>",
        bodyHtml: "",
        footerHtml: "",
      },
    });
    expect(out.earlyHead).toContain("__clickoraCookieConsent");
    expect(out.earlyHead).toContain("USE_GCM=0");
    expect(out.earlyHead).not.toContain("__clickoraGcmDefaultsApplied");
    expect(out.cookieBootInline).toBe(true);
  });

  it("com gate: `</script>` no payload não fecha o boot nem corre marketing antes do consentimento", () => {
    const out = buildExportConsentAwareSnippets({
      cookieGate: true,
      hasGoogleTags: false,
      clickoraHead: "",
      marketing: {
        headHtml: "<script>fbq('init')</script></script><script>window.__pwned=1</script><!--",
        bodyHtml: "<p>linha\u2028separador\u2029</p>",
        footerHtml: "",
      },
    });
    const scripts = out.earlyHead.match(/<script>/gi) ?? [];
    const closes = out.earlyHead.match(/<\/script>/gi) ?? [];
    expect(scripts).toHaveLength(1);
    expect(closes).toHaveLength(1);
    expect(out.earlyHead).not.toContain("<!--");
    expect(out.earlyHead).not.toMatch(/[\u2028\u2029]/);

    const payloadJson = out.earlyHead.match(/var PAYLOAD=(\{.*?\});\n/)?.[1] ?? "";
    const parsed = JSON.parse(payloadJson) as { head: string; body: string };
    expect(parsed.head).toBe("<script>fbq('init')</script></script><script>window.__pwned=1</script><!--");
    expect(parsed.body).toBe("<p>linha\u2028separador\u2029</p>");
  });

  it("jsonForInlineScript escapa < e separadores de linha JS", () => {
    expect(jsonForInlineScript("</script>")).toBe('"\\u003c/script>"');
    expect(jsonForInlineScript("a\u2028b\u2029")).toBe('"a\\u2028b\\u2029"');
  });

  it("strict sem Google: sem GCM mesmo com applyConsentModeDefaults", () => {
    const out = buildExportConsentAwareSnippets({
      cookieGate: false,
      applyConsentModeDefaults: true,
      consentModeDefaultDenied: true,
      hasGoogleTags: false,
      clickoraHead: "<script>/*clickora*/</script>",
      marketing: { headHtml: "<script>fbq('init')</script>", bodyHtml: "", footerHtml: "" },
    });
    expect(out.earlyHead).not.toContain("ad_storage");
    expect(out.earlyHead).toContain("fbq");
  });
});
