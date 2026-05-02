import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { paidAdsService } from "@/services/paidAdsService";

type Props = {
  changeRequestId: string;
  reload: () => void;
};

/** Remove o cartão da fila (pedido já rejeitado ou falhado). Requer permissão de admin no projecto. */
export function DpilotChangeRequestPurgeButton({ changeRequestId, reload }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    setBusy(true);
    try {
      const { error } = await paidAdsService.deleteChangeRequest(changeRequestId);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Pedido removido da lista");
      setOpen(false);
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive">
          Apagar da lista
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar este pedido?</AlertDialogTitle>
          <AlertDialogDescription className="text-left leading-relaxed">
            O registo sai da fila de aprovações no Clickora. Não altera campanhas na Google, Meta ou TikTok.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? "A apagar…" : "Apagar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
