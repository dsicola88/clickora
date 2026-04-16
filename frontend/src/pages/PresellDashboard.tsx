import { useEffect, useMemo, useState } from "react";
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
  ChevronDown,
  ChevronRight,
  Pencil,
  Code2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PRESELL_CREATION_LANGUAGES, normalizePresellLocale } from "@/lib/presellUiStrings";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { presellService } from "@/services/presellService";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { FieldError } from "@/components/FieldError";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { presellAutoCreatorSchema } from "@/lib/validations";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import {
  getPublicPresellFullUrl,
  getPublicPresellOriginForPresell,
  resolveDefaultCustomDomainIdForAccount,
} from "@/lib/publicPresellOrigin";
import { buildPresellStandaloneHtml } from "@/lib/presellExportHtml";
import { customDomainService } from "@/services/customDomainService";
import { buildYoutubeEmbedUrlForPresell, isYoutubeUrl, resolveVideoEmbedSrc } from "@/lib/youtubeEmbed";
import { mergeClickoraTrackingIntoHeader } from "@/lib/presellTrackingMerge";
import type { Presell } from "@/types/api";

type PresellSettings = Record<string, string | boolean>;

const DEFAULT_PRESELL_CONFIG_SETTINGS = {
  exitPopup: false,
  countdownTimer: false,
  socialProof: false,
  googleTrackingCode: "",
  googleConversionEvent: "",
  fbPixelId: "",
  fbTrackName: "",
  fbConversionApi: "disabled",
  headerCode: "",
  bodyCode: "",
  footerCode: "",
  customCss: "",
};

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

const presellTypes = [
  { id: "cookies", name: "Cookies" },
  { id: "desconto", name: "Desconto" },
  { id: "fantasma", name: "Fantasma" },
  { id: "vsl", name: "VSL (Video Sales Letter)" },
  { id: "tsl", name: "TSL (Text Sales Letter)" },
  { id: "dtc", name: "DTC (Direct to Consumer)" },
  { id: "review", name: "Review" },
  { id: "vsl_tsl", name: "VSL + TSL (Combo)" },
  { id: "sexo", name: "Sexo" },
  { id: "idade", name: "Idade" },
  { id: "grupo_homem", name: "Grupo de idade Homem" },
  { id: "grupo_mulher", name: "Grupo de idade Mulher" },
  { id: "pais", name: "País" },
  { id: "captcha", name: "Captcha" },
  { id: "modelos", name: "Modelos" },
];

export default function PresellDashboard() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  /** Isola cache React Query por conta (evita mostrar dados da sessão anterior). */
  const tenantKey = user?.id ?? "";
  const [showCreator, setShowCreator] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<Presell | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /** A carregar HTML (copiar Elementor ou descarregar .html completo). */
  const [htmlExportBusyId, setHtmlExportBusyId] = useState<string | null>(null);
  const [copiedTrackingScript, setCopiedTrackingScript] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSavingPage, setIsSavingPage] = useState(false);

  /** Mesmo padrão do Tracking → dashboard: script a colar no &lt;head&gt; da presell. */
  const trackingEmbedScript = useMemo(() => {
    const uid = user?.id;
    if (!uid) return "";
    const base = getApiBaseUrl().replace(/\/$/, "");
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
        const publicUrl = getPublicPresellFullUrl(customDomains, created.custom_domain_id ?? null, {
          id: created.id,
        });
        void (async () => {
          try {
            const { data: full } = await presellService.getById(created.id);
            if (full) {
              const html = buildPresellStandaloneHtml(full, {
                apiBase: getApiBaseUrl(),
                publicPageUrl: publicUrl,
                format: "elementor",
              });
              await navigator.clipboard.writeText(html);
            } else {
              await navigator.clipboard.writeText(publicUrl);
            }
            toast.success(
              "Página criada. HTML completo copiado (igual à pré-visualização pública) — cola no Elementor (widget HTML). O link público está no comentário no topo do código.",
              { duration: 12000 },
            );
          } catch {
            try {
              await navigator.clipboard.writeText(publicUrl);
            } catch {
              /* ignore */
            }
            toast.success(`Página criada. Link público: ${publicUrl}`, { duration: 15000 });
          }
        })();
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
    productLink: "",
    /** Vazio = domínio padrão da conta; UUID = domínio verificado específico. */
    customDomainId: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  /** Quando false, o slug segue o «Nome da página»; ao editar o slug à mão, passa a true (edição/alteração manual). */
  const [slugTouchedByUser, setSlugTouchedByUser] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

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
      customDomainId: presetDomainId,
    });
    setSlugTouchedByUser(false);
    setTypeOptions({ cookiePolicyUrl: "", minAge: "18", manualYoutubeUrl: "" });
    setFormErrors({});
    setConfigSettings({ ...DEFAULT_PRESELL_CONFIG_SETTINGS });
  };

  const populateFormFromPresell = (page: Presell) => {
    const content = (page.content || {}) as Record<string, unknown>;
    const settings = (page.settings || {}) as Record<string, unknown>;
    setFormData({
      pageName: page.title,
      pageSlug: page.slug,
      presellType: page.type,
      language: normalizePresellLocale(page.language),
      productLink: String(content.affiliateLink ?? ""),
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
      bodyCode: String(settings.bodyCode ?? ""),
      footerCode: String(settings.footerCode ?? ""),
      customCss: String(settings.customCss ?? ""),
    });
  };

  const exitCreator = () => {
    setShowCreator(false);
    setEditingId(null);
    setEditingPage(null);
    resetForm();
  };

  const handleEditClick = async (page: Presell) => {
    setIsLoadingEdit(true);
    try {
      const { data, error } = await presellService.getById(page.id);
      if (error || !data) {
        toast.error(error || "Não foi possível carregar a página.");
        return;
      }
      setEditingId(data.id);
      setEditingPage(data);
      populateFormFromPresell(data);
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
      const html = buildPresellStandaloneHtml(data, {
        apiBase: getApiBaseUrl(),
        publicPageUrl: publicUrl,
        format: "elementor",
      });
      await navigator.clipboard.writeText(html);
      toast.success(
        "HTML copiado (mesmo layout que a página pública). Cola no Elementor no widget «HTML».",
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
      const html = buildPresellStandaloneHtml(data, {
        apiBase: getApiBaseUrl(),
        publicPageUrl: publicUrl,
        format: "document",
      });
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
    const link = formData.productLink.trim();

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
          }
        }
        const content = {
          ...(editingPage.content as Record<string, unknown>),
          affiliateLink: link,
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
        product_url: link,
        language: formData.language,
        affiliate_link: link,
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
          affiliateLink: link,
          productName: data.product_name,
          productImages: data.images,
          sourceUrl: data.source_url,
          ...(isDiscount
            ? {
                discountHeadline: data.discount_headline,
                socialProofLine: data.social_proof,
                ratingValue: data.rating_value,
                ratingStars: data.rating_stars ?? 5,
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

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  const toggleStatus = (page: Presell) => {
    const newStatus = page.status === "published" ? "paused" : "published";
    toggleMutation.mutate({ id: page.id, status: newStatus });
  };

  const filteredPages = pages.filter((p) => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

  if (showCreator) {
    const isEditing = Boolean(editingId);
    return (
      <div className={APP_PAGE_SHELL}>
        <PageHeader
          title={isEditing ? "Editar presell" : "Nova presell (automática)"}
          description={
            isAdmin
              ? isEditing
                ? "Altere nome, slug, tipo, link de afiliado e opções. O texto e as imagens já importados mantêm-se; para voltar a extrair tudo da URL, duplique a página na lista ou crie uma presell nova."
                : "Cole o link do produto, escolha idioma e tipo, nome e endereço. O restante é gerado para você."
              : undefined
          }
          actions={
            <>
              <Button variant="outline" onClick={exitCreator}>
                Voltar
              </Button>
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
            </>
          }
        />

        {isAdmin ? (
          <div className="rounded-xl border border-border/50 bg-muted/30 px-5 py-4 text-sm text-muted-foreground">
            {isEditing ? (
              <>
                <p className="font-medium text-card-foreground mb-2">Edição</p>
                <p>
                  As alterações aplicam-se ao que está guardado. Não voltamos a aceder ao site do produto automaticamente;
                  só atualiza o que preencher aqui (incluindo o link da oferta e o vídeo manual em VSL).
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-card-foreground mb-2">O que acontece ao criar</p>
                <p className="mb-3 text-xs sm:text-sm leading-relaxed">
                  A página pública fica em{" "}
                  <span className="font-mono text-[11px] text-foreground/90">https://…/p/&lt;id-da-presell&gt;</span>
                  —{" "}
                  <span className="text-foreground/90 font-medium">
                    {hasVerifiedCustomDomain
                      ? "no teu domínio verificado ou no dclickora, conforme a conta"
                      : "no domínio dclickora"}
                  </span>
                  . O link do produto que cola acima só serve para gerar conteúdo e para o clique final na oferta;{" "}
                  <span className="font-medium text-card-foreground">não</span> é o URL de destino do anúncio. O anúncio deve
                  usar o link público com <span className="font-mono text-[11px]">/p/</span> — ao concluir a criação, esse
                  link é copiado automaticamente para a área de transferência.
                </p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>A ferramenta acessa o link do produto e extrai textos e imagens.</li>
                  <li>Monta uma página estruturada (não é cópia idêntica do site do produtor).</li>
                  <li>
                    Para <span className="text-foreground font-medium">VSL + TSL (Combo)</span>, a página pública mostra o
                    vídeo no topo e a carta de vendas completa abaixo. Para <span className="text-foreground font-medium">VSL</span>{" "}
                    só, o destaque é o vídeo e os botões (sem repetir a carta longa abaixo). O vídeo é detetado no import quando
                    possível.
                  </li>
                  <li>
                    O link público (com <span className="font-mono text-[11px]">/p/</span>) fica copiado após criar; na lista
                    pode voltar a <span className="text-foreground font-medium">Copiar</span> para anúncios.
                  </li>
                </ol>
              </>
            )}
          </div>
        ) : null}

        <div className="bg-card rounded-xl shadow-card border border-border/50 w-full overflow-hidden">
          <div className="px-4 py-4 sm:px-6 sm:py-4 border-b border-border/50">
            <h2 className="font-semibold text-card-foreground">Dados obrigatórios</h2>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="productLink">Link do produto</Label>
              <Input
                id="productLink"
                type="url"
                placeholder="https://... (link da oferta ou de afiliado da rede)"
                value={formData.productLink}
                onChange={(e) => updateField("productLink", e.target.value)}
                className={formErrors.productLink ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              <FieldError message={formErrors.productLink} />
              <p className="text-xs text-muted-foreground">
                Link público da oferta (não use localhost). Página em inglês: escolha English no idioma.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2 min-w-0">
                <Label>Idioma</Label>
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
              <div className="space-y-2 min-w-0">
                <Label>Tipo da presell</Label>
                <Select value={formData.presellType} onValueChange={(v) => updateField("presellType", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {presellTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2 min-w-0">
                <Label htmlFor="pageName">Nome da página</Label>
                <Input
                  id="pageName"
                  placeholder="Ex.: Oferta Suplemento X"
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
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor="pageSlug">Endereço (slug)</Label>
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
                  Pré-visualização do caminho:{" "}
                  <span className="font-mono text-foreground/90 break-all" title={presellUrlPreview.fullUrl}>
                    {presellUrlPreview.prefix}
                    {presellUrlPreview.pathLabel}
                  </span>
                  {!hasVerifiedCustomDomain ? (
                    <span className="block mt-1 text-[11px] leading-snug">
                      Com domínio personalizado verificado, <code className="text-[10px] bg-muted px-1 rounded">/p/seu-endereco</code>{" "}
                      funciona no teu site. No dclickora, o link copiado na lista usa <code className="text-[10px] bg-muted px-1 rounded">/p/</code> com o ID da página.
                    </span>
                  ) : null}
                </p>
              </div>
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
                  O URL copiado e usado nos anúncios segue este domínio; se escolher o padrão, usa o marcado como padrão em
                  Configurações.
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 p-4 sm:p-5 space-y-4 text-left w-full min-w-0">
              <p className="text-sm font-medium text-card-foreground">Opções do tipo (respeitadas na página pública)</p>
              <p className="text-xs text-muted-foreground">
                O link do produto continua sendo o que você colou acima; os campos abaixo só alteram o que o visitante vê
                na presell e as regras para liberar o botão da oferta.
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
              {formData.presellType === "idade" ? (
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
              {["sexo", "grupo_homem", "grupo_mulher", "pais", "captcha", "modelos"].includes(formData.presellType) ? (
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
        </div>

        {trackingEmbedScript ? (
          <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-card-foreground">Rastreamento Clickora: </span>
            o script da tua conta é incluído automaticamente em «Código no head» ao guardar (e ao abrir uma presell
            nova). Podes acrescentar Google, Meta ou outros scripts na secção opcional abaixo.
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            Inicia sessão para associar o rastreamento Clickora à presell ao guardar.
          </div>
        )}

        <div className="space-y-2">
          <Collapsible open={openSections["advanced"]} onOpenChange={() => toggleSection("advanced")}>
            <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 bg-card rounded-xl px-4 py-4 sm:px-6 border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer text-left min-w-0">
              <span className="font-medium text-card-foreground">Opcional: configurações e rastreamento</span>
              {openSections["advanced"] ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-card rounded-b-xl px-4 py-4 sm:px-6 border-x border-b border-border/50 space-y-6 w-full min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Popup de saída</p>
                    <p className="text-xs text-muted-foreground">Ao tentar sair da página</p>
                  </div>
                  <Switch
                    checked={configSettings.exitPopup}
                    onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, exitPopup: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Contagem regressiva</p>
                    <p className="text-xs text-muted-foreground">Urgência com timer</p>
                  </div>
                  <Switch
                    checked={configSettings.countdownTimer}
                    onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, countdownTimer: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Prova social</p>
                    <p className="text-xs text-muted-foreground">Notificações de compras</p>
                  </div>
                  <Switch
                    checked={configSettings.socialProof}
                    onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, socialProof: v }))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div className="space-y-2 min-w-0">
                    <Label>Google Analytics / tag</Label>
                    <Input
                      placeholder="ID ou snippet curto"
                      value={configSettings.googleTrackingCode}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, googleTrackingCode: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label>Conversão Google Ads (opcional)</Label>
                    <Input
                      placeholder="AW-…/…"
                      value={configSettings.googleConversionEvent}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, googleConversionEvent: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label>Pixel Facebook</Label>
                    <Input
                      placeholder="ID do pixel"
                      value={configSettings.fbPixelId}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, fbPixelId: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-4 border-t border-border/50 pt-6">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Scripts na página pública</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      O script Clickora da conta é aplicado ao <span className="text-foreground/90">head</span> ao guardar
                      (atualiza com o teu utilizador e o URL da API). Podes acrescentar aqui outros scripts (ex. SmartClick). Os{" "}
                      <span className="text-foreground/90">&lt;script&gt;</span> executam na presell — cabeçalho, início do
                      corpo e rodapé no fim do <span className="text-foreground/90">documento</span>.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                    <div className="space-y-2 min-w-0">
                      <Label className="text-sm">Script Clickora (rastreamento)</Label>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Este <span className="font-mono text-[11px]">&lt;script&gt;</span> é o mesmo que vai para{" "}
                        <span className="font-medium text-foreground/90">Código no &lt;head&gt;</span> ao guardar (conta
                        impressões, cliques e conversões; <span className="font-mono text-[11px]">data-id</span> = o teu
                        utilizador). Copia só se precisares noutro sítio.
                      </p>
                      {trackingEmbedScript ? (
                        <div className="space-y-2">
                          <Textarea
                            readOnly
                            rows={3}
                            value={trackingEmbedScript}
                            className="font-mono text-xs min-h-[4.5rem] bg-muted/30 border-border/80"
                            aria-label="Script de rastreamento Clickora"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              navigator.clipboard.writeText(trackingEmbedScript);
                              setCopiedTrackingScript(true);
                              setTimeout(() => setCopiedTrackingScript(false), 2000);
                              toast.success("Script copiado.");
                            }}
                          >
                            {copiedTrackingScript ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedTrackingScript ? "Copiado" : "Copiar script"}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2">
                          Inicia sessão para gerar o teu script de rastreamento.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 min-w-0 lg:border-l lg:border-border/50 lg:pl-8">
                      <Label htmlFor="headerCode" className="text-sm">
                        Código no &lt;head&gt;
                      </Label>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        O Clickora é antecipado automaticamente; edita ou acrescenta outros scripts (pixels, SmartClick,
                        etc.) se precisares.
                      </p>
                      <Textarea
                        id="headerCode"
                        rows={3}
                        placeholder={`<script src="…/track/v2/clickora.min.js" data-id="…"></script>`}
                        value={configSettings.headerCode}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, headerCode: e.target.value }))}
                        className="font-mono text-xs min-h-[4.5rem]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="bodyCode">Código no início do conteúdo</Label>
                    <Textarea
                      id="bodyCode"
                      rows={2}
                      placeholder="Opcional — pixels ou scripts que costumam ir logo após &lt;body&gt;"
                      value={configSettings.bodyCode}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, bodyCode: e.target.value }))}
                      className="font-mono text-xs min-h-[3.5rem]"
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="footerCode">Código no rodapé (fim da página)</Label>
                    <Textarea
                      id="footerCode"
                      rows={3}
                      placeholder={`Opcional — ex.: segundo script ou tag antes de </body>`}
                      value={configSettings.footerCode}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, footerCode: e.target.value }))}
                      className="font-mono text-xs min-h-[4.5rem]"
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="customCss">CSS personalizado (opcional)</Label>
                    <Textarea
                      id="customCss"
                      rows={3}
                      placeholder=".minha-classe { ... }"
                      value={configSettings.customCss}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, customCss: e.target.value }))}
                      className="font-mono text-xs min-h-[3.5rem]"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
      </div>
    );
  }

  if (isLoading) return <LoadingState message="Carregando suas presells..." />;
  if (isError) return <ErrorState message="Erro ao carregar presells." onRetry={() => refetch()} />;

  if (pages.length === 0) {
    return (
      <EmptyState
        title="Nenhuma presell criada"
        description={isAdmin ? "Cole o link do produto, escolha idioma e tipo — a página completa é gerada automaticamente." : "Crie a primeira página para começar."}
        actionLabel="Criar presell"
        onAction={() => {
          resetForm({ presetCustomDomain: true });
          setShowCreator(true);
        }}
        icon={<FileText className="h-8 w-8 text-muted-foreground" />}
      />
    );
  }

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Lista de páginas Presell"
        description={isAdmin ? "Gerencie, duplique e publique suas páginas em um único lugar." : undefined}
        actions={
          <Button
            onClick={() => {
              resetForm({ presetCustomDomain: true });
              setShowCreator(true);
            }}
            className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Criar nova Presell
          </Button>
        }
      />

      {isAdmin ? (
        <div className="rounded-xl border border-border/50 bg-muted/25 px-4 py-4 sm:px-5 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-card-foreground">Por que uma presell?</p>
          <p>
            Para muitos afiliados que promovem ofertas internacionais, o anúncio leva primeiro a uma{" "}
            <span className="text-foreground/90 font-medium">página sua</span> (presell), que contextualiza o produto e só
            depois encaminha para o <span className="text-foreground/90 font-medium">link oficial da oferta</span>. Redes como
            o Google Ads avaliam destino, transparência e consistência com o anúncio — enviar tráfego direto para certas URLs
            do produtor pode ser restrito ou reprovado; uma presell no seu domínio é uma forma comum de cumprir esse fluxo.
          </p>
          <p className="text-xs leading-relaxed border-t border-border/50 pt-3 mt-3">
            <span className="font-medium text-card-foreground">Importante:</span> a aprovação e a veiculação dependem das{" "}
            <span className="text-foreground/90">políticas atuais</span> da rede, do criativo, da página e da sua conta. A
            dclickora ajuda a criar a página intermediária;{" "}
            <span className="text-foreground/90">não garante aprovação</span> nem substitui a leitura das regras oficiais
            (ex.: Google Ads).
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
        verificado, o dclickora ou o que estiver na conta). O «endereço» (slug) no formulário é só nome interno. O link do
        produto (afiliado) não substitui este URL — fica no botão da presell.{" "}
        <Code2 className="inline h-3 w-3 align-text-bottom opacity-80" aria-hidden />{" "}
        <span className="font-medium text-card-foreground">Copiar HTML</span> (bloco para o Elementor);{" "}
        <Download className="inline h-3 w-3 align-text-bottom opacity-80" aria-hidden />{" "}
        <span className="font-medium text-card-foreground">Descarregar .html</span> (página completa com &lt;html&gt;).
      </p>

      <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Nome da página</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo da Presell</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Link público</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
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
                  <td className="py-3 px-4 text-muted-foreground">{page.type}</td>
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
                    <button
                      onClick={() => toggleStatus(page)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${page.status === "published" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                    >
                      {page.status === "published" ? "Habilitado" : "Desabilitado"}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditClick(page)}
                        disabled={isLoadingEdit}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
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
                        title="Copiar HTML para colar no Elementor (widget HTML)"
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
                      <button
                        onClick={() => duplicateMutation.mutate(page.id)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Duplicar"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(page.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
    </div>
  );
}
