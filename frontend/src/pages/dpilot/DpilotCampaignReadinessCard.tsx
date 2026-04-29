import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDpilotPaid } from "./DpilotPaidContext";

const PLATFORM_LABEL: Record<"google" | "meta" | "tiktok", string> = {
  google: "Google Ads",
  meta: "Meta (Facebook / Instagram)",
  tiktok: "TikTok Ads",
};

const TIPS: Record<"google" | "meta" | "tiktok", string[]> = {
  google: [
    "Campanhas de Pesquisa usam a conta Google Ads ligada por OAuth e o customer ID escolhido na ligação.",
    "O orçamento diário é indicado em USD; os guardrails do projeto aplicam-se antes da publicação.",
    "Conversões e etiquetas opcionais melhoram relatórios — configure-as na conta Google quando fizer sentido.",
  ],
  meta: [
    "Anúncios com destino a um site costumam exigir uma Página Facebook associada ao negócio (o administrador pode configurar META_PROMOTED_PAGE_ID ou META_PAGE_ID na API).",
    "Imagens ou vídeo ajudam o assistente a montar criativos; sem ficheiro, o plano pode usar texto e stock conforme a conta.",
    "Categorias especiais (crédito, emprego, habitação, etc.) implicam regras extra de segmentação no Meta.",
  ],
  tiktok: [
    "Vídeo vertical (9:16) é o formato mais natural no feed; imagem também é aceite.",
    "Objetivos como conversões ou instalações podem exigir pixel ou app configurados na conta TikTok Ads.",
    "O assistente gera rascunhos; criativos complexos podem ser refinados depois no TikTok Ads Manager.",
  ],
};

export function DpilotCampaignReadinessCard({ platform }: { platform: "google" | "meta" | "tiktok" }) {
  const {
    projectId,
    overview,
    oauthConfig,
    metaConn,
    tikConn,
    isConnConnected,
    startOAuth,
    connecting,
  } = useDpilotPaid();

  const googleConn = overview?.connection as
    | { status?: string; account_name?: string | null }
    | undefined;

  const googleAvailable = oauthConfig?.google?.available;
  const metaAvailable = oauthConfig?.meta?.available;
  const tikAvailable = oauthConfig?.tiktok?.available;

  let available = false;
  let connected = false;
  if (platform === "google") {
    available = !!googleAvailable;
    connected = isConnConnected(googleConn);
  } else if (platform === "meta") {
    available = !!metaAvailable;
    connected = isConnConnected(metaConn);
  } else {
    available = !!tikAvailable;
    connected = isConnConnected(tikConn);
  }

  const label = PLATFORM_LABEL[platform];
  const ligacoesPath = `/tracking/dpilot/p/${projectId}/ligacoes`;
  const oauthBusy = connecting !== null;

  const guardrails = overview?.guardrails as { allowed_countries?: string[] } | undefined;
  const allowedCountries = Array.isArray(guardrails?.allowed_countries)
    ? guardrails.allowed_countries.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
    : [];
  const visaoScopeHref = `/tracking/dpilot/p/${projectId}/visao#dpilot-guardrails-scope`;

  return (
    <Card className="border-primary/15 bg-muted/25">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Antes de preencher — conta e boas práticas</CardTitle>
        <CardDescription>Ligação OAuth e lembretes para {label}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!available ? (
          <Alert className="border-amber-500/40 bg-amber-500/5">
            <AlertTitle className="text-sm">Ligação indisponível neste ambiente</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              O servidor precisa de credenciais OAuth configuradas para {label}. Contacte o administrador ou consulte a
              documentação da API.
            </AlertDescription>
          </Alert>
        ) : connected ? (
          <div className="flex gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="leading-snug">
              <span className="font-medium">Conta ligada.</span> Pode gerar o plano com segurança; aplicação na rede
              depende do modo Copilot / Autopilot e dos pedidos em «Aprovações».
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-1.5 leading-snug">
                <p>
                  <span className="font-medium">Conta ainda não ligada.</span> Pode gerar rascunhos e pedidos na mesma;
                  para publicar na rede depois, ligue {label} em «Ligações às redes».
                </p>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <Button
                    type="button"
                    size="sm"
                    disabled={oauthBusy}
                    onClick={() => void startOAuth(platform)}
                  >
                    {connecting === platform ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                        A redirecionar…
                      </>
                    ) : (
                      `Ligar ${label}`
                    )}
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={ligacoesPath}>Abrir ligações</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground leading-relaxed">
          {TIPS[platform].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>

        {allowedCountries.length > 0 ? (
          <div className="rounded-lg border border-border bg-background/80 px-3 py-2.5 text-xs leading-relaxed">
            <p>
              <span className="font-medium text-foreground">Países permitidos pelos guardrails:</span>{" "}
              <span className="tabular-nums">{allowedCountries.join(", ")}</span>
            </p>
            <p className="mt-1 text-muted-foreground">
              Os países da campanha têm de estar nesta lista — ajuste na{" "}
              <Link to={visaoScopeHref} className="font-medium text-primary underline underline-offset-2">
                Visão geral → Escopo geográfico
              </Link>{" "}
              se precisar de outros mercados.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
