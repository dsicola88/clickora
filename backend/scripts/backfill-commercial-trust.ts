/**
 * Confiança comercial — backfill TE offline_csv órfãos → Conversion
 * + alinhar contador denormalizado presell_pages.conversions.
 *
 * Dry-run por defeito (não escreve). Para aplicar:
 *   npx tsx scripts/backfill-commercial-trust.ts --apply
 *   npx tsx scripts/backfill-commercial-trust.ts --apply --user=<userId>
 *
 * Nunca inventa funil: só fecha o ledger com a mesma upsert canónica do import CSV.
 */
import {
  backfillOfflineCsvTeToConversions,
  reconcileConversionLedger,
  reconcilePresellPageConversionCounters,
} from "../src/lib/conversionLedger";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const userArg = args.find((a) => a.startsWith("--user="));
  const userId = userArg ? userArg.slice("--user=".length).trim() || undefined : undefined;
  const sinceArg = args.find((a) => a.startsWith("--since="));
  const since = sinceArg ? new Date(sinceArg.slice("--since=".length)) : undefined;
  if (since && Number.isNaN(since.getTime())) {
    console.error("Data --since inválida (use ISO)");
    process.exit(2);
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry_run",
        userId: userId ?? null,
        since: since?.toISOString() ?? null,
      },
      null,
      2,
    ),
  );

  const backfill = await backfillOfflineCsvTeToConversions({
    userId,
    since,
    dryRun: !apply,
    limit: 20_000,
  });
  console.log("backfill_offline_csv", backfill);

  const counters = await reconcilePresellPageConversionCounters({
    userId,
    dryRun: !apply,
  });
  console.log("presell_counters", {
    pages_checked: counters.pages_checked,
    pages_mismatched: counters.pages_mismatched,
    dry_run: counters.dry_run,
    samples: counters.samples,
  });

  if (userId) {
    const recon = await reconcileConversionLedger({
      userId,
      since: since ?? new Date(0),
    });
    console.log("reconcile", recon);
  }

  if (!apply) {
    console.log("\nDry-run concluído. Reexecuta com --apply para gravar.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
