import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/providers/AuthProvider";
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
  listOrganizationsForLanding,
} from "@/server/landing.functions";

export const Route = createFileRoute("/app/admin/landings/")({
  component: AdminLandingsList,
});

function AdminLandingsList() {
  const { user, loading: authLoading } = useAuth();
  const load = useServerFn(listLandingPages);
  const create = useServerFn(createLandingPage);
  const del = useServerFn(deleteLandingPage);
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
  const [name, setName] = useState("Nova landing");
  const [slug, setSlug] = useState("comercial");
  const [orgOptions, setOrgOptions] = useState<{ id: string; name: string }[]>([]);
  const [createOrgId, setCreateOrgId] = useState("");
  const router = useRouter();
  const listOrgs = useServerFn(listOrganizationsForLanding);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await load();
      setRows(r);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    if (authLoading || !user?.isPlatformAdmin) return;
    void refresh();
  }, [user, authLoading, refresh]);

  useEffect(() => {
    if (authLoading || !user?.isPlatformAdmin) return;
    void (async () => {
      try {
        const o = await listOrgs();
        setOrgOptions(o.map((x) => ({ id: x.id, name: x.name })));
        setCreateOrgId((prev) => {
          if (prev) return prev;
          return o[0]?.id ?? "";
        });
      } catch {
        setOrgOptions([]);
      }
    })();
  }, [user, authLoading, listOrgs]);

  const onCreate = async () => {
    const s = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "");
    if (s.length < 2) {
      toast.error("Endereço inválido (mín. 2 caracteres: letras, números, hífen).");
      return;
    }
    if (!createOrgId) {
      toast.error("Escolha a conta (organização) desta página.");
      return;
    }
    try {
      const { id } = await create({ data: { name, slug: s, organizationId: createOrgId } });
      toast.success("Landing criada");
      await router.navigate({ to: "/app/admin/landings/$landingId", params: { landingId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div
        className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground/90"
        role="status"
      >
        <p className="font-medium text-foreground">Páginas de venda e site público</p>
        <p className="mt-1.5 text-muted-foreground">
          A página inicial do site (endereço <strong>/</strong>) mostra a página pública cujo
          atalho se chama <strong>vendas</strong> (se o seu alojamento tiver outra regra, siga a
          configuração do fornecedor). Crie a página aqui, associe a uma conta, e use{" "}
          <strong>Publicar</strong> para a tornar visível. Cada página publicada fica acessível em{" "}
          <code className="rounded bg-muted/80 px-1.5 py-0.5 text-xs">/l/atalho-que-escolher</code>.
        </p>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Páginas de venda (editor)</h1>
        <p className="text-sm text-muted-foreground">
          Blocos, textos, preços, vídeos, formulário e ligação ao pagamento. Cada página pertence a
          uma conta (empresa) — só quem essa conta autorizar vê e edita. O endereço público fica em{" "}
          <code className="text-xs">/l/o-seu-atalho</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criar landing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-sm">
            <Label className="text-xs">Conta (quem possui a página)</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={createOrgId}
              onChange={(e) => setCreateOrgId(e.target.value)}
            >
              {orgOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <Label className="text-xs">Nome (só na app)</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-full sm:max-w-xs">
            <Label className="text-xs">Atalho do endereço público</Label>
            <Input
              className="mt-1 font-mono text-sm"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ex.: planos-2025"
            />
          </div>
          <Button type="button" onClick={() => void onCreate()}>
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
                  <TableHead>Conta</TableHead>
                  <TableHead>Atalho / URL</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="w-[200px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      Nenhuma página ainda. Crie uma acima.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.organization?.name ?? "—"}
                    </TableCell>
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
                          <Link to="/app/admin/landings/$landingId" params={{ landingId: r.id }}>
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
                            if (!confirm("Apagar esta landing?")) return;
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
