import { useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { presellService } from "@/services/presellService";
import { customDomainService } from "@/services/customDomainService";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { getPublicPresellFullUrl } from "@/lib/publicPresellOrigin";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { exportPageToHtml } from "@/page-builder/export-html";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const tenantKey = user?.id ?? "";
  const [searchTerm, setSearchTerm] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      toast.success("Página removida.");
    },
    onError: () => toast.error("Erro ao remover a página."),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Presell["status"] }) =>
      presellService.toggleStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["presells"] }),
  });

  const handleEdit = (page: Presell) => {
    navigate(`/presell/builder/${page.id}`);
  };

  const handleDelete = (page: Presell) => {
    if (!confirm(`Remover «${page.title}»? Esta ação não pode ser desfeita.`)) return;
    deleteMutation.mutate(page.id);
  };

  const handleCopyPublicLink = (page: Presell) => {
    const url = getPublicPresellFullUrl(customDomains, page.custom_domain_id, page);
    navigator.clipboard.writeText(url);
    setCopiedId(page.id);
    toast.success("Link público copiado.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadFresh = async (id: string) => {
    const { data, error } = await presellService.getById(id);
    if (error || !data) {
      toast.error(error || "Não foi possível carregar a página.");
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
      const doc = parsePresellBuilderPageDocument(data.content);
      if (!doc) {
        toast.error("Documento do editor em falta.");
        return;
      }
      const html = exportPageToHtml(doc);
      await navigator.clipboard.writeText(html);
      toast.success("HTML copiado para a área de transferência.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao copiar HTML.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadHtml = async (page: Presell) => {
    setBusyId(page.id);
    try {
      const data = await loadFresh(page.id);
      if (!data) return;
      const doc = parsePresellBuilderPageDocument(data.content);
      if (!doc) {
        toast.error("Documento do editor em falta.");
        return;
      }
      const html = exportPageToHtml(doc);
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
      toast.success("Ficheiro HTML descarregado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar HTML.");
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
        toast.error("Documento do editor em falta.");
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
      toast.success("JSON descarregado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar JSON.");
    } finally {
      setBusyId(null);
    }
  };

  if (!tenantKey) {
    return (
      <div className={APP_PAGE_SHELL}>
        <PageHeader title="Páginas criadas" description="Inicie sessão para ver as suas páginas." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={APP_PAGE_SHELL}>
        <LoadingState message="A carregar páginas…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={APP_PAGE_SHELL}>
        <ErrorState title="Não foi possível carregar" onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Páginas criadas"
        description="Páginas montadas no editor manual (multiconta: só vê as da sua sessão). Visualize, edite, exporte ou remova."
        actions={
          <Button type="button" className="gap-2" onClick={() => navigate("/presell/builder")}>
            <LayoutGrid className="h-4 w-4" />
            Novo no editor
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-4">
        <div className="rounded-xl border border-border/50 bg-card/80 p-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Cada conta (afiliado ou assinante) tem a sua própria lista. Os dados vêm do servidor após iniciar sessão —
            não se misturam entre utilizadores.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground shrink-0">
            {filtered.length} página(s) manual(is)
            {manualPages.length !== pages.length ? ` · ${pages.length} presell(s) no total` : ""}
          </p>
          <Input
            placeholder="Buscar por nome, slug ou ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-w-0 sm:max-w-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={manualPages.length === 0 ? "Ainda não há páginas manuais" : "Nenhum resultado"}
            description={
              manualPages.length === 0
                ? "Crie uma página no editor manual e guarde na conta — ela aparecerá aqui."
                : "Ajuste o termo de busca."
            }
            actionLabel={manualPages.length === 0 ? "Abrir editor manual" : undefined}
            onAction={manualPages.length === 0 ? () => navigate("/presell/builder") : undefined}
          />
        ) : (
          <div className="bg-card rounded-xl shadow-card border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Página</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Link público</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((page) => {
                    const publicUrl = getPublicPresellFullUrl(customDomains, page.custom_domain_id, page);
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
                          <code className="text-[11px] text-primary break-all leading-snug">{publicUrl}</code>
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => handleCopyPublicLink(page)}
                              className="text-xs px-2 py-0.5 rounded bg-success/10 text-success font-medium hover:bg-success/20"
                            >
                              {copiedId === page.id ? <Check className="h-3 w-3" /> : "Copiar link"}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
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
                            {page.status === "published" ? "Publicada" : "Pausada"}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <a
                              href={publicUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground inline-flex"
                              title="Visualizar (abre o link público)"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleEdit(page)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Editar no construtor"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 inline-flex"
                                  title="Exportar"
                                >
                                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[13rem]">
                                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => handleCopyHtml(page)}>
                                  <Code2 className="h-4 w-4" />
                                  Copiar HTML
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => handleDownloadHtml(page)}>
                                  <Download className="h-4 w-4" />
                                  Descarregar .html
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => handleExportJson(page)}>
                                  <FileJson className="h-4 w-4" />
                                  Descarregar .json
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <button
                              type="button"
                              onClick={() => handleDelete(page)}
                              disabled={deleteMutation.isPending}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                              title="Remover"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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
