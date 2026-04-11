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

type Props = {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (newPassword: string) => Promise<void>;
  saving?: boolean;
};

export function AdminPasswordDialog({ user, open, onOpenChange, onSave, saving }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (user && open) {
      setPassword("");
      setConfirm("");
    }
  }, [user, open]);

  if (!user) return null;

  const mismatch = password.length > 0 && confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 6;
  const canSubmit = password.length >= 6 && password === confirm && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            {user.email} — defina uma nova palavra-passe. O utilizador deve usar esta no próximo login.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="adm-pw">Nova senha</Label>
            <Input
              id="adm-pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {tooShort && <p className="text-xs text-destructive">Mínimo 6 caracteres.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="adm-pw2">Confirmar senha</Label>
            <Input
              id="adm-pw2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch && <p className="text-xs text-destructive">As senhas não coincidem.</p>}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={async () => {
              try {
                await onSave(password);
                onOpenChange(false);
              } catch {
                /* toast no pai */
              }
            }}
          >
            {saving ? "A guardar…" : "Guardar senha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
