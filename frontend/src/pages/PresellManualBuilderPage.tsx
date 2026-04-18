import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { PresellBuilderEmbedProvider } from "@/contexts/PresellBuilderEmbedContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import { mergeClickoraTrackingIntoHeader } from "@/lib/presellTrackingMerge";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { DEFAULT_PRESELL_CONFIG_SETTINGS, type PresellConfigSettings } from "@/lib/presellConfigDefaults";
import { PresellAdvancedTrackingCollapsible } from "@/components/presell/PresellAdvancedTrackingCollapsible";
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
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
  return s || "pagina";
}

export default function PresellManualBuilderPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantKey = user?.id ?? "";

  const [editorReady, setEditorReady] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [affiliateDraft, setAffiliateDraft] = useState("");
  const [customDomainId, setCustomDomainId] = useState("");
  const [configSettings, setConfigSettings] = useState<PresellConfigSettings>(() => ({
    ...DEFAULT_PRESELL_CONFIG_SETTINGS,
  }));
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

  const trackingEmbedScript = useMemo(() => {
    const uid = user?.id;
    if (!uid) return "";
    const base = getApiBaseUrl().replace(/\/$/, "");
    return `<script src="${base}/track/v2/clickora.min.js" data-id="${uid}"></script>`;
  }, [user?.id]);

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
        bodyCode: String(s.bodyCode ?? ""),
        footerCode: String(s.footerCode ?? ""),
        customCss: String(s.customCss ?? ""),
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

  const buildSettingsPayload = useCallback((): PresellSettings => {
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
        status: "published",
        ...(hasVerifiedCustomDomain && customDomainId
          ? { custom_domain_id: customDomainId }
          : {}),
      };

      if (routeId) {
        const { data: updated, error } = await presellService.update(routeId, payload);
        if (error) throw new Error(error);
        return updated;
      }
      const { data: created, error } = await presellService.create(payload);
      if (error) throw new Error(error);
      return created;
    },
    onSuccess: async (saved) => {
      queryClient.invalidateQueries({ queryKey: ["presells"] });
      toast.success(routeId ? "Presell atualizada." : "Presell publicada.");
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

  const embedValue = useMemo(
    () => ({
      onRequestSave: () => saveMutation.mutate(),
      isSaving: saveMutation.isPending,
    }),
    [saveMutation],
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
      <div className="page-builder-scope fixed inset-0 z-[100] flex flex-col bg-editor-bg text-editor-fg">
        <div className="flex flex-wrap items-center gap-2 border-b border-editor-border bg-editor-panel px-3 py-2 text-xs shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-editor-border bg-editor-panel-2 text-editor-fg hover:bg-editor-border"
            onClick={() => navigate("/presell/dashboard")}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Voltar
          </Button>
          <div className="h-6 w-px bg-editor-border hidden sm:block" />
          <div className="flex items-center gap-1.5 min-w-0">
            <Label className="text-editor-fg-muted shrink-0">Slug</Label>
            <Input
              value={slugDraft}
              onChange={(e) => setSlugDraft(e.target.value)}
              className="h-8 w-36 sm:w-44 bg-editor-bg border-editor-border text-editor-fg text-xs"
              placeholder="minha_pagina"
            />
          </div>
          <div className="flex flex-1 min-w-[12rem] items-center gap-1.5">
            <Label className="text-editor-fg-muted shrink-0 hidden md:inline">Oferta (cliques)</Label>
            <Input
              value={affiliateDraft}
              onChange={(e) => setAffiliateDraft(e.target.value)}
              className="h-8 flex-1 min-w-0 bg-editor-bg border-editor-border text-editor-fg text-xs"
              placeholder="https://… (link de afiliado para rastrear cliques)"
            />
          </div>
          {hasVerifiedCustomDomain ? (
            <Select
              value={customDomainId || "default"}
              onValueChange={(v) => setCustomDomainId(v === "default" ? "" : v)}
            >
              <SelectTrigger className="h-8 w-[10rem] sm:w-52 bg-editor-bg border-editor-border text-editor-fg text-xs">
                <SelectValue placeholder="Domínio" />
              </SelectTrigger>
              <SelectContent>
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
        </div>

        <div className="shrink-0 border-b border-editor-border bg-editor-panel-2 px-3 py-2 space-y-2 max-h-[min(40vh,22rem)] overflow-y-auto editor-scrollbar">
          <p className="text-[11px] leading-relaxed text-editor-fg-muted">
            <span className="font-medium text-editor-fg">Presell automática vs manual:</span> aqui montas o layout no
            editor (secções e widgets). O <span className="text-editor-fg">link público</span> é o mesmo formato{" "}
            <span className="font-mono text-[10px]">/p/&lt;id&gt;</span> que na lista de presells. Usa «Guardar na conta»
            no topo do editor para publicar. Abaixo, as mesmas opções de rastreamento e código extra que na criação
            automática.
          </p>
          {trackingEmbedScript ? (
            <div className="rounded border border-editor-border bg-editor-panel px-2 py-1.5 text-[11px] text-editor-fg-muted leading-relaxed">
              <span className="font-medium text-editor-fg">Clickora:</span> o script da conta entra no head ao guardar;
              podes acrescentar pixels em «Opcional».
            </div>
          ) : (
            <div className="rounded border border-dashed border-editor-border px-2 py-1.5 text-[11px] text-editor-fg-muted">
              Inicia sessão para incluir o rastreamento Clickora ao guardar.
            </div>
          )}
          <PresellAdvancedTrackingCollapsible
            open={advancedSettingsOpen}
            onOpenChange={setAdvancedSettingsOpen}
            configSettings={configSettings}
            setConfigSettings={setConfigSettings}
            trackingEmbedScript={trackingEmbedScript}
            surface="editor"
          />
        </div>

        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-editor-fg-muted text-sm">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                A carregar o editor…
              </div>
            }
          >
            <PageEditor />
          </Suspense>
        </div>
      </div>
    </PresellBuilderEmbedProvider>
  );
}
