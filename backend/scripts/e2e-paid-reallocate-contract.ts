/**
 * Contrato redistribuição activa (sem secrets / sem BD).
 *
 *   cd backend && npx tsx scripts/e2e-paid-reallocate-contract.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const results: { name: string; ok: boolean; detail: string }[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

function main() {
  const root = join(process.cwd(), "src");
  const fe = join(process.cwd(), "../frontend/src");

  const eng = readFileSync(join(root, "paid/optimizer/reallocate.engine.ts"), "utf8");
  const actions = readFileSync(join(root, "paid/optimizer/actions.service.ts"), "utf8");
  const opt = readFileSync(join(root, "paid/optimizer/optimizer.service.ts"), "utf8");
  const alerts = readFileSync(join(root, "paid/optimizer/alerts.service.ts"), "utf8");
  const ui = readFileSync(join(fe, "lib/paidAdsUi.ts"), "utf8");
  const tr = readFileSync(join(fe, "lib/paidAdsTransparency.ts"), "utf8");

  record(
    "engine propõe reallocate_budget neutro em gasto",
    eng.includes("proposeBudgetReallocations") &&
      eng.includes("reallocate_budget_winner_from_laggard") &&
      eng.includes("transferUsd") &&
      eng.includes("gasto total inalterado"),
    "ok",
  );
  record(
    "acção receptor-primeiro + rollback",
    actions.includes("reallocateBudget") &&
      actions.includes('role: "receiver"') &&
      actions.includes("receiver_rollback") &&
      actions.includes("readCampaignDailyBudgetUsd"),
    "ok",
  );
  record(
    "tick liga realloc e suprime scale do vencedor",
    opt.includes("proposeBudgetReallocations") &&
      opt.includes("receiversWithRealloc") &&
      opt.includes('c.decisionType !== "scale_budget"') &&
      opt.includes("enqueueBudgetReallocatedAlert"),
    "ok",
  );
  record(
    "alerta budget_reallocated + labels FE",
    alerts.includes("budget_reallocated") &&
      alerts.includes("enqueueBudgetReallocatedAlert") &&
      ui.includes("reallocate_budget") &&
      ui.includes("reallocate_budget_winner_from_laggard") &&
      tr.includes("reallocate_budget_winner_from_laggard"),
    "ok",
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passaram`);
  if (failed.length) process.exitCode = 1;
}

main();
