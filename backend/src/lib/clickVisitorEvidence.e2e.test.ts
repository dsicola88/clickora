/**
 * E2E (sem HTTP): IP+UA gravados → evidência → etiqueta Situação do relatório.
 * Garante que não se inventa Real/Bot/Datacenter sem evidência.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveClickVisitorEvidence,
  situationLabelFromEvidence,
} from "./clickVisitorEvidence";
import { isExplicitDatacenterForAutoBlacklist, classifyDatacenterIp } from "./ipNetworkClass";
import { isProtectedGoogleCrawlerUserAgent } from "./detectBot";

const situationLabel = situationLabelFromEvidence;

const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const ADSBOT =
  "Mozilla/5.0 (compatible; AdsBot-Google; +http://www.google.com/adsbot.html)";

describe("E2E evidência → Situação (sem inventar)", () => {
  it("Visivra AWS + Safari → Cloud (AWS), não Real", () => {
    for (const ip of ["18.144.100.168", "52.53.177.27", "54.67.110.173"]) {
      const ev = resolveClickVisitorEvidence({
        ipAddress: ip,
        userAgent: SAFARI_IOS,
        metadata: { gclid: "abc", utm_source: "google_ads" },
      });
      assert.equal(ev.evidence, "datacenter_ip", ip);
      assert.equal(ev.unqualified, true, ip);
      assert.equal(ev.ip_network, "AWS", ip);
      assert.equal(ev.is_bot, false, ip);
      assert.equal(situationLabel(ev), "Cloud (AWS)", ip);
      assert.equal(isExplicitDatacenterForAutoBlacklist(classifyDatacenterIp(ip)), true, ip);
    }
  });

  it("IP residencial de documentação + Safari → Real", () => {
    const ev = resolveClickVisitorEvidence({
      ipAddress: "203.0.113.50",
      userAgent: SAFARI_IOS,
      metadata: {},
    });
    assert.equal(ev.evidence, "none");
    assert.equal(ev.unqualified, false);
    assert.equal(ev.is_bot, false);
    assert.equal(ev.ip_network, null);
    assert.equal(situationLabel(ev), "Real");
  });

  it("UA AdsBot → Robot Google; nunca tratar como auto-blacklist Google", () => {
    const ev = resolveClickVisitorEvidence({
      ipAddress: "203.0.113.50",
      userAgent: ADSBOT,
      metadata: {},
    });
    assert.equal(ev.evidence, "bot_ua");
    assert.equal(ev.is_bot, true);
    assert.match(ev.bot_label || "", /Google/i);
    assert.equal(situationLabel(ev), "Robot Google");
    assert.equal(isProtectedGoogleCrawlerUserAgent(ADSBOT), true);
  });

  it("metadata is_bot mentiroso não inventa Bot se o UA é Safari", () => {
    const ev = resolveClickVisitorEvidence({
      ipAddress: "203.0.113.50",
      userAgent: SAFARI_IOS,
      metadata: { is_bot: true, bot_label: "Inventado" },
    });
    assert.equal(ev.is_bot, false);
    assert.equal(situationLabel(ev), "Real");
  });

  it("IP de nó CDN77 → Cloud (CDN77), mesmo com country_source", () => {
    const ev = resolveClickVisitorEvidence({
      ipAddress: "152.233.29.1",
      userAgent: SAFARI_IOS,
      metadata: { country_source: "cdn77" },
    });
    assert.equal(ev.unqualified, true);
    assert.equal(ev.ip_network, "CDN77");
    assert.equal(situationLabel(ev), "Cloud (CDN77)");
  });

  it("AWS + country_source cdn77 (geo CDN, IP visitante cloud) → Cloud (AWS)", () => {
    const ev = resolveClickVisitorEvidence({
      ipAddress: "18.144.100.168",
      userAgent: SAFARI_IOS,
      metadata: { country_source: "cdn77" },
    });
    assert.equal(ev.evidence, "datacenter_ip");
    assert.equal(ev.ip_network, "AWS");
    assert.equal(situationLabel(ev), "Cloud (AWS)");
  });

  it("Google 66.102.x + UA residencial → Cloud (Google) no relatório", () => {
    for (const ip of ["66.102.8.131", "66.102.8.132"]) {
      const ev = resolveClickVisitorEvidence({
        ipAddress: ip,
        userAgent: SAFARI_IOS,
        metadata: { source: "google_ads", medium: "cpc" },
      });
      assert.equal(ev.evidence, "report_cloud_ip", ip);
      assert.equal(ev.unqualified, true, ip);
      assert.equal(ev.ip_network, "Google", ip);
      assert.equal(situationLabel(ev), "Cloud (Google)", ip);
      // Não é elegível para auto-blacklist (só relatório).
      assert.equal(isExplicitDatacenterForAutoBlacklist(classifyDatacenterIp(ip)), false, ip);
    }
  });

  it("Azure 23.100.x → Cloud (Azure) no relatório", () => {
    const ev = resolveClickVisitorEvidence({
      ipAddress: "23.100.50.10",
      userAgent: SAFARI_IOS,
      metadata: {},
    });
    assert.equal(ev.evidence, "report_cloud_ip");
    assert.equal(ev.ip_network, "Azure");
    assert.equal(situationLabel(ev), "Cloud (Azure)");
  });

  it("sem IP e sem UA de bot → Real (não inventa Cloud)", () => {
    const ev = resolveClickVisitorEvidence({
      ipAddress: null,
      userAgent: SAFARI_IOS,
      metadata: {},
    });
    assert.equal(ev.unqualified, false);
    assert.equal(situationLabel(ev), "Real");
  });
});
