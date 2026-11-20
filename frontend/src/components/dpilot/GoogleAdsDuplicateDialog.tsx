/**
 * Duplicar campanha Google — nome, orçamento e publicar (sem window.prompt).
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export type GoogleAdsDuplicateConfirm = {
  name: string;
  daily_budget_usd?: number;
  publish: boolean;
};

export function GoogleAdsDuplicateDialog({
  open,
  onOpenChange,
  sourceName,
  currentBudgetUsd,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceName: string;
  currentBudgetUsd: number | null;
  busy?: boolean;
  onConfirm: (values: GoogleAdsDuplicateConfirm) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [budgetRaw, setBudgetRaw] = useState("");
  const [publish, setPublish] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(`${sourceName} (cópia)`.slice(0, 200));
    setBudgetRaw(
      currentBudgetUsd != null && Number.isFinite(currentBudgetUsd)
        ? currentBudgetUsd.toFixed(2)
        : "",
    );
    setPublish(false);
    setErr(null);
  }, [open, sourceName, currentBudgetUsd]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Indique um nome para a cópia.");
      return;
    }
    let daily_budget_usd: number | undefined;
    if (budgetRaw.trim() !== "") {
      const usd = Number(budgetRaw.replace(",", "."));
      if (!Number.isFinite(usd) || usd <= 0) {
        setErr("Orçamento inválido (deixe vazio para igual à original).");
        return;
      }
      daily_budget_usd = usd;
    }
    await onConfirm({ name: trimmed, daily_budget_usd, publish });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicar campanha</DialogTitle>
          <DialogDescription>
            Cria uma cópia local sem métricas da original. Pode publicar já na Google ou ficar só como rascunho.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="gads-dup-name">Nome</Label>
            <Input
              id="gads-dup-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErr(null);
              }}
              maxLength={200}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gads-dup-budget">Orçamento diário USD</Label>
            <Input
              id="gads-dup-budget"
              inputMode="decimal"
              value={budgetRaw}
              onChange={(e) => {
                setBudgetRaw(e.target.value);
                setErr(null);
              }}
              placeholder="Vazio = igual à original"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/80 px-3 py-2.5 text-sm">
            <Checkbox
              checked={publish}
              onCheckedChange={(v) => setPublish(v === true)}
              className="mt-0.5"
              aria-label="Publicar na Google"
            />
            <span className="leading-snug text-muted-foreground">
              <span className="font-medium text-foreground">Publicar na Google</span>
              <span className="block text-xs">
                Dono aplica já (ou vai a Aprovações se for outro membro). Desligado = só rascunho local.
              </span>
            </span>
          </label>
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
