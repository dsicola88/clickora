import { describe, expect, it } from "vitest";
import {
  buildPresellOptionalSettingsMarketing,
  detectPastedAdPixelBases,
  normalizeBingUetTagId,
  normalizeGoogleConversionEvent,
  normalizeGoogleTrackingCode,
  normalizeMetaPixelId,
  normalizeTikTokPixelId,
} from "./presellOptionalSettingsMarketing";
import { coerceTrackingSnippetToHtml } from "./injectPresellCustomCode";
import { hydratePresellConfigSettings } from "./presellConfigDefaults";

describe("normalize* pixel IDs from messy paste", () => {
  it("Meta: ID puro, espaços e fbq('init')", () => {
    expect(normalizeMetaPixelId("1234567890123456")).toBe("1234567890123456");
    expect(normalizeMetaPixelId("1234 5678 9012 3456")).toBe("1234567890123456");
    expect(normalizeMetaPixelId("Pixel ID: 1234567890123456")).toBe("1234567890123456");
    expect(
      normalizeMetaPixelId(`fbq('init', '1234567890123456'); fbq('track', 'PageView');`),
    ).toBe("1234567890123456");
  });

  it("TikTok: ID e ttq.load (sem match guloso em texto)", () => {
    expect(normalizeTikTokPixelId("CABCDEF1234567890")).toBe("CABCDEF1234567890");
    expect(normalizeTikTokPixelId(`ttq.load('CABCDEF1234567890');`)).toBe("CABCDEF1234567890");
    expect(normalizeTikTokPixelId("Cole o ID ABCDEFGHIJKLMNOPQRST no painel")).toBe("");
  });

  it("Bing UET", () => {
    expect(normalizeBingUetTagId("12345678")).toBe("12345678");
    expect(normalizeBingUetTagId(`ti:"9876543"`)).toBe("9876543");
  });

  it("Google tags e conversão", () => {
    expect(normalizeGoogleTrackingCode("g-xxxxxxxxxx")).toBe("G-XXXXXXXXXX");
    expect(normalizeGoogleTrackingCode("Measurement ID G-ABC123XYZ")).toBe("G-ABC123XYZ");
    expect(normalizeGoogleConversionEvent("send_to AW-111111111/AbCdEfGh")).toBe(
      "AW-111111111/AbCdEfGh",
    );
  });
});

describe("buildPresellOptionalSettingsMarketing", () => {
  it("modo auto gera Meta + TikTok + Bing", () => {
    const out = buildPresellOptionalSettingsMarketing({
      adPixelsMode: "auto",
      fbPixelId: "1234567890123456",
      tiktokPixelId: "CABCDEFGHIJKLMNOP",
      bingUetTagId: "12345678",
    });
    expect(out.headHtml).toContain("Meta Pixel");
    expect(out.headHtml).toContain("1234567890123456");
    expect(out.headHtml).toContain("TikTok Pixel");
    expect(out.headHtml).toContain("CABCDEFGHIJKLMNOP");
    expect(out.headHtml).toContain("Microsoft Advertising UET");
    expect(out.headHtml).toContain("12345678");
    expect(out.bodyHtml).toContain("facebook.com/tr");
  });

  it("modo manual não gera scripts a partir dos IDs", () => {
    const out = buildPresellOptionalSettingsMarketing({
      adPixelsMode: "manual",
      fbPixelId: "1234567890123456",
      tiktokPixelId: "CABCDEFGHIJKLMNOP",
      bingUetTagId: "12345678",
      googleTrackingCode: "G-XXXX",
    });
    expect(out.headHtml).toBe("");
    expect(out.bodyHtml).toBe("");
  });

  it("Google AW conversion em modo auto", () => {
    const out = buildPresellOptionalSettingsMarketing({
      adPixelsMode: "auto",
      googleConversionEvent: "AW-111111111/AbCdEfGh",
    });
    expect(out.headHtml).toContain("AW-111111111");
    expect(out.headHtml).toContain("conversion");
  });

  it("cola suja no campo ID ainda gera pixel", () => {
    const out = buildPresellOptionalSettingsMarketing({
      adPixelsMode: "auto",
      fbPixelId: "ID do pixel: 1234567890123456",
      tiktokPixelId: "ttq.load('CABCDEF1234567890')",
      bingUetTagId: "Tag ti: 11223344",
    });
    expect(out.headHtml).toContain("1234567890123456");
    expect(out.headHtml).toContain("CABCDEF1234567890");
    expect(out.headHtml).toContain("11223344");
  });

  it("não duplica Meta se conversionTrackingScript já tem fbevents", () => {
    const out = buildPresellOptionalSettingsMarketing({
      adPixelsMode: "auto",
      fbPixelId: "1234567890123456",
      conversionTrackingScript: `<script src="https://connect.facebook.net/en_US/fbevents.js"></script>`,
    });
    expect(out.headHtml).not.toContain("Meta Pixel");
    expect(out.bodyHtml).not.toContain("facebook.com/tr");
  });

  it("script Meta no campo Google não duplica com fbPixelId", () => {
    const out = buildPresellOptionalSettingsMarketing({
      adPixelsMode: "auto",
      fbPixelId: "1234567890123456",
      googleTrackingCode: `<script>fbq('init','999');</script>`,
    });
    expect(out.headHtml).toContain("Snippet colado");
    expect(out.headHtml).not.toContain("Meta Pixel");
  });

  it("evento Meta standard usa track, custom usa trackCustom", () => {
    const lead = buildPresellOptionalSettingsMarketing({
      adPixelsMode: "auto",
      fbPixelId: "1234567890123456",
      fbTrackName: "Lead",
    });
    expect(lead.headHtml).toContain(`fbq('track',"Lead")`);
    const custom = buildPresellOptionalSettingsMarketing({
      adPixelsMode: "auto",
      fbPixelId: "1234567890123456",
      fbTrackName: "MyCustomEvent",
    });
    expect(custom.headHtml).toContain(`fbq('trackCustom',"MyCustomEvent")`);
  });

  it("detectPastedAdPixelBases cobre as 4 redes", () => {
    const d = detectPastedAdPixelBases(`
      fbevents.js
      ttq.load('X')
      bat.bing.com
      googletagmanager.com/gtag/js
    `);
    expect(d).toEqual({ meta: true, tiktok: true, bing: true, google: true });
  });
});

describe("coerceTrackingSnippetToHtml", () => {
  it("envolve JS nu em script", () => {
    expect(coerceTrackingSnippetToHtml("fbq('track','PageView');")).toContain("<script>");
  });

  it("mantém HTML com tags", () => {
    const html = `<script>fbq('init','1');</script>`;
    expect(coerceTrackingSnippetToHtml(html)).toBe(html);
  });
});

describe("hydratePresellConfigSettings", () => {
  it("preserva pixels + cloak + defaults em páginas antigas", () => {
    const h = hydratePresellConfigSettings({
      fbPixelId: "1234567890123456",
      enterpriseCloak: true,
      cloakGeoDeny: "CN",
      adPixelsMode: "manual",
      conversionTrackingScript: "<script>x</script>",
    });
    expect(h.fbPixelId).toBe("1234567890123456");
    expect(h.enterpriseCloak).toBe(true);
    expect(h.cloakGeoDeny).toBe("CN");
    expect(h.adPixelsMode).toBe("manual");
    expect(h.tiktokPixelId).toBe("");
    expect(h.exitPopup).toBe(false);
    expect(h.conversionTrackingScript).toContain("script");
  });
});
