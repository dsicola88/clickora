import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { enterpriseService } from "@/services/enterpriseService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ProPanel } from "@/components/enterprise/ProShell";
import { toast } from "sonner";
import { Loader2, Palette } from "lucide-react";

/**
 * White-label do tenant — disponível quando o plano tem `has_branding === false` (Pro).
 */
export function EnterpriseTenantBrandingPanel() {
  const { userPlan } = useAuth();
  const qc = useQueryClient();
  const canWhiteLabel = userPlan?.has_branding === false;

  const [brandName, setBrandName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [hidePoweredBy, setHidePoweredBy] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["enterprise-tenant-branding"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.getTenantBranding();
      if (error) throw new Error(error);
      return data!;
    },
    enabled: canWhiteLabel,
  });

  useEffect(() => {
    if (!data) return;
    setBrandName(data.brand_name ?? "");
    setLogoUrl(data.logo_url ?? "");
    setFaviconUrl(data.favicon_url ?? "");
    setPrimaryColor(data.primary_color ?? "");
    setAccentColor(data.accent_color ?? "");
    setHidePoweredBy(data.hide_powered_by ?? true);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const { data: saved, error, errorCode } = await enterpriseService.updateTenantBranding({
        brand_name: brandName.trim() || null,
        logo_url: logoUrl.trim() || null,
        favicon_url: faviconUrl.trim() || null,
        primary_color: primaryColor.trim() || null,
        accent_color: accentColor.trim() || null,
        hide_powered_by: hidePoweredBy,
      });
      if (error) {
        const err = new Error(error) as Error & { code?: string };
        err.code = errorCode ?? undefined;
        throw err;
      }
      return saved!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enterprise-tenant-branding"] });
      qc.invalidateQueries({ queryKey: ["enterprise-onboarding"] });
      toast.success("Marca guardada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canWhiteLabel) {
    return (
      <ProPanel
        title="Marca white-label (Pro)"
        description="Personalize nome, logo e cores nas páginas publicadas. Disponível nos planos Pro."
      >
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            O seu plano actual não inclui remoção da marca dclickora. Faça upgrade para personalizar a marca do
            tenant.
          </p>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/planos">Ver planos</Link>
          </Button>
        </div>
      </ProPanel>
    );
  }

  return (
    <ProPanel
      title="Marca white-label"
      description="Nome, logo, favicon e cores nas propriedades publicadas da conta."
    >
      <div className="space-y-4 px-4 pb-4 max-w-xl">
        {isLoading ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar…
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="brand-name">Nome da marca</Label>
              <Input
                id="brand-name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                maxLength={120}
                placeholder="A sua marca"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logo-url">URL do logo</Label>
              <Input
                id="logo-url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="favicon-url">URL do favicon</Label>
              <Input
                id="favicon-url"
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="primary-color">Cor primária</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary-color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#0F172A"
                    className="font-mono"
                  />
                  <input
                    type="color"
                    aria-label="Escolher cor primária"
                    className="h-10 w-10 shrink-0 cursor-pointer rounded border border-border bg-transparent"
                    value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#0F172A"}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accent-color">Cor de destaque</Label>
                <div className="flex gap-2">
                  <Input
                    id="accent-color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#2563EB"
                    className="font-mono"
                  />
                  <input
                    type="color"
                    aria-label="Escolher cor de destaque"
                    className="h-10 w-10 shrink-0 cursor-pointer rounded border border-border bg-transparent"
                    value={/^#[0-9a-fA-F]{6}$/.test(accentColor) ? accentColor : "#2563EB"}
                    onChange={(e) => setAccentColor(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Ocultar «powered by dclickora»</p>
                <p className="text-[11px] text-muted-foreground">Nas páginas publicadas com white-label.</p>
              </div>
              <Switch checked={hidePoweredBy} onCheckedChange={setHidePoweredBy} />
            </div>
            <Button type="button" className="gap-1.5" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}
              Guardar marca
            </Button>
          </>
        )}
      </div>
    </ProPanel>
  );
}
