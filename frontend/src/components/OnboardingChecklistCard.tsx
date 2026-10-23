import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, ListChecks } from "lucide-react";
import { enterpriseService } from "@/services/enterpriseService";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "dclickora.onboardingChecklistExpanded";

function readExpandedPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Checklist de onboarding enterprise — colapsado por defeito para os
 * relatórios do Início ficarem em primeiro plano; o afiliado expande se quiser.
 */
export function OnboardingChecklistCard({ compact }: { compact?: boolean }) {
  const [expanded, setExpanded] = useState(readExpandedPreference);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
  }, [expanded]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["enterprise-onboarding"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.getOnboardingStatus();
      if (error) throw new Error(error);
      return data!;
    },
    staleTime: 60_000,
  });

  if (isLoading || isError || !data || data.complete) return null;

  const pending = data.steps.filter((s) => !s.done && !s.optional);
  const optionalPending = data.steps.filter((s) => !s.done && s.optional);
  const show = [...pending, ...optionalPending].slice(0, compact ? 5 : 8);
  const pct = data.progress.total ? Math.round((data.progress.done / data.progress.total) * 100) : 0;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={cn(
          "rounded-xl border border-primary/30 bg-primary/[0.04] shadow-sm",
          compact ? "p-3" : "p-4 sm:p-5",
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
          >
            <div className="space-y-1 min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ListChecks className="h-4 w-4 text-primary shrink-0" />
                Checklist de arranque
                {!expanded ? (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    · {data.progress.done}/{data.progress.total}
                    {data.plan_name ? ` · ${data.plan_name}` : ""}
                  </span>
                ) : null}
              </h2>
              {expanded ? (
                <p className="text-xs text-muted-foreground">
                  {data.progress.done}/{data.progress.total} passos essenciais
                  {data.plan_name ? ` · ${data.plan_name}` : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Toque para ver os passos em falta</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-2 w-20 sm:w-28 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ul className="mt-4 space-y-2">
            {show.map((step) => (
              <li key={step.id}>
                <Link
                  to={step.href}
                  className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-background/80 transition-colors"
                >
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <span className={cn(step.done && "text-muted-foreground line-through")}>
                    {step.label}
                    {step.optional ? (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        opcional
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {data.steps.length > show.length ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              +{data.steps.length - show.length} passos no total (conclua os essenciais primeiro)
            </p>
          ) : null}

          <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
            <Link to="/presells/nova">Continuar setup</Link>
          </Button>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
