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
import { campaignStatusArchivableLocally } from "@/lib/paidAdsUi";
import type { CampaignRow } from "@/services/paidAdsService";
import { paidAdsService } from "@/services/paidAdsService";

type Props = {
  projectId: string;
  campaign: CampaignRow;
  reload: () => void;
};

/** Arquiva na base (estado «arquivada») sem apagar a conta na rede — só rascunhos / pré-publish / erro. */
export function DpilotCampaignArchiveButton({ projectId, campaign, reload }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!campaignStatusArchivableLocally(campaign.status)) {
    return null;
  }

  const onConfirm = async () => {
    setBusy(true);
    try {
      const { error } = await paidAdsService.archiveCampaign(projectId, campaign.id);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Campanha arquivada", {
        description:
          "Saíu da lista por defeito — filtre por «Arquivada» se precisar de ver o registo.",
      });
      setOpen(false);
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
          Arquivar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar «{campaign.name}»?</AlertDialogTitle>
          <AlertDialogDescription className="text-left leading-relaxed">
            Esta acção marca a campanha como <strong className="font-medium text-foreground">arquivada</strong> no Clickora
            (não apaga nada na conta Google, Meta ou TikTok se ainda não foi publicada). Pode filtrar estado «Arquivada» na
            tabela para a voltar a ver.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? "A arquivar…" : "Confirmar arquivo"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
