import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createLandingPage,
  deleteLandingPage,
  listLandingPages,
} from "@/server/landing.functions";
import { getProjectWithOrg } from "@/server/app-data.functions";

export const Route = createFileRoute("/app/projects/$projectId/landings/")({
  component: ProjectLandingsList,
});

function ProjectLandingsList() {
  const { projectId } = Route.useParams();
  const router = useRouter();
  const load = useServerFn(listLandingPages);
  const create = useServerFn(createLandingPage);
  const del = useServerFn(deleteLandingPage);
  const fetchProject = useServerFn(getProjectWithOrg);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<
    | {
        id: string;
        name: string;
        slug: string;
        isPublished: boolean;
        updatedAt: Date;
        organization: { name: string; slug: string } | null;
      }[]
    | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Nova página");
  const [slug, setSlug] = useState("comercial");

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const r = await load({ data: { organizationId: orgId } });
      setRows(r);
    } finally {
      setLoading(false);
    }
  }, [load, orgId]);

  useEffect(() => {
    void (async () => {
      const p = await fetchProject({ data: { projectId } });
      if (p) setOrgId(p.organization_id);
    })();
  }, [projectId, fetchProject]);

  useEffect(() => {
    if (orgId) void refresh();
  }, [orgId, refresh]);

  const onCreate = async () => {
    if (!orgId) return;
    const s = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "");
    if (s.length < 2) {
      toast.error("Endereço inválido (mín. 2 caracteres: letras, números, hífen).");
      return;
    }
    try {
      const { id } = await create({ data: { name, slug: s, organizationId: orgId } });
      toast.success("Página criada");
      await router.navigate({
        to: "/app/projects/$projectId/landings/$landingId",
        params: { projectId, landingId: id },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Páginas de venda do seu projecto</h1>
        <p className="text-sm text-muted-foreground">
          Só a sua equipa (esta conta) vê e edita estes conteúdos. O endereço público fica em{" "}
          <code className="text-xs">/l/atalho</code> após publicar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criar página</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label className="text-xs">Nome (só na app)</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-full sm:max-w-xs">
            <Label className="text-xs">Atalho (URL pública)</Label>
            <Input
              className="mt-1 font-mono text-sm"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ex.: planos-2025"
            />
          </div>
          <Button type="button" onClick={() => void onCreate()} disabled={!orgId}>
            <Plus className="mr-1.5 h-4 w-4" /> Criar e editar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Páginas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
            </div>
          )}
          {rows && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Atalho</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="w-[200px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      Nenhuma página ainda.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <code className="text-xs">{r.slug}</code>
                    </TableCell>
                    <TableCell className="text-sm">{r.isPublished ? "Publicada" : "Rascunho"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.updatedAt).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="secondary" asChild>
                          <Link
                            to="/app/projects/$projectId/landings/$landingId"
                            params={{ projectId, landingId: r.id }}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                          </Link>
                        </Button>
                        {r.isPublished && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/l/${r.slug}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1 h-3.5 w-3.5" />
                              Ver
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (!confirm("Apagar esta página?")) return;
                            void (async () => {
                              try {
                                await del({ data: { id: r.id } });
                                toast.success("Removida");
                                void refresh();
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Erro");
                              }
                            })();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
