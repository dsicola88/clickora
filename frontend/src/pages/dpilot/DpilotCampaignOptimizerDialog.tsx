import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { paidAdsService, type CampaignRow } from "@/services/paidAdsService";

type Props = {
  projectId: string;
  campaign: CampaignRow;
  reload: () => void;
};

/** Editar override do optimizer por campanha (admin). Valores vazios removem override. */
export function DpilotCampaignOptimizerDialog({ projectId, campaign, reload }: Props) {
  const [open, setOpen] = useState(false);
  const [pauseUsd, setPauseUsd] = useState("");
  const [minClicks, setMinClicks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPauseUsd(
      campaign.optimizer_pause_spend_usd != null && Number.isFinite(Number(campaign.optimizer_pause_spend_usd))
        ? String(campaign.optimizer_pause_spend_usd)
        : "",
    );
    setMinClicks(
      campaign.optimizer_pause_min_clicks != null && Number.isFinite(Number(campaign.optimizer_pause_min_clicks))
        ? String(campaign.optimizer_pause_min_clicks)
        : "",
    );
  }, [open, campaign]);

  const summary =
    campaign.optimizer_pause_spend_usd != null || campaign.optimizer_pause_min_clicks != null
      ? [
          campaign.optimizer_pause_spend_usd != null ? `${campaign.optimizer_pause_spend_usd} USD` : null,
          campaign.optimizer_pause_min_clicks != null ? `${campaign.optimizer_pause_min_clicks} cliques` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "Política do projecto";

  const onSave = async () => {
    let optimizer_pause_spend_usd: number | null;
    if (pauseUsd.trim() === "") {
      optimizer_pause_spend_usd = null;
    } else {
      const n = parseFloat(pauseUsd.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("USD: número positivo ou vazio para herd do projecto.");
        return;
      }
      optimizer_pause_spend_usd = n;
    }

    let optimizer_pause_min_clicks: number | null;
    if (minClicks.trim() === "") {
      optimizer_pause_min_clicks = null;
    } else {
      const n = parseInt(minClicks.trim(), 10);
      if (!Number.isFinite(n) || n < 0 || n > 500) {
        toast.error("Cliques: inteiro 0–500 ou vazio.");
        return;
      }
      optimizer_pause_min_clicks = n;
    }

    setSaving(true);
    try {
      const { error } = await paidAdsService.patchCampaignOptimizerLimits(projectId, campaign.id, {
        optimizer_pause_spend_usd,
        optimizer_pause_min_clicks,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Limites desta campanha actualizados.");
      setOpen(false);
      reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
          Pausa motor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pausa sem conversões · {campaign.name.slice(0, 80)}</DialogTitle>
          <DialogDescription>
            Actual: <span className="font-medium text-foreground">{summary}</span>. Vazios voltam à política definida em
            «Visão geral» (guardrails).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`opt-usd-${campaign.id}`}>Gasto máx. USD</Label>
            <Input
              id={`opt-usd-${campaign.id}`}
              inputMode="decimal"
              placeholder="Vazio = projecto"
              value={pauseUsd}
              onChange={(e) => setPauseUsd(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`opt-cl-${campaign.id}`}>Mín. cliques</Label>
            <Input
              id={`opt-cl-${campaign.id}`}
              inputMode="numeric"
              placeholder="Vazio = projecto"
              value={minClicks}
              onChange={(e) => setMinClicks(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void onSave()} disabled={saving}>
            {saving ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
