import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enterpriseService } from "@/services/enterpriseService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, Shield, ShieldCheck, ShieldOff } from "lucide-react";

/**
 * Activar / desactivar MFA (TOTP) na conta.
 */
export function AccountMfaSection() {
  const qc = useQueryClient();
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");

  const { data: status, isLoading, isError, error } = useQuery({
    queryKey: ["enterprise-mfa-status"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.getMfaStatus();
      if (error) throw new Error(error);
      return data!;
    },
  });

  const setupMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await enterpriseService.setupMfa();
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (data) => {
      setSetupSecret(data.secret);
      setOtpauthUrl(data.otpauth_url);
      setBackupCodes(null);
      setConfirmCode("");
      toast.success("Segredo gerado. Adicione-o na app Authenticator.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await enterpriseService.confirmMfa(confirmCode.trim());
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (data) => {
      setBackupCodes(data.backup_codes);
      setSetupSecret(null);
      setOtpauthUrl(null);
      setConfirmCode("");
      qc.invalidateQueries({ queryKey: ["enterprise-mfa-status"] });
      qc.invalidateQueries({ queryKey: ["enterprise-onboarding"] });
      toast.success("MFA activado. Guarde os códigos de recuperação.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disableMut = useMutation({
    mutationFn: async () => {
      const { error } = await enterpriseService.disableMfa(disableCode.trim(), disablePassword);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      setDisableCode("");
      setDisablePassword("");
      setBackupCodes(null);
      qc.invalidateQueries({ queryKey: ["enterprise-mfa-status"] });
      qc.invalidateQueries({ queryKey: ["enterprise-onboarding"] });
      toast.success("MFA desactivado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const enabled = Boolean(status?.mfa_enabled);

  return (
    <Card className="border-border/80 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {enabled ? <ShieldCheck className="h-5 w-5 text-primary" /> : <Shield className="h-5 w-5 text-primary" />}
          Autenticação em dois factores (MFA)
        </CardTitle>
        <CardDescription>
          Use uma app Authenticator (Google Authenticator, 1Password, Authy…) para proteger o login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> A carregar estado MFA…
          </p>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Não foi possível carregar o MFA."}
          </p>
        ) : enabled ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">MFA está activo nesta conta.</p>
            <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
              <div className="space-y-2">
                <Label htmlFor="mfa-disable-code">Código MFA ou recuperação</Label>
                <Input
                  id="mfa-disable-code"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  autoComplete="one-time-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfa-disable-pw">Senha actual</Label>
                <Input
                  id="mfa-disable-pw"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive"
              disabled={disableMut.isPending || disableCode.trim().length < 6 || !disablePassword}
              onClick={() => disableMut.mutate()}
            >
              {disableMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              Desactivar MFA
            </Button>
          </div>
        ) : setupSecret ? (
          <div className="space-y-4 max-w-xl">
            <p className="text-sm text-muted-foreground">
              Adicione esta chave na app Authenticator (entrada manual) e confirme com o código de 6 dígitos.
            </p>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 font-mono text-sm break-all">
              {setupSecret}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => void copyText(setupSecret, "Segredo")}>
                <Copy className="h-3.5 w-3.5" /> Copiar segredo
              </Button>
              {otpauthUrl ? (
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => void copyText(otpauthUrl, "URL otpauth")}>
                  <KeyRound className="h-3.5 w-3.5" /> Copiar otpauth://
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mfa-confirm">Código da app</Label>
              <Input
                id="mfa-confirm"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                placeholder="000000"
                maxLength={12}
                autoComplete="one-time-code"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={confirmMut.isPending || confirmCode.trim().length < 6}
                onClick={() => confirmMut.mutate()}
              >
                {confirmMut.isPending ? "A confirmar…" : "Confirmar e activar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSetupSecret(null);
                  setOtpauthUrl(null);
                  setConfirmCode("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" className="gap-2" disabled={setupMut.isPending} onClick={() => setupMut.mutate()}>
            {setupMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Activar MFA
          </Button>
        )}

        {backupCodes && backupCodes.length > 0 ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              Códigos de recuperação (só são mostrados uma vez — guarde-os num local seguro)
            </p>
            <ul className="grid gap-1 sm:grid-cols-2 font-mono text-xs">
              {backupCodes.map((c) => (
                <li key={c} className="rounded bg-background/80 px-2 py-1 border border-border/50">
                  {c}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              onClick={() => void copyText(backupCodes.join("\n"), "Códigos")}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar todos
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
