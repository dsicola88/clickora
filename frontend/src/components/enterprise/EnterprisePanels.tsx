import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, KeyRound, Palette, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProPanel } from "@/components/enterprise/ProShell";
import { enterpriseService } from "@/services/enterpriseService";
import { toast } from "sonner";

export function EnterpriseOnboardingCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["enterprise", "onboarding"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.onboardingStatus();
      if (error) throw new Error(error);
      return data!;
    },
  });
  if (isLoading || !data || data.complete) return null;
  return (
    <ProPanel
      title="Setup enterprise"
      description={`${data.progress.done}/${data.progress.total} passos obrigatórios · ${data.plan_name ?? "plano"}`}
    >
      <ul className="space-y-2 px-4 pb-4">
        {data.steps.map((s) => (
          <li key={s.id} className="flex items-start gap-2 text-sm">
            {s.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <Link to={s.href} className="hover:underline text-foreground">
              {s.label}
              {s.optional ? <span className="text-muted-foreground"> (opcional)</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </ProPanel>
  );
}

export function EnterpriseSecurityPanel() {
  const qc = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["enterprise", "mfa"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.mfaStatus();
      if (error) throw new Error(error);
      return data!;
    },
  });
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState<string[] | null>(null);
  const [disablePw, setDisablePw] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const start = useMutation({
    mutationFn: async () => {
      const { data, error } = await enterpriseService.mfaSetup();
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (d) => {
      setSetupSecret(d.secret);
      setOtpauth(d.otpauth_url);
      toast.message("Abra o Authenticator e digite o código");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const { data, error } = await enterpriseService.mfaConfirm(code);
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (d) => {
      setBackup(d.backup_codes);
      setSetupSecret(null);
      setOtpauth(null);
      setCode("");
      void qc.invalidateQueries({ queryKey: ["enterprise", "mfa"] });
      toast.success("MFA activo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const { data, error } = await enterpriseService.mfaDisable(disablePw, disableCode);
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: () => {
      setDisablePw("");
      setDisableCode("");
      void qc.invalidateQueries({ queryKey: ["enterprise", "mfa"] });
      toast.success("MFA desactivado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ProPanel title="Segurança MFA" description="Authenticator (TOTP) + códigos de recuperação.">
      <div className="space-y-4 px-4 pb-4">
        <div className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4" />
          Estado: <strong>{status?.mfa_enabled ? "Activo" : "Inactivo"}</strong>
        </div>
        {!status?.mfa_enabled && !setupSecret && (
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            Activar MFA
          </Button>
        )}
        {setupSecret && (
          <div className="space-y-2 text-sm">
            <p className="font-mono break-all text-xs bg-muted p-2 rounded">{setupSecret}</p>
            {otpauth && (
              <a className="text-primary underline text-xs" href={otpauth}>
                Abrir no Authenticator
              </a>
            )}
            <Label>Código de confirmação</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            <Button onClick={() => confirm.mutate()} disabled={confirm.isPending || code.length < 6}>
              Confirmar
            </Button>
          </div>
        )}
        {backup && (
          <div className="text-xs space-y-1">
            <p className="font-medium text-amber-700">Guarde estes códigos agora:</p>
            <ul className="font-mono">
              {backup.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {status?.mfa_enabled && (
          <div className="space-y-2 border-t pt-3">
            <Label>Desactivar — senha + código</Label>
            <Input
              type="password"
              value={disablePw}
              onChange={(e) => setDisablePw(e.target.value)}
              placeholder="Senha"
            />
            <Input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="Código MFA"
            />
            <Button variant="destructive" onClick={() => disable.mutate()} disabled={disable.isPending}>
              Desactivar MFA
            </Button>
          </div>
        )}
      </div>
    </ProPanel>
  );
}

export function EnterpriseApiKeysPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("Produção");
  const [created, setCreated] = useState<string | null>(null);
  const { data: keys = [] } = useQuery({
    queryKey: ["enterprise", "api-keys"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.listApiKeys();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await enterpriseService.createApiKey(name);
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (d) => {
      setCreated(d.api_key);
      void qc.invalidateQueries({ queryKey: ["enterprise", "api-keys"] });
      toast.success("API key criada — copie agora");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await enterpriseService.revokeApiKey(id);
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["enterprise", "api-keys"] });
      toast.success("Revogada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ProPanel title="API keys B2B" description="Authorization: Bearer ck_live_…">
      <div className="space-y-3 px-4 pb-4">
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <KeyRound className="h-4 w-4 mr-1" /> Criar
          </Button>
        </div>
        {created && (
          <p className="text-xs font-mono break-all bg-muted p-2 rounded border border-amber-500/40">
            {created}
          </p>
        )}
        <ul className="text-sm space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 border-b border-border/50 py-2">
              <span>
                {k.name} · <span className="font-mono text-xs">{k.key_prefix}…</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => revoke.mutate(k.id)}>
                Revogar
              </Button>
            </li>
          ))}
          {keys.length === 0 && <li className="text-muted-foreground text-xs">Nenhuma key activa.</li>}
        </ul>
      </div>
    </ProPanel>
  );
}

export function EnterpriseBrandingPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["enterprise", "branding"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.getTenantBranding();
      if (error) throw new Error(error);
      return data!;
    },
  });
  const [brandName, setBrandName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primary, setPrimary] = useState("#0f172a");
  const [hide, setHide] = useState(true);

  useEffect(() => {
    if (!data) return;
    setBrandName(data.brand_name || "");
    setLogoUrl(data.logo_url || "");
    setPrimary(data.primary_color || "#0f172a");
    setHide(data.hide_powered_by ?? true);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: d, error } = await enterpriseService.putTenantBranding({
        brand_name: brandName || null,
        logo_url: logoUrl || null,
        primary_color: primary || null,
        hide_powered_by: hide,
      });
      if (error) throw new Error(error);
      return d!;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["enterprise", "branding"] });
      toast.success("Marca guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ProPanel title="White-label" description="Pro — nome, logo e cores nas páginas públicas.">
      <div className="space-y-3 px-4 pb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Palette className="h-4 w-4" /> Personalização por conta
        </div>
        <Label>Nome da marca</Label>
        <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="A sua marca" />
        <Label>Logo URL</Label>
        <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
        <Label>Cor primária</Label>
        <Input value={primary} onChange={(e) => setPrimary(e.target.value)} />
        <div className="flex items-center gap-2">
          <Switch checked={hide} onCheckedChange={setHide} id="hide-pw" />
          <Label htmlFor="hide-pw">Ocultar «powered by dclickora»</Label>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Guardar marca
        </Button>
      </div>
    </ProPanel>
  );
}
