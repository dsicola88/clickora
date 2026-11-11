import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Loader2, Trash2, Star } from "lucide-react";
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
import type { CustomDomainDto } from "@/types/api";
import {
  inferDnsRecordKind,
  normalizeDomainStatus,
  resolveHostingDnsHint,
  resolvePendingDnsForDisplay,
} from "@/lib/customDomainDnsDisplay";
import { CustomDomainDnsTable } from "@/components/settings/CustomDomainDnsTable";
import { CustomDomainSslBadge } from "@/components/settings/CustomDomainSslBadge";
import { tenantQueryKey } from "@/lib/tenantQueryKey";

export function CustomDomainSettings() {
  const { t } = useAppLocale();
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
                    {normalizeDomainStatus(d.status) === "verified" && d.is_default && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" /> {t("pages.settings.defaultLander")}
                      </span>
                    )}
                    {d.is_default_tracking && (d.purpose === "tracking" || d.purpose === "both" || !d.purpose) && (
                      <span className="text-xs text-sky-700 dark:text-sky-400">{t("pages.settings.defaultTracking")}</span>
                    )}
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
                    {normalizeDomainStatus(d.status) === "verified" &&
                      !d.is_default &&
                      d.purpose !== "tracking" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={defaultMutation.isPending}
                        onClick={() => defaultMutation.mutate(d.id)}
                      >
                        {t("pages.settings.setDefaultLander")}
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
                          .filter((p) => p.custom_domain_id === d.id && p.status === "published")
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
    </div>
  );
}

