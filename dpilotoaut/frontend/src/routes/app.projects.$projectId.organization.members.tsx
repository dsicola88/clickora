import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Copy, Loader2, UserCog, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type OrganizationInviteRow,
  type OrganizationMemberRow,
  createOrganizationInvite,
  listOrganizationInvites,
  listProjectOrganizationMembers,
  removeProjectOrganizationMember,
  revokeOrganizationInvite,
  transferProjectOrganizationOwnership,
} from "@/server/organization.functions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/projects/$projectId/organization/members")({
  component: OrgMembersPage,
});

const roleLabel: Record<OrganizationMemberRow["role"], string> = {
  owner: "Owner",
  admin: "Administrador",
  member: "Membro",
  viewer: "Leitor",
};

function inviteRolePt(r: OrganizationInviteRow["role"]): string {
  if (r === "admin") return "Administrador";
  if (r === "viewer") return "Leitor";
  return "Membro";
}

function OrgMembersPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const listFn = useServerFn(listProjectOrganizationMembers);
  const removeFn = useServerFn(removeProjectOrganizationMember);
  const transferFn = useServerFn(transferProjectOrganizationOwnership);
  const createInvFn = useServerFn(createOrganizationInvite);
  const listInvFn = useServerFn(listOrganizationInvites);
  const revInvFn = useServerFn(revokeOrganizationInvite);

  const [rows, setRows] = useState<OrganizationMemberRow[] | null>(null);
  const [invites, setInvites] = useState<OrganizationInviteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferId, setTransferId] = useState<string>("");
  const [invRole, setInvRole] = useState<"member" | "viewer" | "admin">("member");
  const [invEmail, setInvEmail] = useState("");
  const [invDays, setInvDays] = useState(7);
  const [invBusy, setInvBusy] = useState(false);

  const isOwner = useMemo(
    () => (rows ?? []).some((r) => r.is_you && r.role === "owner"),
    [rows],
  );
  const canManageInvites = useMemo(
    () => (rows ?? []).some((r) => r.is_you && (r.role === "owner" || r.role === "admin")),
    [rows],
  );

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await listFn({ data: { projectId } });
      setRows(data);
      if (data.some((r) => r.is_you && (r.role === "owner" || r.role === "admin"))) {
        try {
          const list = await listInvFn({ data: { projectId } });
          setInvites(list);
        } catch {
          setInvites([]);
        }
      } else {
        setInvites(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro a carregar a equipa.");
    } finally {
      setLoading(false);
    }
  }, [listFn, listInvFn, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRemove(m: OrganizationMemberRow) {
    if (!m.can_remove) return;
    const isLeave = m.action_label === "sair";
    if (
      !confirm(
        isLeave
          ? "Sair desta organização? Perde acesso a todos os projectos do workspace."
          : `Remover ${m.email} da organização?`,
      )
    ) {
      return;
    }
    setRemoving(m.id);
    try {
      const r = await removeFn({ data: { projectId, memberId: m.id } });
      toast.success(isLeave || r.left ? "Saiu da organização" : "Membro removido");
      if (r.left) {
        await navigate({ to: "/app", replace: true });
        return;
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível remover.";
      toast.error("Operação rejeitada", { description: msg });
    } finally {
      setRemoving(null);
    }
  }

  async function onTransfer() {
    if (!transferId) {
      toast.error("Escolha o novo owner.");
      return;
    }
    if (
      !confirm(
        "A sua função passará a Administrador. O membro escolhido passará a ser o único Owner. Continuar?",
      )
    ) {
      return;
    }
    try {
      await transferFn({ data: { projectId, newOwnerMemberId: transferId } });
      toast.success("Propriedade transferida");
      setTransferId("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na transferência");
    }
  }

  async function onCreateInvite() {
    setInvBusy(true);
    try {
      const row = await createInvFn({
        data: {
          projectId,
          role: invRole,
          emailConstraint: invEmail.trim() || undefined,
          expiresInDays: invDays,
        },
      });
      const full = `${window.location.origin}${row.invite_path}`;
      await navigator.clipboard.writeText(full);
      toast.success("Link do convite copiado para a área de transferência", {
        description: "Partilhe por um canal seguro. Uso único; expira na data indicada.",
      });
      setInvEmail("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o convite");
    } finally {
      setInvBusy(false);
    }
  }

  async function onRevokeInvite(id: string) {
    if (!confirm("Revogar este convite? O link deixa de funcionar.")) return;
    try {
      await revInvFn({ data: { projectId, inviteId: id } });
      toast.success("Convite revogado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const transferOptions = (rows ?? []).filter((r) => !r.is_you);

  return (
    <div className="pb-12">
      <PageHeader
        title="Equipa do workspace"
        description="Membros da organização, transferência de owner e convites com link (uso único)."
        badge={
          <Badge variant="secondary" className="gap-1">
            <Users className="h-3 w-3" />
            Acesso
          </Badge>
        }
      />
      <div className="space-y-10 px-6 sm:px-8">
        {error && (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            {error}
          </div>
        )}

        {isOwner && !loading && rows && transferOptions.length > 0 && (
          <section className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserCog className="h-4 w-4" />
              Transferir ownership
            </div>
            <p className="text-xs text-muted-foreground">
              Deixa de ser owner; o destino passa a owner único. Todos os outros owners
              (se existirem) passam a administradores.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1.5 sm:min-w-[220px]">
                <Label>Novo owner</Label>
                <Select value={transferId} onValueChange={setTransferId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher membro" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.email} ({roleLabel[m.role]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={onTransfer}>
                Transferir
              </Button>
            </div>
          </section>
        )}

        {canManageInvites && !loading && (
          <section className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
            <div className="text-sm font-medium">Novo convite (link de uso único)</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Função ao aceitar</Label>
                <Select
                  value={invRole}
                  onValueChange={(v) => setInvRole(v as "member" | "viewer" | "admin")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="viewer">Leitor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Restringir a e-mail (opcional)</Label>
                <Input
                  type="email"
                  placeholder="só@esta-conta.com"
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expira (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={invDays}
                  onChange={(e) => setInvDays(Math.min(90, Math.max(1, Number(e.target.value) || 7)))}
                />
              </div>
            </div>
            <Button type="button" onClick={onCreateInvite} disabled={invBusy}>
              {invBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar e copiar link"}
            </Button>
            {invites && invites.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Convites pendentes</p>
                <ul className="space-y-2 text-sm">
                  {invites.map((i) => (
                    <li
                      key={i.id}
                      className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/50 p-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <span className="font-medium">
                          {inviteRolePt(i.role)} · {new Date(i.expires_at).toLocaleString()}
                        </span>
                        {i.email_constraint && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            só {i.email_constraint}
                          </span>
                        )}
                        <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">
                          {typeof window !== "undefined"
                            ? `${window.location.origin}${i.invite_path}`
                            : i.invite_path}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const u =
                              (typeof window !== "undefined" ? window.location.origin : "") +
                              i.invite_path;
                            void navigator.clipboard.writeText(u);
                            toast.success("Copiado");
                          }}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copiar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => onRevokeInvite(i.id)}
                        >
                          Revogar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {loading || rows === null ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="w-[120px] text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">
                      {m.email}
                      {m.is_you && (
                        <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{m.full_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {roleLabel[m.role] ?? m.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {m.can_remove && m.action_label && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            m.action_label === "remover" && "text-destructive hover:text-destructive",
                          )}
                          disabled={removing === m.id}
                          onClick={() => onRemove(m)}
                        >
                          {removing === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : m.action_label === "sair" ? (
                            "Sair"
                          ) : (
                            "Remover"
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          A remoção revoga acesso a todos os projectos do workspace, mas não apaga a conta de
          utilizador. Convites: cada link só pode ser usado uma vez; pode restringir a um e-mail.
        </p>
      </div>
    </div>
  );
}
