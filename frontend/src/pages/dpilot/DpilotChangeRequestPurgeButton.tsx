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
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { paidAdsService } from "@/services/paidAdsService";

type Props = {
  changeRequestId: string;
  reload: () => void;
};

/** Remove o cartão da fila (pedido já rejeitado ou falhado). Requer permissão de admin no projecto. */
export function DpilotChangeRequestPurgeButton({ changeRequestId, reload }: Props) {
  const { t } = useAppLocale();
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
      toast.success(t("pages.dpilot.hub.requestPurgeToast"));
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
          {t("pages.dpilot.hub.requestPurgeBtn")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("pages.dpilot.hub.requestPurgeTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="text-left leading-relaxed">
            {t("pages.dpilot.hub.requestPurgeBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? t("pages.dpilot.hub.purging") : t("pages.dpilot.hub.requestPurgeConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
