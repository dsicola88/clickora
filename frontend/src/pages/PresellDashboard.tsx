import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Eye,
  Save,
  Plus,
  Copy,
  Check,
  Trash2,
  Settings,
  Pencil,
  Code2,
  Download,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRESELL_CREATION_LANGUAGES, normalizePresellLocale } from "@/lib/presellUiStrings";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { presellService } from "@/services/presellService";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { FieldError } from "@/components/FieldError";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { PRO_PAGE_SHELL, ProPageHeader } from "@/components/enterprise/ProShell";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { presellAutoCreatorSchema, presellCreatorStep1Schema } from "@/lib/validations";
import { getApiBaseUrl, getTrackApiBaseUrl } from "@/lib/apiOrigin";
import { tenantQueryKey } from "@/lib/tenantQueryKey";
import { userCanWritePresells } from "@/lib/workspaceCapabilities";
import {
  getPublicPresellFullUrl,
  getPublicPresellOriginForPresell,
  resolveDefaultCustomDomainIdForAccount,
} from "@/lib/publicPresellOrigin";
import { buildPresellStandaloneHtml } from "@/lib/presellExportHtml";
import { customDomainService } from "@/services/customDomainService";
import { buildYoutubeEmbedUrlForPresell, isYoutubeUrl, resolveVideoEmbedSrc } from "@/lib/youtubeEmbed";
import { mergeClickoraTrackingIntoHeader } from "@/lib/presellTrackingMerge";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { exportPageToHtml } from "@/page-builder/export-html";
import type { Presell } from "@/types/api";
import { DEFAULT_PRESELL_CONFIG_SETTINGS, type PresellConfigSettings } from "@/lib/presellConfigDefaults";
import { PresellAdvancedTrackingCollapsible } from "@/components/presell/PresellAdvancedTrackingCollapsible";
import { MirrorHtmlEditor } from "@/components/presell/MirrorHtmlEditor";
import { PresellTrackingHealthPanel } from "@/components/presell/PresellTrackingHealthPanel";
import {
  PresellRastreamentoScriptCard,
  PresellCliquesPorPaisCard,
  usePresellAnalyticsDashboardQuery,
} from "@/components/presell/PresellScriptAnalyticsPanel";
import { PresellTypeCombobox } from "@/components/presell/PresellTypeCombobox";
import { getPresellTypeLabel, getPresellTypeOption } from "@/lib/presellTypeOptions";
import { rangeLast30Days } from "@/lib/dateRangePresets";
import {
  PRESELL_DASH_ANALYTICS_TAB_PARAM,
  parsePresellDashAnalyticsTab,
  type PresellDashAnalyticsTab,
} from "@/lib/presellDashboardAnalyticsTab";

type PresellSettings = PresellConfigSettings;

function sanitizeSlug(raw: string): string {
  const s = raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
  return s || "pagina";
}

function toastErrorFromCatch(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message.trim() : "";
  toast.error(msg || fallback);
}

export default function PresellDashboard() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  /** Isola cache React Query por conta (evita mostrar dados da sessão anterior). */
  const tenantKey = tenantQueryKey(user);
  const canWritePresells = userCanWritePresells(user);
  const [showCreator, setShowCreator] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<Presell | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /** A carregar HTML (copiar fragmento para widget ou descarregar .html completo). */
  const [htmlExportBusyId, setHtmlExportBusyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSavingPage, setIsSavingPage] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  /** Assistente em 3 passos (criação; edição reutiliza o mesmo layout). */
  const [creatorStep, setCreatorStep] = useState(1);

  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const dashRangePreset = useMemo(() => rangeLast30Days(), []);
  const [dashFrom, setDashFrom] = useState(dashRangePreset.from);
  const [dashTo, setDashTo] = useState(dashRangePreset.to);
  const presellAnalyticsQuery = usePresellAnalyticsDashboardQuery(tenantKey, dashFrom, dashTo);
  const analyticsPeriodLabel = presellAnalyticsQuery.data?.period
    ? `${new Date(presellAnalyticsQuery.data.period.from + "T12:00:00").toLocaleDateString("pt-BR")} — ${new Date(presellAnalyticsQuery.data.period.to + "T12:00:00").toLocaleDateString("pt-BR")}`
    : null;

  const abaInUrl = parsePresellDashAnalyticsTab(location.search);
  const isMetricsView = abaInUrl !== null;

  /** Migra bookmarks antigos (#rastreamento-script / #cliques-pais) para ?aba=. */
  useEffect(() => {
    const raw = (location.hash || "").replace(/^#/, "");
    if (raw !== "rastreamento-script" && raw !== "cliques-pais") return;
    const search =
      raw === "rastreamento-script"
        ? `?${PRESELL_DASH_ANALYTICS_TAB_PARAM}=rastreamento`
        : `?${PRESELL_DASH_ANALYTICS_TAB_PARAM}=pais`;
    navigate({ pathname: "/presells", search, hash: "" }, { replace: true });
  }, [location.hash, navigate]);

  const onAnalyticsTabChange = (v: PresellDashAnalyticsTab) => {
    setSearchParams({ [PRESELL_DASH_ANALYTICS_TAB_PARAM]: v }, { replace: true });
  };

  /** Mesmo padrão do Tracking → dashboard: script a colar no &lt;head&gt; da presell. */
  const trackingEmbedScript = useMemo(() => {
    const uid = user?.id;
    if (!uid) return "";
    const base = getTrackApiBaseUrl().replace(/\/$/, "");
    return `<script src="${base}/track/v2/clickora.min.js" data-id="${uid}"></script>`;
  }, [user?.id]);

  /**
   * Nova presell: junta o script Clickora ao head ao abrir o formulário.
   * Edição: só sugere script se o head guardado estiver vazio (evita sobrescrever o que já existe).
   */
  useEffect(() => {
    if (!showCreator || !trackingEmbedScript) return;
    setConfigSettings((prev) => {
      if (editingId && prev.headerCode.trim()) return prev;
      const next = mergeClickoraTrackingIntoHeader(prev.headerCode, trackingEmbedScript);
      if (next === prev.headerCode) return prev;
      return { ...prev, headerCode: next };
    });
  }, [showCreator, editingId, trackingEmbedScript]);

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

  const { data: pages = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["presells", tenantKey],
    queryFn: async () => {
      const { data, error } = await presellService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => presellService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presells"] });
      toast.success("Página removida.");
    },
    onError: () => toast.error("Erro ao remover página."),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Presell["status"] }) =>
      presellService.toggleStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["presells"] }),
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Presell>) => {
      const { data: created, error } = await presellService.create(data);
      if (error) throw new Error(error);
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["presells"] });
      setShowCreator(false);
      resetForm();
      if (created?.id) {
        navigate("/campanhas");
        toast.success(
          "Presell criada. Continue em Campanhas ou use «Nova presell» para o assistente completo com link do anúncio.",
          { duration: 8000 },
        );
      } else {
        toast.success("Página criada! Texto e imagens foram gerados automaticamente.");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Presell> }) => {
      const { data: updated, error } = await presellService.update(id, data);
      if (error) throw new Error(error);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presells"] });
      setShowCreator(false);
      setEditingId(null);
      setEditingPage(null);
      resetForm();
      toast.success("Presell atualizada.");
    },
    onError: () => toast.error("Erro ao guardar alterações."),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => presellService.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presells"] });
      toast.success("Presell duplicada com sucesso!");
    },
    onError: () => toast.error("Erro ao duplicar presell."),
  });

  const [formData, setFormData] = useState({
    pageName: "",
    pageSlug: "",
    presellType: "cookies",
    language: "pt-BR",
    /** URL da página de vendas que o servidor importa (clone do conteúdo). */
    productLink: "",
    /** Hoplink da rede — destino do botão (obrigatório para atribuição no marketplace). */
    affiliateLink: "",
    /** Vazio = domínio padrão da conta; UUID = domínio verificado específico. */
    customDomainId: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  /** Quando false, o slug segue o «Nome da página»; ao editar o slug à mão, passa a true (edição/alteração manual). */
  const [slugTouchedByUser, setSlugTouchedByUser] = useState(false);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

  const presellUrlPreview = useMemo(() => {
    const origin = getPublicPresellOriginForPresell(customDomains, formData.customDomainId || null).replace(
      /\/+$/,
      "",
    );
    const slugPart = sanitizeSlug(formData.pageSlug || formData.pageName);
    const emptyBoth = !formData.pageSlug.trim() && !formData.pageName.trim();
    return {
      origin,
      prefix: `${origin}/p/`,
      slugPart,
      pathLabel: emptyBoth ? "…" : slugPart,
      fullUrl: `${origin}/p/${slugPart}`,
    };
  }, [customDomains, formData.customDomainId, formData.pageSlug, formData.pageName]);

  const [typeOptions, setTypeOptions] = useState({
    cookiePolicyUrl: "",
    minAge: "18",
    /** Só VSL: se o import não achar vídeo, colar link do YouTube (watch ou youtu.be). */
    manualYoutubeUrl: "",
  });

  const [configSettings, setConfigSettings] = useState(() => ({ ...DEFAULT_PRESELL_CONFIG_SETTINGS }));
  /** Rascunho do HTML espelhado ao editar (sincroniza com `content.importMirrorSrcDoc`). */
  const [mirrorHtmlDraft, setMirrorHtmlDraft] = useState("");
  const [mirrorReimportBusy, setMirrorReimportBusy] = useState(false);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const effectiveAffiliateLink = useMemo(
    () => formData.affiliateLink.trim(),
    [formData.affiliateLink],
  );

  const goCreatorNext = () => {
    if (creatorStep === 1) {
      const r = presellCreatorStep1Schema.safeParse({
        pageName: formData.pageName,
        productLink: formData.productLink,
        language: formData.language,
        affiliateLink: formData.affiliateLink,
      });
      if (!r.success) {
        const errs: Record<string, string> = {};
        r.error.errors.forEach((e) => {
          if (e.path[0]) errs[String(e.path[0])] = e.message;
        });
        setFormErrors(errs);
        toast.error("Corrija os campos do passo 1.");
        return;
      }
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.pageName;
        delete next.productLink;
        delete next.language;
        delete next.affiliateLink;
        return next;
      });
      setCreatorStep(2);
      return;
    }
    if (creatorStep === 2) setCreatorStep(3);
  };

  const goCreatorPrev = () => {
    if (creatorStep > 1) setCreatorStep((s) => s - 1);
  };

  const resetForm = (opts?: { presetCustomDomain?: boolean }) => {
    const presetDomainId =
      opts?.presetCustomDomain && hasVerifiedCustomDomain
        ? resolveDefaultCustomDomainIdForAccount(customDomains) ?? ""
        : "";
    setFormData({
      pageName: "",
      pageSlug: "",
      presellType: "cookies",
      language: "pt-BR",
      productLink: "",
      affiliateLink: "",
      customDomainId: presetDomainId,
    });
    setCreatorStep(1);
    setSlugTouchedByUser(false);
    setTypeOptions({ cookiePolicyUrl: "", minAge: "18", manualYoutubeUrl: "" });
    setFormErrors({});
    setConfigSettings({ ...DEFAULT_PRESELL_CONFIG_SETTINGS });
    setMirrorHtmlDraft("");
  };

  const populateFormFromPresell = (page: Presell) => {
    const content = (page.content || {}) as Record<string, unknown>;
    const settings = (page.settings || {}) as Record<string, unknown>;
    const affiliate = String(content.affiliateLink ?? "");
    const source = String(content.sourceUrl ?? "");
    setFormData({
      pageName: page.title,
      pageSlug: page.slug,
      presellType: page.type,
      language: normalizePresellLocale(page.language),
      productLink: source || affiliate,
      affiliateLink: affiliate,
      customDomainId: page.custom_domain_id ?? "",
    });
    setSlugTouchedByUser(true);
    setTypeOptions({
      cookiePolicyUrl: String(settings.cookiePolicyUrl ?? ""),
      minAge: String(settings.minAge ?? "18"),
      manualYoutubeUrl: page.video_url || "",
    });
    setConfigSettings({
      exitPopup: Boolean(settings.exitPopup),
      countdownTimer: Boolean(settings.countdownTimer),
      socialProof: Boolean(settings.socialProof),
      googleTrackingCode: String(settings.googleTrackingCode ?? ""),
      googleConversionEvent: String(settings.googleConversionEvent ?? ""),
      fbPixelId: String(settings.fbPixelId ?? ""),
      fbTrackName: String(settings.fbTrackName ?? ""),
      fbConversionApi: String(settings.fbConversionApi ?? "disabled"),
      headerCode: String(settings.headerCode ?? ""),
      conversionTrackingScript: String(settings.conversionTrackingScript ?? ""),
      bodyCode: String(settings.bodyCode ?? ""),
      footerCode: String(settings.footerCode ?? ""),
      customCss: String(settings.customCss ?? ""),
      countdownDurationMinutes: String(settings.countdownDurationMinutes ?? "15"),
      offerQueryForwardAllowlist: String(settings.offerQueryForwardAllowlist ?? ""),
      enterpriseCloak: Boolean(settings.enterpriseCloak),
      cloakSafeTitle: String(settings.cloakSafeTitle ?? ""),
      cloakSafeBody: String(settings.cloakSafeBody ?? ""),
      cloakGeoDeny: String(settings.cloakGeoDeny ?? ""),
    });
    setMirrorHtmlDraft(
      typeof content.importMirrorSrcDoc === "string" ? content.importMirrorSrcDoc : "",
    );
  };

  const exitCreator = () => {
    setShowCreator(false);
    setEditingId(null);
    setEditingPage(null);
    resetForm();
  };

  const handleEditClick = async (page: Presell) => {
    if (!canWritePresells) {
      toast.error("Sem permissão para editar presells neste workspace.");
      return;
    }
    setIsLoadingEdit(true);
    try {
      const { data, error } = await presellService.getById(page.id);
      if (error || !data) {
        toast.error(error || "Não foi possível carregar a página.");
        return;
      }
      if (data.type === "builder") {
        navigate(`/presell/builder/${data.id}`);
        return;
      }
      setEditingId(data.id);
      setEditingPage(data);
      populateFormFromPresell(data);
      setCreatorStep(1);
      setShowCreator(true);
    } finally {
      setIsLoadingEdit(false);
    }
  };

  const handleCopySlug = (page: Presell) => {
    const url = getPublicPresellFullUrl(customDomains, page.custom_domain_id, page);
    navigator.clipboard.writeText(url);
    setCopiedId(page.id);
    toast.success("Link público copiado (/p/ e ID da página).");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyHtml = async (page: Presell) => {
    setHtmlExportBusyId(page.id);
    try {
      const { data, error } = await presellService.getById(page.id);
      if (error || !data) {
        toast.error(error || "Não foi possível carregar a página.");
        return;
      }
      const publicUrl = getPublicPresellFullUrl(customDomains, data.custom_domain_id, data);
      let html: string;
      if (data.type === "builder") {
        const doc = parsePresellBuilderPageDocument(data.content);
        if (!doc) {
          toast.error("Documento do editor em falta.");
          return;
        }
        html = exportPageToHtml(doc);
      } else {
        html = buildPresellStandaloneHtml(data, {
          apiBase: getTrackApiBaseUrl(),
          publicPageUrl: publicUrl,
          format: "htmlWidget",
        });
      }
      await navigator.clipboard.writeText(html);
      toast.success(
        data.type === "builder"
          ? "HTML copiado a partir do layout do editor manual."
          : "HTML copiado (mesmo layout que a página pública). Cola no teu site no bloco ou widget «HTML».",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível copiar o HTML.");
    } finally {
      setHtmlExportBusyId(null);
    }
  };

  const handleDownloadFullHtml = async (page: Presell) => {
    setHtmlExportBusyId(page.id);
    try {
      const { data, error } = await presellService.getById(page.id);
      if (error || !data) {
        toast.error(error || "Não foi possível carregar a página.");
        return;
      }
      const publicUrl = getPublicPresellFullUrl(customDomains, data.custom_domain_id, data);
      let html: string;
      if (data.type === "builder") {
        const doc = parsePresellBuilderPageDocument(data.content);
        if (!doc) {
          toast.error("Documento do editor em falta.");
          return;
        }
        html = exportPageToHtml(doc);
      } else {
        html = buildPresellStandaloneHtml(data, {
          apiBase: getTrackApiBaseUrl(),
          publicPageUrl: publicUrl,
          format: "document",
        });
      }
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const baseName = sanitizeSlug(data.slug || data.title || "presell");
      a.download = `${baseName}.html`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("Ficheiro .html completo descarregado (abre no browser ou edita offline).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o ficheiro.");
    } finally {
      setHtmlExportBusyId(null);
    }
  };

  const buildPresellSettingsPayload = (): PresellSettings => ({
    ...(configSettings as PresellSettings),
    headerCode: mergeClickoraTrackingIntoHeader(configSettings.headerCode, trackingEmbedScript),
    cookiePolicyUrl: typeOptions.cookiePolicyUrl,
    minAge: typeOptions.minAge,
  });

  const handleSave = async () => {
    const result = presellAutoCreatorSchema.safeParse(formData);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        if (e.path[0]) errs[String(e.path[0])] = e.message;
      });
      setFormErrors(errs);
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    setFormErrors({});

    const slug = sanitizeSlug(formData.pageSlug || formData.pageName);
    const importUrl = formData.productLink.trim();
    const ctaAffiliate = formData.affiliateLink.trim();
    if (!ctaAffiliate) {
      toast.error("Indique o hoplink da rede (destino do botão). Sem ele o marketplace não atribui o clique.");
      setCreatorStep(1);
      setFormErrors((prev) => ({
        ...prev,
        affiliateLink: "Cole o hoplink da rede (obrigatório).",
      }));
      return;
    }

    if (editingId && editingPage) {
      setIsSavingPage(true);
      try {
        const isVsl = formData.presellType === "vsl" || formData.presellType === "vsl_tsl";
        const manualYt = typeOptions.manualYoutubeUrl.trim();
        let video_url: string | null = null;
        if (isVsl) {
          if (manualYt) {
            if (isYoutubeUrl(manualYt)) {
              const embed = buildYoutubeEmbedUrlForPresell(manualYt);
              if (!embed) {
                toast.error("URL do YouTube inválido. Use um link de vídeo (watch, youtu.be ou embed).");
                return;
              }
              video_url = embed;
            } else {
              video_url = resolveVideoEmbedSrc(manualYt);
            }
          } else if (editingPage.video_url) {
            video_url = editingPage.video_url;
          }
        }
        const prevContent = editingPage.content as Record<string, unknown>;
        const content = {
          ...prevContent,
          affiliateLink: ctaAffiliate,
          sourceUrl: prevContent.sourceUrl ?? importUrl,
          ...(mirrorHtmlDraft.trim().length > 0
            ? { importMirrorSrcDoc: mirrorHtmlDraft }
            : { importMirrorSrcDoc: "" }),
        };
        await updateMutation.mutateAsync({
          id: editingId,
          data: {
            title: formData.pageName,
            slug,
            type: formData.presellType,
            language: formData.language,
            video_url: isVsl ? video_url : null,
            content,
            settings: buildPresellSettingsPayload(),
            ...(hasVerifiedCustomDomain
              ? { custom_domain_id: formData.customDomainId ? formData.customDomainId : null }
              : {}),
          },
        });
      } catch (e) {
        toastErrorFromCatch(e, "Erro ao guardar alterações.");
      } finally {
        setIsSavingPage(false);
      }
      return;
    }

    setIsSavingPage(true);
    try {
      const { data, error } = await presellService.importFromUrl({
        product_url: importUrl,
        language: formData.language,
        affiliate_link: formData.affiliateLink.trim(),
      });

      if (error || !data) {
        toast.error(error || "Não foi possível ler esta página. Verifique o link do produto (deve ser https://).");
        return;
      }

      const isVsl = formData.presellType === "vsl" || formData.presellType === "vsl_tsl";
      const manualYt = typeOptions.manualYoutubeUrl.trim();
      let video_url: string | undefined;
      if (isVsl) {
        if (data.video_url) {
          video_url = resolveVideoEmbedSrc(data.video_url);
        } else if (manualYt) {
          const embed = buildYoutubeEmbedUrlForPresell(manualYt);
          if (!embed) {
            toast.error("URL do YouTube inválido. Use um link de vídeo (watch, youtu.be ou embed).");
            return;
          }
          video_url = embed;
        }
      }
      const isDiscount = formData.presellType === "desconto";

      await createMutation.mutateAsync({
        title: formData.pageName,
        slug,
        type: formData.presellType,
        category: "sem",
        language: formData.language,
        video_url,
        ...(hasVerifiedCustomDomain && formData.customDomainId
          ? { custom_domain_id: formData.customDomainId }
          : {}),
        content: {
          title: data.title,
          subtitle: data.subtitle,
          salesText: data.sales_text,
          ctaText: isDiscount ? data.official_buy_cta : data.cta_text,
          affiliateLink: data.affiliate_link,
          productName: data.product_name,
          productImages: data.images,
          sourceUrl: data.source_url,
          /** Espelho visual para landings escuras (detetado no import). */
          storefrontTheme: data.storefront_theme,
          storefrontHeroTint: data.storefront_hero_tint,
          mirrorShowSpotlight: false,
          ...(typeof data.import_mirror_src_doc === "string" && data.import_mirror_src_doc.length > 0
            ? { importMirrorSrcDoc: data.import_mirror_src_doc }
            : {}),
          /** Extraído da página do produto — usado no layout tipo loja (estrelas). */
          ratingValue: data.rating_value,
          ratingStars: data.rating_stars ?? 5,
          ...(isDiscount
            ? {
                discountHeadline: data.discount_headline,
                socialProofLine: data.social_proof,
                urgencyTimerSeconds: data.urgency_timer_seconds ?? 649,
                discountPercent: data.discount_percent,
              }
            : {}),
        },
        settings: buildPresellSettingsPayload(),
        status: "published",
      });
    } catch (e) {
      toastErrorFromCatch(e, "Erro ao criar página.");
    } finally {
      setIsSavingPage(false);
    }
  };

  const handleDelete = (id: string) => setDeleteConfirmId(id);

  const toggleStatus = (page: Presell) => {
    const newStatus = page.status === "published" ? "paused" : "published";
    toggleMutation.mutate({ id: page.id, status: newStatus });
  };

  const filteredPages = pages.filter((p) => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

  if (showCreator) {
    if (!canWritePresells) {
      return (
        <div className={APP_PAGE_SHELL}>
          <PageHeader
            title="Sem permissão"
            description="Precisa de permissão «presells:write» neste workspace."
            actions={
              <Button variant="outline" onClick={exitCreator}>
                Voltar à lista
              </Button>
            }
          />
        </div>
      );
    }
    const isEditing = Boolean(editingId);
    const showAllSteps = isEditing;
    const stepVisible = (n: 1 | 2 | 3) => showAllSteps || creatorStep === n;
    const selectedPresellTypeDetail = getPresellTypeOption(formData.presellType);
    return (
      <div className={APP_PAGE_SHELL}>
        <PageHeader
          title={isEditing ? "Editar presell" : "Nova presell em 3 passos"}
          description={
            isAdmin
              ? isEditing
                ? "Nome, slug, tipo e links; reimportar só duplicando ou criando página nova."
                : "Importa conteúdo do URL da oferta; em 3 passos: URLs, tipo e slug /p/…"
              : undefined
          }
          actions={
            <>
              <Button variant="outline" onClick={exitCreator}>
                Voltar
              </Button>
              {(isEditing || creatorStep === 3) && (
                <Button
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending || isSavingPage}
                  className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
                >
                  <Save className="h-4 w-4" />{" "}
                  {createMutation.isPending || updateMutation.isPending || isSavingPage
                    ? isEditing
                      ? "A guardar..."
                      : "Gerando página..."
                    : isEditing
                      ? "Guardar alterações"
                      : "Criar página completa"}
                </Button>
              )}
            </>
          }
        />

        {isAdmin ? (
          <div className="rounded-xl border border-border/50 bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
            {isEditing ? (
              <>
                <p className="font-medium text-card-foreground mb-2">Edição</p>
                <p>Alterações são locais; não voltamos a ler o site da oferta automaticamente.</p>
              </>
            ) : (
              <>
                <p className="font-medium text-card-foreground mb-2">Como funciona (sem WordPress)</p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                  <li>
                    Ligar o <span className="font-medium text-foreground/90">teu domínio</span> (DNS) — a Clickora
                    publica a página e o SSL.
                  </li>
                  <li>
                    Criar a <span className="font-medium text-foreground/90">presell</span> com o visual do produto + o{" "}
                    <span className="font-medium text-foreground/90">hoplink</span> da rede.
                  </li>
                  <li>
                    No anúncio usa só o link público{" "}
                    <span className="font-mono text-[11px]">…/p/&lt;id&gt;</span> — o botão conta o clique e envia à
                    oferta.
                  </li>
                </ol>
              </>
            )}
          </div>
        ) : null}

        {!isEditing ? (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-4 sm:px-5 mb-4">
            <p className="text-xs font-medium text-foreground/90 mb-3">3 passos</p>
            <ol className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-8 text-sm">
              {(
                [
                  { n: 1 as const, label: "Nome + URLs" },
                  { n: 2 as const, label: "Tipo" },
                  { n: 3 as const, label: "Publicar" },
                ] as const
              ).map(({ n, label }) => (
                <li key={n} className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                      creatorStep === n
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/25 ring-offset-2 ring-offset-background"
                        : creatorStep > n
                          ? "bg-primary/90 text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {n}
                  </span>
                  <span
                    className={cn(
                      "truncate",
                      creatorStep === n ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="bg-card rounded-xl shadow-card border border-border/50 w-full overflow-hidden">
          <div className="px-4 py-4 sm:px-6 sm:py-4 border-b border-border/50">
            <h2 className="font-semibold text-card-foreground">
              {isEditing
                ? "Dados da presell"
                : creatorStep === 1
                  ? "Passo 1 — Nome e links"
                  : creatorStep === 2
                    ? "Passo 2 — Tipo de página"
                    : "Passo 3 — Endereço e criar"}
            </h2>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {stepVisible(1) ? (
              <div className="space-y-6 border-border/50 pb-6 sm:border-b sm:pb-8">
                <div className="space-y-2">
                  <Label htmlFor="pageName">Nome do projeto</Label>
                  <Input
                    id="pageName"
                    placeholder="Ex.: Campanha Suplemento X"
                    value={formData.pageName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        pageName: v,
                        ...(!slugTouchedByUser ? { pageSlug: v.trim() ? sanitizeSlug(v) : "" } : {}),
                      }));
                      setFormErrors((prev) => {
                        if (!prev.pageName) return prev;
                        const next = { ...prev };
                        delete next.pageName;
                        return next;
                      });
                    }}
                    className={formErrors.pageName ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  <FieldError message={formErrors.pageName} />
                  <p className="text-xs text-muted-foreground">Só para te organizares na lista — não é o link do anúncio.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productLink">1) Página do produto a clonar</Label>
                  <Input
                    id="productLink"
                    type="url"
                    placeholder="https://… sales page pública do produto"
                    value={formData.productLink}
                    onChange={(e) => updateField("productLink", e.target.value)}
                    className={formErrors.productLink ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  <FieldError message={formErrors.productLink} />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Espelhamos esta página (layout, CSS, imagens) na presell. Use a{" "}
                    <span className="font-medium text-foreground/90">sales page pública</span>, não o checkout.
                    O hoplink abaixo é o destino rastreado dos CTAs.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/[0.04] p-3 sm:p-4">
                  <Label htmlFor="affiliateLinkOpt" className="text-foreground">
                    2) Hoplink da rede — destino do botão{" "}
                    <span className="text-destructive font-normal">(obrigatório)</span>
                  </Label>
                  <Input
                    id="affiliateLinkOpt"
                    type="url"
                    placeholder="https://… link de afiliado da Digistore / ClickBank / etc."
                    value={formData.affiliateLink}
                    onChange={(e) => updateField("affiliateLink", e.target.value)}
                    className={formErrors.affiliateLink ? "border-destructive focus-visible:ring-destructive" : ""}
                    required
                  />
                  <FieldError message={formErrors.affiliateLink} />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Este é o link que a rede te dá (com o teu ID). O botão da presell envia o visitante para aqui — é o
                    que faz o marketplace registar o teu clique e a venda.
                  </p>
                </div>

                <div className="space-y-2 max-w-md">
                  <Label>Idioma do conteúdo gerado</Label>
                  <Select value={formData.language} onValueChange={(v) => updateField("language", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESELL_CREATION_LANGUAGES.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {stepVisible(2) ? (
              <div className="space-y-6 border-border/50 pb-6 sm:border-b sm:pb-8">
                <div className="space-y-2 max-w-xl">
                  <Label htmlFor="presell-type-select">Tipo de presell</Label>
                  <PresellTypeCombobox
                    id="presell-type-select"
                    value={formData.presellType}
                    onValueChange={(v) => updateField("presellType", v)}
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Abre a lista, usa a <span className="font-medium text-foreground/80">pesquisa</span> para filtrar (ex. «VSL»,
                    «cookie», «desconto») e lê a descrição de cada tipo antes de confirmar.
                  </p>
                  {selectedPresellTypeDetail ? (
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                      <p className="font-medium text-foreground/90">{selectedPresellTypeDetail.name}</p>
                      <p className="mt-1">{selectedPresellTypeDetail.description}</p>
                    </div>
                  ) : null}
                </div>

            <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 p-4 sm:p-5 space-y-4 text-left w-full min-w-0">
              <p className="text-sm font-medium text-card-foreground">Opções do tipo (na página pública)</p>
              <p className="text-xs text-muted-foreground">
                O URL importado e o link de afiliado foram definidos no passo 1; aqui só ajusta regras visuais (cookies,
                idade, VSL, etc.).
              </p>
              {formData.presellType === "cookies" ? (
                <div className="space-y-2">
                  <Label htmlFor="cookiePolicyUrl">URL da política de cookies / privacidade (opcional)</Label>
                  <Input
                    id="cookiePolicyUrl"
                    type="url"
                    placeholder="https://..."
                    value={typeOptions.cookiePolicyUrl}
                    onChange={(e) => setTypeOptions((o) => ({ ...o, cookiePolicyUrl: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Modal de cookies; qualquer ação redireciona para o link da oferta. Link opcional da política abre
                    noutro separador.
                  </p>
                </div>
              ) : null}
              {["idade", "idade_sexo", "idade_pais"].includes(formData.presellType) ? (
                <div className="space-y-2">
                  <Label htmlFor="minAge">Idade mínima para liberar o botão</Label>
                  <Input
                    id="minAge"
                    type="number"
                    min={13}
                    max={120}
                    className="max-w-[120px]"
                    value={typeOptions.minAge}
                    onChange={(e) => setTypeOptions((o) => ({ ...o, minAge: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Na página pública o visitante indica a idade; o botão da oferta só fica ativo se a idade for igual ou
                    superior a este valor. O clique usa o mesmo link de afiliado guardado na presell.
                  </p>
                </div>
              ) : null}
              {[
                "sexo",
                "grupo_homem",
                "grupo_mulher",
                "pais",
                "captcha",
                "modelos",
                "idade_sexo",
                "sexo_pais",
              ].includes(formData.presellType) ? (
                <p className="text-xs text-muted-foreground">
                  Na página pública aparece o formulário correspondente. O botão da oferta só ativa após preencher
                  corretamente. O clique usa o mesmo link de afiliado guardado na presell.
                </p>
              ) : null}
              {["vsl", "vsl_tsl"].includes(formData.presellType) ? (
                <div className="space-y-3">
                  {formData.presellType === "vsl_tsl" ? (
                    <p className="text-xs text-muted-foreground">
                      Na página pública: vídeo em destaque no topo e, abaixo, o texto longo importado da oferta (cartas
                      TSL), com CTA a meio — combinação VSL + TSL.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Na página pública: foco no vídeo e nos botões; o texto longo importado não é mostrado outra vez por
                      baixo (continua guardado na presell se quiser mudar o tipo para combo ou TSL depois).
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    O import analisa o HTML da página (iframes, scripts, ficheiros .mp4, YouTube no texto, etc.).
                    Muitas VSL carregam o vídeo só com JavaScript depois do carregamento — nesse caso o URL pode não
                    aparecer no HTML e terá de colar o link do YouTube abaixo. O vídeo reproduz na presell; os botões
                    levam à oferta, não ao YouTube.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="manualYoutubeUrl">YouTube (opcional, se a página não tiver vídeo)</Label>
                    <Input
                      id="manualYoutubeUrl"
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=… ou https://youtu.be/…"
                      value={typeOptions.manualYoutubeUrl}
                      onChange={(e) => setTypeOptions((o) => ({ ...o, manualYoutubeUrl: e.target.value }))}
                    />
                  </div>
                </div>
              ) : null}
              {formData.presellType === "desconto" ? (
                <p className="text-xs text-muted-foreground">
                  A página pública mostra faixa rosa com contagem regressiva, modal com desconto, prova social e
                  avaliação — extraídos automaticamente do texto da oferta quando possível.
                </p>
              ) : null}
              {["tsl", "dtc", "review"].includes(formData.presellType) ? (
                <p className="text-xs text-muted-foreground">
                  Layout padrão (hero claro): título, imagens e texto importados; sem vídeo nem formulário extra.
                </p>
              ) : null}
              {formData.presellType === "fantasma" ? (
                <p className="text-xs text-muted-foreground">
                  O visitante é enviado para a página da oferta ao primeiro movimento do rato, toque ou scroll — útil
                  para não deixar sair sem passar pelo link de afiliado.
                </p>
              ) : null}
            </div>
              </div>
            ) : null}

            {stepVisible(3) ? (
              <div className="space-y-6">
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="pageSlug">Endereço público (slug)</Label>
                  <div className="flex min-w-0 rounded-md border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                    <span
                      className="flex items-center shrink min-w-0 max-w-[min(100%,14rem)] sm:max-w-[16rem] px-2.5 py-2 text-xs sm:text-sm font-mono text-muted-foreground bg-muted/40 border-r border-border select-none truncate"
                      title={presellUrlPreview.fullUrl}
                      aria-hidden
                    >
                      {presellUrlPreview.prefix}
                    </span>
                    <Input
                      id="pageSlug"
                      placeholder="ex.: suplemento_x"
                      value={formData.pageSlug}
                      onChange={(e) => {
                        setSlugTouchedByUser(true);
                        updateField("pageSlug", sanitizeSlug(e.target.value));
                      }}
                      className="min-w-0 border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-xs sm:text-sm"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pré-visualização:{" "}
                    <span className="font-mono text-foreground/90 break-all" title={presellUrlPreview.fullUrl}>
                      {presellUrlPreview.prefix}
                      {presellUrlPreview.pathLabel}
                    </span>
                    {!hasVerifiedCustomDomain ? (
                      <span className="block mt-1 text-[11px] leading-snug">
                        Com domínio verificado, <code className="text-[10px] bg-muted px-1 rounded">/p/seu-endereco</code>{" "}
                        funciona no teu site. No dclickora, o link de anúncio usa <code className="text-[10px] bg-muted px-1 rounded">/p/</code>{" "}
                        com o ID da página.
                      </span>
                    ) : null}
                  </p>
                </div>

                {hasVerifiedCustomDomain ? (
                  <div className="space-y-2 max-w-xl">
                    <Label>Domínio nos links públicos</Label>
                    <Select
                      value={formData.customDomainId || "default"}
                      onValueChange={(v) => updateField("customDomainId", v === "default" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Domínio padrão da conta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Domínio padrão da conta</SelectItem>
                        {customDomains
                          .filter((d) => d.status === "verified")
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.hostname}
                              {d.is_default ? " (padrão)" : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O URL copiado para anúncios segue este domínio; «padrão» usa o definido em Configurações.
                    </p>
                  </div>
                ) : null}

                <p className="text-xs text-muted-foreground leading-relaxed rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                  <span className="font-medium text-card-foreground">Favicon:</span> em presells automáticas o ícone do
                  separador segue o domínio onde a página abre. Para definir favicon por URL (como em geradores externos),
                  use o <span className="font-medium text-foreground/90">Editor manual</span> (SEO) ou acrescente uma tag{" "}
                  <code className="text-[10px] bg-background px-1 rounded">&lt;link rel=&quot;icon&quot; …&gt;</code> em «Código
                  no head» abaixo.
                </p>
              </div>
            ) : null}

            {!isEditing ? (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                {creatorStep > 1 ? (
                  <Button type="button" variant="outline" onClick={goCreatorPrev} className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                ) : null}
                {creatorStep < 3 ? (
                  <Button type="button" onClick={goCreatorNext} className="gap-1">
                    Seguinte
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {(isEditing || creatorStep === 3) && (
          <>
            {trackingEmbedScript ? (
              <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                <span className="font-medium text-card-foreground">Rastreamento: </span>
                ao guardar, o script da conta vai para «Código no head»; pode acrescentar outros scripts em baixo.
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
                Inicie sessão para ligar o rastreamento Clickora ao guardar.
              </div>
            )}

            <PresellTrackingHealthPanel
              configSettings={configSettings}
              trackingEmbedScript={trackingEmbedScript}
              affiliateLink={effectiveAffiliateLink}
              publishedPageId={editingId}
              publicPageUrl={
                editingId
                  ? getPublicPresellFullUrl(customDomains, formData.customDomainId || null, { id: editingId })
                  : null
              }
            />

            {isEditing ? (
              <MirrorHtmlEditor
                value={mirrorHtmlDraft}
                onChange={setMirrorHtmlDraft}
                reimportBusy={mirrorReimportBusy}
                onReimport={async () => {
                  const url = formData.productLink.trim() || formData.affiliateLink.trim();
                  if (!/^https?:\/\//i.test(url)) {
                    toast.error("Indique um URL https:// do produto para re-importar.");
                    return;
                  }
                  setMirrorReimportBusy(true);
                  try {
                    const { data, error } = await presellService.importFromUrl({
                      product_url: url,
                      language: formData.language,
                      affiliate_link: formData.affiliateLink.trim() || undefined,
                    });
                    if (error || !data) {
                      toast.error(error || "Falha ao re-importar.");
                      return;
                    }
                    const mirror =
                      typeof data.import_mirror_src_doc === "string" ? data.import_mirror_src_doc : "";
                    if (mirror.length < 200) {
                      toast.warning("Re-import sem espelho fiel — HTML mantido. Verifique o URL.");
                      return;
                    }
                    setMirrorHtmlDraft(mirror);
                    toast.success("Espelho actualizado. Guarde para publicar.");
                  } catch (e) {
                    toastErrorFromCatch(e, "Falha ao re-importar.");
                  } finally {
                    setMirrorReimportBusy(false);
                  }
                }}
              />
            ) : null}

            <div className="space-y-2">
              <PresellAdvancedTrackingCollapsible
                open={advancedSettingsOpen}
                onOpenChange={setAdvancedSettingsOpen}
                configSettings={configSettings}
                setConfigSettings={setConfigSettings}
                trackingEmbedScript={trackingEmbedScript}
                surface="dashboard"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending || isSavingPage}
              className="w-full sm:w-auto gradient-primary border-0 text-primary-foreground hover:opacity-90"
            >
              {createMutation.isPending || updateMutation.isPending || isSavingPage
                ? isEditing
                  ? "A guardar..."
                  : "Gerando página..."
                : isEditing
                  ? "Guardar alterações"
                  : "Criar página completa"}
            </Button>
          </>
        )}
      </div>
    );
  }

  if (isLoading) return <LoadingState message="A carregar as suas presells…" />;
  if (isError) return <ErrorState message="Erro ao carregar presells." onRetry={() => refetch()} />;

  if (pages.length === 0 && !isMetricsView) {
    return (
      <EmptyState
        title="Nenhuma presell criada"
        description="Crie a página em poucos passos. O tracking fica activo automaticamente."
        actionLabel={canWritePresells ? "Criar presell" : undefined}
        onAction={canWritePresells ? () => navigate("/presells/nova") : undefined}
        secondaryActionLabel={canWritePresells ? "Formulário rápido" : undefined}
        secondaryOnAction={
          canWritePresells
            ? () => {
                resetForm({ presetCustomDomain: true });
                setShowCreator(true);
              }
            : undefined
        }
        icon={<FileText className="h-8 w-8 text-muted-foreground" />}
      />
    );
  }

  if (abaInUrl) {
    return (
      <div className={cn(APP_PAGE_SHELL, "space-y-6")}>
        <PageHeader
          title="Métricas do script"
          description="Impressões, cliques e conversões das presells com o script Clickora no head."
          actions={
            <Button variant="outline" asChild className="gap-1">
              <Link to="/presells">
                <ChevronLeft className="h-4 w-4" />
                Voltar às presells
              </Link>
            </Button>
          }
        />

        <Tabs
          value={abaInUrl}
          onValueChange={(v) => onAnalyticsTabChange(v as PresellDashAnalyticsTab)}
          className="w-full"
        >
          <TabsList className="grid h-auto w-full grid-cols-1 gap-1.5 p-1 sm:inline-flex sm:h-auto sm:min-h-10 sm:w-auto sm:grid-cols-none">
            <TabsTrigger
              value="rastreamento"
              className="whitespace-normal px-3 py-2.5 text-left text-xs leading-snug sm:max-w-[20rem] sm:text-center sm:text-sm sm:py-2"
            >
              Rastreamento (script)
            </TabsTrigger>
            <TabsTrigger
              value="pais"
              className="whitespace-normal px-3 py-2.5 text-left text-xs leading-snug sm:text-center sm:text-sm sm:py-2"
            >
              Cliques por país
            </TabsTrigger>
          </TabsList>
          <TabsContent value="rastreamento" className="mt-4 outline-none">
            <PresellRastreamentoScriptCard
              startDate={dashFrom}
              endDate={dashTo}
              onApply={({ from, to }) => {
                setDashFrom(from);
                setDashTo(to);
              }}
              query={presellAnalyticsQuery}
            />
          </TabsContent>
          <TabsContent value="pais" className="mt-4 outline-none">
            <PresellCliquesPorPaisCard
              startDate={dashFrom}
              endDate={dashTo}
              onApply={({ from, to }) => {
                setDashFrom(from);
                setDashTo(to);
              }}
              periodLabel={analyticsPeriodLabel}
              query={presellAnalyticsQuery}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className={cn(PRO_PAGE_SHELL, "space-y-5")}>
      <ProPageHeader
        title="Presells"
        subtitle="Páginas publicadas e rascunhos."
        actions={
          canWritePresells ? (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => navigate("/presells/nova")} className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4" /> Nova presell
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm({ presetCustomDomain: true });
                  setShowCreator(true);
                }}
                className="gap-2"
              >
                Formulário rápido
              </Button>
              <Button variant="outline" onClick={() => navigate("/presell/builder")} className="gap-2">
                Editor manual
              </Button>
            </div>
          ) : null
        }
      />

      {isAdmin ? (
        <div className="rounded-xl border border-border/50 bg-muted/25 px-4 py-4 sm:px-5 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-card-foreground">Por que presell?</p>
          <p>
            O anúncio leva à tua página intermédia — depois ao link da oferta — padrão comum para cumprir políticas de redes como o Google Ads.
          </p>
          <p className="text-xs border-t border-border/50 pt-3 mt-3">
            <span className="font-medium text-card-foreground">Importante:</span> aprovação depende das regras da rede; a dclickora não garante resultado.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/50 bg-card p-3 sm:p-4">
        <p className="text-sm text-muted-foreground shrink-0">{filteredPages.length} página(s) encontrada(s)</p>
        <Input
          placeholder="Buscar por nome da página"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full min-w-0 sm:max-w-xs md:max-w-sm sm:ml-auto"
        />
      </div>

      <p className="text-xs text-muted-foreground rounded-lg border border-border/50 bg-muted/20 px-3 py-2 leading-relaxed">
        <span className="font-medium text-card-foreground">Anúncios e partilha:</span> o link que copias é sempre{" "}
        <code className="text-[11px] bg-background px-1 rounded">https://teu-dominio/p/&lt;id&gt;</code> (com domínio
        verificado, ou o da conta). O «endereço» (slug) é só nome interno. O{" "}
        <span className="font-medium text-card-foreground">hoplink</span> fica no botão — não uses a página do produto
        no anúncio.{" "}
        <Code2 className="inline h-3 w-3 align-text-bottom opacity-80" aria-hidden />{" "}
        <span className="font-medium text-card-foreground">Copiar HTML</span> (fragmento para colar num widget HTML);{" "}
        <Download className="inline h-3 w-3 align-text-bottom opacity-80" aria-hidden />{" "}
        <span className="font-medium text-card-foreground">Descarregar .html</span> (página completa com &lt;html&gt;). Nas
        presells <span className="font-medium text-card-foreground">manuais</span>, o HTML exportado corresponde ao layout
        do editor (não ao modelo importado por URL).
      </p>

      <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nome da página</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo da Presell</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Link público</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                  <Settings className="h-4 w-4 inline" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.map((page) => (
                <tr key={page.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium">
                      {page.title}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{getPresellTypeLabel(page.type)}</td>
                  <td className="py-3 px-4 max-w-[min(100vw,22rem)]">
                    <div className="flex flex-col gap-1">
                      <code className="text-[11px] sm:text-xs text-primary break-all leading-snug">
                        {getPublicPresellFullUrl(customDomains, page.custom_domain_id, page)}
                      </code>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">slug: /{page.slug}</span>
                        <button
                          type="button"
                          onClick={() => handleCopySlug(page)}
                          className="text-xs px-2 py-0.5 rounded bg-success/10 text-success font-medium hover:bg-success/20 transition-colors"
                        >
                          {copiedId === page.id ? <Check className="h-3 w-3" /> : "Copiar"}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {canWritePresells ? (
                      <button
                        type="button"
                        onClick={() => toggleStatus(page)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${page.status === "published" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {page.status === "published" ? "Publicada" : page.status === "draft" ? "Rascunho" : "Pausada"}
                      </button>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${page.status === "published" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {page.status === "published" ? "Publicada" : page.status === "draft" ? "Rascunho" : "Pausada"}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      {canWritePresells ? (
                        <button
                          type="button"
                          onClick={() => handleEditClick(page)}
                          disabled={isLoadingEdit}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}
                      <a
                        href={getPublicPresellFullUrl(customDomains, page.custom_domain_id, page)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title={
                          page.status === "published"
                            ? "Abrir o mesmo link público que vês na coluna (domínio verificado ou dclickora)."
                            : "A presell tem de estar «Habilitada» (publicada) para o link público mostrar conteúdo"
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyHtml(page)}
                        disabled={htmlExportBusyId === page.id}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                        title="Copiar HTML para colar no widget HTML do teu site"
                      >
                        <Code2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadFullHtml(page)}
                        disabled={htmlExportBusyId === page.id}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                        title="Descarregar página .html completa (DOCTYPE, head, body)"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {canWritePresells ? (
                        <button
                          type="button"
                          onClick={() => duplicateMutation.mutate(page.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Duplicar"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canWritePresells ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(page.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPages.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma presell encontrada para &quot;{searchTerm}&quot;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={deleteConfirmId != null} onOpenChange={(o) => !o && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar esta presell?</AlertDialogTitle>
            <AlertDialogDescription>
              O link público deixa de funcionar. Esta acção não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
