import { describe, expect, it } from "vitest";
import {
  collectDatacenterIpsForGoogleAdsExclusion,
  formatGoogleAdsIpExclusionList,
} from "./googleAdsIpExclusion";

describe("googleAdsIpExclusion", () => {
  it("só recolhe IPv4 de linhas datacenter — sem inventar", () => {
    const ips = collectDatacenterIpsForGoogleAdsExclusion([
      { ip: "18.144.100.168", statusKind: "datacenter" },
      { ip: "18.144.100.168", statusKind: "datacenter" },
      { ip: "71.208.226.154", statusKind: "real" },
      { ip: "—", statusKind: "datacenter" },
      { ip: "not-an-ip", statusKind: "datacenter" },
      { ip: "::ffff:52.53.177.27", statusKind: "datacenter" },
    ]);
    expect(ips).toEqual(["18.144.100.168", "52.53.177.27"]);
  });

  it("formata um IP por linha", () => {
    expect(formatGoogleAdsIpExclusionList(["1.2.3.4", "5.6.7.8"])).toBe("1.2.3.4\n5.6.7.8");
  });
});
