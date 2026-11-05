import { describe, expect, it } from "vitest";
import {
  AFFILIATE_PLATFORM_DEFS,
  AFFILIATE_PLATFORMS,
  AFFILIATE_POSTBACK_PRESETS,
  NATIVE_AFFILIATE_PLATFORMS,
  buildAffiliateFunnelEventUrl,
  buildAffiliatePostbackExampleUrl,
  getAffiliateFunnelGuide,
  getAffiliatePostbackPreset,
} from "./marketingPlatforms";

/** Espelho do backend `NATIVE_AFFILIATE_PLATFORM_NAMES` — tem de bater certo. */
const BACKEND_NATIVE = [
  "BuyGoods",
  "ClickBank",
  "Digistore24",
  "Hotmart",
  "JVZoo",
  "MaxWeb",
  "SmartAdv",
  "WarriorPlus",
] as const;

const BANNED_FILLER = [
  "Ambalaya",
  "BlitzAds",
  "ClickHunts",
  "ClickFlow",
  "CPAGetti",
  "Gasmobi",
  "Giantmobi",
  "LemonAd",
  "ShakesPro",
  "TrafficLight",
  "UpPromote",
];

describe("marketingPlatforms — catálogo profissional", () => {
  it("só tem plataformas reais com def completa (preset + funnel + tier)", () => {
    expect(AFFILIATE_PLATFORM_DEFS.length).toBeGreaterThanOrEqual(BACKEND_NATIVE.length);
    expect(AFFILIATE_PLATFORMS).toEqual(AFFILIATE_PLATFORM_DEFS.map((d) => d.name));
    expect(AFFILIATE_PLATFORMS).toEqual([...AFFILIATE_PLATFORMS].sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" })));

    for (const def of AFFILIATE_PLATFORM_DEFS) {
      expect(def.name.trim().length).toBeGreaterThan(1);
      expect(["native", "documented_s2s"]).toContain(def.tier);
      expect(def.preset.hint.trim().length).toBeGreaterThan(40);
      expect(def.funnel.panelPath.trim().length).toBeGreaterThan(5);
      expect(def.funnel.summary.trim().length).toBeGreaterThan(20);
      expect(AFFILIATE_POSTBACK_PRESETS[def.name]).toEqual(def.preset);
      expect(getAffiliatePostbackPreset(def.name)).toEqual(def.preset);
      expect(getAffiliateFunnelGuide(def.name)).toEqual(def.funnel);
    }
  });

  it("nativas FE = nativas BE (parsers reais)", () => {
    expect([...NATIVE_AFFILIATE_PLATFORMS].sort()).toEqual([...BACKEND_NATIVE].sort());
    for (const name of BACKEND_NATIVE) {
      const def = AFFILIATE_PLATFORM_DEFS.find((d) => d.name === name);
      expect(def?.tier).toBe("native");
    }
  });

  it("não inclui fillers / redes sem documentação real no catálogo", () => {
    for (const banned of BANNED_FILLER) {
      expect(AFFILIATE_PLATFORMS).not.toContain(banned);
    }
  });

  it("hints nativos não mentem «sem adaptador»", () => {
    for (const name of NATIVE_AFFILIATE_PLATFORMS) {
      const hint = getAffiliatePostbackPreset(name).hint.toLowerCase();
      expect(hint).not.toMatch(/não tem adaptador nativo/);
      expect(hint).not.toMatch(/nao tem adaptador nativo/);
    }
  });

  it("URL de exemplo inclui platform= e macros do preset (quando há params)", () => {
    const hook = "https://api.example.com/hook?token=abc";
    for (const def of AFFILIATE_PLATFORM_DEFS) {
      const url = buildAffiliatePostbackExampleUrl(hook, def.name);
      expect(url).toContain("platform=");
      expect(url).toContain(encodeURIComponent(def.name));
      for (const [k, v] of Object.entries(def.preset.params)) {
        expect(url).toContain(`${encodeURIComponent(k)}=${v}`);
      }
    }
  });

  it("BuyGoods / MaxWeb / Digistore / SmartAdv geram macros críticas no URL", () => {
    const hook = "https://api.example.com/hook?token=t";
    expect(buildAffiliatePostbackExampleUrl(hook, "BuyGoods")).toContain("{SUBID2}");
    expect(buildAffiliatePostbackExampleUrl(hook, "MaxWeb")).toContain("{SUBID2}");
    expect(buildAffiliatePostbackExampleUrl(hook, "Digistore24")).toContain("{sid1}");
    expect(buildAffiliatePostbackExampleUrl(hook, "SmartAdv")).toContain("{sub3}");
    expect(buildAffiliatePostbackExampleUrl(hook, "Monetizze")).toContain("[[src]]");
    expect(buildAffiliatePostbackExampleUrl(hook, "Braip")).toContain("{xcod}");
  });

  it("funnel event URL inclui funnel_step e macro da rede", () => {
    const base = "https://api.example.com/event?token=t";
    const max = buildAffiliateFunnelEventUrl(base, "MaxWeb", "checkout");
    expect(max).toContain("funnel_step=checkout");
    expect(max).toContain("{SUBID2}");
    const smart = buildAffiliateFunnelEventUrl(base, "SmartAdv", "checkout");
    expect(smart).toContain("{sub3}");
  });

  it("BR e CPA principais estão no catálogo profissional", () => {
    for (const name of ["Monetizze", "Eduzz", "Kiwify", "Braip", "AdCombo", "EverFlow", "DrCash", "LeadBit"]) {
      expect(AFFILIATE_PLATFORMS).toContain(name);
      expect(AFFILIATE_PLATFORM_DEFS.find((d) => d.name === name)?.tier).toBe("documented_s2s");
    }
  });
});
