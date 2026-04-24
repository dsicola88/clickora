import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdminPlanRow } from "@/types/api";
import { adminService } from "@/services/adminService";
import { toast } from "sonner";
import { formatPlanPrice, mergeWithDefaultLabels } from "@/lib/planDisplayLabels";

type Props = {
  plan: AdminPlanRow;
  onSaved: () => void;
  /** Moeda e formatação alinhadas com a landing /planos (opcional). */
  priceLabels?: Record<string, string> | null;
};

export function PlanEditorCard({ plan, onSaved, priceLabels }: Props) {
  const lb = mergeWithDefaultLabels(priceLabels ?? undefined);
  const [name, setName] = useState(plan.name);
  const [priceInput, setPriceInput] = useState((plan.price_cents / 100).toFixed(2));
  const [maxPages, setMaxPages] = useState(plan.max_presell_pages != null ? String(plan.max_presell_pages) : "");
  const [maxClicks, setMaxClicks] = useState(plan.max_clicks_per_month != null ? String(plan.max_clicks_per_month) : "");
  const [maxCustomDomains, setMaxCustomDomains] = useState(String(plan.max_custom_domains ?? 0));
  const [hasBranding, setHasBranding] = useState(plan.has_branding);
  const [affiliateWebhook, setAffiliateWebhook] = useState(plan.affiliate_webhook_enabled ?? false);
  const [featuresText, setFeaturesText] = useState(() => (plan.features ?? []).join("\n"));
  const [ctaLabel, setCtaLabel] = useState(plan.cta_label ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(plan.name);
    setPriceInput((plan.price_cents / 100).toFixed(2));
    setMaxPages(plan.max_presell_pages != null ? String(plan.max_presell_pages) : "");
    setMaxClicks(plan.max_clicks_per_month != null ? String(plan.max_clicks_per_month) : "");
    setMaxCustomDomains(String(plan.max_custom_domains ?? 0));
    setHasBranding(plan.has_branding);
    setAffiliateWebhook(plan.affiliate_webhook_enabled ?? false);
    setFeaturesText((plan.features ?? []).join("\n"));
    setCtaLabel(plan.cta_label ?? "");
  }, [plan]);

  const reset = () => {
    setName(plan.name);
    setPriceInput((plan.price_cents / 100).toFixed(2));
    setMaxPages(plan.max_presell_pages != null ? String(plan.max_presell_pages) : "");
    setMaxClicks(plan.max_clicks_per_month != null ? String(plan.max_clicks_per_month) : "");
    setMaxCustomDomains(String(plan.max_custom_domains ?? 0));
    setHasBranding(plan.has_branding);
    setAffiliateWebhook(plan.affiliate_webhook_enabled ?? false);
    setFeaturesText((plan.features ?? []).join("\n"));
    setCtaLabel(plan.cta_label ?? "");
  };

  const save = async () => {
    const parsed = parseFloat(priceInput.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Preço inválido");
      return;
    }
    const price_cents = Math.round(parsed * 100);
    let max_presell_pages: number | null = null;
    if (maxPages.trim() !== "") {
      const n = parseInt(maxPages, 10);
      if (Number.isNaN(n) || n < 0) {
        toast.error("Max. presells inválido");
        return;
      }
      max_presell_pages = n;
    }
    let max_clicks_per_month: number | null = null;
    if (maxClicks.trim() !== "") {
      const n = parseInt(maxClicks, 10);
      if (Number.isNaN(n) || n < 0) {
        toast.error("Max. cliques inválido");
        return;
      }
      max_clicks_per_month = n;
    }
    const mcd = parseInt(maxCustomDomains, 10);
    if (Number.isNaN(mcd) || mcd < 0 || mcd > 50) {
      toast.error("Máx. domínios personalizados: número entre 0 e 50");
      return;
    }

    const features = featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      const { error } = await adminService.updatePlan(plan.id, {
        name,
        price_cents,
        max_presell_pages,
        max_clicks_per_month,
        max_custom_domains: mcd,
        has_branding: hasBranding,
        affiliate_webhook_enabled: affiliateWebhook,
        features,
        cta_label: ctaLabel.trim() === "" ? null : ctaLabel.trim(),
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Plano atualizado");
      onSaved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span>{plan.name}</span>
          <code className="text-xs font-normal bg-muted px-2 py-0.5 rounded">{plan.type}</code>
        </CardTitle>
        <CardDescription>
          Pré-visualização: {formatPlanPrice(plan.price_cents, lb)} · a moeda na página pública segue a landing /planos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`n-${plan.id}`}>Nome comercial</Label>
            <Input id={`n-${plan.id}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`p-${plan.id}`}>Preço (valor principal)</Label>
            <Input
              id={`p-${plan.id}`}
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`mp-${plan.id}`}>Máx. presells (vazio = ilimitado)</Label>
            <Input
              id={`mp-${plan.id}`}
              placeholder="—"
              value={maxPages}
              onChange={(e) => setMaxPages(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`mc-${plan.id}`}>Máx. cliques/mês (vazio = ilimitado)</Label>
            <Input
              id={`mc-${plan.id}`}
              placeholder="—"
              value={maxClicks}
              onChange={(e) => setMaxClicks(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`mcd-${plan.id}`}>Máx. domínios personalizados (0 = só HTML/dclickora)</Label>
            <Input
              id={`mcd-${plan.id}`}
              inputMode="numeric"
              value={maxCustomDomains}
              onChange={(e) => setMaxCustomDomains(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`f-${plan.id}`}>Lista «Também inclui» (uma linha por funcionalidade)</Label>
          <Textarea
            id={`f-${plan.id}`}
            rows={6}
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            className="resize-y font-mono text-sm"
            placeholder="Ex.: Analytics completo&#10;Suporte prioritário"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`cta-${plan.id}`}>Texto do botão (opcional)</Label>
          <Input
            id={`cta-${plan.id}`}
            placeholder="Vazio = usar textos globais (grátis / upgrade / plano atual)"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <Label htmlFor={`br-${plan.id}`} className="cursor-pointer">
            Branding nas presells
          </Label>
          <Switch id={`br-${plan.id}`} checked={hasBranding} onCheckedChange={setHasBranding} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <div className="pr-3">
            <Label htmlFor={`wh-${plan.id}`} className="cursor-pointer">
              Webhook de afiliados (Plataformas)
            </Label>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Postback HTTP para fechar vendas com o clique. Desligado = URL e chamadas recusadas para contas neste plano.
            </p>
          </div>
          <Switch id={`wh-${plan.id}`} checked={affiliateWebhook} onCheckedChange={setAffiliateWebhook} />
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={reset} disabled={loading}>
            Repor
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={loading || !name.trim()}>
            {loading ? "A guardar…" : "Guardar plano"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
