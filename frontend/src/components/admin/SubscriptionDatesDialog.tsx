import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { AdminUser } from "@/types/api";

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

type Props = {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: { starts_at: string; ends_at: string | null }) => Promise<void>;
  saving?: boolean;
};

export function SubscriptionDatesDialog({ user, open, onOpenChange, onSave, saving }: Props) {
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");

  useEffect(() => {
    if (user && open) {
      setStarts(toDateInput(user.sub_starts_at));
      setEnds(toDateInput(user.sub_ends_at));
    }
  }, [user, open]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Datas da assinatura</DialogTitle>
          <DialogDescription>
            {user.email} — ajuste início e fim do período contratado. Deixe &quot;Fim&quot; vazio para sem data de expiração.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sub-start">Início</Label>
            <Input id="sub-start" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub-end">Fim / expiração</Label>
            <Input id="sub-end" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving || !starts}
            onClick={async () => {
              try {
                await onSave({ starts_at: starts, ends_at: ends.trim() === "" ? null : ends });
                onOpenChange(false);
              } catch {
                /* toast no pai */
              }
            }}
          >
            {saving ? "A guardar…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
