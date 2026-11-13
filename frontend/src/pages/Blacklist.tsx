import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { numberLocaleFor } from "@/i18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldBan, ShieldCheck, Search, Trash2, AlertTriangle, Bot, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { integrationsService } from "@/services/integrationsService";
import { analyticsService } from "@/services/analyticsService";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { userCanWriteIntegrations } from "@/lib/workspaceCapabilities";

export default function Blacklist() {
  const { t, locale } = useAppLocale();
  const numLocale = numberLocaleFor(locale);
  const { user } = useAuth();
  const intLocked = !userCanWriteIntegrations(user);
  const queryClient = useQueryClient();
  const [newIp, setNewIp] = useState("");
  const [newWlIp, setNewWlIp] = useState("");
  const [newWlNote, setNewWlNote] = useState("");
  const [autoClickLimit, setAutoClickLimit] = useState(0);
  const [autoClickWindowH, setAutoClickWindowH] = useState(24);

  const { data: guards, isLoading: loadingGuards } = useQuery({
    queryKey: ["integrations-tracking-guards"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getTrackingGuards();
      if (error) throw new Error(error);
      return data ?? null;
    },
  });

  useEffect(() => {
    if (!guards) return;
    setAutoClickLimit(guards.auto_blacklist_click_threshold ?? 0);
    const whAllowed = [6, 12, 24, 48, 72, 168] as const;
    const wh = guards.auto_blacklist_click_window_hours ?? 24;
    setAutoClickWindowH(whAllowed.includes(wh as (typeof whAllowed)[number]) ? wh : 24);
  }, [guards]);

  const { data: whitelist, isLoading: loadingWl } = useQuery({
    queryKey: ["integrations-whitelist"],
    queryFn: async () => {
      const { data, error } = await integrationsService.listWhitelist();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const { data: blacklist, isLoading } = useQuery({
    queryKey: ["integrations-blacklist"],
    queryFn: async () => {
      const { data, error } = await integrationsService.listBlacklist();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const { data: blocks } = useQuery({
    queryKey: ["analytics-blacklist-blocks"],
    queryFn: async () => {
      const { data, error } = await analyticsService.getBlacklistBlocks({ limit: 50 });
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await integrationsService.addBlacklist({ ip: newIp.trim() });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      toast.success(t("pages.blacklist.toastAdded"));
      setNewIp("");
      void queryClient.invalidateQueries({ queryKey: ["integrations-blacklist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await integrationsService.removeBlacklist(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      toast.success(t("pages.blacklist.toastRemoved"));
      void queryClient.invalidateQueries({ queryKey: ["integrations-blacklist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchGuardsMutation = useMutation({
    mutationFn: async (body: {
      block_empty_user_agent?: boolean;
      block_bot_clicks?: boolean;
      block_proxy_clicks?: boolean;
      auto_blacklist_click_threshold?: number;
      auto_blacklist_click_window_hours?: number;
    }) => {
      const { data, error } = await integrationsService.patchTrackingGuards(body);
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      toast.success(t("pages.blacklist.toastSettings"));
      void queryClient.invalidateQueries({ queryKey: ["integrations-tracking-guards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addWlMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await integrationsService.addWhitelist({
        ip: newWlIp.trim(),
        note: newWlNote.trim() || undefined,
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      toast.success(t("pages.blacklist.toastWhitelist"));
      setNewWlIp("");
      setNewWlNote("");
      void queryClient.invalidateQueries({ queryKey: ["integrations-whitelist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeWlMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await integrationsService.removeWhitelist(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      toast.success(t("pages.blacklist.toastRemovedWhitelist"));
      void queryClient.invalidateQueries({ queryKey: ["integrations-whitelist"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!newIp.trim()) {
      toast.error(t("pages.blacklist.toastNeedIp"));
      return;
    }
    addMutation.mutate();
  };

  const handleAddWl = () => {
    if (!newWlIp.trim()) {
      toast.error(t("pages.blacklist.toastNeedIp"));
      return;
    }
    addWlMutation.mutate();
  };

  if (isLoading || loadingGuards || loadingWl) return <LoadingState message={t("pages.blacklist.loading")} />;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title={t("pages.blacklist.title")}
        description={t("pages.blacklist.subtitle")}
      />

      {intLocked ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-950/90 dark:text-amber-100/90 mb-4">
          {t("pages.blacklist.readOnly")}
        </div>
      ) : null}

      <div className="rounded-xl border border-primary/25 bg-primary/[0.05] px-4 py-3 text-sm mb-4">
        <p className="font-medium text-foreground/90">{t("pages.blacklist.suspectReportTitle")}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {t("pages.blacklist.suspectReportBody")}{" "}
          <Link
            to="/resultados/relatorios/suspeitos"
            className="underline underline-offset-2 text-foreground/90"
          >
            {t("pages.blacklist.suspectReportLink")}
          </Link>
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/25 px-4 py-3 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground/90">{t("pages.blacklist.orderTitle")}</p>
        <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm leading-relaxed">
          <li>{t("pages.blacklist.order1")}</li>
          <li>{t("pages.blacklist.order2")}</li>
          <li>{t("pages.blacklist.order3")}</li>
          <li>{t("pages.blacklist.order4")}</li>
          <li>{t("pages.blacklist.order5")}</li>
          <li>{t("pages.blacklist.order6")}</li>
          <li>{t("pages.blacklist.order7")}</li>
        </ol>
        <p className="text-xs border-t border-border/50 pt-2 mt-2">{t("pages.blacklist.orderNote")}</p>
        <p className="text-xs border-t border-border/50 pt-2 mt-2 text-foreground/80">
          <strong className="font-medium">{t("pages.blacklist.manualOnly")}</strong> {t("pages.blacklist.manualOnlyBody")}
        </p>
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t("pages.blacklist.rulesTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("pages.blacklist.rulesHint")}</p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="guard-empty-ua">{t("pages.blacklist.guardEmptyUa")}</Label>
            <p className="text-xs text-muted-foreground">{t("pages.blacklist.guardEmptyUaHint")}</p>
          </div>
          <Switch
            id="guard-empty-ua"
            checked={guards?.block_empty_user_agent ?? false}
            disabled={intLocked || patchGuardsMutation.isPending}
            onCheckedChange={(v) => patchGuardsMutation.mutate({ block_empty_user_agent: v })}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="guard-bots">{t("pages.blacklist.guardBots")}</Label>
            <p className="text-xs text-muted-foreground">{t("pages.blacklist.guardBotsHint")}</p>
          </div>
          <Switch
            id="guard-bots"
            checked={guards?.block_bot_clicks ?? false}
            disabled={intLocked || patchGuardsMutation.isPending}
            onCheckedChange={(v) => patchGuardsMutation.mutate({ block_bot_clicks: v })}
          />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="guard-proxy">{t("pages.blacklist.guardProxy")}</Label>
            <p className="text-xs text-muted-foreground">{t("pages.blacklist.guardProxyHint")}</p>
          </div>
          <Switch
            id="guard-proxy"
            checked={guards?.block_proxy_clicks ?? false}
            disabled={intLocked || patchGuardsMutation.isPending}
            onCheckedChange={(v) => patchGuardsMutation.mutate({ block_proxy_clicks: v })}
          />
        </div>

        <div className="rounded-lg border border-border/60 p-4 space-y-4">
          <div className="space-y-1">
            <Label>{t("pages.blacklist.clickLimit")}</Label>
            <p className="text-xs text-muted-foreground">{t("pages.blacklist.clickLimitHint")}</p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
            <div className="space-y-1.5 flex-1 min-w-[140px]">
              <Label htmlFor="auto-click-limit-input" className="text-xs text-muted-foreground">
                {t("pages.blacklist.maxClicks")}
              </Label>
              <Input
                id="auto-click-limit-input"
                type="number"
                min={0}
                max={5000}
                inputMode="numeric"
                value={autoClickLimit}
                readOnly={intLocked}
                onChange={(e) => setAutoClickLimit(Math.max(0, Math.min(5000, Number(e.target.value) || 0)))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">{t("pages.blacklist.windowHours")}</Label>
              <Select
                value={String(autoClickWindowH)}
                onValueChange={(v) => setAutoClickWindowH(Number(v))}
                disabled={intLocked || patchGuardsMutation.isPending}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[6, 12, 24, 48, 72, 168].map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h} h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto shrink-0"
              disabled={intLocked || patchGuardsMutation.isPending}
              onClick={() =>
                patchGuardsMutation.mutate({
                  auto_blacklist_click_threshold:
                    autoClickLimit > 0 ? Math.max(30, Math.min(5000, autoClickLimit)) : 0,
                  auto_blacklist_click_window_hours: autoClickWindowH,
                })
              }
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-foreground">{t("pages.blacklist.allowTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground/90">{t("pages.blacklist.allowEffect")}</strong>{" "}
          {t("pages.blacklist.allowEffectBody")} {t("pages.blacklist.emptyListOff")}
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full">
          <Input
            className="sm:flex-1 min-w-[140px]"
            placeholder={t("pages.blacklist.allowPlaceholder")}
            value={newWlIp}
            readOnly={intLocked}
            onChange={(e) => setNewWlIp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddWl()}
          />
          <Input
            className="sm:flex-1 min-w-[140px]"
            placeholder={t("pages.blacklist.notePlaceholder")}
            value={newWlNote}
            readOnly={intLocked}
            onChange={(e) => setNewWlNote(e.target.value)}
          />
          <Button type="button" onClick={handleAddWl} disabled={intLocked || addWlMutation.isPending} className="gap-2 shrink-0">
            <ShieldCheck className="h-4 w-4" /> {t("common.add")}
          </Button>
        </div>
        {!whitelist?.length ? (
          <p className="text-sm text-muted-foreground text-center py-2">{t("pages.blacklist.allowEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">IP</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("pages.blacklist.note")}</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("pages.blacklist.added")}</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t("pages.blacklist.action")}</th>
                </tr>
              </thead>
              <tbody>
                {whitelist.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-card-foreground">{item.ip}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{item.note || "—"}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(item.added_at).toLocaleString(numLocale)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={intLocked || removeWlMutation.isPending}
                        onClick={() => removeWlMutation.mutate(item.id)}
                        className="text-destructive hover:text-destructive/80 transition-colors"
                        aria-label={t("common.remove")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldBan className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">{t("pages.blacklist.blockTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("pages.blacklist.blockHint")}</p>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 w-full">
          <div className="space-y-2 flex-1 w-full">
            <Input
              placeholder={t("pages.blacklist.blockPlaceholder")}
              value={newIp}
              readOnly={intLocked}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={intLocked || addMutation.isPending}
            className="gap-2 w-full sm:w-auto shrink-0 gradient-primary border-0 text-primary-foreground hover:opacity-90"
          >
            <Search className="h-4 w-4" /> {t("pages.blacklist.addBlock")}
          </Button>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200/90">
            <strong>{t("pages.blacklist.blockExplainLead")}</strong> {t("pages.blacklist.blockExplain")}
          </p>
        </div>

        {!blacklist?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("pages.blacklist.blockEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">IP</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("pages.blacklist.note")}</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("pages.blacklist.added")}</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t("pages.blacklist.action")}</th>
                </tr>
              </thead>
              <tbody>
                {blacklist.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-card-foreground">{item.ip}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{item.reason || "—"}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">
                      {new Date(item.added_at).toLocaleString(numLocale)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        disabled={intLocked || removeMutation.isPending}
                        onClick={() => removeMutation.mutate(item.id)}
                        className="text-destructive hover:text-destructive/80 transition-colors"
                        aria-label={t("common.remove")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldBan className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">{t("pages.blacklist.attemptsTitle")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("pages.blacklist.attemptsHint")}
        </p>
        {!blocks?.length ? (
          <p className="text-sm text-muted-foreground py-2">{t("pages.blacklist.attemptsEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">{t("pages.blacklist.colWhen")}</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">IP</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">{t("pages.blacklist.colChannel")}</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground max-w-[160px]">{t("pages.blacklist.colReason")}</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground max-w-[200px]">User-Agent</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2 px-3 text-xs whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString(numLocale)}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs">{row.ip ?? "—"}</td>
                    <td className="py-2 px-3 text-xs">{row.channel ?? "—"}</td>
                    <td className="py-2 px-3 text-[11px] text-muted-foreground truncate max-w-[160px]" title={row.message ?? ""}>
                      {row.message || "—"}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-muted-foreground truncate max-w-[240px]" title={row.user_agent ?? ""}>
                      {row.user_agent || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t("pages.blacklist.botsTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("pages.blacklist.botsBodyLead")} {t("pages.blacklist.botsBodyMid")}{" "}
          <strong className="text-foreground/90">{t("pages.blacklist.botsBodyRule")}</strong>{" "}
          {t("pages.blacklist.botsBodyTail")}
        </p>
      </div>
    </div>
  );
}
