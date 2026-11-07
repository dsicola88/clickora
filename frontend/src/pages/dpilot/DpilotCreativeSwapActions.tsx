import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { paidAdsService, type CampaignRow } from "@/services/paidAdsService";
import { optimizerFlagsHint } from "@/lib/paidAdsUi";

type PreviewState = {
  detail: string;
  next_action: {
    type: string;
    label: string;
  } | null;
  rankLine: string | null;
};

/**
 * CTA Copilot após flag CTR:
 * 1) ver ranking da rede
 * 2) opcionalmente gerar rascunhos de mensagem (Meta/Google)
 * 3) publicar próximo rascunho ou marcar tratado
 */
export function DpilotCreativeSwapActions({
  projectId,
  campaign,
  reload,
}: {
  projectId: string;
  campaign: CampaignRow;
  reload: () => void;
}) {
  const hint = optimizerFlagsHint(campaign.optimizer_flags);
  const supportsMessageRecs =
    campaign.platform === "meta_ads" || campaign.platform === "google_ads";
  const [busy, setBusy] = useState<"apply" | "dismiss" | "recs" | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const loadPreview = useCallback(() => {
    if (!hint) return;
    void paidAdsService.previewCreativeSwap(projectId, campaign.id).then(({ data, error }) => {
      if (error || !data) {
        setPreview({
          detail: error || "Não foi possível pré-visualizar o próximo passo.",
          next_action: null,
          rankLine: null,
        });
        return;
      }
      let rankLine: string | null = null;
      const r = data.ranking;
      if (r) {
        const winner = r.ranked.find((x) => x.id === r.winner_id);
        const loser = r.ranked.find((x) => x.id === r.loser_id);
        if (winner && loser) {
          const wCtr = winner.ctr != null ? `${(winner.ctr * 100).toFixed(2)}%` : "—";
          const lCtr = loser.ctr != null ? `${(loser.ctr * 100).toFixed(2)}%` : "—";
          rankLine = `Rede: vencedor «${winner.label}» (CTR ${wCtr}) · perdedor «${loser.label}» (CTR ${lCtr})`;
        } else if (winner) {
          rankLine = `Rede: «${winner.label}» é a única variante elegível (≥ ${r.min_impressions} imp.).`;
        } else if (data.ranking_error) {
          rankLine = `Ranking: ${data.ranking_error}`;
        } else {
          rankLine = r.note;
        }
      } else if (data.ranking_error) {
        rankLine = `Ranking: ${data.ranking_error}`;
      }

      setPreview({
        detail: data.detail,
        next_action: data.next_action
          ? { type: data.next_action.type, label: data.next_action.label }
          : null,
        rankLine,
      });
    });
  }, [hint, projectId, campaign.id]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  if (!hint) return null;

  const canPublish = preview?.next_action != null;

  return (
    <div className="mt-1 space-y-1">
      {preview?.rankLine ? (
        <p className="text-[10px] leading-snug text-muted-foreground max-w-md">{preview.rankLine}</p>
      ) : null}
      {preview?.detail ? (
        <p className="text-[10px] leading-snug text-muted-foreground max-w-md">{preview.detail}</p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 px-2 text-[11px]"
          disabled={busy != null || !canPublish}
          title={
            canPublish
              ? `Publicar «${preview?.next_action?.label ?? ""}»`
              : "Sem rascunho por publicar — use «Sugerir mensagens» ou crie uma variante no assistente."
          }
          onClick={() => {
            setBusy("apply");
            void paidAdsService
              .applyCreativeSwap(projectId, campaign.id)
              .then(({ data, error }) => {
                if (error) {
                  toast.error(error);
                  return;
                }
                if (data?.apply_error) {
                  toast.warning(
                    `Pedido criado (${data.change_request_status}): ${data.apply_error}`,
                  );
                  // Flag stays set on failed apply — refresh preview only so retry remains available.
                  loadPreview();
                  return;
                }
                toast.success(
                  data?.change_request_status === "pending"
                    ? "Pedido na fila de aprovações — reveja em Aprovações."
                    : `Criativo enfileirado (${data?.change_request_status ?? "ok"}).`,
                );
                reload();
              })
              .finally(() => setBusy(null));
          }}
        >
          {busy === "apply" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden /> : null}
          Publicar variante
        </Button>
        {supportsMessageRecs ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={busy != null}
            onClick={() => {
              setBusy("recs");
              void paidAdsService
                .recommendMessageOffer(projectId, campaign.id, true)
                .then(({ data, error }) => {
                  if (error) {
                    toast.error(error);
                    return;
                  }
                  const n = data?.persisted_ids?.length ?? 0;
                  if (data?.llm_error) {
                    toast.warning(data.llm_error);
                  }
                  if (n > 0) {
                    toast.success(
                      `${n} rascunho(s) de mensagem criados — pode publicar a variante.`,
                    );
                  } else if (data?.persist_detail) {
                    toast.message(data.persist_detail);
                  } else if (!data?.llm_error) {
                    toast.message(data?.detail ?? "Sem novas variantes distintas.");
                  }
                  loadPreview();
                  if (n > 0) reload();
                })
                .finally(() => setBusy(null));
            }}
          >
            {busy === "recs" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden /> : null}
            Sugerir mensagens
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px]"
          disabled={busy != null}
          onClick={() => {
            setBusy("dismiss");
            void paidAdsService
              .dismissCreativeSwap(projectId, campaign.id)
              .then(({ error }) => {
                if (error) {
                  toast.error(error);
                  return;
                }
                toast.success("Sugestão marcada como tratada.");
                reload();
              })
              .finally(() => setBusy(null));
          }}
        >
          {busy === "dismiss" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden /> : null}
          Tratado
        </Button>
      </div>
    </div>
  );
}
