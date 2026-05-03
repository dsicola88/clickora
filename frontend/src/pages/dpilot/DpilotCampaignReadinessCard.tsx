import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDpilotPaid } from "./DpilotPaidContext";

const PLATFORM_LABEL: Record<"google" | "meta" | "tiktok", string> = {
  google: "Google Ads",
  meta: "Meta (Facebook / Instagram)",
  tiktok: "TikTok Ads",
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
        <CardTitle className="text-base">Conta {label}</CardTitle>
        <p className="text-[11px] leading-snug text-muted-foreground pt-1">
          Ligue primeiro a conta onde as campanhas serão criadas — o fluxo seguinte mantém‑se dentro dos guardrails deste
          projeto.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!available ? (
          <Alert className="border-amber-500/40 bg-amber-500/5">
            <AlertTitle className="text-sm">OAuth indisponível</AlertTitle>
            <AlertDescription className="text-xs">
              Credenciais {label} em falta no servidor.
            </AlertDescription>
          </Alert>
        ) : connected ? (
          <div className="flex gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="leading-snug font-medium">Conta ligada</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <div className="space-y-1.5 leading-snug">
                <p className="font-medium">Conta não ligada</p>
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
                    <Link to={ligacoesPath}>Ligações</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {allowedCountries.length > 0 ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            Mercados permitidos (guardrail): {allowedCountries.join(", ")} ·{" "}
            <Link to={visaoScopeHref} className="text-primary underline underline-offset-2">
              Visão geral
            </Link>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            <Link to={visaoScopeHref} className="text-primary underline underline-offset-2">
              Escopo geográfico (Visão geral)
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
