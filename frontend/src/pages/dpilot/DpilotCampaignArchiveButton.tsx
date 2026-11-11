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
import { fill } from "@/i18n";
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
  const { t } = useAppLocale();
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
      toast.success(t("pages.dpilot.hub.archiveToast"), {
        description: t("pages.dpilot.hub.archiveToastDesc"),
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
          {t("pages.dpilot.hub.archiveBtn")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{fill(t("pages.dpilot.hub.archiveTitle"), { name: campaign.name })}</AlertDialogTitle>
          <AlertDialogDescription className="text-left leading-relaxed">
            {t("pages.dpilot.hub.archiveBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? t("pages.dpilot.hub.archiving") : t("pages.dpilot.hub.archiveConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
