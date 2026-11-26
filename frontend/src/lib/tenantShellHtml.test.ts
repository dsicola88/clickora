import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTenantShellHtml } from "./tenantShellHtml";

const indexHtml = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
const shell = buildTenantShellHtml(indexHtml);

describe("buildTenantShellHtml", () => {
  it("remove a verificação Search Console e os metadados de marketing da plataforma", () => {
    expect(shell).not.toContain('name="google-site-verification"');
    expect(shell).not.toMatch(/<meta[^>]+name="description"/);
    expect(shell).not.toMatch(/<meta[^>]+name="keywords"/);
    expect(shell).not.toMatch(/<meta[^>]+name="author"/);
    expect(shell).not.toMatch(/<meta[^>]+property="og:/);
    expect(shell).not.toMatch(/<meta[^>]+name="twitter:/);
    expect(shell).not.toMatch(/<meta[^>]+name="apple-mobile-web-app-title"/);
    expect(shell).not.toMatch(/<link[^>]+rel="(manifest|icon|shortcut icon|apple-touch-icon)"/);
    expect(shell).not.toMatch(/<title>[^<]*dclickora/i);
  });

  it("marca noindex e mantém o arranque da SPA", () => {
    expect(shell).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(shell).toContain('<div id="root"></div>');
    expect(shell).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(shell).toContain("window.__clickoraPresellEarly");
  });
});
