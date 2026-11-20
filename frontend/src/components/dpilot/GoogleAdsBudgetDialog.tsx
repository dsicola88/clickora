/**
 * Diálogo de orçamento diário (substitui window.prompt).
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GoogleAdsBudgetDialog({
  open,
  onOpenChange,
  currentUsd,
  busy,
  title = "Orçamento diário",
  description = "Valor em USD. Confirme antes de aplicar na Google Ads.",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUsd: number | null;
  busy?: boolean;
  title?: string;
  description?: string;
  onConfirm: (usd: number) => void | Promise<void>;
}) {
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRaw(currentUsd != null && Number.isFinite(currentUsd) ? currentUsd.toFixed(2) : "");
    setErr(null);
  }, [open, currentUsd]);

  const submit = async () => {
    const usd = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(usd) || usd <= 0) {
      setErr("Indique um valor válido em USD (ex.: 50).");
      return;
    }
    if (currentUsd != null && currentUsd > 0) {
      const ratio = usd / currentUsd;
      if (ratio >= 2 || ratio <= 0.5) {
        if (
          !window.confirm(
            `Alteração elevada: ${currentUsd.toFixed(2)} → ${usd.toFixed(2)} USD/dia. Confirmar?`,
          )
        ) {
          return;
        }
      }
    }
    await onConfirm(usd);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <Label htmlFor="gads-budget-usd">USD / dia</Label>
          <Input
            id="gads-budget-usd"
            inputMode="decimal"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="50.00"
            autoFocus
          />
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
