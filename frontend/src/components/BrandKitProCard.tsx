import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { enterpriseService } from "@/services/enterpriseService";
import {
  BRAND_KIT_DEFAULTS,
  readBrandKitPro,
  writeBrandKitPro,
  type BrandKitPro,
} from "@/lib/brandKitPro";
import { Loader2 } from "lucide-react";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

/**
 * Brand kit Pro — sync white-label enterprise quando o plano permite;
 * rascunho local alinhado com wizard / Agency.
 */
export function BrandKitProCard() {
  const { t } = useAppLocale();
  const { userPlan } = useAuth();
  const qc = useQueryClient();
  const canWhiteLabel = userPlan?.has_branding === false;
  const [kit, setKit] = useState<BrandKitPro>(BRAND_KIT_DEFAULTS);

  const { data: remote, isLoading } = useQuery({
    queryKey: ["enterprise-tenant-branding", "brand-kit"],
    queryFn: async () => {
      const { data, error } = await enterpriseService.getTenantBranding();
      if (error) throw new Error(error);
      return data!;
    },
    enabled: canWhiteLabel,
  });

  useEffect(() => {
    const local = readBrandKitPro();
    if (canWhiteLabel && remote) {
      setKit({
        brandName: remote.brand_name ?? local.brandName,
        primaryColor: remote.primary_color || local.primaryColor || BRAND_KIT_DEFAULTS.primaryColor,
        supportEmail: local.supportEmail,
        logoUrl: remote.logo_url ?? local.logoUrl,
      });
      return;
    }
    setKit(local);
  }, [canWhiteLabel, remote]);

  const saveRemote = useMutation({
    mutationFn: async () => {
      const { data, error } = await enterpriseService.updateTenantBranding({
        brand_name: kit.brandName.trim() || null,
        logo_url: kit.logoUrl.trim() || null,
        primary_color: kit.primaryColor.trim() || null,
      });
      if (error) throw new Error(error);
      try {
        writeBrandKitPro(kit);
      } catch {
        /* ignore */
      }
      return data!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enterprise-tenant-branding"] });
      toast.success(t("pages.brandKit.toastSynced"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveLocal = () => {
    try {
      writeBrandKitPro(kit);
      toast.success(t("pages.brandKit.toastSavedLocal"));
    } catch {
      toast.error(t("pages.brandKit.toastError"));
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("pages.brandKit.title")}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {canWhiteLabel ? t("pages.brandKit.synced") : t("pages.brandKit.localDraft")}
        </p>
      </div>
      {canWhiteLabel && isLoading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("pages.brandKit.loading")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bk-name">{t("pages.brandKit.brand")}</Label>
            <Input
              id="bk-name"
              value={kit.brandName}
              onChange={(e) => setKit((k) => ({ ...k, brandName: e.target.value }))}
              placeholder="Ex. FastBuy"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-color">{t("pages.brandKit.primaryColor")}</Label>
            <div className="flex gap-2">
              <Input
                id="bk-color"
                type="color"
                className="h-9 w-12 p-1"
                value={kit.primaryColor}
                onChange={(e) => setKit((k) => ({ ...k, primaryColor: e.target.value }))}
              />
              <Input
                value={kit.primaryColor}
                onChange={(e) => setKit((k) => ({ ...k, primaryColor: e.target.value }))}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-email">{t("pages.brandKit.supportEmail")}</Label>
            <Input
              id="bk-email"
              type="email"
              value={kit.supportEmail}
              onChange={(e) => setKit((k) => ({ ...k, supportEmail: e.target.value }))}
              placeholder="support@…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-logo">{t("pages.brandKit.logoUrl")}</Label>
            <Input
              id="bk-logo"
              value={kit.logoUrl}
              onChange={(e) => setKit((k) => ({ ...k, logoUrl: e.target.value }))}
              placeholder="https://…"
            />
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {canWhiteLabel ? (
          <Button type="button" size="sm" onClick={() => saveRemote.mutate()} disabled={saveRemote.isPending}>
            {saveRemote.isPending ? t("pages.brandKit.saving") : t("pages.brandKit.saveAccount")}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={saveLocal}>
            {t("pages.brandKit.saveLocal")}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" asChild>
          <Link to="/configuracoes">{t("pages.brandKit.settings")}</Link>
        </Button>
      </div>
    </div>
  );
}
