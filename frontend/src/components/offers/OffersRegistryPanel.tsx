import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { offersService, type OfferInput } from "@/services/offersService";
import type { OfferDto } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProPanel } from "@/components/enterprise/ProShell";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

const STATUS_CLS: Record<string, string> = {
  valid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  blocked: "bg-destructive/15 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

export function OffersRegistryPanel({ canWrite = true }: { canWrite?: boolean }) {
  const { m } = useAppLocale();
  const co = m.pages.continuity.offers;
  const statusLabel: Record<string, string> = {
    valid: co.statusValid,
    warning: co.statusWarning,
    blocked: co.statusBlocked,
    unknown: co.statusUnknown,
  };
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OfferDto | null>(null);
  const [name, setName] = useState("");
  const [network, setNetwork] = useState("");
  const [hoplinkUrl, setHoplinkUrl] = useState("");
  const [backupHoplinkUrl, setBackupHoplinkUrl] = useState("");

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["offers"],
    queryFn: async () => {
      const { data, error } = await offersService.list();
      if (error) return [];
      return data ?? [];
    },
  });

  const resetForm = () => {
    setEditing(null);
    setName("");
    setNetwork("");
    setHoplinkUrl("");
    setBackupHoplinkUrl("");
    setShowForm(false);
  };

  const openEdit = (offer: OfferDto) => {
    setEditing(offer);
    setName(offer.name);
    setNetwork(offer.network ?? "");
    setHoplinkUrl(offer.hoplink_url);
    setBackupHoplinkUrl(offer.backup_hoplink_url ?? "");
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: OfferInput = {
        name: name.trim(),
        network: network.trim() || null,
        hoplink_url: hoplinkUrl.trim(),
        backup_hoplink_url: backupHoplinkUrl.trim() || null,
      };
      if (editing) {
        const res = await offersService.update(editing.id, payload);
        if (res.error) throw new Error(res.error);
        return res.data!;
      }
      const res = await offersService.create(payload);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["presells"] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      const propCount = saved.propagated_presell_ids?.length ?? 0;
      toast.success(
        editing
          ? propCount > 0
            ? fill(co.updatedPropagated, { n: propCount })
            : co.updated
          : co.created,
      );
      resetForm();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : co.saveError),
  });

  const validateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await offersService.validate(id);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      if (row.validation_status === "valid") {
        toast.success(fill(co.validatedToast, { name: row.name, host: row.resolved_final_host || "OK" }));
      } else {
        toast.warning(fill(co.validationWarning, { name: row.name, detail: row.last_validation_error || row.validation_status }));
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : co.validateError),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await offersService.update(id, { is_active: isActive });
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      toast.success(vars.isActive ? co.activatedToast : co.pausedToast);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : co.updateError),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await offersService.remove(id);
      if (res.error) throw new Error(res.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      toast.success(co.removedToast);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : co.removeError),
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await offersService.backfill();
      if (res.error || !res.data) throw new Error(res.error || co.backfillError);
      return res.data;
    },
    onSuccess: (summary) => {
      qc.invalidateQueries({ queryKey: ["offers"] });
      qc.invalidateQueries({ queryKey: ["presells"] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(
        fill(co.backfillDone, { offers: summary.offersCreated, presells: summary.presellsLinked }),
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : co.backfillError),
  });

  return (
    <ProPanel
      title={fill(co.title, { n: offers.length })}
      description={co.description}
      actions={
        canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={backfillMutation.isPending}
              onClick={() => backfillMutation.mutate()}
              title={co.importTitle}
            >
              {backfillMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {co.importButton}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                if (showForm && !editing) resetForm();
                else {
                  resetForm();
                  setShowForm(true);
                }
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              {co.newOffer}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="px-4 pb-4 space-y-4">
        {showForm && canWrite ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {editing ? fill(co.editTitle, { name: editing.name }) : co.createTitle}
              </p>
              <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={resetForm}>
                {co.cancel}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="offer-name" className="text-xs">{co.nameLabel}</Label>
                <Input
                  id="offer-name"
                  placeholder={co.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer-network" className="text-xs">{co.networkLabel}</Label>
                <Input
                  id="offer-network"
                  placeholder={co.networkPlaceholder}
                  value={network}
                  onChange={(e) => setNetwork(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-hoplink" className="text-xs">{co.hoplinkLabel}</Label>
              <Input
                id="offer-hoplink"
                type="url"
                placeholder={co.hoplinkPlaceholder}
                value={hoplinkUrl}
                onChange={(e) => setHoplinkUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-backup" className="text-xs">{co.backupLabel}</Label>
              <Input
                id="offer-backup"
                type="url"
                placeholder="https://..."
                value={backupHoplinkUrl}
                onChange={(e) => setBackupHoplinkUrl(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                disabled={saveMutation.isPending || !name.trim() || !hoplinkUrl.trim()}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> {co.saving}
                  </>
                ) : editing ? (
                  co.saveChanges
                ) : (
                  co.saveAndValidate
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
            <Loader2 className="h-4 w-4 animate-spin" /> {co.loading}
          </div>
        ) : offers.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            {co.emptyBefore} <strong className="text-foreground">{co.emptyStrong}</strong> {co.emptyAfter}
          </p>
        ) : (
          <div className="space-y-2.5">
            {offers.map((offer) => {
              const statusKey = offer.validation_status in STATUS_CLS ? offer.validation_status : "unknown";
              return (
                <div
                  key={offer.id}
                  className="rounded-lg border border-border/60 bg-card/60 px-3.5 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{offer.name}</span>
                      {offer.network ? (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                          {offer.network}
                        </span>
                      ) : null}
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[statusKey]}`}
                        title={statusKey === "blocked" ? co.blockedHint : undefined}
                      >
                        {statusLabel[statusKey]}
                      </span>
                      {!offer.is_active ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {co.pausedBadge}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {fill(co.counts, { presells: offer.presells_count ?? 0, campaigns: offer.campaigns_count ?? 0 })}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground truncate max-w-2xl" title={offer.hoplink_url}>
                      {offer.hoplink_url}
                    </p>
                    {offer.last_validation_error ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {offer.last_validation_error}
                      </p>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <div className="flex flex-wrap items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 h-8"
                        disabled={validateMutation.isPending}
                        onClick={() => validateMutation.mutate(offer.id)}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {co.validate}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 h-8"
                        disabled={toggleActiveMutation.isPending}
                        onClick={() =>
                          toggleActiveMutation.mutate({ id: offer.id, isActive: !offer.is_active })
                        }
                      >
                        {offer.is_active ? (
                          <>
                            <PauseCircle className="h-3.5 w-3.5" /> {co.pause}
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-3.5 w-3.5" /> {co.activate}
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => openEdit(offer)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> {co.edit}
                      </Button>
                      <a
                        href={offer.hoplink_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                        title={co.openTitle}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(fill(co.removeConfirm, { name: offer.name }))) {
                            deleteMutation.mutate(offer.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProPanel>
  );
}
