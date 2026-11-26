import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill } from "@/i18n";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Pencil,
  Trash2,
  Download,
  Code2,
  FileJson,
  Loader2,
  LayoutGrid,
  Check,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { presellService } from "@/services/presellService";
import { customDomainService } from "@/services/customDomainService";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { tenantQueryKey } from "@/lib/tenantQueryKey";
import { userCanWritePresells } from "@/lib/workspaceCapabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { resolveTrackApiBaseForExport } from "@/lib/apiOrigin";
import { getPublicPresellFullUrl, PUBLIC_DOMAIN_REQUIRED_MESSAGE } from "@/lib/publicPresellOrigin";
import { buildGoogleAdsPresellCopyUrl, presellAdsCampaignName } from "@/lib/googleAdsPresellUrl";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { buildPresellStandaloneHtml } from "@/lib/presellExportHtml";
import {
  extractPageDocumentFromExportedHtml,
  parsePageDocumentFromJsonDetailed,
} from "@/page-builder/document-import";
import { id as builderId } from "@/page-builder/factory";
import type { Presell } from "@/types/api";

function sanitizeSlug(raw: string): string {
  const s = raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
  return s || "pagina";
}

export default function PresellManualPagesPage() {
  const { t } = useAppLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantKey = tenantQueryKey(user);
  const canWritePresells = userCanWritePresells(user);
  const [searchTerm, setSearchTerm] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  const { data: pages = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["presells", tenantKey],
    queryFn: async () => {
      const { data, error } = await presellService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!tenantKey,
  });

  const manualPages = useMemo(
    () => pages.filter((p) => p.type === "builder"),
    [pages],
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return manualPages;
    return manualPages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [manualPages, searchTerm]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => presellService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presells"] });
      toast.success(t("pages.manualPages.removed"));
    },
    onError: () => toast.error(t("pages.manualPages.removeError")),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Presell["status"] }) => {
      const { data, error } = await presellService.toggleStatus(id, status);
      if (error) throw new Error(error);
      const blocked = data as { compliance_blocked?: boolean; message?: string; compliance?: { error?: string } } | null;
      if (blocked?.compliance_blocked) {
        throw new Error(
          blocked.compliance?.error ||
            blocked.message ||
            t("pages.manualPages.publishBlocked"),
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presells"] });
      toast.success(t("pages.manualPages.statusUpdated"));
    },
    onError: (e: Error) => {
      toast.error(e.message || t("pages.manualPages.statusError"));
    },
  });

  const handleEdit = (page: Presell) => {
    if (!canWritePresells) {
      toast.error(t("pages.manualPages.noPermission"));
      return;
    }
    navigate(`/presell/builder/${page.id}`);
  };

  const handleDelete = (page: Presell) => {
    if (!canWritePresells) return;
    if (!confirm(fill(t("pages.manualPages.deleteConfirm"), { title: page.title }))) return;
    deleteMutation.mutate(page.id);
  };

  const handleCopyAdsUrl = (page: Presell) => {
    if (page.status !== "published") {
      toast.error(t("pages.presells.toastPublishBeforeCopy"));
      return;
    }
    const base = getPublicPresellFullUrl(customDomains, page.custom_domain_id, page);
    const url = buildGoogleAdsPresellCopyUrl(base, presellAdsCampaignName(page.title, page.slug), "Google Ads");
    if (!url) {
      toast.error(PUBLIC_DOMAIN_REQUIRED_MESSAGE);
      return;
    }
    void navigator.clipboard.writeText(url);
    setCopiedId(page.id);
    toast.success(t("pages.createPresell.copyCombinedUrlDone"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadFresh = async (id: string) => {
    const { data, error } = await presellService.getById(id);
    if (error || !data) {
      toast.error(error || t("pages.manualPages.loadError"));
      return null;
    }
    return data;
  };

  const handleCopyHtml = async (page: Presell) => {
    setBusyId(page.id);
    try {
      const data = await loadFresh(page.id);
      if (!data) return;
      const publicUrl = getPublicPresellFullUrl(customDomains, data.custom_domain_id, data);
      if (!parsePresellBuilderPageDocument(data.content)) {
        toast.error(t("pages.manualPages.docMissing"));
        return;
      }
      const html = buildPresellStandaloneHtml(data, {
        apiBase: resolveTrackApiBaseForExport(customDomains, publicUrl),
        publicPageUrl: publicUrl,
        format: "htmlWidget",
      });
      await navigator.clipboard.writeText(html);
      toast.success(t("pages.manualPages.htmlCopied"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("pages.manualPages.htmlCopyError"));
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadHtml = async (page: Presell) => {
    setBusyId(page.id);
    try {
      const data = await loadFresh(page.id);
      if (!data) return;
      if (!parsePresellBuilderPageDocument(data.content)) {
        toast.error(t("pages.manualPages.docMissing"));
        return;
      }
      const publicUrl = getPublicPresellFullUrl(customDomains, data.custom_domain_id, data);
      const html = buildPresellStandaloneHtml(data, {
        apiBase: resolveTrackApiBaseForExport(customDomains, publicUrl),
        publicPageUrl: publicUrl,
        format: "document",
      });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${sanitizeSlug(data.slug || data.title || "pagina")}.html`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(t("pages.manualPages.htmlDownloaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("pages.manualPages.htmlGenerateError"));
    } finally {
      setBusyId(null);
    }
  };

  const handleExportJson = async (page: Presell) => {
    setBusyId(page.id);
    try {
      const data = await loadFresh(page.id);
      if (!data) return;
      const doc = parsePresellBuilderPageDocument(data.content);
      if (!doc) {
        toast.error(t("pages.manualPages.docMissing"));
        return;
      }
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sanitizeSlug(data.slug || data.title || "pagina")}.json`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("pages.manualPages.jsonDownloaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("pages.manualPages.jsonExportError"));
    } finally {
      setBusyId(null);
    }
  };

  /** JSON (ou HTML Clickora) → rascunho builder totalmente editável. */
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canWritePresells) return;
    setBusyId("import");
    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      let parsed =
        lower.endsWith(".html") || lower.endsWith(".htm")
          ? extractPageDocumentFromExportedHtml(text)
          : null;
      if (!parsed) {
        const detailed = parsePageDocumentFromJsonDetailed(text);
        if (detailed.ok === true) {
          parsed = detailed.doc;
        } else {
          toast.error(
            t(
              detailed.reason === "not_json"
                ? "pages.manualPages.importNotJson"
                : "pages.manualPages.importWrongShape",
            ),
          );
          return;
        }
      }
      const doc = {
        ...parsed,
        id: builderId("page_"),
        name: parsed.name?.trim() || t("pages.manualPages.importDefaultName"),
        updatedAt: Date.now(),
      };
      const slug = `${sanitizeSlug(doc.name)}_${Date.now().toString(36).slice(-4)}`;
      const content: Record<string, unknown> = {
        pageDocument: doc,
        editorWorkingDocument: doc,
        affiliateLink: "",
        manualVisualEdit: true,
      };
      const { data: created, error } = await presellService.create({
        title: doc.name,
        slug,
        type: "builder",
        category: "other",
        language: "en",
        content,
        settings: {},
        status: "draft",
      });
      if (error || !created?.id) {
        throw new Error(error || t("pages.manualPages.importCreateError"));
      }
      await queryClient.invalidateQueries({ queryKey: ["presells"] });
      toast.success(t("pages.manualPages.importOk"));
      navigate(`/presell/builder/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pages.manualPages.importFailed"));
    } finally {
      setBusyId(null);
    }
  };

  if (!tenantKey) {
    return (
      <div className={APP_PAGE_SHELL}>
        <PageHeader title={t("pages.manualPages.title")} description={t("pages.manualPages.signIn")} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={APP_PAGE_SHELL}>
        <LoadingState message={t("pages.manualPages.loading")} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={APP_PAGE_SHELL}>
        <ErrorState message={t("pages.manualPages.loadPagesError")} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title={t("pages.manualPages.listTitle")}
        description={t("pages.manualPages.listDesc")}
        actions={
          canWritePresells ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".json,.html,.htm,application/json,text/html"
                className="sr-only"
                onChange={(ev) => void handleImportFile(ev)}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={busyId === "import"}
                onClick={() => importInputRef.current?.click()}
              >
                {busyId === "import" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {t("pages.manualPages.importJson")}
              </Button>
              <Button type="button" className="gap-2" onClick={() => navigate("/presell/builder")}>
                <LayoutGrid className="h-4 w-4" />
                {t("pages.manualPages.newInEditor")}
              </Button>
            </div>
          ) : null
        }
      />

      <div className="mt-6 flex flex-col gap-4">
        <div className="rounded-xl border border-border/50 bg-card/80 p-4 text-sm text-muted-foreground">
          <p>{t("pages.manualPages.sessionNote")}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground shrink-0">
            {fill(t("pages.manualPages.count"), { n: filtered.length })}
            {manualPages.length !== pages.length
              ? fill(t("pages.manualPages.countTotal"), { n: pages.length })
              : ""}
          </p>
          <Input
            placeholder={t("pages.manualPages.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-w-0 sm:max-w-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={manualPages.length === 0 ? t("pages.manualPages.emptyTitle") : t("pages.manualPages.noResults")}
            description={
              manualPages.length === 0
                ? t("pages.manualPages.emptyDesc")
                : t("pages.manualPages.adjustSearch")
            }
            actionLabel={manualPages.length === 0 && canWritePresells ? t("pages.manualPages.openEditor") : undefined}
            onAction={manualPages.length === 0 && canWritePresells ? () => navigate("/presell/builder") : undefined}
          />
        ) : (
          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("pages.manualPages.colPage")}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("pages.presells.colPublicLink")}</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t("common.status")}</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t("pages.manualPages.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((page) => {
                    const lander = getPublicPresellFullUrl(customDomains, page.custom_domain_id, page);
                    const busy = busyId === page.id;
                    return (
                      <tr key={page.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">{page.title}</span>
                            <span className="text-[11px] text-muted-foreground">slug: {page.slug}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-[min(100vw,20rem)]">
                          {lander ? (
                            <code className="text-[11px] text-primary break-all leading-snug">{lander}</code>
                          ) : (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
                              {PUBLIC_DOMAIN_REQUIRED_MESSAGE}
                            </span>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={page.status !== "published"}
                              onClick={() => handleCopyAdsUrl(page)}
                              className="text-xs px-2 py-0.5 rounded bg-success/10 text-success font-medium hover:bg-success/20 disabled:opacity-40"
                            >
                              {copiedId === page.id ? <Check className="h-3 w-3 inline" /> : null}{" "}
                              {t("pages.createPresell.copyCombinedUrl")}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {canWritePresells ? (
                            <button
                              type="button"
                              onClick={() =>
                                toggleMutation.mutate({
                                  id: page.id,
                                  status: page.status === "published" ? "paused" : "published",
                                })
                              }
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                                page.status === "published"
                                  ? "bg-success/10 text-success"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {page.status === "published" ? t("common.published") : t("common.paused")}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                page.status === "published"
                                  ? "bg-success/10 text-success"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {page.status === "published" ? t("common.published") : t("common.paused")}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <a
                              href={lander}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground inline-flex"
                              title={t("pages.manualPages.viewTitle")}
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                            {canWritePresells ? (
                              <button
                                type="button"
                                onClick={() => handleEdit(page)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title={t("pages.manualPages.editTitle")}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            ) : null}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 inline-flex"
                                  title={t("pages.manualPages.exportTitle")}
                                >
                                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[13rem]">
                                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => handleCopyHtml(page)}>
                                  <Code2 className="h-4 w-4" />
                                  {t("pages.manualPages.copyHtml")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => handleDownloadHtml(page)}>
                                  <Download className="h-4 w-4" />
                                  {t("pages.manualPages.downloadHtml")}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => handleExportJson(page)}>
                                  <FileJson className="h-4 w-4" />
                                  {t("pages.manualPages.downloadJson")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {canWritePresells ? (
                              <button
                                type="button"
                                onClick={() => handleDelete(page)}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                                title={t("pages.manualPages.removeTitle")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
