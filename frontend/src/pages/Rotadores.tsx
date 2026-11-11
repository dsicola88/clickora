import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Check,
  Plus,
  Pencil,
  Trash2,
  Shuffle,
  ExternalLink,
  Loader2,
  Trophy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { presellService } from "@/services/presellService";
import {
  trafficRotatorsService,
  type CreateTrafficRotatorBody,
  type TrafficRotatorArmInput,
  type TrafficRotatorDto,
  type TrafficRotatorMode,
  type RotatorDeviceRule,
} from "@/services/trafficRotatorsService";
import {
  RotatorRulesBuilder,
  draftsToPolicy,
  emptyRuleDraft,
  policyToDrafts,
  type RotatorRuleDraft,
} from "@/components/RotatorRulesBuilder";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { tenantQueryKey } from "@/lib/tenantQueryKey";
import { userCanWriteRotators } from "@/lib/workspaceCapabilities";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, numberLocaleFor, type MessageKey } from "@/i18n";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 52);
}

function parseIsoList(raw: string): string[] | null {
  const parts = raw
    .split(/[,;\s]+/)
    .map((x) => x.trim().toUpperCase())
    .filter((x) => /^[A-Z]{2}$/.test(x));
  return parts.length ? [...new Set(parts)] : null;
}

function RotatorAbPanel({ rotatorId, canMutate }: { rotatorId: string; canMutate: boolean }) {
  const { t, locale } = useAppLocale();
  const numLocale = numberLocaleFor(locale);
  const [open, setOpen] = useState(false);
  const [lookback, setLookback] = useState(30);
  const [metric, setMetric] = useState<"conversion_rate" | "revenue">("conversion_rate");
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["traffic-rotator-ab-stats", rotatorId, lookback] as const,
    queryFn: async () => {
      const { data: d, error } = await trafficRotatorsService.abStats(rotatorId, { lookback_days: lookback });
      if (error) throw new Error(error);
      if (!d) throw new Error(t("pages.rotators.toastEmptyResponse"));
      return d;
    },
    enabled: open,
  });

  const promoteMut = useMutation({
    mutationFn: async () => {
      const { data: d, error } = await trafficRotatorsService.promoteWinner(rotatorId, {
        metric,
        lookback_days: lookback,
        min_clicks_per_arm: 50,
      });
      if (error) throw new Error(error);
      return d;
    },
    onSuccess: (payload) => {
      qc.invalidateQueries({ queryKey: ["traffic-rotators"] });
      qc.invalidateQueries({ queryKey: ["traffic-rotator-ab-stats", rotatorId] });
      const label = payload?.winner_label?.trim() || payload?.winner_arm_id?.slice(0, 8) || "—";
      toast.success(fill(t("pages.rotators.abWinnerToast"), { label }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border/50 pt-3 mt-3">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-between h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="inline-flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 opacity-70" />
            {t("pages.rotators.abTitle")}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("pages.rotators.abLookback")}</Label>
            <Input
              type="number"
              min={1}
              max={730}
              className="h-8 w-24 text-xs"
              value={lookback}
              onChange={(e) => setLookback(Math.max(1, Math.min(730, parseInt(e.target.value, 10) || 30)))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{t("pages.rotators.abMetric")}</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as "conversion_rate" | "revenue")}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conversion_rate">{t("pages.rotators.abMetricCvr")}</SelectItem>
                <SelectItem value="revenue">{t("pages.rotators.abMetricRevenue")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 text-xs"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("common.refresh")}
          </Button>
        </div>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        ) : isError ? (
          <p className="text-xs text-destructive">{t("pages.rotators.abLoadError")}</p>
        ) : data ? (
          <>
            <p className="text-[11px] text-muted-foreground">
              {fill(t("pages.rotators.since"), {
                when: new Date(data.lookback_from).toLocaleString(numLocale, { dateStyle: "short" }),
              })}
            </p>
            <div className="overflow-x-auto rounded-md border border-border/60 text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="py-1.5 px-2 font-medium">{t("pages.rotators.abArm")}</th>
                    <th className="py-1.5 px-2 font-medium">{t("pages.rotators.abWeight")}</th>
                    <th className="py-1.5 px-2 font-medium">{t("pages.rotators.abClicks")}</th>
                    <th className="py-1.5 px-2 font-medium">{t("pages.rotators.abConv")}</th>
                    <th className="py-1.5 px-2 font-medium">{t("pages.rotators.abRate")}</th>
                    <th className="py-1.5 px-2 font-medium">{t("pages.rotators.abRevenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.arms.map((row) => (
                    <tr key={row.arm_id} className="border-t border-border/50">
                      <td className="py-1.5 px-2 max-w-[140px] truncate" title={row.label || row.arm_id}>
                        {row.label || "—"}
                      </td>
                      <td className="py-1.5 px-2 tabular-nums">{row.current_weight}</td>
                      <td className="py-1.5 px-2 tabular-nums">{row.clicks.toLocaleString(numLocale)}</td>
                      <td className="py-1.5 px-2 tabular-nums">{row.conversions.toLocaleString(numLocale)}</td>
                      <td className="py-1.5 px-2 tabular-nums">
                        {(row.conversion_rate * 100).toLocaleString(numLocale, { maximumFractionDigits: 2 })}%
                      </td>
                      <td className="py-1.5 px-2 tabular-nums">{row.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("pages.rotators.abPromoteHint")}
            </p>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={!canMutate || promoteMut.isPending}
              onClick={() => {
                if (
                  !confirm(t("pages.rotators.abPromoteConfirm"))
                ) {
                  return;
                }
                promoteMut.mutate();
              }}
            >
              {promoteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
              {t("pages.rotators.abPromote")}
            </Button>
          </>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

type ArmForm = {
  destination_url: string;
  label: string;
  order_index: number;
  weight: string;
  max_clicks: string;
  countries_allow: string;
  countries_deny: string;
  device_rule: RotatorDeviceRule;
};

function emptyArm(i: number): ArmForm {
  return {
    destination_url: "",
    label: "",
    order_index: i,
    weight: "100",
    max_clicks: "",
    countries_allow: "",
    countries_deny: "",
    device_rule: "all",
  };
}

function dtoToArms(r: TrafficRotatorDto): ArmForm[] {
  return r.arms.map((a, i) => ({
    destination_url: a.destination_url,
    label: a.label ?? "",
    order_index: a.order_index,
    weight: String(a.weight),
    max_clicks: a.max_clicks != null ? String(a.max_clicks) : "",
    countries_allow: a.countries_allow?.join(", ") ?? "",
    countries_deny: a.countries_deny?.join(", ") ?? "",
    device_rule: a.device_rule,
  }));
}

/** Em dclickora.com / preview o /p/ público só resolve UUID — slug dá 404. */
function isBrokenMainHostPresellPath(url: string): boolean {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!/(^|\.)dclickora\.com$/i.test(host) && !/localhost|127\.0\.0\.1/i.test(host)) return false;
    const m = u.pathname.match(/^\/p\/([^/]+)\/?$/i);
    if (!m) return false;
    const param = decodeURIComponent(m[1]);
    return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
  } catch {
    return false;
  }
}

function armsToPayload(arms: ArmForm[]): TrafficRotatorArmInput[] | null {
  const out: TrafficRotatorArmInput[] = [];
  arms.forEach((a, i) => {
    const url = a.destination_url.trim();
    if (!url) return;
    const wRaw = a.weight.trim();
    const wParsed = wRaw === "" ? 100 : parseInt(wRaw, 10);
    const w = Number.isNaN(wParsed) ? 100 : Math.max(0, Math.min(100_000, wParsed));
    const maxRaw = a.max_clicks.trim();
    const maxClicks = maxRaw ? Math.max(1, parseInt(maxRaw, 10) || 0) : null;
    out.push({
      destination_url: url,
      label: a.label.trim() || null,
      order_index: i,
      weight: w,
      max_clicks: maxClicks,
      countries_allow: parseIsoList(a.countries_allow),
      countries_deny: parseIsoList(a.countries_deny),
      device_rule: a.device_rule,
    });
  });
  return out.length ? out : null;
}

function resolveRulesPolicyForSubmit(
  drafts: RotatorRuleDraft[],
  editing: TrafficRotatorDto | null,
): { ok: true; value: unknown | undefined | null } | { ok: false; error: MessageKey } {
  for (const d of drafts) {
    if (d.action === "redirect" && !/^https?:\/\//i.test(d.redirect_url.trim())) {
      return { ok: false, error: "pages.rotators.toastRuleRedirect" };
    }
  }
  const policy = draftsToPolicy(drafts);
  const hadPolicy = Boolean(editing && editing.rules_policy != null);
  if (!policy) {
    if (!editing) return { ok: true, value: undefined };
    if (hadPolicy && drafts.length === 0) return { ok: true, value: null };
    if (hadPolicy && drafts.length > 0) {
      return { ok: false, error: "pages.rotators.toastRulesFix" };
    }
    return { ok: true, value: undefined };
  }
  return { ok: true, value: policy };
}

export default function Rotadores() {
  const { user } = useAuth();
  const { t, m } = useAppLocale();
  const tenantKey = tenantQueryKey(user);
  const canWriteRotators = userCanWriteRotators(user);
  const qc = useQueryClient();
  const modeLabels = m.modes;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrafficRotatorDto | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [mode, setMode] = useState<TrafficRotatorMode>("weighted");
  const [backupUrl, setBackupUrl] = useState("");
  const [contextPresellId, setContextPresellId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  /** Só em edição: remover código guardado sem substituir. */
  const [stripAccessCode, setStripAccessCode] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [stickySession, setStickySession] = useState(false);
  const [arms, setArms] = useState<ArmForm[]>([emptyArm(0), emptyArm(1)]);
  const [rulesDrafts, setRulesDrafts] = useState<RotatorRuleDraft[]>([]);
  const [rulesPolicyOpen, setRulesPolicyOpen] = useState(false);
  const [rulesJsonAdvanced, setRulesJsonAdvanced] = useState(false);
  const [rulesPolicyText, setRulesPolicyText] = useState("");

  const { data: presells = [] } = useQuery({
    queryKey: ["presells-rotadores", tenantKey],
    queryFn: async () => {
      const { data, error } = await presellService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
  });

  const publishedPresells = presells.filter((p) => p.status === "published");

  const { data: rotators = [], isLoading } = useQuery({
    queryKey: ["traffic-rotators", tenantKey],
    queryFn: async () => {
      const { data, error } = await trafficRotatorsService.list();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
  });

  const resetForm = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setSlugManual(false);
    setMode("weighted");
    setBackupUrl("");
    setContextPresellId("");
    setAccessCode("");
    setStripAccessCode(false);
    setIsActive(true);
    setStickySession(false);
    setArms([emptyArm(0), emptyArm(1)]);
    setRulesDrafts([]);
    setRulesPolicyText("");
    setRulesPolicyOpen(false);
    setRulesJsonAdvanced(false);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (r: TrafficRotatorDto) => {
    setEditing(r);
    setName(r.name);
    setSlug(r.slug);
    setSlugManual(true);
    setMode(r.mode);
    setBackupUrl(r.backup_url ?? "");
    setContextPresellId(r.context_presell_id);
    setAccessCode("");
    setStripAccessCode(false);
    setIsActive(r.is_active);
    setStickySession(Boolean(r.sticky_session));
    setArms(dtoToArms(r).length ? dtoToArms(r) : [emptyArm(0)]);
    setRulesDrafts(policyToDrafts(r.rules_policy));
    setRulesPolicyText(r.rules_policy != null ? JSON.stringify(r.rules_policy, null, 2) : "");
    setRulesJsonAdvanced(false);
    setDialogOpen(true);
  };

  const createMut = useMutation({
    mutationFn: async (body: CreateTrafficRotatorBody) => {
      const { data, error } = await trafficRotatorsService.create(body);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic-rotators"] });
      toast.success(t("pages.rotators.toastCreated"));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<CreateTrafficRotatorBody> & { access_code?: string } }) => {
      const { data, error } = await trafficRotatorsService.update(id, body);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic-rotators"] });
      toast.success(t("pages.rotators.toastUpdated"));
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await trafficRotatorsService.remove(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["traffic-rotators"] });
      toast.success(t("pages.rotators.toastDeleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugManual && !editing) setSlug(slugify(v));
  };

  const submit = () => {
    const armPayload = armsToPayload(arms);
    if (!name.trim() || !slug.trim() || !contextPresellId || !armPayload) {
      toast.error(t("pages.rotators.toastFillRequired"));
      return;
    }
    const badPaths = [
      ...armPayload.map((a) => a.destination_url),
      backupUrl.trim() || "",
    ].filter((u) => u && isBrokenMainHostPresellPath(u));
    if (badPaths.length) {
      toast.error(t("pages.rotators.toastDclickoraPath"));
      return;
    }

    let rulesRes: ReturnType<typeof resolveRulesPolicyForSubmit>;
    if (rulesJsonAdvanced) {
      const rawJson = rulesPolicyText.trim();
      if (!rawJson) {
        rulesRes = resolveRulesPolicyForSubmit([], editing);
      } else {
        try {
          const parsed: unknown = JSON.parse(rawJson);
          const hadPolicy = Boolean(editing && editing.rules_policy != null);
          if (!editing && parsed === null) rulesRes = { ok: true, value: undefined };
          else if (editing && parsed === null && hadPolicy) rulesRes = { ok: true, value: null };
          else rulesRes = { ok: true, value: parsed };
        } catch {
          toast.error(t("pages.rotators.toastRulesInvalid"));
          return;
        }
      }
    } else {
      rulesRes = resolveRulesPolicyForSubmit(rulesDrafts, editing);
    }
    if (rulesRes.ok === false) {
      toast.error(t(rulesRes.error));
      return;
    }

    const base: CreateTrafficRotatorBody = {
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      mode,
      backup_url: backupUrl.trim() || null,
      context_presell_id: contextPresellId,
      access_code: accessCode.trim() || null,
      is_active: isActive,
      sticky_session: stickySession,
      arms: armPayload,
    };
    if (rulesRes.value !== undefined) base.rules_policy = rulesRes.value;

    if (editing) {
      const patch: Partial<CreateTrafficRotatorBody> & { access_code?: string } = {
        name: base.name,
        slug: base.slug,
        mode: base.mode,
        backup_url: base.backup_url,
        context_presell_id: base.context_presell_id,
        is_active: base.is_active,
        sticky_session: base.sticky_session,
        arms: base.arms,
      };
      if (rulesRes.value !== undefined) patch.rules_policy = rulesRes.value;
      if (stripAccessCode) patch.access_code = "";
      else if (accessCode.trim()) patch.access_code = accessCode.trim();
      updateMut.mutate({ id: editing.id, body: patch });
    } else {
      createMut.mutate(base);
    }
  };

  const copyUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success(t("pages.rotators.toastCopied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const busy = createMut.isPending || updateMut.isPending;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title={t("pages.rotators.title")}
        description={t("pages.rotators.subtitle")}
        actions={
          canWriteRotators ? (
            <Button
              type="button"
              className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              {t("common.create")}
            </Button>
          ) : null
        }
      />

      {!canWriteRotators ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-950/90 dark:text-amber-100/90 mb-4">
          {t("pages.rotators.readOnlyBanner")}
        </div>
      ) : null}

      <div className="rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-3 text-sm mb-4 space-y-2">
        <p className="font-medium text-foreground text-sm">{t("pages.rotators.useCasesTitle")}</p>
        <ul className="text-xs text-muted-foreground leading-relaxed list-disc pl-4 space-y-1">
          <li>
            <strong className="text-foreground/90">{t("pages.rotators.useCaseAbLead")}</strong>
            {t("pages.rotators.useCaseAb")}
          </li>
          <li>
            <strong className="text-foreground/90">{t("pages.rotators.useCaseWaLead")}</strong>
            {t("pages.rotators.useCaseWa")}
          </li>
          <li>
            <strong className="text-foreground/90">{t("pages.rotators.useCaseOfferLead")}</strong>
            {t("pages.rotators.useCaseOffer")}
          </li>
          <li>
            <strong className="text-foreground/90">{t("pages.rotators.useCaseBackupLead")}</strong>
            {t("pages.rotators.useCaseBackup")}
          </li>
        </ul>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("pages.rotators.flowHint")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : rotators.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          <Shuffle className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>{t("pages.rotators.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rotators.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border/50 bg-card shadow-sm p-5 space-y-3 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground">{r.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.slug}</p>
                  <p className="text-xs text-muted-foreground mt-1">{modeLabels[r.mode]}</p>
                </div>
                <span
                  className={cn(
                    "text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full",
                    r.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                  )}
                >
                  {r.is_active ? t("common.active") : t("common.inactive")}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => copyUrl(r.public_click_url, r.id)}
                >
                  {copiedId === r.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {t("pages.rotators.copyLink")}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" asChild>
                  <a href={r.public_click_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t("common.open")}
                  </a>
                </Button>
                {canWriteRotators ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={() => openEdit(r)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("common.edit")}
                  </Button>
                ) : null}
                {canWriteRotators ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive gap-1"
                    onClick={() => {
                      if (confirm(t("pages.rotators.deleteConfirm"))) {
                        deleteMut.mutate(r.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>

              <div className="text-xs text-muted-foreground border-t border-border/50 pt-3 space-y-1">
                {r.arms.map((a) => (
                  <div key={a.id} className="flex justify-between gap-2">
                    <span className="truncate" title={a.destination_url}>
                      {a.label || a.destination_url.slice(0, 48)}
                      {a.destination_url.length > 48 && !a.label ? "…" : ""}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {a.clicks_delivered}
                      {a.max_clicks != null ? ` / ${a.max_clicks}` : ""}
                    </span>
                  </div>
                ))}
              </div>
              <RotatorAbPanel rotatorId={r.id} canMutate={canWriteRotators} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !busy && setDialogOpen(o)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? t("pages.rotators.dialogEdit") : t("pages.rotators.dialogNew")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("pages.rotators.labelName")}</Label>
                <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder={t("pages.rotators.namePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("pages.rotators.labelSlug")}</Label>
                <Input
                  value={slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  placeholder={t("pages.rotators.slugPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("pages.rotators.mode")}</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as TrafficRotatorMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(modeLabels) as TrafficRotatorMode[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {modeLabels[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editing && canWriteRotators ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      setMode("weighted");
                      setArms([
                        { ...emptyArm(0), label: t("pages.rotators.pageA"), weight: "50" },
                        { ...emptyArm(1), label: t("pages.rotators.pageB"), weight: "50" },
                      ]);
                      toast.message(t("pages.rotators.toastPresetAb"));
                    }}
                  >
                    {t("pages.rotators.presetAbBtn")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      setMode("sequential");
                      setArms([
                        { ...emptyArm(0), label: fill(t("pages.rotators.sellerN"), { n: 1 }), destination_url: "https://wa.me/", weight: "100" },
                        { ...emptyArm(1), label: fill(t("pages.rotators.sellerN"), { n: 2 }), destination_url: "https://wa.me/", weight: "100" },
                        { ...emptyArm(2), label: fill(t("pages.rotators.sellerN"), { n: 3 }), destination_url: "https://wa.me/", weight: "100" },
                      ]);
                      toast.message(t("pages.rotators.toastPresetWa"));
                    }}
                  >
                    {t("pages.rotators.presetWa")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      setMode("weighted");
                      setArms([
                        { ...emptyArm(0), label: fill(t("pages.rotators.offerN"), { n: 1 }), weight: "50" },
                        { ...emptyArm(1), label: fill(t("pages.rotators.offerN"), { n: 2 }), weight: "50" },
                      ]);
                      toast.message(t("pages.rotators.toastPresetOffer"));
                    }}
                  >
                    {t("pages.rotators.presetOfferBtn")}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>{t("pages.rotators.contextPresell")}</Label>
              <Select value={contextPresellId} onValueChange={setContextPresellId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("pages.rotators.pickPresell")} />
                </SelectTrigger>
                <SelectContent>
                  {publishedPresells.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} ({p.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{t("pages.rotators.contextHint")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("pages.rotators.fallbackUrl")}</Label>
              <Input
                value={backupUrl}
                onChange={(e) => setBackupUrl(e.target.value)}
                placeholder={t("pages.rotators.fallbackPlaceholder")}
              />
              <p className="text-[11px] text-muted-foreground">{t("pages.rotators.fallbackHint")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("pages.rotators.accessCode")}</Label>
              <Input
                value={accessCode}
                onChange={(e) => {
                  setStripAccessCode(false);
                  setAccessCode(e.target.value);
                }}
                placeholder={
                  editing?.access_code_set
                    ? t("pages.rotators.newCodePlaceholder")
                    : t("pages.rotators.codeExample")
                }
                disabled={stripAccessCode}
              />
              {editing?.access_code_set ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setStripAccessCode((s) => !s);
                      setAccessCode("");
                    }}
                  >
                    {stripAccessCode ? t("pages.rotators.cancelRemove") : t("pages.rotators.removeProtection")}
                  </Button>
                  {stripAccessCode ? (
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">
                      {t("pages.rotators.removeProtectionHint")}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="rot-active" />
              <Label htmlFor="rot-active" className="cursor-pointer">
                {t("pages.rotators.active")}
              </Label>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Switch
                  checked={stickySession}
                  onCheckedChange={setStickySession}
                  id="rot-sticky"
                  disabled={mode !== "weighted" && mode !== "random"}
                />
                <Label
                  htmlFor="rot-sticky"
                  className={cn(
                    "cursor-pointer",
                    mode !== "weighted" && mode !== "random" && "text-muted-foreground",
                  )}
                >
                  {t("pages.rotators.sticky")}
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug pl-0.5">
                {t("pages.rotators.stickyHint")}
              </p>
            </div>

            <Collapsible
              open={rulesPolicyOpen}
              onOpenChange={setRulesPolicyOpen}
              className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2"
            >
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between h-9 px-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span>
                    Regras do rotador
                    {rulesDrafts.length ? ` (${rulesDrafts.length})` : ""}
                  </span>
                  {rulesPolicyOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                {!rulesJsonAdvanced ? (
                  <RotatorRulesBuilder
                    drafts={rulesDrafts}
                    onChange={setRulesDrafts}
                    disabled={!canWriteRotators}
                  />
                ) : (
                  <Textarea
                    value={rulesPolicyText}
                    onChange={(e) => setRulesPolicyText(e.target.value)}
                    placeholder={`{\n  "version": 1,\n  "rules": []\n}`}
                    className="font-mono text-xs min-h-[120px]"
                    spellCheck={false}
                  />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1 text-[11px] text-muted-foreground"
                  onClick={() => {
                    if (!rulesJsonAdvanced) {
                      const p = draftsToPolicy(rulesDrafts);
                      setRulesPolicyText(p ? JSON.stringify(p, null, 2) : "");
                      setRulesJsonAdvanced(true);
                      return;
                    }
                    if (rulesPolicyText.trim()) {
                      try {
                        const parsed: unknown = JSON.parse(rulesPolicyText);
                        if (
                          !parsed ||
                          typeof parsed !== "object" ||
                          (parsed as { version?: unknown }).version !== 1 ||
                          !Array.isArray((parsed as { rules?: unknown }).rules)
                        ) {
                          toast.error(t("pages.rotators.toastPolicyInvalid"));
                          return;
                        }
                        setRulesDrafts(policyToDrafts(parsed));
                      } catch {
                        toast.error(t("pages.rotators.toastRulesVisual"));
                        return;
                      }
                    } else {
                      setRulesDrafts([]);
                    }
                    setRulesJsonAdvanced(false);
                  }}
                >
                  {rulesJsonAdvanced ? t("pages.rotators.useVisual") : t("pages.rotators.advancedText")}
                </Button>
                {!rulesDrafts.length && !rulesJsonAdvanced ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setRulesDrafts([emptyRuleDraft()])}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("pages.rotators.startRule")}
                  </Button>
                ) : null}
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-3 border-t border-border pt-4">
              {editing ? (
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2">
                  {t("pages.rotators.armsReset")}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="text-base">{t("pages.rotators.arms")}</Label>
                <div className="flex items-center gap-2">
                  {contextPresellId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[11px]"
                      onClick={() => {
                        const origin =
                          typeof window !== "undefined" ? window.location.origin : "https://www.dclickora.com";
                        const pub = `${origin.replace(/\/+$/, "")}/p/${contextPresellId}`;
                        setArms((prev) => {
                          const next = [...prev];
                          const idx = next.findIndex((a) => !a.destination_url.trim());
                          const i = idx >= 0 ? idx : 0;
                          next[i] = { ...next[i], destination_url: pub };
                          return next;
                        });
                        if (!backupUrl.trim()) setBackupUrl(pub);
                        toast.message(t("pages.rotators.toastPublicUrl"));
                      }}
                    >
                      {t("pages.rotators.insertContext")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setArms((prev) => [...prev, emptyArm(prev.length)])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {t("pages.rotators.arm")}
                  </Button>
                </div>
              </div>

              {arms.map((arm, idx) => (
                <div key={idx} className="rounded-lg border border-border/60 p-3 space-y-2 bg-muted/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">{fill(t("pages.rotators.armN"), { n: idx + 1 })}</span>
                    {arms.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        onClick={() => setArms((prev) => prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, order_index: i })))}
                      >
                        {t("common.remove")}
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    placeholder={t("pages.rotators.destPlaceholder")}
                    value={arm.destination_url}
                    onChange={(e) =>
                      setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, destination_url: e.target.value } : a)))
                    }
                  />
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Input
                      placeholder={t("pages.rotators.labelOptional")}
                      value={arm.label}
                      onChange={(e) =>
                        setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, label: e.target.value } : a)))
                      }
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder={t("pages.rotators.weightOff")}
                        className="w-24"
                        value={arm.weight}
                        onChange={(e) =>
                          setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, weight: e.target.value } : a)))
                        }
                      />
                      <Input
                        placeholder={t("pages.rotators.maxClicks")}
                        className="flex-1"
                        value={arm.max_clicks}
                        onChange={(e) =>
                          setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, max_clicks: e.target.value } : a)))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Input
                      placeholder={t("pages.rotators.countriesAllow")}
                      value={arm.countries_allow}
                      onChange={(e) =>
                        setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, countries_allow: e.target.value } : a)))
                      }
                    />
                    <Input
                      placeholder={t("pages.rotators.countriesDeny")}
                      value={arm.countries_deny}
                      onChange={(e) =>
                        setArms((prev) => prev.map((a, i) => (i === idx ? { ...a, countries_deny: e.target.value } : a)))
                      }
                    />
                  </div>
                  <Select
                    value={arm.device_rule}
                    onValueChange={(v) =>
                      setArms((prev) =>
                        prev.map((a, i) => (i === idx ? { ...a, device_rule: v as RotatorDeviceRule } : a)),
                      )
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("pages.rotators.anyDevice")}</SelectItem>
                      <SelectItem value="mobile">{t("pages.rotators.mobileOnly")}</SelectItem>
                      <SelectItem value="desktop">{t("pages.rotators.desktopOnly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button type="button" className="gradient-primary border-0 text-primary-foreground" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? t("common.save") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
