import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Loader2, RotateCcw, Shield } from "lucide-react";
import { toast } from "sonner";
import { presellService } from "@/services/presellService";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { DomainRoutingRole } from "@/types/api";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

export function PresellDomainBindingsControl({
  presellId,
  onPrimaryChanged,
}: {
  presellId: string;
  onPrimaryChanged?: (newPrimaryDomainId: string | null) => void;
}) {
  const { m } = useAppLocale();
  const cb = m.pages.continuity.bindings;
  const roleLabel: Record<string, string> = {
    primary: m.pages.continuity.domains.rolePrimary,
    backup: m.pages.continuity.domains.roleBackup,
    standby: m.pages.continuity.domains.roleStandby,
  };
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["presell-domains", presellId],
    queryFn: async () => {
      const res = await presellService.getDomains(presellId);
      if (res.error || !res.data) throw new Error(res.error || cb.loadError);
      return res.data;
    },
    enabled: Boolean(presellId),
  });

  const setDomainsMutation = useMutation({
    mutationFn: async (
      bindings: Array<{ custom_domain_id: string; role: DomainRoutingRole; priority?: number }>,
    ) => {
      const res = await presellService.setDomains(presellId, bindings);
      if (res.error || !res.data) throw new Error(res.error || cb.saveError);
      return res.data;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["presell-domains", presellId] });
      qc.invalidateQueries({ queryKey: ["presells"] });
      onPrimaryChanged?.(res.primary_domain_id);
      qc.invalidateQueries({ queryKey: ["continuity-overview"] });
      toast.success(cb.savedToast);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : cb.saveError),
  });

  const swapMutation = useMutation({
    mutationFn: async (targetDomainId: string) => {
      const res = await presellService.swapPrimaryDomain(presellId, {
        target_domain_id: targetDomainId,
        reason: "Troca rápida no editor da presell",
      });
      if (res.error || !res.data) throw new Error(res.error || cb.swapError);
      return res.data;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["presell-domains", presellId] });
      qc.invalidateQueries({ queryKey: ["presells"] });
      onPrimaryChanged?.(res.target_domain_id);
      qc.invalidateQueries({ queryKey: ["continuity-overview"] });
      toast.success(cb.swappedToast);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : cb.swapError),
  });

  const rollbackMutation = useMutation({
    mutationFn: async () => {
      const res = await presellService.rollbackPrimaryDomain(presellId);
      if (res.error || !res.data) throw new Error(res.error || cb.rollbackError);
      return res.data;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["presell-domains", presellId] });
      qc.invalidateQueries({ queryKey: ["presells"] });
      onPrimaryChanged?.(res.target_domain_id);
      qc.invalidateQueries({ queryKey: ["continuity-overview"] });
      toast.success(cb.rollbackToast);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : cb.rollbackError),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {cb.loading}
      </div>
    );
  }
  if (!data || data.available_domains.length === 0) return null;

  const currentBindingsMap = new Map(data.bindings.map((b) => [b.custom_domain_id, b]));
  /** Sem bindings, o domínio efetivo é o legado da presell ou, sem ele, o padrão da conta. */
  const implicitPrimaryId =
    data.bindings.length > 0
      ? null
      : data.custom_domain_id ??
        data.available_domains.find((d) => d.is_default && d.status === "verified")?.id ??
        null;
  const canRollback = data.routing_events.some(
    (ev) =>
      (ev.event_type === "manual_swap" || ev.event_type === "auto_failover" || ev.event_type === "manual_rollback") &&
      Boolean(ev.previous_domain_id) &&
      ev.previous_domain_id !== data.custom_domain_id,
  );

  const toggleBackup = (domainId: string, currentlyBound: boolean) => {
    const next = [...data.bindings].map((b) => ({
      custom_domain_id: b.custom_domain_id,
      role: b.role,
      priority: b.priority,
    }));
    if (currentlyBound) {
      const filtered = next.filter((b) => b.custom_domain_id !== domainId);
      setDomainsMutation.mutate(filtered);
    } else {
      if (implicitPrimaryId && implicitPrimaryId !== domainId) {
        next.push({ custom_domain_id: implicitPrimaryId, role: "primary", priority: 10 });
      }
      const role: DomainRoutingRole = next.some((b) => b.role === "primary") ? "backup" : "primary";
      next.push({
        custom_domain_id: domainId,
        role,
        priority: role === "primary" ? 10 : 100 + next.length * 10,
      });
      setDomainsMutation.mutate(next);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4 space-y-3 max-w-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-primary" />
          <Label className="text-xs font-semibold text-foreground">
            {cb.title}
          </Label>
        </div>
        {canRollback ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            disabled={rollbackMutation.isPending}
            onClick={() => rollbackMutation.mutate()}
          >
            <RotateCcw className="h-3 w-3" /> {cb.rollback}
          </Button>
        ) : null}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {cb.description}
      </p>

      <div className="space-y-1.5">
        {data.available_domains.map((dom) => {
          const binding = currentBindingsMap.get(dom.id);
          const isPrimary = binding?.role === "primary" || (!binding && implicitPrimaryId === dom.id);
          const verified = dom.status === "verified";
          return (
            <div
              key={dom.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 bg-background/70 px-2.5 py-2 text-xs"
            >
              <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                <span className="font-mono truncate">{dom.hostname}</span>
                {isPrimary ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
                    {cb.primaryBadge}
                  </span>
                ) : binding ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-medium">
                    {roleLabel[binding.role] ?? binding.role}
                  </span>
                ) : null}
                {!dom.is_active ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {cb.paused}
                  </span>
                ) : dom.health_status === "down" ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                    {cb.offline}
                  </span>
                ) : dom.health_status === "degraded" ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    {cb.degraded}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {verified && dom.is_active && !isPrimary ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    disabled={swapMutation.isPending}
                    onClick={() => swapMutation.mutate(dom.id)}
                  >
                    <ArrowLeftRight className="h-3 w-3" /> {cb.makePrimary}
                  </Button>
                ) : null}
                {verified && !isPrimary ? (
                  <Button
                    type="button"
                    variant={binding ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={setDomainsMutation.isPending}
                    onClick={() => toggleBackup(dom.id, Boolean(binding))}
                  >
                    {binding ? cb.removeBackup : cb.addBackup}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
