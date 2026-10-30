import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyReportCloudIp } from "./reportCloudIpRanges";
import { classifyDatacenterIp } from "./ipNetworkClass";

describe("reportCloudIpRanges (só relatório)", () => {
  it("marca 66.102.8.x como Google", () => {
    assert.equal(classifyReportCloudIp("66.102.8.131")?.name, "Google");
    assert.equal(classifyReportCloudIp("66.102.8.132")?.name, "Google");
  });

  it("marca 23.100.x como Azure", () => {
    assert.equal(classifyReportCloudIp("23.100.50.10")?.name, "Azure");
  });

  it("marca 54.222.x como AWS (China)", () => {
    assert.equal(classifyReportCloudIp("54.222.10.20")?.name, "AWS");
  });

  it("não polui classifyDatacenterIp (sem auto-blacklist / clientIp)", () => {
    assert.equal(classifyDatacenterIp("66.102.8.131"), null);
    assert.equal(classifyDatacenterIp("23.100.50.10"), null);
  });

  it("IP de documentação continua null", () => {
    assert.equal(classifyReportCloudIp("203.0.113.50"), null);
  });
});
