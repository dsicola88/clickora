/**
 * Gate local/staging: contratos Paid pós go-live (sem secrets de produção).
 *
 *   cd backend && npx tsx scripts/e2e-staging-paid-autopilot-gate.ts
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const steps = [
  { name: "test:paid", cmd: ["npm", "run", "test:paid"] },
  { name: "e2e-sync-health-contract", cmd: ["npx", "tsx", "scripts/e2e-sync-health-contract.ts"] },
  {
    name: "e2e-paid-creative-swap-contract",
    cmd: ["npx", "tsx", "scripts/e2e-paid-creative-swap-contract.ts"],
  },
  {
    name: "e2e-paid-reallocate-contract",
    cmd: ["npx", "tsx", "scripts/e2e-paid-reallocate-contract.ts"],
  },
];

let failed = 0;
for (const step of steps) {
  console.log(`\n=== ${step.name} ===`);
  const r = spawnSync(step.cmd[0]!, step.cmd.slice(1), {
    cwd: join(process.cwd()),
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    failed += 1;
    console.error(`FAIL  ${step.name}  exit=${r.status}`);
  } else {
    console.log(`PASS  ${step.name}`);
  }
}

if (failed === 0) {
  console.log("\nSTAGING_PAID_AUTOPILOT_GATE_OK");
} else {
  console.error(`\nSTAGING_PAID_AUTOPILOT_GATE_FAIL  failed=${failed}`);
  process.exit(1);
}
