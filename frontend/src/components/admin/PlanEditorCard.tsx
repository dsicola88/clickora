import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminPlanRow } from "@/types/api";
import { adminService } from "@/services/adminService";
import { toast } from "sonner";

function formatMoneyCents(cents: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

type Props = {
  plan: AdminPlanRow;
  onSaved: () => void;
};

export function PlanEditorCard({ plan, onSaved }: Props) {
  const [name, setName] = useState(plan.name);
  const [priceEuros, setPriceEuros] = useState((plan.price_cents / 100).toFixed(2));
  const [maxPages, setMaxPages] = useState(plan.max_presell_pages != null ? String(plan.max_presell_pages) : "");
  const [maxClicks, setMaxClicks] = useState(plan.max_clicks_per_month != null ? String(plan.max_clicks_per_month) : "");
  const [hasBranding, setHasBranding] = useState(plan.has_branding);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(plan.name);
    setPriceEuros((plan.price_cents / 100).toFixed(2));
    setMaxPages(plan.max_presell_pages != null ? String(plan.max_presell_pages) : "");
    setMaxClicks(plan.max_clicks_per_month != null ? String(plan.max_clicks_per_month) : "");
    setHasBranding(plan.has_branding);
  }, [plan]);

  const reset = () => {
    setName(plan.name);
    setPriceEuros((plan.price_cents / 100).toFixed(2));
    setMaxPages(plan.max_presell_pages != null ? String(plan.max_presell_pages) : "");
    setMaxClicks(plan.max_clicks_per_month != null ? String(plan.max_clicks_per_month) : "");
    setHasBranding(plan.has_branding);
  };

  const save = async () => {
    const parsed = parseFloat(priceEuros.replace(",", "."));
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

    setLoading(true);
    try {
      const { error } = await adminService.updatePlan(plan.id, {
        name,
        price_cents,
        max_presell_pages,
        max_clicks_per_month,
        has_branding: hasBranding,
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
        <CardDescription>Antes: {formatMoneyCents(plan.price_cents)} · limites conforme abaixo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`n-${plan.id}`}>Nome comercial</Label>
            <Input id={`n-${plan.id}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`p-${plan.id}`}>Preço (EUR)</Label>
            <Input
              id={`p-${plan.id}`}
              inputMode="decimal"
              value={priceEuros}
              onChange={(e) => setPriceEuros(e.target.value)}
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
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
          <Label htmlFor={`br-${plan.id}`} className="cursor-pointer">
            Branding nas presells
          </Label>
          <Switch id={`br-${plan.id}`} checked={hasBranding} onCheckedChange={setHasBranding} />
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
