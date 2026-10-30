import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { PresellBuilderEmbedProvider } from "@/contexts/PresellBuilderEmbedContext";
import { adminService } from "@/services/adminService";
import { asSalesPageDocument, createDefaultSalesLandingDocument } from "@/lib/salesLandingBuilderDoc";
import { coerceLandingExtras } from "@/lib/plansLandingExtras";
import { setPageBuilderStorageKey, useBuilder } from "@/page-builder/store";
import type { PageDocument } from "@/page-builder/types";
import "@/page-builder/page-builder-theme.css";
import {
  EditorChromeThemeProvider,
  useEditorChromeThemeContext,
} from "@/page-builder/EditorChromeThemeContext";

const PageEditor = lazy(() =>
  import("@/page-builder/components/PageEditor").then((m) => ({ default: m.PageEditor })),
);

const STORAGE_KEY = "clickora:sales-landing-builder:v1";
const ADMIN_KEY = ["admin-plans-landing"] as const;
const PUBLIC_KEY = ["plans-landing-public"] as const;

function readLocalDraft(): PageDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return asSalesPageDocument(JSON.parse(raw));
  } catch {
    return null;
  }
}

export default function AdminSalesPageBuilderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [editorReady, setEditorReady] = useState(false);
  const lastCloudDocJsonRef = useRef("");

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperAdmin) {
      toast.error("Apenas o super administrador pode editar a página de vendas.");
      navigate("/admin/plans", { replace: true });
    }
  }, [authLoading, isSuperAdmin, navigate]);

  useEffect(() => {
    setPageBuilderStorageKey(STORAGE_KEY);
  }, []);

  const landingQuery = useQuery({
    queryKey: ADMIN_KEY,
    queryFn: async () => {
      const { data, error } = await adminService.getPlansLanding();
      if (error) throw new Error(error);
      return data;
    },
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!landingQuery.isSuccess || !landingQuery.data) return;
    let cancelled = false;
    setEditorReady(false);

    const run = () => {
      const row = landingQuery.data;
      const extras = coerceLandingExtras(row?.landing_extras);
      const published = asSalesPageDocument(extras.page_document);
      const local = readLocalDraft();
      const doc =
        published ??
        local ??
        createDefaultSalesLandingDocument({
          heroTitle: row?.hero_title,
          heroSubtitle: row?.hero_subtitle ?? undefined,
        });

      if (cancelled) return;
      setPageBuilderStorageKey(STORAGE_KEY);
      useBuilder.getState().hydrateDocument(doc);
      lastCloudDocJsonRef.current = published ? JSON.stringify(published) : "";
      setEditorReady(true);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [landingQuery.isSuccess, landingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const doc = useBuilder.getState().doc;
      if (!doc.sections?.length) {
        throw new Error("Adicione pelo menos uma secção antes de publicar.");
      }
      const { data, error } = await adminService.patchPlansLanding({
        landing_extras: {
          builder_enabled: true,
          page_document: doc,
        },
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      lastCloudDocJsonRef.current = JSON.stringify(useBuilder.getState().doc);
      void queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
      void queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      toast.success("Página de vendas publicada.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível publicar.");
    },
  });

  const onRequestSave = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  const embedValue = useMemo(
    () => ({
      onRequestSave,
      isSaving: saveMutation.isPending,
      canSave: true,
    }),
    [onRequestSave, saveMutation.isPending],
  );

  if (authLoading || !isSuperAdmin) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-2 bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />A verificar permissões…
      </div>
    );
  }

  if (landingQuery.isError) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm text-destructive">
          {(landingQuery.error as Error)?.message || "Erro ao carregar a landing."}
        </p>
        <Button variant="outline" asChild>
          <Link to="/admin/plans">Voltar ao admin</Link>
        </Button>
      </div>
    );
  }

  if (!editorReady || landingQuery.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center gap-2 bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />A preparar o editor visual…
      </div>
    );
  }

  return (
    <PresellBuilderEmbedProvider value={embedValue}>
      <EditorChromeThemeProvider>
        <SalesBuilderChromeShell>
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-editor-border bg-editor-panel px-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 border-editor-border bg-editor-panel-2 text-editor-fg hover:bg-editor-border hover:text-editor-fg"
              onClick={() => navigate("/admin/plans")}
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Voltar
            </Button>
            <p className="min-w-0 flex-1 truncate text-xs text-editor-fg-muted sm:text-sm">
              Editor visual da página de vendas — arraste elementos à esquerda, edite à direita, publique.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 border-editor-border bg-editor-panel-2 text-editor-fg hover:bg-editor-border"
              asChild
            >
              <a href="/planos" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Ver no ar
              </a>
            </Button>
          </div>
          <div className="relative min-h-0 flex-1">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-editor-fg-muted">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />A carregar o editor…
                </div>
              }
            >
              <PageEditor />
            </Suspense>
          </div>
        </SalesBuilderChromeShell>
      </EditorChromeThemeProvider>
    </PresellBuilderEmbedProvider>
  );
}

function SalesBuilderChromeShell({ children }: { children: ReactNode }) {
  const { themeId } = useEditorChromeThemeContext();
  return (
    <div
      className="page-builder-scope fixed inset-0 z-[100] flex min-h-0 flex-col overflow-hidden bg-editor-bg text-editor-fg"
      data-editor-theme={themeId}
    >
      {children}
    </div>
  );
}
