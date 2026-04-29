import { Gavel } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Platform = "google" | "meta" | "tiktok";

const COPY: Record<
  Platform,
  { title: string; choice: string; auction: string }
> = {
  google: {
    title: "O que escolhe aqui vs. o que o Google decide no leilão",
    choice:
      "Escolhe a estratégia de licitação ao nível da campanha (por exemplo maximizar cliques, maximizar conversões, CPA ou ROAS alvo). Isso diz ao Google Ads que resultado optimizar dentro do orçamento.",
    auction:
      "O custo por clique (CPC) efectivo em cada impressão é definido pelo Google Ads em tempo real: leilão, concorrência, qualidade do anúncio e probabilidade de conversão. Não fixamos um CPC único na app — a plataforma ajusta continuamente.",
  },
  meta: {
    title: "Objetivo da campanha e leilão Meta",
    choice:
      "O objetivo (tráfego, leads, vendas, etc.) alinha-se aos tipos de campanha Meta (OUTCOME_*). O conjunto de anúncios usa uma meta de optimização coerente com esse objetivo.",
    auction:
      "O custo por resultado (clique, impressão, conversão atribuída) varia leilão a leilão. A Meta define licitações para entregar o objetivo; nós geramos segmentação e criativos alinhados ao público e idioma.",
  },
  tiktok: {
    title: "Objetivo TikTok e leilão",
    choice:
      "O tipo de objective da campanha na API TikTok (tráfego, conversões, leads, etc.) orienta o sistema de entrega e métricas.",
    auction:
      "CPM/CPC efectivos dependem do leilão, criativo e audiência. Os hooks e copy devem soar nativos no idioma do público — o TikTok optimiza entrega em tempo real.",
  },
};

/** Explicação curta: escolha do anunciante/autopilot vs. plataforma que licita no leilão. */
export function DpilotAuctionEducationBanner({ platform }: { platform: Platform }) {
  const c = COPY[platform];
  return (
    <Alert className="border-amber-500/20 bg-amber-500/[0.05]">
      <Gavel className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden />
      <AlertTitle className="text-sm text-foreground">{c.title}</AlertTitle>
      <AlertDescription className="text-xs leading-relaxed text-muted-foreground space-y-2">
        <p>
          <span className="font-medium text-foreground">A sua escolha:</span> {c.choice}
        </p>
        <p>
          <span className="font-medium text-foreground">Depois, na rede:</span> {c.auction}
        </p>
      </AlertDescription>
    </Alert>
  );
}
