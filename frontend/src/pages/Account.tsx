import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { workspaceService, type WorkspaceMemberRow, type WorkspaceMineRow } from "@/services/workspaceService";
import { WORKSPACE_EXTRA_PERMS } from "@/lib/workspaceCapabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/PageHeader";
import { DASHBOARD_USER_GUIDE_DISMISSED_KEY } from "@/components/DashboardUserGuide";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { toast } from "sonner";
import { Camera, ChevronDown, ChevronUp, Loader2, Trash2, User, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";

function initials(name: string, email: string) {
  const n = name.trim();
  if (n.length >= 2) return n.slice(0, 2).toUpperCase();
  const e = email.slice(0, 2);
  return e.toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Dono",
  admin: "Administrador",
  member: "Membro",
  viewer: "Só leitura",
};

function WorkspaceTeamCard({ row }: { row: WorkspaceMineRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");

  const canManage = row.role === "owner" || row.role === "admin";

  const { data: members = [], isPending: loadingMembers } = useQuery({
    queryKey: ["workspace-members", row.workspace_id],
    queryFn: async () => {
      const { data, error } = await workspaceService.listMembers(row.workspace_id);
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: open,
  });

  const { data: audit = [], isFetching: loadingAudit } = useQuery({
    queryKey: ["workspace-audit", row.workspace_id],
    queryFn: async () => {
      const { data, error } = await workspaceService.audit(row.workspace_id, 30);
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: auditOpen,
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const email = inviteEmail.trim();
      if (!email) throw new Error("Indique o e-mail.");
      const { error } = await workspaceService.addMember(row.workspace_id, { email, role: inviteRole });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      toast.success("Membro adicionado. O utilizador pode alternar para este workspace após iniciar sessão.");
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["workspace-members", row.workspace_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await workspaceService.removeMember(row.workspace_id, userId);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      toast.success("Membro removido.");
      qc.invalidateQueries({ queryKey: ["workspace-members", row.workspace_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchPermsMut = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: string[] | null }) => {
      const { error } = await workspaceService.patchMemberPermissions(row.workspace_id, userId, { permissions });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      toast.success("Permissões actualizadas.");
      qc.invalidateQueries({ queryKey: ["workspace-members", row.workspace_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setExtraPerm = (m: WorkspaceMemberRow, perm: string, on: boolean) => {
    const cur = new Set(m.permissions ?? []);
    if (on) cur.add(perm);
    else cur.delete(perm);
    const next = [...cur];
    patchPermsMut.mutate({ userId: m.user_id, permissions: next.length ? next : null });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border/60 bg-muted/10">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="w-full h-auto py-3 px-4 flex flex-wrap items-center justify-between gap-2 text-left font-normal hover:bg-muted/30"
        >
          <div>
            <p className="font-medium text-foreground">{row.name}</p>
            <p className="text-xs text-muted-foreground">
              O seu papel: <span className="text-foreground/90">{ROLE_LABELS[row.role] ?? row.role}</span>
            </p>
          </div>
          {open ? <ChevronUp className="h-4 w-4 shrink-0 opacity-70" /> : <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-4">
        {loadingMembers ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="rounded-md border border-border/50 overflow-hidden text-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 px-3 font-medium">E-mail</th>
                    <th className="py-2 px-3 font-medium">Nome</th>
                    <th className="py-2 px-3 font-medium">Papel</th>
                    <th className="py-2 px-3 font-medium text-[10px] max-w-[200px]">
                      Escrita extra
                      <span className="block font-normal text-muted-foreground normal-case">(útil para «Só leitura»)</span>
                    </th>
                    {canManage ? <th className="py-2 px-3 font-medium w-[100px]" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id} className="border-t border-border/50">
                      <td className="py-2 px-3 text-xs break-all">{m.email}</td>
                      <td className="py-2 px-3 text-xs">{m.name?.trim() || "—"}</td>
                      <td className="py-2 px-3 text-xs">{ROLE_LABELS[m.role] ?? m.role}</td>
                      <td className="py-2 px-3 text-xs align-top">
                        {m.role === "owner" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : m.role === "viewer" && canManage ? (
                          <div className="flex flex-col gap-2 min-w-[140px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground">Integrações</span>
                              <Switch
                                checked={(m.permissions ?? []).includes(WORKSPACE_EXTRA_PERMS.integrations_write)}
                                disabled={patchPermsMut.isPending}
                                onCheckedChange={(c) => setExtraPerm(m, WORKSPACE_EXTRA_PERMS.integrations_write, c)}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground">Rotadores</span>
                              <Switch
                                checked={(m.permissions ?? []).includes(WORKSPACE_EXTRA_PERMS.rotators_write)}
                                disabled={patchPermsMut.isPending}
                                onCheckedChange={(c) => setExtraPerm(m, WORKSPACE_EXTRA_PERMS.rotators_write, c)}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] text-muted-foreground">Presells</span>
                              <Switch
                                checked={(m.permissions ?? []).includes(WORKSPACE_EXTRA_PERMS.presells_write)}
                                disabled={patchPermsMut.isPending}
                                onCheckedChange={(c) => setExtraPerm(m, WORKSPACE_EXTRA_PERMS.presells_write, c)}
                              />
                            </div>
                          </div>
                        ) : m.role === "viewer" ? (
                          <span className="text-[10px] text-muted-foreground">
                            {(m.permissions ?? []).length ? (m.permissions ?? []).join(", ") : "—"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {canManage ? (
                        <td className="py-2 px-3 text-right">
                          {m.role !== "owner" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-destructive"
                              disabled={removeMut.isPending}
                              onClick={() => {
                                if (confirm(`Remover ${m.email} deste workspace?`)) removeMut.mutate(m.user_id);
                              }}
                            >
                              Remover
                            </Button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canManage ? (
              <div className="space-y-2 rounded-md border border-border/50 p-3 bg-background/50">
                <Label className="text-xs text-muted-foreground">Convidar por e-mail</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Input
                    type="email"
                    placeholder="colega@empresa.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "member" | "viewer")}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="viewer">Só leitura</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" disabled={addMut.isPending} onClick={() => addMut.mutate()}>
                    {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convidar"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  O convidado precisa de uma conta Clickora. Para utilizadores «Só leitura», pode conceder escrita em
                  integrações, rotadores ou presells com os interruptores na tabela.
                </p>
              </div>
            ) : null}

            <Collapsible open={auditOpen} onOpenChange={setAuditOpen} className="rounded-md border border-border/40">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="w-full justify-between h-9 px-3 text-xs">
                  <span>Auditoria recente</span>
                  {auditOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 max-h-48 overflow-y-auto text-[11px] font-mono text-muted-foreground space-y-1">
                {loadingAudit ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : audit.length === 0 ? (
                  <p>Sem eventos.</p>
                ) : (
                  audit.map((a) => (
                    <div key={a.id} className="border-b border-border/30 pb-1 last:border-0">
                      <span className="text-foreground/80">{a.action}</span> ·{" "}
                      {new Date(a.created_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                  ))
                )}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function Account() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const { data: workspaces = [], isLoading: workspacesLoading } = useQuery({
    queryKey: ["workspaces-mine", user?.id],
    queryFn: async () => {
      const { data, error } = await workspaceService.listMine();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user) {
      setFullName(user.name || "");
      setAvatarUrlInput(user.avatar_url?.startsWith("http") ? user.avatar_url : "");
    }
  }, [user]);

  if (!user) return null;

  const saveName = async () => {
    const name = fullName.trim();
    if (!name) {
      toast.error("Indique um nome.");
      return;
    }
    setSavingName(true);
    try {
      const { error } = await authService.patchProfile({ full_name: name });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Nome atualizado.");
      await refreshUser();
    } finally {
      setSavingName(false);
    }
  };

  const saveAvatarUrl = async () => {
    const url = avatarUrlInput.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("Use um URL que comece por http:// ou https://");
      return;
    }
    setSavingUrl(true);
    try {
      const { error } = await authService.patchProfile({
        avatar_url: url === "" ? null : url,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(url ? "Foto (URL) guardada." : "Foto removida.");
      await refreshUser();
    } finally {
      setSavingUrl(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { error } = await authService.uploadAvatar(file);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Foto de perfil atualizada.");
      setAvatarUrlInput("");
      await refreshUser();
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    setRemoving(true);
    try {
      const { error } = await authService.deleteAvatar();
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Foto removida.");
      setAvatarUrlInput("");
      await refreshUser();
    } finally {
      setRemoving(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação da nova senha não coincide.");
      return;
    }
    setChangingPw(true);
    try {
      const { error } = await authService.changePassword(currentPassword, newPassword);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Senha alterada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setChangingPw(false);
    }
  };

  const displayAvatar = user.avatar_url ?? undefined;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Conta e perfil"
        description="Altere o seu nome, foto de perfil e senha. Estas opções estão disponíveis para todas as contas."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5 text-primary" />
              Foto de perfil
            </CardTitle>
            <CardDescription>Carregue uma imagem (JPG, PNG ou WebP até 2 MB) ou use um link público (URL).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <Avatar className="h-24 w-24 border-2 border-border">
                {displayAvatar ? <AvatarImage src={displayAvatar} alt="" className="object-cover" /> : null}
                <AvatarFallback className="text-lg">{initials(user.name, user.email)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={onPickFile}
                />
                <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? "A enviar…" : "Carregar imagem"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:text-destructive"
                  disabled={!user.avatar_url || removing}
                  onClick={() => removeAvatar()}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover foto
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="avatar-url">URL da imagem (opcional)</Label>
              <p className="text-xs text-muted-foreground">Se preencher, substitui a foto carregada. Deixe vazio e guarde para limpar o URL.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="avatar-url"
                  type="url"
                  placeholder="https://…"
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="secondary" disabled={savingUrl} onClick={() => saveAvatarUrl()}>
                  {savingUrl ? "A guardar…" : "Guardar URL"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                Nome
              </CardTitle>
              <CardDescription>Como o seu nome aparece na aplicação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full-name">Nome completo</Label>
                <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
              </div>
              <p className="text-xs text-muted-foreground">E-mail: {user.email}</p>
              <Button type="button" onClick={() => saveName()} disabled={savingName}>
                {savingName ? "A guardar…" : "Guardar nome"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-lg">Alterar senha</CardTitle>
              <CardDescription>Introduza a senha atual e a nova senha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cur-pw">Senha atual</Label>
                <Input
                  id="cur-pw"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pw">Nova senha</Label>
                <Input
                  id="new-pw"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf-pw">Confirmar nova senha</Label>
                <Input
                  id="cf-pw"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="button" onClick={() => changePassword()} disabled={changingPw}>
                {changingPw ? "A atualizar…" : "Alterar senha"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Ajuda no dashboard</CardTitle>
            <CardDescription>
              Se ocultou o guia rápido no Rastreamento, pode voltá-lo a mostrar aqui. Depois abra{" "}
              <span className="text-foreground/90">Rastreamento → Dashboard</span>. O guia inclui o passo sobre{" "}
              <strong className="text-foreground/90">macros</strong> (palavra-chave, criativo); também estão em{" "}
              <Link to="/tracking/links" className="font-medium text-primary underline underline-offset-2">
                Links
              </Link>{" "}
              e{" "}
              <Link to="/tracking/url-builder" className="font-medium text-primary underline underline-offset-2">
                Construtor de URL
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                try {
                  localStorage.removeItem(DASHBOARD_USER_GUIDE_DISMISSED_KEY);
                } catch {
                  /* ignore */
                }
                toast.success("Guia do dashboard voltará a aparecer na próxima visita ao Rastreamento.");
              }}
            >
              Mostrar guia rápido outra vez
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Equipa e workspaces
            </CardTitle>
            <CardDescription>
              Workspaces em que participa, membros e convites. A conta de dados (presells, rotadores) é a do dono da
              subscrição quando trabalha em equipa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspacesLoading ? (
              <div className="flex justify-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : workspaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">Não foi possível carregar os workspaces.</p>
            ) : (
              workspaces.map((w) => <WorkspaceTeamCard key={w.workspace_id} row={w} />)
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
