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
import { campaignStatusPurgeableLocally } from "@/lib/paidAdsUi";
import type { CampaignRow } from "@/services/paidAdsService";
import { paidAdsService } from "@/services/paidAdsService";

type Props = {
  projectId: string;
  campaign: CampaignRow;
  reload: () => void;
};

/** Remove o registo no Clickora (após arquivo). Não apaga recursos na Google/Meta/TikTok. */
export function DpilotCampaignPurgeArchivedButton({ projectId, campaign, reload }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!campaignStatusPurgeableLocally(campaign.status)) {
    return null;
  }

  const extId = campaign.external_campaign_id?.replace(/\D/g, "") ?? "";
  const hadRemote = Boolean(extId);

  const onConfirm = async () => {
    setBusy(true);
    try {
      const { error } = await paidAdsService.deleteArchivedCampaign(projectId, campaign.id);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Campanha removida da lista", {
        description: hadRemote
          ? "O registo local foi apagado; se a campanha ainda existir na rede, gere-a no gestor de anúncios."
          : "Rascunho e dados associados foram removidos do projecto.",
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
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive">
          Apagar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar «{campaign.name}» do projecto?</AlertDialogTitle>
          <AlertDialogDescription className="text-left leading-relaxed">
            Isto remove o registo da campanha no Clickora (rascunho, palavras-chave, anúncios e histórico local associados).{" "}
            <strong className="font-medium text-foreground">Não</strong> desactiva nem apaga nada na Google, Meta ou
            TikTok.
            {hadRemote ? (
              <>
                {" "}
                Esta campanha tinha ID na rede — confirme no gestor da plataforma se ainda existe e apague lá se precisar.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? "A apagar…" : "Apagar do Clickora"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
