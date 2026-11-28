import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Loader2,
  Trash2,
  Star,
  Activity,
  Power,
  RotateCcw,
  ArrowUpCircle,
  History,
} from "lucide-react";
import { useState } from "react";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { customDomainService } from "@/services/customDomainService";
import { presellService } from "@/services/presellService";
import { apiClient } from "@/lib/apiClient";
import type { CustomDomainDto, DomainRoutingEventDto, DomainRoutingRole } from "@/types/api";
import {
  inferDnsRecordKind,
  normalizeDomainStatus,
  resolveHostingDnsHint,
  resolvePendingDnsForDisplay,
} from "@/lib/customDomainDnsDisplay";
import { CustomDomainDnsTable } from "@/components/settings/CustomDomainDnsTable";
import { CustomDomainSslBadge } from "@/components/settings/CustomDomainSslBadge";
import { shouldPollCustomDomainSsl } from "@/lib/customDomainSslDisplay";
import { tenantQueryKey } from "@/lib/tenantQueryKey";

/** Igual a `PRIMARY_SWAP_EVENT_TYPES` no backend (`domainRoutingService`). */
const ROLLBACK_SWAP_EVENT_TYPES = ["manual_swap", "auto_failover", "auto_recovery", "manual_rollback"];

export function CustomDomainSettings() {
  const { t, m } = useAppLocale();
  const cd = m.pages.continuity.domains;
  const { user } = useAuth();
  const tenantKey = tenantQueryKey(user);
  const queryClient = useQueryClient();
  const [newHostname, setNewHostname] = useState("");
  const [newPurpose, setNewPurpose] = useState<"hosting" | "tracking" | "both">("both");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ["custom-domain", tenantKey],
    queryFn: async () => {
      const { data, error } = await customDomainService.list();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
  });

  const { data: quota } = useQuery({
    queryKey: ["custom-domain-quota", tenantKey],
    queryFn: async () => {
      const { data, error } = await customDomainService.quota();
      if (error) throw new Error(error);
      return data ?? null;
    },
    enabled: !!tenantKey,
    staleTime: 30_000,
  });

  const { data: presells = [] } = useQuery({
    queryKey: ["presells", tenantKey],
    queryFn: async () => {
      const { data, error } = await presellService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
  });

  const createMutation = useMutation({
    mutationFn: (hostname: string) => customDomainService.create(hostname, newPurpose),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const created = res.data;
      if (created) {
        queryClient.setQueryData<CustomDomainDto[]>(["custom-domain", tenantKey], (old) => {
          const list = old ?? [];
          const rest = list.filter((x) => x.id !== created.id);
          return [created, ...rest];
        });
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["custom-domain-quota"] });
      setNewHostname("");
      const d = res.data;
      const mode = d?.pending_dns?.mode;
      if (mode === "vercel") {
        toast.success(t("pages.settings.addedVercel"));
      } else {
        toast.success(t("pages.settings.addedTxt"));
      }
    },
    onError: () => toast.error(t("pages.settings.addFailed")),
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => customDomainService.verify(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      toast.success(t("pages.settings.verified"));
    },
    onError: () => toast.error(t("pages.settings.verifyFailed")),
  });

  const goLiveMutation = useMutation({
    mutationFn: (id: string) => customDomainService.goLive(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const row = res.data;
      if (row) {
        queryClient.setQueryData<CustomDomainDto[]>(["custom-domain", tenantKey], (old) =>
          (old ?? []).map((x) => (x.id === row.id ? { ...x, ...row } : x)),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      if (row?.https_ready) {
        toast.success(t("pages.settings.sslReady"));
      } else {
        toast.message(t("pages.settings.sslStillProvisioning"));
      }
    },
    onError: () => toast.error(t("pages.settings.sslCheckFailed")),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => customDomainService.setDefault(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      toast.success(t("pages.settings.defaultUpdated"));
    },
    onError: () => toast.error(t("pages.settings.defaultFailed")),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => customDomainService.remove(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["custom-domain-quota"] });
      toast.success(t("pages.settings.removed"));
    },
    onError: () => toast.error(t("pages.settings.removeFailed")),
  });

  const rootPresellMutation = useMutation({
    mutationFn: async ({ domainId, presellId }: { domainId: string; presellId: string | null }) => {
      const res = await customDomainService.setRootPresell(domainId, presellId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["public-custom-domain-root-presell"] });
      toast.success(t("pages.settings.rootUpdated"));
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : t("pages.settings.saveFailed");
      toast.error(msg);
    },
  });

  const purposeMutation = useMutation({
    mutationFn: async ({
      id,
      purpose,
    }: {
      id: string;
      purpose: "hosting" | "tracking" | "both";
    }) => {
      const res = await customDomainService.setPurpose(id, purpose);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      toast.success(t("pages.settings.purposeUpdated"));
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : t("pages.settings.purposeSaveFailed"));
    },
  });

  const defaultTrackingMutation = useMutation({
    mutationFn: (id: string) => customDomainService.setDefaultTracking(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      toast.success(t("pages.settings.trackingDefaultUpdated"));
    },
    onError: () => toast.error(t("pages.settings.trackingDefaultFailed")),
  });

  const { data: routingEvents = [] } = useQuery({
    queryKey: ["custom-domain-routing-events", tenantKey],
    queryFn: async () => {
      const { data, error } = await customDomainService.routingEvents({ limit: 15 });
      if (error) return [];
      return data ?? [];
    },
    enabled: !!tenantKey,
    staleTime: 20_000,
  });

  /** Só trocas da conta: durante uma falha as sondas encheriam a lista acima e o rollback desapareceria. */
  const { data: latestAccountSwap = null } = useQuery({
    queryKey: ["custom-domain-routing-events", tenantKey, "account-swaps"],
    queryFn: async () => {
      const q = new URLSearchParams({ scope: "domain", event_type: ROLLBACK_SWAP_EVENT_TYPES.join(","), limit: "1" });
      const { data, error } = await apiClient.get<DomainRoutingEventDto[]>(`/custom-domain/routing-events?${q}`);
      if (error) return null;
      return data?.[0] ?? null;
    },
    enabled: !!tenantKey,
    staleTime: 20_000,
  });

  const healthCheckMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await customDomainService.healthCheck(id);
      if (res.error || !res.data) throw new Error(res.error || cd.healthCheckFailed);
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["custom-domain-routing-events"] });
      queryClient.invalidateQueries({ queryKey: ["continuity-overview"] });
      if (res.check.ok) {
        toast.success(fill(cd.healthyToast, { host: res.domain.hostname, status: res.check.httpStatus ?? "OK" }));
      } else {
        toast.warning(
          fill(cd.unhealthyToast, { host: res.domain.hostname, detail: res.check.error || res.check.healthStatus }),
        );
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : cd.healthCheckError),
  });

  const setActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await customDomainService.setActive(id, isActive);
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["custom-domain-routing-events"] });
      queryClient.invalidateQueries({ queryKey: ["continuity-overview"] });
      toast.success(vars.isActive ? cd.reactivatedToast : cd.pausedToast);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : cd.stateError),
  });

  const setRoutingMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: DomainRoutingRole }) => {
      const res = await customDomainService.setRouting(id, { routing_role: role });
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["custom-domain-routing-events"] });
      queryClient.invalidateQueries({ queryKey: ["continuity-overview"] });
      toast.success(cd.roleUpdated);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : cd.roleError),
  });

  const promotePrimaryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await customDomainService.promotePrimary(id);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["custom-domain-routing-events"] });
      queryClient.invalidateQueries({ queryKey: ["continuity-overview"] });
      toast.success(cd.promotedToast);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : cd.promoteError),
  });

  const rollbackPrimaryMutation = useMutation({
    mutationFn: async () => {
      const res = await customDomainService.rollbackPrimary();
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-domain"] });
      queryClient.invalidateQueries({ queryKey: ["custom-domain-routing-events"] });
      queryClient.invalidateQueries({ queryKey: ["continuity-overview"] });
      toast.success(cd.rollbackDone);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : cd.rollbackNone),
  });

  /** Espelha `planRollbackTarget` + `rollbackPrimary`: só a troca de conta mais recente, com anterior ≠ primário atual. */
  const currentAccountPrimaryId = domains.find((d) => d.is_default && d.purpose !== "tracking")?.id ?? null;
  const hasRollbackCandidate =
    Boolean(latestAccountSwap?.previous_domain_id) && latestAccountSwap?.previous_domain_id !== currentAccountPrimaryId;
  const eventTypeLabel: Record<string, string> = {
    auto_failover: m.pages.continuity.panel.event_auto_failover,
    auto_recovery: m.pages.continuity.panel.event_auto_recovery,
    manual_swap: m.pages.continuity.panel.event_manual_swap,
    manual_rollback: m.pages.continuity.panel.event_manual_rollback,
    health_check_failed: m.pages.continuity.panel.event_health_check_failed,
    role_changed: m.pages.continuity.panel.event_role_changed,
    domain_disabled: m.pages.continuity.panel.event_domain_disabled,
    domain_enabled: m.pages.continuity.panel.event_domain_enabled,
  };

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success(t("pages.settings.copied"));
    } catch {
      toast.error(t("pages.settings.copyFailed"));
    }
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-card-foreground">{t("pages.settings.domainsTitle")}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("pages.settings.domainsIntroA")} <strong className="text-foreground font-medium">{t("pages.settings.pendingWord")}</strong>,{" "}
            {t("pages.settings.domainsIntroB")}{" "}
            <strong className="text-foreground font-medium">{t("pages.settings.readyForAds")}</strong>, {t("pages.settings.domainsIntroC")}
          </p>
        </div>
      </div>

      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground border border-border/50 rounded-lg p-4 bg-muted/20">
        <li>
          {t("pages.settings.stepPending")}
        </li>
        <li>{t("pages.settings.stepSaveWait")}</li>
        <li>{t("pages.settings.stepVerify")}</li>
        <li>{t("pages.settings.stepPresells")}</li>
      </ol>

      {quota && !quota.can_add ? (
        <div
          className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100/95"
          role="status"
        >
          {quota.max_custom_domains === 0
            ? t("pages.settings.planNoDomain")
            : fill(t("pages.settings.quotaReached"), { used: quota.used, max: quota.max_custom_domains })}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="new-custom-hostname">{t("pages.settings.addDomain")}</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="new-custom-hostname"
            placeholder={t("pages.settings.hostnamePlaceholder")}
            value={newHostname}
            onChange={(e) => setNewHostname(e.target.value)}
            disabled={createMutation.isPending || (quota != null && !quota.can_add)}
            className="font-mono text-sm"
          />
          <Select
            value={newPurpose}
            onValueChange={(v) => setNewPurpose(v as "hosting" | "tracking" | "both")}
          >
            <SelectTrigger className="w-full sm:w-[11rem] shrink-0">
              <SelectValue placeholder={t("pages.settings.purpose")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">{t("pages.settings.purposeBoth")}</SelectItem>
              <SelectItem value="hosting">{t("pages.settings.purposeHosting")}</SelectItem>
              <SelectItem value="tracking">{t("pages.settings.purposeTracking")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            className="shrink-0"
            disabled={createMutation.isPending || (quota != null && !quota.can_add)}
            onClick={() => {
              const raw = newHostname.trim();
              if (!raw) {
                toast.error(t("pages.settings.hostnameRequired"));
                return;
              }
              createMutation.mutate(raw);
            }}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.add")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("pages.settings.purposeHintLead")} <strong className="text-foreground">{t("pages.settings.purposeTracking")}</strong> {t("pages.settings.purposeHintTail")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("pages.settings.emptyDomains")}</p>
      ) : (
        <div className="space-y-4">
          {domains.map((d) => {
            const dns = resolvePendingDnsForDisplay(d);
            const isPending = normalizeDomainStatus(d.status) === "pending";
            const hostingHint = resolveHostingDnsHint(d);
            return (
              <div
                key={d.id}
                className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <code className="text-sm font-mono break-all">https://{d.hostname}</code>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        normalizeDomainStatus(d.status) === "verified"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {normalizeDomainStatus(d.status) === "verified" ? t("pages.settings.confirmed") : t("pages.settings.pendingWord")}
                    </span>
                    {normalizeDomainStatus(d.status) === "verified" ? (
                      <CustomDomainSslBadge domain={d} tenantKey={tenantKey} />
                    ) : null}
                    {normalizeDomainStatus(d.status) === "verified" ? (
                      <span
                        title={d.last_health_error || undefined}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          d.is_active === false
                            ? "bg-muted text-muted-foreground"
                            : d.health_status === "healthy"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : d.health_status === "degraded"
                                ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                : d.health_status === "down"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-muted/70 text-muted-foreground"
                        }`}
                      >
                        {d.is_active === false
                          ? cd.statusPaused
                          : d.health_status === "healthy"
                            ? `${cd.statusHealthy}${d.last_http_status ? ` · ${d.last_http_status}` : ""}`
                            : d.health_status === "degraded"
                              ? cd.statusDegraded
                              : d.health_status === "down"
                                ? cd.statusDown
                                : cd.statusUnknown}
                      </span>
                    ) : null}
                    {normalizeDomainStatus(d.status) === "verified" && d.is_default && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> {t("pages.settings.defaultLander")}
                      </span>
                    )}
                    {d.is_default_tracking && (d.purpose === "tracking" || d.purpose === "both" || !d.purpose) && (
                      <span className="text-xs text-sky-700 dark:text-sky-400">{t("pages.settings.defaultTracking")}</span>
                    )}
                    {normalizeDomainStatus(d.status) === "verified" && d.purpose !== "tracking" ? (
                      <Select
                        value={d.routing_role ?? (d.is_default ? "primary" : "standby")}
                        onValueChange={(v) =>
                          setRoutingMutation.mutate({
                            id: d.id,
                            role: v as DomainRoutingRole,
                          })
                        }
                        disabled={setRoutingMutation.isPending}
                      >
                        <SelectTrigger className="h-7 w-[7.2rem] text-[11px]" title={cd.roleHint}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">{cd.rolePrimary}</SelectItem>
                          <SelectItem value="backup">{cd.roleBackup}</SelectItem>
                          <SelectItem value="standby">{cd.roleStandby}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}
                    <Select
                      value={d.purpose ?? "both"}
                      onValueChange={(v) =>
                        purposeMutation.mutate({
                          id: d.id,
                          purpose: v as "hosting" | "tracking" | "both",
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-[9.5rem] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">{t("pages.settings.purposeBothShort")}</SelectItem>
                        <SelectItem value="hosting">{t("pages.settings.purposeHosting")}</SelectItem>
                        <SelectItem value="tracking">{t("pages.settings.purposeTracking")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {normalizeDomainStatus(d.status) === "verified" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        disabled={healthCheckMutation.isPending}
                        onClick={() => healthCheckMutation.mutate(d.id)}
                        title={cd.healthButtonTitle}
                      >
                        <Activity className="h-3.5 w-3.5" />
                        {cd.healthButton}
                      </Button>
                    )}
                    {normalizeDomainStatus(d.status) === "verified" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        disabled={setActiveMutation.isPending}
                        onClick={() =>
                          setActiveMutation.mutate({ id: d.id, isActive: d.is_active === false })
                        }
                        title={
                          d.is_active === false ? cd.reactivateTitle : cd.pauseTitle
                        }
                      >
                        <Power className="h-3.5 w-3.5" />
                        {d.is_active === false ? cd.reactivate : cd.pause}
                      </Button>
                    )}
                    {normalizeDomainStatus(d.status) === "verified" &&
                      !d.is_default &&
                      d.is_active !== false &&
                      d.purpose !== "tracking" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        disabled={promotePrimaryMutation.isPending || defaultMutation.isPending}
                        onClick={() => promotePrimaryMutation.mutate(d.id)}
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                        {cd.promote}
                      </Button>
                    )}
                    {normalizeDomainStatus(d.status) === "verified" &&
                      !d.is_default_tracking &&
                      (d.purpose === "tracking" || d.purpose === "both") && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={defaultTrackingMutation.isPending}
                        onClick={() => defaultTrackingMutation.mutate(d.id)}
                      >
                        {t("pages.settings.setDefaultTracking")}
                      </Button>
                    )}
                    {isPending && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate(d.id)}
                      >
                        {t("pages.settings.verifyNow")}
                      </Button>
                    )}
                    {normalizeDomainStatus(d.status) === "verified" && shouldPollCustomDomainSsl(d) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        disabled={goLiveMutation.isPending}
                        onClick={() => goLiveMutation.mutate(d.id)}
                      >
                        {t("pages.settings.refreshSecurity")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive text-xs"
                      disabled={removeMutation.isPending}
                      onClick={() => {
                        if (!confirm(fill(t("pages.settings.removeConfirm"), { host: d.hostname }))) return;
                        removeMutation.mutate(d.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {isPending && dns && (
                  <div className="space-y-3 text-xs" data-testid="custom-domain-pending-dns">
                    {dns.mode === "vercel" ? (
                      <>
                        <p className="text-muted-foreground leading-relaxed">{dns.note}</p>
                        <CustomDomainDnsTable
                          idPrefix={`${d.id}-pend-v`}
                          title={t("pages.settings.dnsPasteTitle")}
                          sourceNote={t("pages.settings.dnsPasteNote")}
                          description={dns.cname.note}
                          rows={[
                            {
                              kind: inferDnsRecordKind(dns.cname.target),
                              name: dns.cname.host,
                              value: dns.cname.target,
                            },
                            ...dns.vercel_txt.map((row) => ({
                              kind: "TXT" as const,
                              name: row.name,
                              value: row.value,
                              detail: row.reason,
                            })),
                          ]}
                          copiedField={copiedField}
                          onCopy={(fieldId, text) => void copy(fieldId, text)}
                        />
                        <CustomDomainDnsTable
                          idPrefix={`${d.id}-pend-v-own`}
                          title={t("pages.settings.dnsConfirmTitle")}
                          sourceNote={t("pages.settings.dnsConfirmNote")}
                          rows={[
                            {
                              kind: "TXT",
                              name: dns.txt_name,
                              value: dns.txt_value,
                            },
                          ]}
                          copiedField={copiedField}
                          onCopy={(fieldId, text) => void copy(fieldId, text)}
                        />
                        {dns.vercel_txt.length === 0 && (
                          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-muted-foreground leading-relaxed">
                            <p className="font-medium text-card-foreground mb-1">{t("pages.settings.dnsOneLineTitle")}</p>
                            <p>{t("pages.settings.dnsOneLineBody")}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-muted-foreground leading-relaxed">{dns.note}</p>
                        <ul className="list-disc pl-4 text-muted-foreground space-y-1 text-[11px] leading-relaxed">
                          <li>{t("pages.settings.dnsPanelHint")}</li>
                        </ul>
                        <CustomDomainDnsTable
                          idPrefix={`${d.id}-pend-d`}
                          title={t("pages.settings.dnsConfirmTitle")}
                          sourceNote={t("pages.settings.dnsConfirmNote")}
                          rows={[
                            {
                              kind: "TXT",
                              name: dns.txt_name,
                              value: dns.txt_value,
                            },
                          ]}
                          copiedField={copiedField}
                          onCopy={(fieldId, text) => void copy(fieldId, text)}
                        />
                      </>
                    )}
                  </div>
                )}
                {hostingHint && (
                  <CustomDomainDnsTable
                    idPrefix={`${d.id}-host`}
                    title={t("pages.settings.dnsHostingTitle")}
                    sourceNote={t("pages.settings.dnsHostingNote")}
                    description={hostingHint.note}
                    rows={[
                      {
                        kind: inferDnsRecordKind(hostingHint.target),
                        name: hostingHint.host,
                        value: hostingHint.target,
                      },
                    ]}
                    copiedField={copiedField}
                    onCopy={(fieldId, text) => void copy(fieldId, text)}
                  />
                )}
                {normalizeDomainStatus(d.status) === "verified" &&
                  d.purpose !== "tracking" && (
                  <div className="space-y-2 pt-3 border-t border-border/40">
                    <Label className="text-xs font-medium text-card-foreground">
                      {fill(t("pages.settings.rootPresell"), { url: `https://${d.hostname}/` })}
                    </Label>
                    <Select
                      value={d.root_presell_id ?? "__auto__"}
                      onValueChange={(v) => {
                        const next = v === "__auto__" ? null : v;
                        rootPresellMutation.mutate({ domainId: d.id, presellId: next });
                      }}
                      disabled={rootPresellMutation.isPending}
                    >
                      <SelectTrigger className="text-sm max-w-md">
                        <SelectValue placeholder={t("pages.settings.rootAutoShort")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">{t("pages.settings.rootAuto")}</SelectItem>
                        {presells
                          .filter(
                            (p) =>
                              p.status === "published" &&
                              (p.id === d.root_presell_id ||
                                p.custom_domain_id === d.id ||
                                (p.custom_domain_id == null && d.is_default)),
                          )
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t("pages.settings.rootHint")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(hasRollbackCandidate || routingEvents.length > 0) && (
        <div className="rounded-lg border border-border/60 bg-muted/15 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-card-foreground">
                {cd.historyTitle}
              </h4>
            </div>
            {hasRollbackCandidate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                disabled={rollbackPrimaryMutation.isPending}
                onClick={() => rollbackPrimaryMutation.mutate()}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {rollbackPrimaryMutation.isPending ? cd.rollbackRunning : cd.rollbackButton}
              </Button>
            ) : null}
          </div>
          {routingEvents.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {routingEvents.slice(0, 8).map((ev) => (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/30 pb-1 last:border-b-0 last:pb-0"
                >
                  <span className="text-foreground/90">
                    <span className="text-[11px] font-medium text-primary mr-1.5">{eventTypeLabel[ev.event_type] ?? ev.event_type}</span>
                    {ev.reason ||
                      (ev.previous_domain?.hostname && ev.target_domain?.hostname
                        ? `${ev.previous_domain.hostname} → ${ev.target_domain.hostname}`
                        : ev.custom_domain?.hostname || cd.eventFallback)}
                  </span>
                  <span className="text-[11px] tabular-nums shrink-0">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

