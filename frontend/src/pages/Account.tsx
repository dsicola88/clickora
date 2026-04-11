import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { toast } from "sonner";
import { Camera, Trash2, User } from "lucide-react";

function initials(name: string, email: string) {
  const n = name.trim();
  if (n.length >= 2) return n.slice(0, 2).toUpperCase();
  const e = email.slice(0, 2);
  return e.toUpperCase();
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
      </div>
    </div>
  );
}
