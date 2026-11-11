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
  const { t } = useAppLocale();
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
      toast.success(t("pages.dpilot.hub.purgeToast"), {
        description: hadRemote
          ? t("pages.dpilot.hub.purgeToastRemote")
          : t("pages.dpilot.hub.purgeToastLocal"),
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
          {t("pages.dpilot.hub.purgeBtn")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{fill(t("pages.dpilot.hub.purgeTitle"), { name: campaign.name })}</AlertDialogTitle>
          <AlertDialogDescription className="text-left leading-relaxed">
            {t("pages.dpilot.hub.purgeBody")}
            {hadRemote ? t("pages.dpilot.hub.purgeBodyRemote") : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? t("pages.dpilot.hub.purging") : t("pages.dpilot.hub.purgeConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
