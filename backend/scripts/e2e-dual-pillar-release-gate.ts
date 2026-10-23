/**
 * Gate de release dual-pillar: suites backend críticas + vitest frontend (CTA/bake/regras).
 *
 *   node --import tsx scripts/e2e-dual-pillar-release-gate.ts
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = path.resolve(root, "../frontend");

const suites = [
  "src/lib/opsObservability.test.ts",
  "src/lib/appendClickIdToUrl.test.ts",
  "src/lib/affiliatePlatforms/parseAffiliatePostback.test.ts",
  "src/lib/clientIp.test.ts",
  "src/lib/presellEnterpriseCloak.test.ts",
  "src/lib/routingRules/evaluate.test.ts",
  "scripts/e2e-audit-manual-block-conformity.ts",
  "scripts/e2e-affiliate-clickid-resilience.ts",
];

const frontendSuites = [
  "src/lib/presellPublishReadiness.test.ts",
  "src/lib/presellOfferHrefBake.test.ts",
  "src/lib/presellCtaBake.test.ts",
  "src/lib/publishPresellFlow.test.ts",
  "src/lib/presellEliteQuality.test.ts",
  "src/components/RotatorRulesBuilder.test.ts",
];

let failed = 0;
let total = 0;

for (const rel of suites) {
  total += 1;
  const isScript = rel.startsWith("scripts/");
  const args = isScript
    ? ["--import", "tsx", rel]
    : ["--import", "tsx", "--test", rel];
  console.log(`\n── ${rel} ──`);
  const r = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    failed += 1;
    console.error(`FAIL ${rel}`);
  } else {
    console.log(`PASS ${rel}`);
  }
}

if (fs.existsSync(path.join(frontendRoot, "package.json"))) {
  total += 1;
  console.log(`\n── frontend vitest (${frontendSuites.length} files) ──`);
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vitest", "run", ...frontendSuites],
    {
      cwd: frontendRoot,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    },
  );
  if (r.status !== 0) {
    failed += 1;
    console.error("FAIL frontend vitest");
  } else {
    console.log("PASS frontend vitest");
  }
}

console.log(`\n${total - failed}/${total} suites`);
if (failed) {
  console.log("DUAL_PILLAR_RELEASE_GATE_FAILED");
  process.exitCode = 1;
} else {
  console.log("DUAL_PILLAR_RELEASE_GATE_OK");
}
