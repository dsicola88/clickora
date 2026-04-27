import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDpilotPaid } from "./DpilotPaidContext";

type Platform = "google" | "meta" | "tiktok";

function show(only: Platform | "all" | undefined, p: Platform) {
  if (!only || only === "all") return true;
  return only === p;
}

export function DpilotPaidOauthGrid({ only }: { only?: "google" | "meta" | "tiktok" | "all" }) {
  const p = useDpilotPaid();
  const {
    projectId,
    overview,
    oauthConfig,
    connecting,
    startOAuth,
    disconnect,
    isConnConnected,
  } = p;
  const googleConn = overview?.connection as {
    status?: string;
    account_name?: string | null;
    error_message?: string | null;
  };
  const metaConn = p.metaConn;
  const tikConn = p.tikConn;
  const googleAvailable = oauthConfig?.google?.available;
  const metaAvailable = oauthConfig?.meta?.available;
  const tikAvailable = oauthConfig?.tiktok?.available;
  const cols = only && only !== "all" ? "grid-cols-1 max-w-md" : "md:grid-cols-3";

  return (
    <div className={`grid gap-4 ${cols}`}>
      {show(only, "google") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Google Ads</CardTitle>
            <CardDescription>
              {googleAvailable
                ? "Servidor com credenciais Google Ads (OAuth + developer token)."
                : "Configure credenciais na API (GOOGLE_ADS_* + token de programador)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm">
              {googleAvailable ? (
                <>
                  {isConnConnected(googleConn) ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Ligado{googleConn?.account_name ? ` — ${googleConn.account_name}` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Não ligado (OAuth ainda não concluído)</span>
                  )}
                  {googleConn?.error_message && googleConn.status === "error" ? (
                    <span className="mt-1 block text-xs text-destructive">{googleConn.error_message}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">Ligação indisponível até a API estar configurada.</span>
              )}
            </p>
            <Button
              type="button"
              disabled={!projectId || !googleAvailable || connecting === "google"}
              onClick={() => void startOAuth("google")}
            >
              {connecting === "google"
                ? "A redirecionar…"
                : isConnConnected(googleConn)
                  ? "Reautenticar"
                  : "Ligar Google"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!projectId || !isConnConnected(googleConn)}
              onClick={() => void disconnect("google")}
            >
              Desligar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {show(only, "meta") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meta</CardTitle>
            <CardDescription>
              {metaAvailable
                ? "App Facebook/Meta com redirect registado (mesmo base URL que a API pública)."
                : "Defina META_APP_ID e META_APP_SECRET na API (ex. Railway)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm">
              {metaAvailable ? (
                <>
                  {isConnConnected(metaConn) ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Ligado{metaConn?.account_name ? ` — ${metaConn.account_name}` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Não ligado</span>
                  )}
                  {metaConn?.error_message && metaConn?.status === "error" ? (
                    <span className="mt-1 block text-xs text-destructive">{metaConn.error_message}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">Botão desactivado: falta configuração no servidor.</span>
              )}
            </p>
            <Button
              type="button"
              disabled={!projectId || !metaAvailable || connecting === "meta"}
              onClick={() => void startOAuth("meta")}
            >
              {connecting === "meta"
                ? "A redirecionar…"
                : isConnConnected(metaConn)
                  ? "Reautenticar"
                  : "Ligar Meta"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!projectId || !isConnConnected(metaConn)}
              onClick={() => void disconnect("meta")}
            >
              Desligar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {show(only, "tiktok") ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">TikTok</CardTitle>
            <CardDescription>
              {oauthConfig?.tiktok?.available
                ? "App de marketing TikTok (redirects alinhados com a API)."
                : "Defina TIKTOK_APP_ID e TIKTOK_APP_SECRET na API (ex. Railway)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm">
              {tikAvailable ? (
                <>
                  {isConnConnected(tikConn) ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Ligado{tikConn?.account_name ? ` — ${tikConn.account_name}` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Não ligado</span>
                  )}
                  {tikConn?.error_message && tikConn?.status === "error" ? (
                    <span className="mt-1 block text-xs text-destructive">{tikConn.error_message}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-muted-foreground">Botão desactivado: falta configuração no servidor.</span>
              )}
            </p>
            <Button
              type="button"
              disabled={!projectId || !tikAvailable || connecting === "tiktok"}
              onClick={() => void startOAuth("tiktok")}
            >
              {connecting === "tiktok"
                ? "A redirecionar…"
                : isConnConnected(tikConn)
                  ? "Reautenticar"
                  : "Ligar TikTok"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!projectId || !isConnConnected(tikConn)}
              onClick={() => void disconnect("tiktok")}
            >
              Desligar
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
