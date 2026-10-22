import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getTrackApiBaseUrl } from "@/lib/apiOrigin";
import { tenantQueryKey } from "@/lib/tenantQueryKey";
import { userCanWritePresells } from "@/lib/workspaceCapabilities";
import { buildClickoraEmbedScriptHtml } from "@/lib/clickoraEmbedScript";
import { mergeClickoraTrackingIntoHeader } from "@/lib/presellTrackingMerge";
import { computePresellTrackingHealth } from "@/lib/presellTrackingHealth";
import {
  parsePresellBuilderPageDocument,
  parsePresellEditorWorkingDocument,
  pickPresellEditorDocument,
} from "@/lib/presellBuilderContent";
import { buildEditablePageDocument, pointOfferButtonsAt } from "@/lib/presellVisualEdit";
import type { PageDocument } from "@/page-builder/types";
import { DEFAULT_PRESELL_CONFIG_SETTINGS, type PresellConfigSettings } from "@/lib/presellConfigDefaults";
import { PresellAdvancedTrackingCollapsible } from "@/components/presell/PresellAdvancedTrackingCollapsible";
import { PresellTrackingHealthPanel } from "@/components/presell/PresellTrackingHealthPanel";
import {
  getPublicPresellFullUrl,
  resolveDefaultCustomDomainIdForAccount,
} from "@/lib/publicPresellOrigin";
import { setPageBuilderStorageKey, useBuilder } from "@/page-builder/store";
import { identityFromPresellContent } from "@/page-builder/pageIdentity";
import { PRESELL_CREATION_LANGUAGES, normalizePresellLocale, type PresellLocaleKey } from "@/lib/presellUiStrings";
import { PresellPublicLocaleProvider } from "@/lib/presellPublicLocale";
import { presellService } from "@/services/presellService";
import { customDomainService } from "@/services/customDomainService";
import type { Presell } from "@/types/api";
import "@/page-builder/page-builder-theme.css";

const PageEditor = lazy(() =>
  import("@/page-builder/components/PageEditor").then((m) => ({ default: m.PageEditor })),
);

function readVisualDraft(key: string): PageDocument | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const doc = JSON.parse(raw) as PageDocument;
    if (!doc || !Array.isArray(doc.sections) || doc.sections.length === 0) return null;
    return doc;
  } catch {
    return null;
  }
}

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
  const [language, setLanguage] = useState<PresellLocaleKey>("pt-BR");
  const [category, setCategory] = useState("sem");
  /** A página pública ainda é a versão automática até a primeira publicação neste editor. */
  const [awaitingVisualPublish, setAwaitingVisualPublish] = useState(false);
  const [affiliateDraft, setAffiliateDraft] = useState("");
  const loadedOfferRef = useRef("");
  const [customDomainId, setCustomDomainId] = useState("");
  const [configSettings, setConfigSettings] = useState<PresellConfigSettings>(() => ({
    ...DEFAULT_PRESELL_CONFIG_SETTINGS,
  }));
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(true);
  const [publishDrawer, setPublishDrawer] = useState(false);

  const trackingEmbedScript = useMemo(() => {
    const uid = user?.id;
    if (!uid) return "";
    return buildClickoraEmbedScriptHtml({ apiBase: getTrackApiBaseUrl(), userId: uid });
  }, [user?.id]);
  const contentRef = useRef<Record<string, unknown>>({});
  const pageTypeRef = useRef("builder");
  const lastCloudDocJsonRef = useRef("");
  const [cloudAutosaveStatus, setCloudAutosaveStatus] = useState<
    "idle" | "pending" | "saving" | "saved" | "error"
  >("idle");
  const [lastCloudSavedAt, setLastCloudSavedAt] = useState<number | null>(null);
  const draftBootstrapRef = useRef(false);
  const cloudInflightRef = useRef(false);

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
          setLanguage("pt-BR");
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
      const c = (data.content || {}) as Record<string, unknown>;
      contentRef.current = { ...c };
      pageTypeRef.current = data.type || "builder";
      const storageKey = `clickora:builder:${routeId}`;
      setPageBuilderStorageKey(storageKey);
      const publishedDoc = parsePresellBuilderPageDocument(c);
      const workingDoc = parsePresellEditorWorkingDocument(c);
      const localDoc = readVisualDraft(storageKey);
      let doc = pickPresellEditorDocument({
        published: publishedDoc,
        working: workingDoc,
        local: localDoc,
      });
      if (!doc) {
        doc = buildEditablePageDocument({
          title: data.title,
          type: data.type,
          videoUrl: data.video_url,
          language: data.language,
          content: c,
        });
      }
      setAwaitingVisualPublish(data.type !== "builder");
      if (!doc || !Array.isArray(doc.sections)) {
        toast.error("Documento do editor em falta ou inválido.");
        navigate("/presell/dashboard", { replace: true });
        return;
      }
      useBuilder.getState().hydrateDocument(doc, {
        identity: identityFromPresellContent(c, doc, data.title),
      });
      lastCloudDocJsonRef.current = JSON.stringify(useBuilder.getState().doc);
      setSlugDraft(data.slug);
      setCategory(data.category || "sem");
      setLanguage(normalizePresellLocale(data.language));
      setAffiliateDraft(String(c.affiliateLink ?? ""));
      loadedOfferRef.current = String(c.affiliateLink ?? "");
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
        businessName: String(s.businessName ?? ""),
        contactEmail: String(s.contactEmail ?? ""),
        privacyPolicyUrl: String(s.privacyPolicyUrl ?? ""),
        cookiePolicyUrl: String(s.cookiePolicyUrl ?? ""),
        affiliateDisclosure: String(s.affiliateDisclosure ?? ""),
        ...(typeof s.operatorDocument === "string" && s.operatorDocument.trim()
          ? { operatorDocument: s.operatorDocument }
          : {}),
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
      const slug = sanitizeSlug(slugDraft || useBuilder.getState().doc.name);
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
      const doc = pointOfferButtonsAt(useBuilder.getState().doc, affiliate, loadedOfferRef.current);
      const currentIdentity = useBuilder.getState().pageIdentity;
      useBuilder.getState().hydrateDocument(doc, {
        identity: {
          ...currentIdentity,
          ...identityFromPresellContent(contentRef.current, doc),
          offerHref: affiliate,
        },
      });
      loadedOfferRef.current = affiliate;

      const keepType = routeId ? pageTypeRef.current || "builder" : "builder";
      const content: Record<string, unknown> = {
        ...contentRef.current,
        pageDocument: doc,
        editorWorkingDocument: doc,
        affiliateLink: affiliate,
      };
      contentRef.current = content;
      lastCloudDocJsonRef.current = JSON.stringify(doc);

      const payload: Partial<Presell> = {
        title: doc.name.trim() || "Presell manual",
        slug,
        type: keepType,
        category,
        language,
        content,
        settings: buildSettingsPayload(),
        /** Rascunho só no POST; a seguir publicamos de imediato (sem fila de aprovação). */
        status: "draft",
        ...(hasVerifiedCustomDomain && customDomainId
          ? { custom_domain_id: customDomainId }
          : {}),
      };

      if (routeId) {
        const { data: updated, error } = await presellService.update(routeId, payload);
        if (error) throw new Error(error);
        const { data: published, error: pubErr } = await presellService.toggleStatus(routeId, "published");
        if (pubErr) throw new Error(pubErr);
        return published || updated;
      }
      const { data: created, error } = await presellService.create({
        ...payload,
        status: "published",
      });
      if (error) throw new Error(error);
      const createdRow = created as
        | (Presell & {
            compliance_blocked?: boolean;
            compliance?: {
              error?: string;
              message?: string;
              critical_issues?: Array<{ name?: string; evidence?: string; remediation?: string }>;
            };
            message?: string;
          })
        | null;
      if (createdRow?.compliance_blocked) {
        const issues = (createdRow.compliance?.critical_issues || [])
          .map((r) => (r.name || r.evidence || r.remediation || "").trim())
          .filter(Boolean)
          .slice(0, 4);
        const base =
          createdRow.compliance?.error ||
          createdRow.message ||
          "Publicação bloqueada pelas verificações internas.";
        throw new Error(issues.length ? `${base}: ${issues.join(" · ")}` : base);
      }
      if (created?.id && created.status !== "published") {
        const { data: published, error: pubErr } = await presellService.toggleStatus(created.id, "published");
        if (pubErr) throw new Error(pubErr);
        return published || created;
      }
      return created;
    },
    onSuccess: async (saved) => {
      queryClient.invalidateQueries({ queryKey: ["presells"] });
      setAwaitingVisualPublish(false);
      if (!saved?.id) {
        toast.success("Presell publicada.");
        return;
      }
      const publicUrl = getPublicPresellFullUrl(
        customDomains,
        saved.custom_domain_id ?? customDomainId ?? null,
        { id: saved.id },
      );
      toast.success("Página publicada — pronta a usar (links e rastreamento ativos).", {
        description: publicUrl,
        duration: 8000,
      });
      try {
        await navigator.clipboard.writeText(publicUrl);
      } catch {
        /* ignore */
      }
      navigate("/presell/dashboard", { replace: true });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar.");
    },
  });

  const canSaveToAccount = userCanWritePresells(user);
  const affiliateDraftRef = useRef(affiliateDraft);
  affiliateDraftRef.current = affiliateDraft;
  const slugDraftRef = useRef(slugDraft);
  slugDraftRef.current = slugDraft;
  const languageRef = useRef(language);
  languageRef.current = language;
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const customDomainIdRef = useRef(customDomainId);
  customDomainIdRef.current = customDomainId;
  const buildSettingsPayloadRef = useRef(buildSettingsPayload);
  buildSettingsPayloadRef.current = buildSettingsPayload;

  const pushWorkingToCloud = useCallback(async (presellId: string, doc: PageDocument) => {
    const snapshot = JSON.stringify(doc);
    if (snapshot === lastCloudDocJsonRef.current) return true;
    const affiliate =
      affiliateDraftRef.current.trim() || String(contentRef.current.affiliateLink ?? "");
    const content: Record<string, unknown> = {
      ...contentRef.current,
      editorWorkingDocument: doc,
      affiliateLink: affiliate || contentRef.current.affiliateLink,
    };
    setCloudAutosaveStatus("saving");
    const { error } = await presellService.update(presellId, {
      content,
      language: languageRef.current,
    });
    if (error) {
      setCloudAutosaveStatus("error");
      return false;
    }
    lastCloudDocJsonRef.current = snapshot;
    contentRef.current = content;
    setLastCloudSavedAt(Date.now());
    setCloudAutosaveStatus("saved");
    return true;
  }, []);

  const bootstrapDraftInCloud = useCallback(async (doc: PageDocument) => {
    if (draftBootstrapRef.current || cloudInflightRef.current) return;
    draftBootstrapRef.current = true;
    cloudInflightRef.current = true;
    setCloudAutosaveStatus("saving");
    const slug = sanitizeSlug(slugDraftRef.current || doc.name || "pagina");
    const affiliate = affiliateDraftRef.current.trim();
    const content: Record<string, unknown> = {
      ...contentRef.current,
      pageDocument: doc,
      editorWorkingDocument: doc,
      affiliateLink: affiliate || contentRef.current.affiliateLink || "",
    };
    const payload: Partial<Presell> = {
      title: doc.name.trim() || "Presell manual",
      slug,
      type: "builder",
      category: categoryRef.current,
      language: languageRef.current,
      content,
      settings: buildSettingsPayloadRef.current(),
      status: "draft",
      ...(hasVerifiedCustomDomain && customDomainIdRef.current
        ? { custom_domain_id: customDomainIdRef.current }
        : {}),
    };
    const { data: created, error } = await presellService.create(payload);
    cloudInflightRef.current = false;
    if (error || !created?.id) {
      draftBootstrapRef.current = false;
      setCloudAutosaveStatus("error");
      return;
    }
    contentRef.current = content;
    lastCloudDocJsonRef.current = JSON.stringify(doc);
    pageTypeRef.current = "builder";
    setLastCloudSavedAt(Date.now());
    setCloudAutosaveStatus("saved");
    setPageBuilderStorageKey(`clickora:builder:${created.id}`);
    navigate(`/presell/builder/${created.id}`, { replace: true });
  }, [hasVerifiedCustomDomain, navigate]);

  useEffect(() => {
    if (!editorReady || !canSaveToAccount) return;
    let timer: number | undefined;
    const schedule = () => {
      const doc = useBuilder.getState().doc;
      const json = JSON.stringify(doc);
      if (json === lastCloudDocJsonRef.current) return;
      setCloudAutosaveStatus("pending");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (cloudInflightRef.current) return;
        cloudInflightRef.current = true;
        void (async () => {
          try {
            if (!routeId) {
              await bootstrapDraftInCloud(doc);
              return;
            }
            await pushWorkingToCloud(routeId, doc);
          } finally {
            cloudInflightRef.current = false;
          }
        })();
      }, 1200);
    };
    const unsub = useBuilder.subscribe((state, prev) => {
      if (prev && state.doc === prev.doc) return;
      schedule();
    });
    const flush = () => {
      window.clearTimeout(timer);
      const doc = useBuilder.getState().doc;
      const json = JSON.stringify(doc);
      if (json === lastCloudDocJsonRef.current || cloudInflightRef.current) return;
      if (routeId) {
        // best-effort sync on tab close
        void pushWorkingToCloud(routeId, doc);
      }
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      unsub();
      window.clearTimeout(timer);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [editorReady, routeId, canSaveToAccount, pushWorkingToCloud, bootstrapDraftInCloud]);

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
      cloudAutosaveStatus,
      lastCloudSavedAt,
    }),
    [saveMutation, user, canSaveToAccount, cloudAutosaveStatus, lastCloudSavedAt],
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
    <PresellPublicLocaleProvider language={language}>
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
          <Select value={language} onValueChange={(v) => setLanguage(normalizePresellLocale(v) as PresellLocaleKey)}>
            <SelectTrigger
              className="h-8 w-36 shrink-0 border-editor-border bg-editor-bg text-xs text-editor-fg sm:w-44"
              aria-label="Idioma da página"
            >
              <SelectValue placeholder="Idioma" />
            </SelectTrigger>
            <SelectContent className="z-[240] border-editor-border bg-editor-panel text-editor-fg">
              {PRESELL_CREATION_LANGUAGES.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        {awaitingVisualPublish ? (
          <p className="shrink-0 border-b border-editor-border bg-editor-panel-2 px-3 py-2 text-xs leading-relaxed text-editor-fg">
            Escolhe o domínio (se tiveres), edita e clica em <strong className="font-medium">Publicar</strong> — a
            página fica no ar de imediato, com rastreamento e pronta na lista de Presells.
          </p>
        ) : null}

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
                    <p className="text-sm font-semibold text-editor-fg">Rastreio (opcional)</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-editor-fg-muted">
                      Ao publicar, o script Clickora entra no &lt;head&gt; automaticamente. Pixels extra e conversões
                      podes configurar aqui — não bloqueiam a publicação.
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
    </PresellPublicLocaleProvider>
  );
}
