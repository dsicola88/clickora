import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  let accountName: string | null = null;
  if (platform === "google") {
    available = !!googleAvailable;
    connected = isConnConnected(googleConn);
    accountName = googleConn?.account_name?.trim() || null;
  } else if (platform === "meta") {
    available = !!metaAvailable;
    connected = isConnConnected(metaConn);
    accountName =
      (metaConn as { account_name?: string | null } | null | undefined)?.account_name?.trim() || null;
  } else {
    available = !!tikAvailable;
    connected = isConnConnected(tikConn);
    accountName =
      (tikConn as { account_name?: string | null } | null | undefined)?.account_name?.trim() || null;
  }

  const label = PLATFORM_LABEL[platform];
  const contaPath =
    platform === "google"
      ? `/tracking/dpilot/p/${projectId}/google`
      : platform === "meta"
        ? `/tracking/dpilot/p/${projectId}/meta`
        : `/tracking/dpilot/p/${projectId}/tiktok`;
  const oauthBusy = connecting !== null;

  const guardrails = overview?.guardrails as { allowed_countries?: string[] } | undefined;
  const allowedCountries = Array.isArray(guardrails?.allowed_countries)
    ? guardrails.allowed_countries.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
    : [];
  const visaoScopeHref = `/tracking/dpilot/p/${projectId}/visao#dpilot-guardrails-scope`;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">Conta {label}</p>
        {!available ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">OAuth indisponível no servidor.</p>
        ) : connected ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Ligada
            {accountName ? (
              <span className="font-normal text-muted-foreground">· {accountName}</span>
            ) : null}
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Ainda não ligada — ligue antes de publicar.
          </p>
        )}
        {allowedCountries.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Mercados: {allowedCountries.join(", ")} ·{" "}
            <Link to={visaoScopeHref} className="underline underline-offset-2 hover:text-foreground">
              Escopo
            </Link>
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            <Link to={visaoScopeHref} className="underline underline-offset-2 hover:text-foreground">
              Escopo geográfico
            </Link>
          </p>
        )}
      </div>
      {!connected && available ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={oauthBusy} onClick={() => void startOAuth(platform)}>
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
            <Link to={contaPath}>Conta</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
