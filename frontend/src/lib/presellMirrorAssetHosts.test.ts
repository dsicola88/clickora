import { describe, expect, it } from "vitest";
import { alignMirrorAssetUrlsToCaptureBase } from "./presellMirrorAssetHosts";

describe("alignMirrorAssetUrlsToCaptureBase", () => {
  it("repoint merchant http assets para CDN do base", () => {
    const html = `<!doctype html><html><head>
<base href="https://proj7310956.webhooks1.online/">
<link rel="stylesheet" href="http://yourtrimoryn.com/assets/css/tsl-a2.css">
</head><body><h1>Trimoryn</h1></body></html>`;
    const out = alignMirrorAssetUrlsToCaptureBase(
      html,
      "https://yourtrimoryn.com/tsl-a2",
    );
    expect(out).toContain("https://proj7310956.webhooks1.online/assets/css/tsl-a2.css");
    expect(out).not.toMatch(/http:\/\/yourtrimoryn/i);
  });
});