import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LandingEditorView } from "@/components/landing/LandingEditor";
import {
  getDefaultLandingDocument,
  parseLandingDocument,
  type LandingDocument,
} from "@/lib/landing-document";
import { getLandingPageAdmin, saveLandingPage } from "@/server/landing.functions";

export function LandingPageEditScreen({
  landingId,
  backToProjectId,
}: {
  landingId: string;
  /** Se definido, mostra ligação «Voltar» à lista de páginas do projeto. */
  backToProjectId?: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const load = useServerFn(getLandingPageAdmin);
  const save = useServerFn(saveLandingPage);
  const router = useRouter();

  const [meta, setMeta] = useState<{
    name: string;
    slug: string;
    isPublished: boolean;
    access: "read" | "write";
    organizationName: string;
  } | null>(null);
  const [doc, setDoc] = useState<LandingDocument | null>(null);
  const [theme, setTheme] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await load({ data: { id: landingId } });
      if (!r) {
        setMeta(null);
        setDoc(null);
        return;
      }
      setMeta({
        name: r.name,
        slug: r.slug,
        isPublished: r.isPublished,
        access: r.access,
        organizationName: r.organizationName,
      });
      setDoc(
        r.document && typeof r.document === "object"
          ? parseLandingDocument(r.document)
          : getDefaultLandingDocument(),
      );
      setTheme(
        r.theme && typeof r.theme === "object" && r.theme !== null
          ? (r.theme as Record<string, unknown>)
          : { primary: "hsl(142 70% 45%)", contentWidth: "max-w-5xl" },
      );
    } finally {
      setLoading(false);
    }
  }, [load, landingId]);

  useEffect(() => {
    if (authLoading || !user) return;
    void refresh();
  }, [user, authLoading, refresh]);

  const onSave = async () => {
    if (!doc || !meta) return;
    if (meta.access === "read") {
      toast.error("Só pode visualizar esta página. Peça a um responsável da conta para editar.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          id: landingId,
          name: meta.name,
          slug: meta.slug,
          isPublished: meta.isPublished,
          document: doc,
          theme,
        },
      });
      toast.success("Guardado");
      await router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-40 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meta || !doc) {
    return <p className="p-6 text-sm text-destructive">Página não encontrada ou sem acesso.</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {backToProjectId && (
        <div className="shrink-0 border-b border-border/60 px-4 py-2 sm:px-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/projects/$projectId/landings" params={{ projectId: backToProjectId }}>
              ← Voltar às páginas de venda
            </Link>
          </Button>
        </div>
      )}
      <div className="shrink-0 border-b border-border bg-card/50 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <p className="w-full text-xs text-muted-foreground lg:max-w-md">
            Conta: <strong className="text-foreground">{meta.organizationName}</strong>
            {meta.access === "read" && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5">Apenas leitura</span>
            )}
          </p>
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs">Nome (só na app)</Label>
              <Input
                className="mt-1"
                value={meta.name}
                disabled={meta.access === "read"}
                onChange={(e) => setMeta((m) => (m ? { ...m, name: e.target.value } : m))}
              />
            </div>
            <div>
              <Label className="text-xs">Atalho (endereço público /l/… )</Label>
              <Input
                className="mt-1 font-mono text-sm"
                value={meta.slug}
                disabled={meta.access === "read"}
                onChange={(e) =>
                  setMeta((m) => (m ? { ...m, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") } : m))
                }
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch
                checked={meta.isPublished}
                disabled={meta.access === "read"}
                onCheckedChange={(c) => setMeta((m) => (m ? { ...m, isPublished: c } : m))}
                id="pub"
              />
              <Label htmlFor="pub" className="text-sm">
                Publicar
              </Label>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label className="text-xs">Cor de destaque (cor em texto ou HSL)</Label>
              <Input
                className="mt-1 font-mono text-sm"
                value={String(theme?.primary ?? "")}
                disabled={meta.access === "read"}
                onChange={(e) => setTheme((t) => ({ ...t, primary: e.target.value }))}
                placeholder="hsl(142 70% 45%)"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label className="text-xs">Largura máxima do conteúdo (avançado)</Label>
              <Input
                className="mt-1 font-mono text-sm"
                value={String(theme?.contentWidth ?? "max-w-5xl")}
                disabled={meta.access === "read"}
                onChange={(e) => setTheme((t) => ({ ...t, contentWidth: e.target.value }))}
                placeholder="max-w-5xl"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void onSave()} disabled={saving || meta.access === "read"}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Guardar
            </Button>
            {meta.isPublished && (
              <Button variant="outline" asChild>
                <a href={`/l/${meta.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir pública
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <LandingEditorView
          doc={doc}
          onChangeDoc={setDoc}
          theme={theme}
          readOnly={meta.access === "read"}
        />
      </div>
    </div>
  );
}
