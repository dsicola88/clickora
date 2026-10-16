import { campaignPackageHealth } from "@/lib/campaignPackageHealth";
import { cn } from "@/lib/utils";
import type { AdBundle, ValidationIssue } from "@/services/keywordResearchService";
import { CheckCircle2, CircleAlert } from "lucide-react";

export function CampaignPackageChecklist({ bundle, issues }: { bundle: AdBundle; issues: ValidationIssue[] }) {
  const rows = campaignPackageHealth(bundle, issues);
  const ready = rows.filter((r) => r.id !== "export").every((r) => r.ok);

  return (
    <section
      className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3"
      aria-label="Conformidade do pacote Search"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold tracking-tight">Checklist Google / Microsoft</h2>
        <span
          className={cn(
            "text-xs font-medium rounded-full px-2.5 py-0.5",
            ready ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-800 dark:text-amber-300",
          )}
        >
          {ready ? "Limites e contagens OK" : "Revise os itens assinalados"}
        </span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-2 text-sm min-w-0">
            {row.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" aria-hidden />
            ) : (
              <CircleAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="font-medium leading-tight">{row.label}</p>
              <p className="text-xs text-muted-foreground leading-snug">{row.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
