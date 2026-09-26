import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import { enterpriseService } from "@/services/enterpriseService";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Checklist de onboarding enterprise — cartão destacado no Início.
 */
export function OnboardingChecklistCard({ compact }: { compact?: boolean }) {
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

  return (
    <div
      className={cn(
        "rounded-xl border border-primary/30 bg-primary/[0.04] p-5 shadow-sm",
        compact && "p-4",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="h-4 w-4 text-primary shrink-0" />
            Checklist de arranque
          </h2>
          <p className="text-xs text-muted-foreground">
            {data.progress.done}/{data.progress.total} passos essenciais
            {data.plan_name ? ` · ${data.plan_name}` : ""}
          </p>
        </div>
        <div className="h-2 w-full sm:w-36 rounded-full bg-muted overflow-hidden shrink-0">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${data.progress.total ? Math.round((data.progress.done / data.progress.total) * 100) : 0}%`,
            }}
          />
        </div>
      </div>

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
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">opcional</span>
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
    </div>
  );
}
