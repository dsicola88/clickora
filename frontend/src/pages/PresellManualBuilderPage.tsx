import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PresellBuilderEmbedProvider } from "@/contexts/PresellBuilderEmbedContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import { tenantQueryKey } from "@/lib/tenantQueryKey";
import { userCanWritePresells } from "@/lib/workspaceCapabilities";
import { mergeClickoraTrackingIntoHeader } from "@/lib/presellTrackingMerge";
import { computePresellTrackingHealth } from "@/lib/presellTrackingHealth";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { DEFAULT_PRESELL_CONFIG_SETTINGS, type PresellConfigSettings } from "@/lib/presellConfigDefaults";
import { PresellAdvancedTrackingCollapsible } from "@/components/presell/PresellAdvancedTrackingCollapsible";
import { PresellTrackingHealthPanel } from "@/components/presell/PresellTrackingHealthPanel";
import {
  getPublicPresellFullUrl,
  resolveDefaultCustomDomainIdForAccount,
} from "@/lib/publicPresellOrigin";
import { setPageBuilderStorageKey, useBuilder } from "@/page-builder/store";
import { presellService } from "@/services/presellService";
import { customDomainService } from "@/services/customDomainService";
import type { Presell } from "@/types/api";
import "@/page-builder/page-builder-theme.css";

const PageEditor = lazy(() =>
  import("@/page-builder/components/PageEditor").then((m) => ({ default: m.PageEditor })),
);

function sanitizeSlug(raw: string): string {
  const s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
  return s || "pagina";
}

export default function PresellManualBuilderPage() {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantKey = tenantQueryKey(user);

  const [editorReady, setEditorReady] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [affiliateDraft, setAffiliateDraft] = useState("");
  const [customDomainId, setCustomDomainId] = useState("");
  const [configSettings, setConfigSettings] = useState<PresellConfigSettings>(() => ({
    ...DEFAULT_PRESELL_CONFIG_SETTINGS,
  }));
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(true);
  const [publishDrawer, setPublishDrawer] = useState(false);

  const trackingEmbedScript = useMemo(() => {
    const uid = user?.id;
    if (!uid) return "";
    const base = getApiBaseUrl().replace(/\/$/, "");
    return `<script src="${base}/track/v2/clickora.min.js" data-id="${uid}"></script>`;
  }, [user?.id]);

  const trackingHealthScore = useMemo(
    () =>
      computePresellTrackingHealth({
        configSettings,
        hasTrackingEmbedScript: Boolean(trackingEmbedScript?.trim()),
        affiliateLinkTrimmed: affiliateDraft.trim(),
        hasPublishedPageId: Boolean(routeId),
      }).readyScore,
    [configSettings, trackingEmbedScript, affiliateDraft, routeId],
  );

  useEffect(() => {
    setConfigSettings((prev) => {
      const next = mergeClickoraTrackingIntoHeader(prev.headerCode, trackingEmbedScript);
      if (next === prev.headerCode) return prev;
      return { ...prev, headerCode: next };
    });
  }, [trackingEmbedScript]);

  const { data: customDomains = [] } = useQuery({
    queryKey: ["custom-domain", tenantKey],
    queryFn: async () => {
      const { data, error } = await customDomainService.list();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
    staleTime: 60_000,
  });

  const hasVerifiedCustomDomain = customDomains.some((d) => d.status === "verified");

  const publicPresellTestUrl = useMemo(() => {
    if (!routeId) return null;
    return getPublicPresellFullUrl(customDomains, customDomainId || null, { id: routeId });
  }, [routeId, customDomains, customDomainId]);

  useEffect(() => {
    const uid = user?.id || "anon";
    setPageBuilderStorageKey(routeId ? `clickora:builder:${routeId}` : `clickora:builder:draft:${uid}`);
  }, [routeId, user?.id]);

  useEffect(() => {
    let cancelled = false;
    setEditorReady(false);

    const run = async () => {
      if (!routeId) {
        useBuilder.getState().reset();
        const doc = useBuilder.getState().doc;
        if (!cancelled) {
          setSlugDraft(sanitizeSlug(doc.name));
          setAffiliateDraft("");
          setConfigSettings({ ...DEFAULT_PRESELL_CONFIG_SETTINGS });
          setEditorReady(true);
        }
        return;
      }

      const { data, error } = await presellService.getById(routeId);
      if (cancelled) return;
      if (error || !data) {
        toast.error(error || "Não foi possível carregar a página.");
        navigate("/presell/dashboard", { replace: true });
        return;
      }
      if (data.type !== "builder") {
        toast.error("Esta presell não foi criada no editor manual.");
        navigate("/presell/dashboard", { replace: true });
        return;
      }
      const doc = parsePresellBuilderPageDocument(data.content);
      if (!doc) {
        toast.error("Documento do editor em falta ou inválido.");
        navigate("/presell/dashboard", { replace: true });
        return;
      }
      useBuilder.getState().hydrateDocument(doc);
      setSlugDraft(data.slug);
      const c = (data.content || {}) as Record<string, unknown>;
      setAffiliateDraft(String(c.affiliateLink ?? ""));
      setCustomDomainId(data.custom_domain_id ?? "");
      const s = (data.settings || {}) as Record<string, unknown>;
      setConfigSettings({
        exitPopup: Boolean(s.exitPopup),
        countdownTimer: Boolean(s.countdownTimer),
        socialProof: Boolean(s.socialProof),
        googleTrackingCode: String(s.googleTrackingCode ?? ""),
        googleConversionEvent: String(s.googleConversionEvent ?? ""),
        fbPixelId: String(s.fbPixelId ?? ""),
        fbTrackName: String(s.fbTrackName ?? ""),
        fbConversionApi: String(s.fbConversionApi ?? "disabled"),
        headerCode: String(s.headerCode ?? ""),
        conversionTrackingScript: String(s.conversionTrackingScript ?? ""),
        bodyCode: String(s.bodyCode ?? ""),
        footerCode: String(s.footerCode ?? ""),
        customCss: String(s.customCss ?? ""),
        countdownDurationMinutes: String(s.countdownDurationMinutes ?? "15"),
        offerQueryForwardAllowlist: String(s.offerQueryForwardAllowlist ?? ""),
      });
      setEditorReady(true);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [routeId, navigate]);

  useEffect(() => {
    if (routeId) return;
    if (!hasVerifiedCustomDomain) return;
    setCustomDomainId((prev) => prev || resolveDefaultCustomDomainIdForAccount(customDomains) || "");
  }, [routeId, hasVerifiedCustomDomain, customDomains]);

  const buildSettingsPayload = useCallback((): PresellConfigSettings => {
    return {
      ...configSettings,
      headerCode: mergeClickoraTrackingIntoHeader(configSettings.headerCode, trackingEmbedScript),
    };
  }, [configSettings, trackingEmbedScript]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const doc = useBuilder.getState().doc;
      const slug = sanitizeSlug(slugDraft || doc.name);
      const affiliate = affiliateDraft.trim();
      if (!slug) throw new Error("Indique um slug (endereço interno) para a página.");
      if (!affiliate) {
        throw new Error("Indique o link da oferta (afiliado) na barra acima — usado pelo rastreamento de cliques.");
      }
      try {
        new URL(affiliate);
      } catch {
        throw new Error("O link da oferta tem de ser um URL válido (https://…).");
      }

      const content: Record<string, unknown> = {
        pageDocument: doc,
        affiliateLink: affiliate,
      };

      const payload: Partial<Presell> = {
        title: doc.name.trim() || "Presell manual",
        slug,
        type: "builder",
        category: "sem",
        language: "pt-BR",
        content,
        settings: buildSettingsPayload(),
        status: "draft",
        ...(hasVerifiedCustomDomain && customDomainId
          ? { custom_domain_id: customDomainId }
          : {}),
      };

      if (routeId) {
        const { data: updated, error } = await presellService.update(routeId, payload);
        if (error) throw new Error(error);
        // Republicar só após gate de conformidade no servidor.
        const { error: pubErr } = await presellService.toggleStatus(routeId, "published");
        if (pubErr) throw new Error(pubErr);
        return updated;
      }
      const { data: created, error } = await presellService.create(payload);
      if (error) throw new Error(error);
      if (created?.id) {
        const { data: published, error: pubErr } = await presellService.toggleStatus(created.id, "published");
        if (pubErr) {
          throw new Error(
            pubErr ||
              "Presell guardada em rascunho. Corrija a conformidade publicitária antes de publicar.",
          );
        }
        return published || created;
      }
      return created;
    },
    onSuccess: async (saved) => {
      queryClient.invalidateQueries({ queryKey: ["presells"] });
      toast.success(routeId ? "Presell atualizada." : "Presell guardada.");
      if (!routeId && saved?.id) {
        const publicUrl = getPublicPresellFullUrl(customDomains, saved.custom_domain_id ?? null, {
          id: saved.id,
        });
        try {
          await navigator.clipboard.writeText(publicUrl);
          toast.success("Link público copiado para a área de transferência.", { duration: 6000 });
        } catch {
          /* ignore */
        }
        navigate(`/presell/builder/${saved.id}`, { replace: true });
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Erro ao guardar.");
    },
  });

  const canSaveToAccount = userCanWritePresells(user);

  const embedValue = useMemo(
    () => ({
      onRequestSave: () => {
        if (!userCanWritePresells(user)) {
          toast.error("Sem permissão para guardar presells neste workspace.");
          return;
        }
        saveMutation.mutate();
      },
      isSaving: saveMutation.isPending,
      canSave: canSaveToAccount,
    }),
    [saveMutation, user, canSaveToAccount],
  );

  if (!editorReady) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        A preparar o editor…
      </div>
    );
  }

  return (
    <PresellBuilderEmbedProvider value={embedValue}>
      <div className="page-builder-scope fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-editor-bg text-editor-fg">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-editor-border bg-editor-panel px-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 border-editor-border bg-editor-panel-2 text-editor-fg hover:bg-editor-border"
            onClick={() => navigate("/presell/dashboard")}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Voltar
          </Button>
          <Input
            value={slugDraft}
            onChange={(e) => setSlugDraft(e.target.value)}
            aria-label="Slug"
            className="h-8 w-36 shrink-0 border-editor-border bg-editor-bg text-xs text-editor-fg sm:w-44"
            placeholder="slug da página"
          />
          <Input
            value={affiliateDraft}
            onChange={(e) => setAffiliateDraft(e.target.value)}
            aria-label="Link da oferta"
            className="h-8 min-w-0 flex-1 border-editor-border bg-editor-bg text-xs text-editor-fg"
            placeholder="Link da oferta — https://…"
          />
          {hasVerifiedCustomDomain ? (
            <Select
              value={customDomainId || "default"}
              onValueChange={(v) => setCustomDomainId(v === "default" ? "" : v)}
            >
              <SelectTrigger className="h-8 w-40 shrink-0 border-editor-border bg-editor-bg text-xs text-editor-fg sm:w-52">
                <SelectValue placeholder="Domínio" />
              </SelectTrigger>
              <SelectContent className="z-[240] border-editor-border bg-editor-panel text-editor-fg">
                <SelectItem value="default">Domínio padrão</SelectItem>
                {customDomains
                  .filter((d) => d.status === "verified")
                  .map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.hostname}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 border-editor-border bg-editor-panel-2 text-editor-fg hover:bg-editor-border"
            onClick={() => {
              setAdvancedSettingsOpen(true);
              setPublishDrawer(true);
            }}
          >
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            Rastreio
            <span className="ml-1.5 tabular-nums text-editor-fg-muted">{trackingHealthScore}</span>
          </Button>
        </div>

        <div className="relative min-h-0 flex-1">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-editor-fg-muted">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                A carregar o editor…
              </div>
            }
          >
            <PageEditor />
          </Suspense>

          {publishDrawer ? (
            <div className="absolute inset-0 z-30 flex justify-end bg-black/45">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="Fechar painel"
                onClick={() => setPublishDrawer(false)}
              />
              <div className="relative flex h-full w-full max-w-xl flex-col border-l border-editor-border bg-editor-panel shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-editor-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-editor-fg">Publicação e rastreio</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-editor-fg-muted">
                      O script Clickora entra no head ao guardar. Pixels e o script de conversão ficam aqui, fora do canvas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPublishDrawer(false)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-editor-fg-muted hover:bg-editor-panel-2 hover:text-editor-fg"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="editor-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
                  <PresellTrackingHealthPanel
                    configSettings={configSettings}
                    trackingEmbedScript={trackingEmbedScript}
                    affiliateLink={affiliateDraft}
                    publishedPageId={routeId ?? null}
                    publicPageUrl={publicPresellTestUrl}
                    isEditor
                  />
                  <PresellAdvancedTrackingCollapsible
                    open={advancedSettingsOpen}
                    onOpenChange={setAdvancedSettingsOpen}
                    configSettings={configSettings}
                    setConfigSettings={setConfigSettings}
                    trackingEmbedScript={trackingEmbedScript}
                    surface="editor"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </PresellBuilderEmbedProvider>
  );
}
