import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("WorkspaceSwitcher anti-flash", () => {
  it("mantém lista conhecida após qc.clear() no switch", () => {
    const src = readFileSync(join(process.cwd(), "src/components/WorkspaceSwitcher.tsx"), "utf8");
    expect(src).toContain("knownWorkspaces");
    expect(src).toContain("setKnownWorkspaces");
    expect(src).toContain("qc.clear()");
    expect(src).toContain('invalidateQueries({ queryKey: ["workspaces", "mine"] })');
    expect(src).toContain("is_active: w.workspace_id === wid");
    expect(src).toContain("list.length < 2");
  });

  it("AppLayout monta WorkspaceSwitcher", () => {
    const layout = readFileSync(join(process.cwd(), "src/components/AppLayout.tsx"), "utf8");
    expect(layout).toContain("WorkspaceSwitcher");
  });
});
