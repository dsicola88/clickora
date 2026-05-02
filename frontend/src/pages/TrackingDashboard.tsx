import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShoppingCart,
  Copy,
  Check,
  Code,
  FileDown,
  LayoutDashboard,
  ArrowRight,
  Target,
  Loader2,
  BarChart3,
  Link2,
  Info,
  Globe,
  Building2,
  ChevronDown,
  Share2,
  AlertTriangle,
  ListChecks,
  Music2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { analyticsService } from "@/services/analyticsService";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { integrationsService } from "@/services/integrationsService";
import { userCanWriteIntegrations } from "@/lib/workspaceCapabilities";
import { Switch } from "@/components/ui/switch";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import { formatGoogleAdsDashboardMoney } from "@/lib/googleAdsDashboardMoney";
import { GOOGLE_ADS_OFFLINE_CLICK_IMPORT_HELP_URL } from "@/lib/googleAdsOfflineImport";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DashboardUserGuide } from "@/components/DashboardUserGuide";
import { DateRangeFilter } from "@/components/DateRangeFilter";

const GOOGLE_OAUTH_PLAYGROUND = "https://developers.google.com/oauthplayground/";
const GOOGLE_ADS_OAUTH_DOC = "https://developers.google.com/google-ads/api/docs/oauth/overview";
const GOOGLE_CLOUD_CREDENTIALS = "https://console.cloud.google.com/apis/credentials";

function SyncHealthBanner({
  dashboard,
}: {
  dashboard: {
    sync_health?: {
      period_days: number;
      google_ads_failed: number;
      meta_capi_failed: number;
      tiktok_events_failed?: number;
    };
  } | null;
}) {
  const sh = dashboard?.sync_health;
  if (!sh) return null;
  const tt = sh.tiktok_events_failed ?? 0;
  const total = sh.google_ads_failed + sh.meta_capi_failed + tt;
  if (total <= 0) return null;
  const parts: string[] = [];
  if (sh.google_ads_failed > 0) {
    parts.push(`${sh.google_ads_failed} conversão(ões) com falha no Google Ads`);
  }
  if (sh.meta_capi_failed > 0) {
    parts.push(`${sh.meta_capi_failed} conversão(ões) com falha na Meta CAPI`);
  }
  if (tt > 0) {
    parts.push(`${tt} conversão(ões) com falha no TikTok Events API`);
  }
  return (
    <Alert className="border-amber-500/35 bg-amber-500/[0.07] text-foreground">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-950 dark:text-amber-100">Atenção: envios para plataformas de anúncios</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        Últimos {sh.period_days}d (UTC): {parts.join(" · ")}. Detalhes e sync em{" "}
        <Link className="font-medium text-primary underline underline-offset-2" to="/tracking/relatorios">
          Relatórios → Conversões
        </Link>
        {" — "}revise tokens/IDs nas secções abaixo.
      </AlertDescription>
    </Alert>
  );
}

function SetupAssistantCallout() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-4 py-3 text-sm">
      <div className="flex items-start gap-2 min-w-0">
        <ListChecks className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" aria-hidden />
        <p className="text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground/90">Assistente:</span> checklist presell, UTMs, webhooks e redes —
          métricas usam as datas deste resumo.
        </p>
      </div>
      <Button variant="secondary" size="sm" className="shrink-0" asChild>
        <Link to="/tracking/setup-assistant">Abrir assistente</Link>
      </Button>
    </div>
  );
}

/** Data local (YYYY-MM-DD) — evita deslocar o dia/ano vs UTC em <input type="date">. */
function formatDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { start: formatDateInput(start), end: formatDateInput(end) };
}

type GoogleAdsQueryData = {
  google_ads_enabled: boolean;
  google_ads_customer_id: string;
  google_ads_conversion_action_id: string;
  google_ads_login_customer_id: string;
  has_refresh_token: boolean;
  api_env_configured: boolean;
  can_upload: boolean;
};

function GoogleAdsConversionUploadCard({
  googleAds,
  gaEnabled,
  setGaEnabled,
  gaCustomerId,
  setGaCustomerId,
  gaActionId,
  setGaActionId,
  gaLoginMcc,
  setGaLoginMcc,
  gaRefresh,
  setGaRefresh,
  saveGoogleAds,
  integrationsLocked = false,
}: {
  googleAds: GoogleAdsQueryData | undefined;
  gaEnabled: boolean;
  setGaEnabled: (v: boolean) => void;
  gaCustomerId: string;
  setGaCustomerId: (v: string) => void;
  gaActionId: string;
  setGaActionId: (v: string) => void;
  gaLoginMcc: string;
  setGaLoginMcc: (v: string) => void;
  gaRefresh: string;
  setGaRefresh: (v: string) => void;
  saveGoogleAds: { mutate: () => void; isPending: boolean };
  integrationsLocked?: boolean;
}) {
  const beginGoogleAdsOAuth = useMutation({
    mutationFn: async () => {
      const { data, error } = await integrationsService.beginGoogleAdsOAuth();
      if (error) throw new Error(error);
      if (!data?.authorize_url) throw new Error("Resposta inválida do servidor.");
      return data.authorize_url;
    },
    onSuccess: (authorizeUrl) => {
      window.location.assign(authorizeUrl);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300">
          <Target className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-semibold text-card-foreground">Google Ads — conversão por clique (API, servidor a servidor)</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Backend envia vendas para <strong className="font-medium text-foreground/90">conversões por clique</strong> offline (com{" "}
            <span className="font-mono text-[11px]">gclid</span>/<span className="font-mono text-[11px]">gbraid</span>/<span className="font-mono text-[11px]">wbraid</span>) — paralelo ao CSV manual em baixo.
          </p>
        </div>
      </div>

      <Alert className="border-sky-500/35 bg-sky-500/[0.07]">
        <Info className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        <AlertTitle className="text-sm text-foreground">Porque não vê «OAuth» dentro do Google Ads</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5 space-y-2">
          <p>
            Em <strong className="text-foreground/90">ads.google.com</strong> configura <strong className="text-foreground/90">campanhas, conversões e o ID da conta</strong>.
            O <strong className="text-foreground/90">refresh token</strong> <em>não</em> é um menu lá: obtém-se no{" "}
            <a
              href={GOOGLE_OAUTH_PLAYGROUND}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium underline underline-offset-2 hover:text-primary/90"
            >
              OAuth 2.0 Playground
            </a>
            , com um <strong className="text-foreground/90">Client ID e Client Secret</strong> criados no{" "}
            <a
              href={GOOGLE_CLOUD_CREDENTIALS}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium underline underline-offset-2 hover:text-primary/90"
            >
              Google Cloud Console → Credenciais
            </a>{" "}
            (projeto com Google Ads API ativa). O botão <strong className="text-foreground/90">Ligar com Google</strong> abaixo faz esse passo pelo browser;
            a secção rebatível é a alternativa manual (Playground).
          </p>
          <p>
            O <span className="font-mono text-[11px]">GOOGLE_ADS_DEVELOPER_TOKEN</span> vem do{" "}
            <strong className="text-foreground/90">Centro da API</strong> do Google Ads (costuma estar em{" "}
            <strong className="text-foreground/90">Ferramentas e definições</strong> → <strong className="text-foreground/90">Configuração</strong> →{" "}
            <strong className="text-foreground/90">Centro da API</strong>, ou pesquise «API» na caixa de pesquisa do Google Ads). Quem gere o servidor cola-o nas variáveis de ambiente — não aparece como campo nesta página.
          </p>
        </AlertDescription>
      </Alert>

      <Collapsible className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-left text-sm font-medium text-foreground hover:opacity-90 [&[data-state=open]>svg]:rotate-180">
          <span className="inline-flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            Mapa: onde fica cada exigência (Ads · Cloud · dclickora)
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-border/50 mt-2 space-y-3">
            <div>
              <p className="font-medium text-foreground">Só no Google Ads (interface de anúncios)</p>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>
                  <strong className="text-foreground/90">Customer ID</strong> — canto superior direito (ou menu do perfil / selector de conta).
                </li>
                <li>
                  <strong className="text-foreground/90">Ações de conversão e ID (ctId / ctld)</strong> — ícone{" "}
                  <strong className="text-foreground/90">Metas</strong> → <strong className="text-foreground/90">Conversões</strong> →{" "}
                  <strong className="text-foreground/90">Resumo</strong>; abra o nome da ação e veja a barra de endereço. (Em contas antigas, «Ferramentas → Conversões» pode abrir o mesmo sítio.)
                </li>
                <li>
                  <strong className="text-foreground/90">Etiquetagem automática</strong> — para existir <span className="font-mono text-[10px]">gclid</span>:{" "}
                  <strong className="text-foreground/90">Ferramentas e definições</strong> (ícone de chave) → definições da conta → procure{" "}
                  <strong className="text-foreground/90">Etiquetagem automática</strong>, ou use a pesquisa no topo do Google Ads.
                </li>
                <li>
                  <strong className="text-foreground/90">Developer token</strong> (para o backend) —{" "}
                  <strong className="text-foreground/90">Centro da API</strong> no Google Ads; o texto amarelo desta página lista o nome da variável.
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Fora do Google Ads (ligação à API / OAuth)</p>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>
                  <strong className="text-foreground/90">Client ID e Client Secret</strong> —{" "}
                  <a
                    href={GOOGLE_CLOUD_CREDENTIALS}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    console.cloud.google.com
                  </a>
                  , tipo «ID do cliente OAuth».
                </li>
                <li>
                  <strong className="text-foreground/90">Refresh token</strong> —{" "}
                  <a
                    href={GOOGLE_OAUTH_PLAYGROUND}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    OAuth Playground
                  </a>{" "}
                  com âmbito Google Ads API (<span className="font-mono text-[10px]">…/auth/adwords</span>), como na secção rebatível abaixo.
                </li>
                <li>
                  Documentação:{" "}
                  <a
                    href={GOOGLE_ADS_OAUTH_DOC}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    OAuth na Google Ads API
                  </a>
                  .
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Nesta página (dclickora)</p>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                <li>
                  Colar <strong className="text-foreground/90">Customer ID</strong>, <strong className="text-foreground/90">ID da ação</strong>,{" "}
                  <strong className="text-foreground/90">Login MCC</strong> se aplicável, <strong className="text-foreground/90">refresh token</strong>, ativar o interruptor e <strong className="text-foreground/90">Guardar</strong>.
                </li>
              </ul>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground mb-1.5">Para o automático funcionar, tem de existir:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <strong className="text-foreground/90">Clique com ID do Google</strong> (<span className="font-mono text-[10px]">gclid</span> /{" "}
            <span className="font-mono text-[10px]">gbraid</span> / <span className="font-mono text-[10px]">wbraid</span>) — o script na presell regista o clique.
          </li>
          <li>
            <strong className="text-foreground/90">Postback</strong> da plataforma em <strong className="text-foreground/90">Plataformas</strong> a marcar a venda como aprovada no dclickora.
          </li>
          <li>
            <strong className="text-foreground/90">Ação de conversão</strong> no Google Ads compatível com <strong className="text-foreground/90">importação por clique</strong> (não só chamadas).
          </li>
          <li>
            <strong className="text-foreground/90">OAuth + API</strong> em baixo e credenciais da API ativas no serviço (mensagem em amarelo, se faltar algo no servidor).
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-3 sm:px-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Configurar a importação automática (Google Ads ↔ dclickora)</p>
        <div className="grid gap-4 sm:grid-cols-2 text-xs text-muted-foreground leading-relaxed">
          <div className="space-y-2">
            <p className="font-medium text-foreground">No Google Ads</p>
            <ol className="list-decimal pl-4 space-y-2">
              <li>
                Ícone <strong className="text-foreground/90">Metas</strong> → <strong className="text-foreground/90">Conversões</strong> →{" "}
                <strong className="text-foreground/90">Resumo</strong> (o mesmo sítio onde vê «+ Criar ação de conversão»).
              </li>
              <li>
                <strong className="text-foreground/90">+ Criar ação de conversão</strong> → <strong className="text-foreground/90">Importar</strong> →{" "}
                <strong className="text-foreground/90">Importação manual com a API ou carregamentos</strong>. Use uma ação por{" "}
                <strong className="text-foreground/90">clique (GCLID)</strong>, não conversões só de chamadas.
              </li>
              <li>
                <strong className="text-foreground/90">Customer ID:</strong> número no canto superior direito da conta — no dclickora use{" "}
                <strong className="text-foreground/90">só os 10 dígitos, sem hífenes</strong>.
              </li>
              <li>
                <strong className="text-foreground/90">ID da ação de conversão:</strong> no <strong className="text-foreground/90">Resumo</strong>, clique no{" "}
                <strong className="text-foreground/90">nome da ação</strong> → na barra de endereço procure{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">ctId=</code> (ou parâmetro parecido, ex.{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">ctld=</code>) e copie o número.
              </li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">No dclickora (esta página)</p>
            <ol className="list-decimal pl-4 space-y-2">
              <li>
                Cole o <strong className="text-foreground/90">Customer ID</strong> e o <strong className="text-foreground/90">ID da ação de conversão</strong>{" "}
                nos campos abaixo (os mesmos valores do passo anterior).
              </li>
                <li>
                  Use <strong className="text-foreground/90">Ligar com Google</strong> (recomendado) ou cole o refresh token manualmente em baixo — com a mesma conta Google do Ads.
                </li>
              <li>
                Ative <strong className="text-foreground/90">importação automática no Google Ads</strong> e clique em{" "}
                <strong className="text-foreground/90">Guardar Google Ads</strong>.
              </li>
              <li>
                Confirme o <strong className="text-foreground/90">script</strong> na presell (secção acima nesta página) e o <strong className="text-foreground/90">postback</strong> da rede em{" "}
                <strong className="text-foreground/90">Plataformas</strong> — sem isso não há venda aprovada para enviar.
              </li>
            </ol>
          </div>
        </div>
      </div>

      <Collapsible className="rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-left text-sm font-medium text-foreground hover:opacity-90 [&[data-state=open]>svg]:rotate-180">
          <span className="inline-flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            Ordem do envio automático (o que acontece em cadeia)
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="text-xs text-muted-foreground leading-relaxed pt-2 border-t border-blue-500/15 mt-2 list-decimal pl-4 space-y-1.5">
            <li>
              Utilizador clica no anúncio; com etiquetagem automática, o URL traz <span className="font-mono text-[11px]">gclid</span> (ou equivalente).
            </li>
            <li>
              A presell com o <strong className="text-foreground/90">script dclickora</strong> regista o clique e guarda esse ID.
            </li>
            <li>
              A rede envia o <strong className="text-foreground/90">postback</strong>; o dclickora cria a conversão <strong className="text-foreground/90">aprovada</strong>.
            </li>
            <li>
              Se esta secção estiver ligada e bem configurada, o <strong className="text-foreground/90">servidor</strong> chama a{" "}
              <strong className="text-foreground/90">Google Ads API</strong> e associa a conversão à ação que indicou.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground leading-relaxed pt-2">
            Documentação Google:{" "}
            <a
              href={GOOGLE_ADS_OAUTH_DOC}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/90"
            >
              OAuth na Google Ads API
            </a>
            .
          </p>
        </CollapsibleContent>
      </Collapsible>

      <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-3 space-y-2 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground text-sm">Conta simples vs conta gestora (MCC)</p>
        <ul className="space-y-2 leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-foreground/90">Conta simples:</strong> em <strong className="text-foreground/90">Customer ID</strong> cola o ID da
            própria conta Google Ads (10 dígitos). Deixa <strong className="text-foreground/90">Login customer ID</strong> vazio. O OAuth (refresh token)
            deve ser da mesma conta.
          </li>
          <li>
            <strong className="text-foreground/90">Via MCC:</strong> <strong className="text-foreground/90">Customer ID</strong> é sempre o da{" "}
            <em>conta cliente</em> onde está a campanha e a ação de conversão. Em <strong className="text-foreground/90">Login customer ID</strong> cola o
            ID da <em>conta gestora</em> com que o OAuth entra. O refresh token deve ter acesso a essa gestão.
          </li>
        </ul>
        <p className="text-[11px] pt-1 border-t border-border/50">
          <strong className="text-foreground/90">Importante:</strong> o MCC deve ser configurado aqui por perfil — não depender de variáveis globais no
          servidor para contas mistas, para o envio não falhar em contas diretas.
        </p>
      </div>

      {!googleAds?.api_env_configured && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
          Variáveis <span className="font-mono">GOOGLE_ADS_DEVELOPER_TOKEN</span>, <span className="font-mono">GOOGLE_ADS_CLIENT_ID</span> e{" "}
          <span className="font-mono">GOOGLE_ADS_CLIENT_SECRET</span> são obrigatórias no servidor. O refresh pode vir de{" "}
          <strong className="font-medium text-foreground/90">Ligar com Google</strong> (por utilizador), do campo manual abaixo ou de{" "}
          <span className="font-mono">GOOGLE_ADS_REFRESH_TOKEN</span> no ambiente (legado).
        </p>
      )}
      {googleAds?.api_env_configured ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-3 space-y-2">
          <p className="text-sm font-medium text-foreground">Ligar conta Google Ads (recomendado)</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Um login com a <strong className="text-foreground/90">mesma conta Google</strong> do anúncio. O token fica guardado só no{" "}
            <strong className="text-foreground/90">seu utilizador</strong> (multi-inquilino). No projeto Google Cloud, o tipo de cliente OAuth tem de ser{" "}
            <strong className="text-foreground/90">Aplicação Web</strong> e o URI de redireccionamento autorizado tem de coincidir com o callback da API
            (veja <span className="font-mono text-[11px]">GOOGLE_ADS_OAUTH_REDIRECT_URI</span> ou{" "}
            <span className="font-mono text-[11px]">API_PUBLIC_URL</span> no servidor).
          </p>
          <Button
            type="button"
            className="gap-2"
            disabled={integrationsLocked || beginGoogleAdsOAuth.isPending}
            onClick={() => beginGoogleAdsOAuth.mutate()}
          >
            {beginGoogleAdsOAuth.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Ligar com Google
          </Button>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <Switch id="ga-enabled" checked={gaEnabled} disabled={integrationsLocked} onCheckedChange={setGaEnabled} />
        <Label htmlFor="ga-enabled" className="text-sm cursor-pointer">
          Ativar importação automática no Google Ads após venda aprovada
        </Label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Customer ID</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Igual ao número no canto superior direito do Google Ads (10 dígitos, <strong className="text-foreground/90">sem hífenes</strong>). Em MCC: conta{" "}
            <em>cliente</em> onde está a campanha, não a gestora.
          </p>
          <Input
            value={gaCustomerId}
            readOnly={integrationsLocked}
            onChange={(e) => setGaCustomerId(e.target.value)}
            placeholder="1234567890"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">ID da ação de conversão</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Número na URL ao abrir a ação em <strong className="text-foreground/90">Metas → Conversões → Resumo</strong> (geralmente após{" "}
            <code className="rounded bg-muted px-0.5 text-[10px]">ctId=</code> ou <code className="rounded bg-muted px-0.5 text-[10px]">ctld=</code>). Ação de{" "}
            <strong className="text-foreground/90">importação por clique</strong>, não só chamadas.
          </p>
          <Input
            value={gaActionId}
            readOnly={integrationsLocked}
            onChange={(e) => setGaActionId(e.target.value)}
            placeholder="ID numérico da ação (URL ou suporte Google)"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Login customer ID (MCC, opcional)</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Só se o acesso à API for através de uma conta gestora. Vazio = OAuth da própria conta em Customer ID.
          </p>
          <Input
            value={gaLoginMcc}
            readOnly={integrationsLocked}
            onChange={(e) => setGaLoginMcc(e.target.value)}
            placeholder="ID da conta gestora (10 dígitos) ou vazio"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Refresh token manual (opcional)</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Só se não usar «Ligar com Google». Deixe vazio para manter o token já guardado na sua conta.
          </p>
          <Input
            type="password"
            value={gaRefresh}
            readOnly={integrationsLocked}
            onChange={(e) => setGaRefresh(e.target.value)}
            placeholder="Cole o refresh token ou deixe vazio"
            className="font-mono text-xs"
          />
          <Collapsible className="rounded-md border border-border/60 bg-muted/30">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium text-foreground hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180">
              OAuth Playground (alternativa manual ao «Ligar com Google»)
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 border-t border-border/50 px-3 pb-3 pt-2 text-[11px] text-muted-foreground leading-relaxed">
                <p>
                  <strong className="text-foreground/90">Uma vez só</strong>, com a <strong className="text-foreground/90">mesma conta Google</strong>{" "}
                  que usa no Google Ads.
                </p>
                <p>
                  Abra a{" "}
                  <a
                    href={GOOGLE_OAUTH_PLAYGROUND}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    OAuth 2.0 Playground
                  </a>
                  {" "}
                  da Google. Nas definições (engrenagem), ative o uso do seu Client ID e Secret — use os da <strong className="text-foreground/90">dclickora</strong>{" "}
                  (o suporte pode enviar-lhos se precisar).
                </p>
                <p>
                  Escolha o âmbito <span className="font-mono text-[10px]">…/auth/adwords</span> (Google Ads API), autorize, troque o código por tokens e copie o{" "}
                  <strong className="text-foreground/90">Refresh token</strong> para o campo acima. Guarde nesta página.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => saveGoogleAds.mutate()}
          disabled={integrationsLocked || saveGoogleAds.isPending}
          className="gap-2"
        >
          {saveGoogleAds.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar definições
        </Button>
        {googleAds?.can_upload ? (
          <Badge variant="secondary" className="font-normal">
            Pronto a enviar
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Integração incompleta
          </Badge>
        )}
        {googleAds?.has_refresh_token ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            OAuth (refresh) OK
          </Badge>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        <strong className="text-foreground/90">Envio automático</strong> quando a integração está activa, com developer token, OAuth e acção de conversão correctos. O bloco de{" "}
        <strong className="text-foreground/90">ficheiro CSV</strong> é apenas para fluxos manuais na interface Google Ads. O refresh token OAuth é armazenado cifrado no servidor.
      </p>
    </div>
  );
}

const META_CAPI_DOC = "https://developers.facebook.com/docs/marketing-api/conversions-api/get-started";
const META_PIXEL_SETTINGS = "https://business.facebook.com/settings/pixels";
const TIKTOK_EVENTS_DOC = "https://ads.tiktok.com/help/article/events-api";
const TIKTOK_EVENTS_API_PORTAL = "https://business-api.tiktok.com/portal/docs";

/** Gera o ficheiro (.csv) para importação por cliques (GCLID) no Google Ads. */
function GoogleAdsOfflineFileExportCard({
  startDate,
  endDate,
  conversionActionIdHint,
}: {
  startDate: string;
  endDate: string;
  conversionActionIdHint: string;
}) {
  const [conversionName, setConversionName] = useState("");
  const [includeAffiliate, setIncludeAffiliate] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    const name = conversionName.trim();
    if (!name) {
      toast.error("Indique o nome da conversão tal como está em Google Ads → Conversões.");
      return;
    }
    setBusy(true);
    try {
      const { data, error, filename } = await analyticsService.downloadGoogleAdsOfflineImportCsv({
        from: startDate,
        to: endDate,
        conversion_name: name,
        include_affiliate: includeAffiliate,
      });
      if (error || !data) {
        toast.error(error || "Não foi possível gerar o ficheiro.");
        return;
      }
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename?.replace(/[^\w.-]+/g, "_") || "google-ads-offline-gclid.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Ficheiro pronto. Importe em Google Ads → Conversões → importar por cliques.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          <FileDown className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-semibold text-card-foreground">Importação manual no Google Ads</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Período igual ao do gráfico. O ficheiro segue o modelo do Google (GCLID, nome da conversão, data/hora UTC,
            valor, moeda ISO). Só entram linhas com GCLID. Depois do upload, a Google pode demorar algumas horas a
            atualizar estatísticas.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Nome da conversão no Google Ads</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            O mesmo texto que vê em Conversões (não o ID numérico).
            {conversionActionIdHint ? (
              <>
                {" "}
                Referência na dclickora: <span className="font-mono text-[10px]">{conversionActionIdHint}</span>.
              </>
            ) : null}
          </p>
          <Input
            value={conversionName}
            onChange={(e) => setConversionName(e.target.value)}
            placeholder="Igual ao nome em Google Ads → Conversões"
            className="text-sm"
          />
          <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground leading-snug list-disc pl-4 marker:text-muted-foreground/70">
            <li>
              O nome é obrigatório e tem de coincidir com{" "}
              <span className="text-foreground/85">Ferramentas → Medição → Conversões</span> (maiúsculas e espaços
              contam).
            </li>
            <li>
              A data e hora de cada conversão são preenchidas automaticamente em UTC; o valor e a moeda seguem o que
              tem na dclickora (até 2 decimais).
            </li>
            <li>
              A acção na conta tem de aceitar{" "}
              <span className="text-foreground/85">importação por cliques</span>.{" "}
              <a
                href={GOOGLE_ADS_OFFLINE_CLICK_IMPORT_HELP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/90"
              >
                Guia oficial do Google
              </a>
            </li>
          </ul>
        </div>
        <div className="flex items-center gap-3 sm:col-span-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <Switch id="ga-offline-include-aff" checked={includeAffiliate} onCheckedChange={setIncludeAffiliate} />
          <Label htmlFor="ga-offline-include-aff" className="text-sm cursor-pointer leading-snug">
            Incluir também vendas aprovadas (postback) com GCLID no clique
          </Label>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Intervalo do ficheiro:{" "}
        <span className="font-mono text-[10px] text-foreground/80">{startDate}</span>
        {" → "}
        <span className="font-mono text-[10px] text-foreground/80">{endDate}</span>.
      </p>
      <Button
        type="button"
        variant="secondary"
        className="gap-2"
        onClick={() => void handleDownload()}
        disabled={busy || !conversionName.trim()}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {busy ? "A gerar…" : "Ficheiro para Google Ads"}
      </Button>
    </div>
  );
}

function MetaCapiIntegrationCard({
  metaCapi,
  metaEnabled,
  setMetaEnabled,
  metaPixelId,
  setMetaPixelId,
  metaToken,
  setMetaToken,
  metaTestCode,
  setMetaTestCode,
  saveMetaCapi,
  integrationsLocked = false,
}: {
  metaCapi:
    | {
        meta_capi_enabled: boolean;
        meta_pixel_id: string;
        has_access_token: boolean;
        meta_capi_test_event_code: string;
        can_send: boolean;
      }
    | undefined;
  metaEnabled: boolean;
  setMetaEnabled: (v: boolean) => void;
  metaPixelId: string;
  setMetaPixelId: (v: string) => void;
  metaToken: string;
  setMetaToken: (v: string) => void;
  metaTestCode: string;
  setMetaTestCode: (v: string) => void;
  saveMetaCapi: { mutate: () => void; isPending: boolean };
  integrationsLocked?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
          <Share2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-semibold text-card-foreground">Meta — Conversions API (CAPI, servidor a servidor)</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            O envio duplicado do evento <span className="font-mono text-[11px]">Purchase</span> reforça o Pixel no browser, com o mesmo <span className="font-mono text-[11px]">event_id</span> da conversão, para
            deduplicação. O <span className="font-mono text-[11px]">fbclid</span> no URL do clique é exigido para atribuição; o <span className="font-mono text-[11px]">_fbp</span> (cookie) é opcional e melhora o emparelhamento.{" "}
            <a href={META_CAPI_DOC} target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2">
              Conversions API
            </a>
            {" · "}
            <a href={META_PIXEL_SETTINGS} target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2">
              Gestor de Pixels
            </a>
            .
          </p>
        </div>
      </div>

      <Alert className="border-indigo-500/35 bg-indigo-500/[0.07]">
        <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <AlertTitle className="text-sm text-foreground">Boas práticas (Meta Business)</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5 space-y-2">
          <p>
            Crie o token em <strong className="text-foreground/90">Definições empresariais</strong> → <strong className="text-foreground/90">Permissões e identidade</strong> (ou a partir do Pixel) com âmbito adequado; restrinja
            a equipas e rode o token se suspeitar de exposição.
          </p>
          <p>
            O servidor envia <span className="font-mono text-[11px]">order_id</span> (postback) e, quando existir, a URL de origem do clique — parâmetros recomendados pela Meta para o Event Match Quality.
          </p>
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-3">
        <Switch id="meta-capi-enabled" checked={metaEnabled} disabled={integrationsLocked} onCheckedChange={setMetaEnabled} />
        <Label htmlFor="meta-capi-enabled" className="text-sm cursor-pointer">
          Ativar envio de conversões aprovadas
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Pixel ID</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">ID numérico do Pixel (Gestor de eventos → Origens de dados).</p>
          <Input
            value={metaPixelId}
            readOnly={integrationsLocked}
            onChange={(e) => setMetaPixelId(e.target.value)}
            placeholder="ex.: 123456789012345"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Token de acesso (Conversions API)</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Pixel <strong className="text-foreground/85">não</strong> é o mesmo identificador que o de Facebook Login: é o token de sistema / API de conversões gerado no contexto do Pixel (gestão de acessos, não partilhado
            publicamente).
          </p>
          <Input
            type="password"
            value={metaToken}
            readOnly={integrationsLocked}
            onChange={(e) => setMetaToken(e.target.value)}
            placeholder={metaCapi?.has_access_token ? "•••••••• (cole um novo para substituir)" : "Cole o token"}
            className="font-mono text-xs"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Código de teste (opcional)</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            No Gestor de eventos → Testar eventos — útil antes de produção. Remova quando validar.
          </p>
          <Input
            value={metaTestCode}
            readOnly={integrationsLocked}
            onChange={(e) => setMetaTestCode(e.target.value)}
            placeholder="TEST12345"
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => saveMetaCapi.mutate()}
          disabled={integrationsLocked || saveMetaCapi.isPending}
          className="gap-2"
        >
          {saveMetaCapi.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar definições
        </Button>
        {metaCapi?.can_send ? (
          <Badge variant="secondary" className="font-normal">
            Pronto a enviar
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Integração incompleta
          </Badge>
        )}
        {metaCapi?.has_access_token ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Token em cofre
          </Badge>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug border-t border-border/50 pt-3">
        Os segredos são armazenados cifrados no servidor; não são devolvidos em APIs de leitura, apenas a indicação de que existem.
      </p>
    </div>
  );
}

function TiktokEventsIntegrationCard({
  tiktok,
  ttEnabled,
  setTtEnabled,
  ttPixelId,
  setTtPixelId,
  ttToken,
  setTtToken,
  ttTestCode,
  setTtTestCode,
  saveTiktok,
  integrationsLocked = false,
}: {
  tiktok:
    | {
        tiktok_events_enabled: boolean;
        tiktok_pixel_id: string;
        has_access_token: boolean;
        tiktok_events_test_event_code: string;
        can_send: boolean;
      }
    | undefined;
  ttEnabled: boolean;
  setTtEnabled: (v: boolean) => void;
  ttPixelId: string;
  setTtPixelId: (v: string) => void;
  ttToken: string;
  setTtToken: (v: string) => void;
  ttTestCode: string;
  setTtTestCode: (v: string) => void;
  saveTiktok: { mutate: () => void; isPending: boolean };
  integrationsLocked?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300">
          <Music2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-semibold text-card-foreground">TikTok — Events API (pixel web, servidor a servidor)</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Complementa o <strong className="text-foreground/90">TikTok Pixel</strong> no site: o mesmo <span className="font-mono text-[11px]">event_id</span> (UUID da conversão) permite deduplicação e métricas coerentes no Events Manager. O
            <span className="font-mono text-[11px]"> ttclid</span> no URL do clique é o identificador principal de atribuição; campos de página e <span className="font-mono text-[11px]">order_id</span> são enviados quando disponíveis.{" "}
            <a href={TIKTOK_EVENTS_DOC} target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2">
              Pixel e eventos
            </a>
            {" · "}
            <a href={TIKTOK_EVENTS_API_PORTAL} target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2">
              Events API
            </a>
            .
          </p>
        </div>
      </div>

      <Alert className="border-rose-500/35 bg-rose-500/[0.07]">
        <Info className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        <AlertTitle className="text-sm text-foreground">Credenciais no TikTok for Business</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5 space-y-2">
          <p>
            O <strong className="text-foreground/90">código do pixel</strong> (event_source_id) e o <strong className="text-foreground/90">token de acesso</strong> (Events / Measurement) vêm do Events Manager, não do SDK no browser. Use o
            separador de testes de eventos para validar antes de produção.
          </p>
        </AlertDescription>
      </Alert>

      <div className="flex items-center gap-3">
        <Switch id="tiktok-events-enabled" checked={ttEnabled} disabled={integrationsLocked} onCheckedChange={setTtEnabled} />
        <Label htmlFor="tiktok-events-enabled" className="text-sm cursor-pointer">
          Ativar envio de conversões aprovadas
        </Label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">ID do pixel (Event source)</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">Código alfanumérico do pixel em TikTok Events Manager (Web), correspondente a <span className="font-mono text-[11px]">event_source_id</span> na API.</p>
          <Input
            value={ttPixelId}
            readOnly={integrationsLocked}
            onChange={(e) => setTtPixelId(e.target.value)}
            placeholder="ex.: D6FF5SRC77U0SFL8LS8G"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Access-Token (Events API)</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">Gerado com permissão para envio de eventos (Measurement). Não reutilize tokens de aplicação sem âmbito adequado.</p>
          <Input
            type="password"
            value={ttToken}
            readOnly={integrationsLocked}
            onChange={(e) => setTtToken(e.target.value)}
            placeholder={tiktok?.has_access_token ? "•••••••• (cole um novo para substituir)" : "Cole o token"}
            className="font-mono text-xs"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Test event code (opcional)</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">Cole o código de «Test events»; remova-o quando a integração estiver em produção.</p>
          <Input
            value={ttTestCode}
            readOnly={integrationsLocked}
            onChange={(e) => setTtTestCode(e.target.value)}
            placeholder="TEST…"
            className="font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => saveTiktok.mutate()}
          disabled={integrationsLocked || saveTiktok.isPending}
          className="gap-2"
        >
          {saveTiktok.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar definições
        </Button>
        {tiktok?.can_send ? (
          <Badge variant="secondary" className="font-normal">
            Pronto a enviar
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Integração incompleta
          </Badge>
        )}
        {tiktok?.has_access_token ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Token em cofre
          </Badge>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug border-t border-border/50 pt-3">
        Os segredos são armazenados cifrados no servidor; o token nunca é devolvido em APIs de leitura.
      </p>
    </div>
  );
}

function CopyFieldRow({
  value,
  disabled,
  copied,
  onCopy,
  id,
}: {
  value: string;
  disabled?: boolean;
  copied: boolean;
  onCopy: () => void;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <Input id={id} value={value} readOnly className="font-mono text-xs sm:text-sm bg-background/80 border-border/80 h-11 sm:h-10" />
      <Button
        type="button"
        variant="default"
        className="shrink-0 gap-2 sm:min-w-[7.5rem] shadow-sm"
        disabled={disabled}
        onClick={onCopy}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

/** URL de importação CSV + script clickora.min.js — necessário para todos os utilizadores. */
function TrackingScriptCsvBlocks({
  csvUploadUrl,
  csvPlaceholder,
  trackingScript,
  copiedCsv,
  copiedScript,
  handleCopy,
  embedSrcWasPatched,
  scriptStillLocalhostOnDeploy,
  showTechnicalNotes = true,
}: {
  csvUploadUrl: string;
  csvPlaceholder: string;
  trackingScript: string;
  copiedCsv: boolean;
  copiedScript: boolean;
  handleCopy: (text: string, type: "script" | "csv") => void;
  embedSrcWasPatched: boolean;
  scriptStillLocalhostOnDeploy: boolean;
  /** Avisos de env/deploy (VITE_, API_) — só admin / super_admin. */
  showTechnicalNotes?: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="group rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-shadow hover:shadow-md md:p-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileDown className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-card-foreground">URL de conversões (CSV)</h3>
          </div>
        </div>
        <CopyFieldRow
          id="csv-url"
          value={csvUploadUrl || csvPlaceholder}
          disabled={!csvUploadUrl}
          copied={copiedCsv}
          onCopy={() => csvUploadUrl && handleCopy(csvUploadUrl, "csv")}
        />
        {showTechnicalNotes ? (
          <>
            <p className="mt-3 text-xs text-muted-foreground">
              <strong className="text-foreground/90">POST</strong> com o CSV no corpo importa linhas;{" "}
              <strong className="text-foreground/90">GET</strong> no mesmo URL só confirma que o{" "}
              <span className="font-mono">token</span> é válido (resposta JSON).
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Não partilhes o token.</p>
          </>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Use este URL para enviar conversões (POST). Não partilhe o link com terceiros.
          </p>
        )}
      </div>

      <div className="group rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-shadow hover:shadow-md md:p-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
            <Code className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-card-foreground">Script da presell</h3>
          </div>
        </div>
        <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground/90">/p/… na app:</strong> sem colar snippet; <strong className="text-foreground/90">HTML externo:</strong> use o snippet abaixo para contar métricas.
        </p>
        {showTechnicalNotes && embedSrcWasPatched && (
          <p className="mb-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
            URL do script ajustada via <span className="font-mono">VITE_API_URL</span>. Em produção define <span className="font-mono">API_PUBLIC_URL</span> no servidor.
          </p>
        )}
        {showTechnicalNotes && scriptStillLocalhostOnDeploy && (
          <p className="mb-3 text-xs text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2">
            O script aponta para <span className="font-mono">localhost</span> no site público — corrige <span className="font-mono">VITE_API_URL</span> /{" "}
            <span className="font-mono">API_PUBLIC_URL</span>.
          </p>
        )}
        {!showTechnicalNotes && (embedSrcWasPatched || scriptStillLocalhostOnDeploy) ? (
          <p className="mb-3 text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
            Se o script não carregar na página pública, contacte o suporte.
          </p>
        ) : null}
        <CopyFieldRow
          id="tracking-script"
          value={trackingScript || "Carregando credenciais…"}
          disabled={!trackingScript}
          copied={copiedScript}
          onCopy={() => trackingScript && handleCopy(trackingScript, "script")}
        />
      </div>
    </div>
  );
}

type DashboardHeroInput = {
  approved_sales_count?: number;
  affiliate_platforms_count?: number;
  google_ads_metrics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost_micros: number;
    currency_code?: string | null;
  } | null;
  google_ads_metrics_error?: string | null;
  tracking_pipeline?: { google_ads_metrics_available?: boolean };
};

function DashboardHeroMetrics({
  dashboard,
  revenue,
  periodLabel,
  startDate,
  endDate,
  onDateRangeApply,
  greeting,
  adminExtras,
}: {
  dashboard: DashboardHeroInput | null | undefined;
  revenue: number;
  periodLabel: string | null;
  startDate: string;
  endDate: string;
  onDateRangeApply: (p: { from: string; to: string }) => void;
  greeting: string;
  adminExtras?: ReactNode;
}) {
  const g = dashboard?.google_ads_metrics;
  const err = dashboard?.google_ads_metrics_error;
  const canGoogle = dashboard?.tracking_pipeline?.google_ads_metrics_available;
  const showGoogleRow = g != null || err || canGoogle;

  const salesCount = dashboard?.approved_sales_count ?? 0;
  const platformsCount = dashboard?.affiliate_platforms_count ?? 0;

  const googleCost = g != null ? g.cost_micros / 1_000_000 : 0;
  const googleCurrency = g?.currency_code ?? null;
  const googleCpc = g != null && g.clicks > 0 ? googleCost / g.clicks : null;
  const googleConvN = g != null ? Number(g.conversions) : 0;
  const googleCostPerConv = g != null && googleConvN > 0 ? googleCost / googleConvN : null;

  const statClass = "rounded-xl border border-border/60 bg-background/80 px-4 py-4 sm:px-5";
  const statLabel = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
  const statValue = "mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl";

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm md:p-7" aria-label="Resumo do período">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">{greeting}</h1>
          <p className="text-sm text-muted-foreground">
            Painel principal do período: <strong className="text-foreground/90 font-medium">vendas</strong>,{" "}
            <strong className="text-foreground/90 font-medium">Google Ads</strong> na conta ligada (se houver) e atalhos
            abaixo. Métricas do <strong className="text-foreground/90 font-medium">script nas páginas</strong> estão em{" "}
            <Link to="/presell/dashboard" className="text-primary font-medium underline underline-offset-2">
              Minhas Presells
            </Link>
            . Para <strong className="text-foreground/90 font-medium">tabelas com filtro por data</strong> use Relatórios;
            para <strong className="text-foreground/90 font-medium">visão por página</strong>, Analytics.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:max-w-md lg:max-w-lg">
          <div className="space-y-1.5 w-full min-w-0">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <DateRangeFilter
              from={startDate}
              to={endDate}
              onApply={(p) => onDateRangeApply({ from: p.from, to: p.to })}
              showCompare
            />
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-border/50 pt-8">
        <p className={statLabel}>Conversões (valor registado)</p>
        <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 md:text-5xl">
          $ {revenue.toFixed(2)}
          <span className="text-xl font-normal text-muted-foreground md:text-2xl"> USD</span>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {periodLabel ? (
            <Badge variant="secondary" className="font-normal">
              {periodLabel}
            </Badge>
          ) : null}
          <Button size="sm" className="gap-1.5 rounded-lg" asChild>
            <Link to="/tracking/analytics">
              Analytics
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Afiliados</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className={cn(statClass, "flex items-start justify-between gap-3")}>
            <div>
              <p className={statLabel}>Total de vendas</p>
              <p className={statValue}>{salesCount.toLocaleString()}</p>
              <p className="mt-2 text-xs text-muted-foreground leading-snug">Vendas confirmadas pelas redes (mesmo período).</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <div className={cn(statClass, "flex items-start justify-between gap-3")}>
            <div>
              <p className={statLabel}>Plataformas com conversão</p>
              <p className={statValue}>{platformsCount.toLocaleString()}</p>
              <p className="mt-2 text-xs text-muted-foreground leading-snug">Quantas redes geraram pelo menos uma venda.</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {showGoogleRow ? (
        <div className="mt-8 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4 md:p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Google Ads (conta)</p>
              <p className="text-[11px] text-muted-foreground">
                Toda a actividade de anúncios desta conta Google no período (API). Pode ser{" "}
                <strong className="font-medium text-foreground/85">superior</strong> ao tráfego que o script regista nas
                presells: nem todos os cliques chegam à página com o script ou usam o mesmo URL. Custos{" "}
                {googleCurrency ? (
                  <>
                    em <span className="font-medium text-foreground/85">{googleCurrency}</span>
                  </>
                ) : (
                  <>na moeda da conta</>
                )}
                .
              </p>
            </div>
          </div>
          {err ? (
            <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">{err}</p>
          ) : null}
          {g ? (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Impressões</dt>
                <dd className="font-semibold tabular-nums text-base">{g.impressions.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Cliques</dt>
                <dd className="font-semibold tabular-nums text-base">{g.clicks.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Conversões</dt>
                <dd className="font-semibold tabular-nums text-base">
                  {googleConvN.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Custo total</dt>
                <dd className="font-semibold tabular-nums text-base">
                  {formatGoogleAdsDashboardMoney(googleCost, googleCurrency)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Custo médio (CPC)</dt>
                <dd className="font-semibold tabular-nums text-base">
                  {googleCpc != null ? formatGoogleAdsDashboardMoney(googleCpc, googleCurrency) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Custo / conversão</dt>
                <dd className="font-semibold tabular-nums text-base">
                  {googleCostPerConv != null ? formatGoogleAdsDashboardMoney(googleCostPerConv, googleCurrency) : "—"}
                </dd>
              </div>
            </dl>
          ) : !err && !canGoogle ? (
            <p className="text-xs text-muted-foreground">
              Configure o envio automático em Meu rastreamento ou o URL de conversões em Integrações.
            </p>
          ) : !err && canGoogle && !g ? (
            <p className="text-xs text-muted-foreground">Sem dados da API Google para este período.</p>
          ) : null}
        </div>
      ) : null}

      {adminExtras ? <div className="mt-8 border-t border-border/50 pt-8">{adminExtras}</div> : null}
    </section>
  );
}

const GOOGLE_ADS_OAUTH_ERROR_HINTS: Record<string, string> = {
  no_refresh_token:
    "O Google não devolveu um novo token. Em myaccount.google.com/permissions revogue o acesso ao dclickora e volte a usar «Ligar com Google».",
  access_denied: "Autorização cancelada no Google.",
  invalid_or_expired_state: "A ligação expirou. Use «Ligar com Google» outra vez.",
  missing_code_or_state: "Resposta inválida do Google. Tente ligar de novo.",
  server_config: "API Google Ads mal configurada no servidor.",
  redirect_uri_config: "URL de callback OAuth mal configurada (API_PUBLIC_URL ou GOOGLE_ADS_OAUTH_REDIRECT_URI).",
};

export default function TrackingDashboard() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const apiBase = getApiBaseUrl();
  /** Alinhado ao botão «Últimos 30 dias» (intervalo inicial ao abrir a página). */
  const initialRange = useMemo(() => defaultDateRange(), []);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [gaEnabled, setGaEnabled] = useState(false);
  const [gaCustomerId, setGaCustomerId] = useState("");
  const [gaActionId, setGaActionId] = useState("");
  const [gaLoginMcc, setGaLoginMcc] = useState("");
  const [gaRefresh, setGaRefresh] = useState("");
  const [metaEnabled, setMetaEnabled] = useState(false);
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [metaTestCode, setMetaTestCode] = useState("");
  const [ttEnabled, setTtEnabled] = useState(false);
  const [ttPixelId, setTtPixelId] = useState("");
  const [ttToken, setTtToken] = useState("");
  const [ttTestCode, setTtTestCode] = useState("");

  const firstName = user?.name?.trim()?.split(/\s+/)[0];
  const integrationsLocked = !userCanWriteIntegrations(user);

  const { data: googleAds } = useQuery({
    queryKey: ["integrations-google-ads"],
    queryFn: async () => {
      const { data, error: err } = await integrationsService.getGoogleAdsSettings();
      if (err) throw new Error(err);
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
  });

  useEffect(() => {
    const o = searchParams.get("google_ads_oauth");
    if (!o) return;
    const reasonRaw = searchParams.get("reason") || "";
    const reason = reasonRaw ? decodeURIComponent(reasonRaw) : "";
    if (o === "success") {
      toast.success("Conta Google Ads ligada — o refresh token da sua conta foi guardado.");
      void queryClient.invalidateQueries({ queryKey: ["integrations-google-ads"] });
    } else if (o === "error") {
      const hint = GOOGLE_ADS_OAUTH_ERROR_HINTS[reason] || reason || "Não foi possível ligar o Google Ads.";
      toast.error(hint);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("google_ads_oauth");
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, queryClient]);

  useEffect(() => {
    if (!googleAds) return;
    setGaEnabled(googleAds.google_ads_enabled);
    setGaCustomerId(googleAds.google_ads_customer_id);
    setGaActionId(googleAds.google_ads_conversion_action_id);
    setGaLoginMcc(googleAds.google_ads_login_customer_id);
    setGaRefresh("");
  }, [googleAds]);

  const { data: metaCapi } = useQuery({
    queryKey: ["integrations-meta-capi"],
    queryFn: async () => {
      const { data, error: err } = await integrationsService.getMetaCapiSettings();
      if (err) throw new Error(err);
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
  });

  useEffect(() => {
    if (!metaCapi) return;
    setMetaEnabled(metaCapi.meta_capi_enabled);
    setMetaPixelId(metaCapi.meta_pixel_id);
    setMetaTestCode(metaCapi.meta_capi_test_event_code ?? "");
    setMetaToken("");
  }, [metaCapi]);

  const { data: tiktokEvents } = useQuery({
    queryKey: ["integrations-tiktok-events"],
    queryFn: async () => {
      const { data, error: err } = await integrationsService.getTiktokEventsSettings();
      if (err) throw new Error(err);
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
  });

  useEffect(() => {
    if (!tiktokEvents) return;
    setTtEnabled(tiktokEvents.tiktok_events_enabled);
    setTtPixelId(tiktokEvents.tiktok_pixel_id);
    setTtTestCode(tiktokEvents.tiktok_events_test_event_code ?? "");
    setTtToken("");
  }, [tiktokEvents]);

  const saveGoogleAds = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.patchGoogleAdsSettings({
        google_ads_enabled: gaEnabled,
        google_ads_customer_id: gaCustomerId,
        google_ads_conversion_action_id: gaActionId,
        google_ads_login_customer_id: gaLoginMcc,
        ...(gaRefresh.trim() ? { google_ads_refresh_token: gaRefresh.trim() } : {}),
      });
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: async () => {
      toast.success("Definições Google Ads guardadas.");
      await queryClient.invalidateQueries({ queryKey: ["integrations-google-ads"] });
      setGaRefresh("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMetaCapi = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.patchMetaCapiSettings({
        meta_capi_enabled: metaEnabled,
        meta_pixel_id: metaPixelId,
        meta_capi_test_event_code: metaTestCode,
        ...(metaToken.trim() ? { meta_access_token: metaToken.trim() } : {}),
      });
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: async () => {
      toast.success("Definições Meta CAPI guardadas.");
      await queryClient.invalidateQueries({ queryKey: ["integrations-meta-capi"] });
      await queryClient.invalidateQueries({ queryKey: ["tracking-dashboard"] });
      setMetaToken("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveTiktokEvents = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.patchTiktokEventsSettings({
        tiktok_events_enabled: ttEnabled,
        tiktok_pixel_id: ttPixelId,
        tiktok_events_test_event_code: ttTestCode,
        ...(ttToken.trim() ? { tiktok_events_access_token: ttToken.trim() } : {}),
      });
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: async () => {
      toast.success("Definições TikTok Events API guardadas.");
      await queryClient.invalidateQueries({ queryKey: ["integrations-tiktok-events"] });
      await queryClient.invalidateQueries({ queryKey: ["tracking-dashboard"] });
      setTtToken("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: dashboard, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tracking-dashboard", startDate, endDate],
    queryFn: async () => {
      const { data, error: err } = await analyticsService.getDashboard({ from: startDate, to: endDate });
      if (err) {
        toast.error(err, { id: "analytics-dashboard-error" });
        throw new Error(err);
      }
      return data;
    },
    retry: (failureCount, err) => {
      const msg = err instanceof Error ? err.message : "";
      if (/intervalo|inválido|inválida|formato yyyy-mm-dd/i.test(msg)) return false;
      return failureCount < 2;
    },
  });

  const resolvedEmbedSrc = useMemo(() => {
    const fromApi = dashboard?.tracking_install?.embed_js_url;
    let src = fromApi || `${apiBase.replace(/\/$/, "")}/track/v2/clickora.min.js`;
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const onLocalDev = host === "localhost" || host === "127.0.0.1";
      const apiIsRemote = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(apiBase);
      if (!onLocalDev && apiIsRemote && /localhost|127\.0\.0\.1/.test(src)) {
        src = `${apiBase.replace(/\/$/, "")}/track/v2/clickora.min.js`;
      }
    }
    return src;
  }, [dashboard?.tracking_install?.embed_js_url, apiBase]);

  const embedSrcWasPatched = useMemo(() => {
    const fromApi = dashboard?.tracking_install?.embed_js_url;
    return Boolean(fromApi && fromApi !== resolvedEmbedSrc);
  }, [dashboard?.tracking_install?.embed_js_url, resolvedEmbedSrc]);

  const trackingScript = useMemo(() => {
    const uid = dashboard?.tracking_install?.user_id || user?.id;
    if (!uid) return "";
    return `<script src="${resolvedEmbedSrc}" data-id="${uid}"></script>`;
  }, [dashboard?.tracking_install?.user_id, user?.id, resolvedEmbedSrc]);

  const scriptStillLocalhostOnDeploy = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const onLocalDev = host === "localhost" || host === "127.0.0.1";
    return !onLocalDev && /localhost|127\.0\.0\.1/.test(resolvedEmbedSrc);
  }, [resolvedEmbedSrc]);

  const csvUploadUrl = useMemo(() => {
    const raw = dashboard?.tracking_install?.csv_upload_url ?? "";
    if (!raw) return "";
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const onLocalDev = host === "localhost" || host === "127.0.0.1";
      const apiIsRemote = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(apiBase);
      if (!onLocalDev && apiIsRemote && /localhost|127\.0\.0\.1/.test(raw)) {
        try {
          const u = new URL(raw);
          const token = u.searchParams.get("token");
          if (token) {
            const base = apiBase.replace(/\/$/, "");
            return `${base}/track/conversions/csv?token=${encodeURIComponent(token)}`;
          }
        } catch {
          /* ignore */
        }
      }
    }
    return raw;
  }, [dashboard?.tracking_install?.csv_upload_url, apiBase]);

  const handleCopy = (text: string, type: "script" | "csv") => {
    navigator.clipboard.writeText(text);
    if (type === "script") {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else {
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 2000);
    }
    toast.success("Copiado!");
  };

  if (isLoading) return <LoadingState message="Carregando dashboard..." />;
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Erro ao carregar o dashboard."}
        onRetry={() => refetch()}
      />
    );
  }

  const periodLabel = dashboard?.period
    ? `${new Date(dashboard.period.from + "T12:00:00").toLocaleDateString("pt-BR")} — ${new Date(dashboard.period.to + "T12:00:00").toLocaleDateString("pt-BR")}`
    : null;

  const revenue = dashboard?.revenue ?? 0;
  const csvPlaceholder = dashboard ? "Atualize a API para obter o link com token." : "Carregando…";

  /** Assinantes: mesmo resumo, atalhos, script/CSV, envio Google Ads (API); gráfico presell em Minhas Presells. */
  if (!isAdmin) {
    return (
      <div className={cn(APP_PAGE_SHELL, "space-y-8")}>
        <DashboardHeroMetrics
          dashboard={dashboard}
          revenue={revenue}
          periodLabel={periodLabel}
          startDate={startDate}
          endDate={endDate}
          onDateRangeApply={({ from, to }) => {
            setStartDate(from);
            setEndDate(to);
          }}
          greeting={firstName ? `Olá, ${firstName}` : "Bem-vindo"}
        />

        <SyncHealthBanner dashboard={dashboard} />
        <DashboardUserGuide variant="tracking" />
        <SetupAssistantCallout />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { to: "/tracking/analytics", title: "Ver números", color: "from-primary/15 to-primary/5", icon: BarChart3 },
              { to: "/presell/dashboard", title: "Presells", color: "from-violet-500/15 to-violet-500/5", icon: LayoutDashboard },
              { to: "/tracking/links", title: "Links de tracking", color: "from-emerald-500/15 to-emerald-500/5", icon: Link2 },
              { to: "/tracking/vendas", title: "Vendas", color: "from-amber-500/15 to-amber-500/5", icon: ShoppingCart },
            ] as const
          ).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
              )}
            >
              <div
                className={cn(
                  "mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-primary",
                  item.color,
                )}
              >
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">{item.title}</h3>
              <ArrowRight className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>

        <section className="space-y-4" aria-labelledby="subscriber-script-csv">
          <div>
            <h2 id="subscriber-script-csv" className="text-lg font-semibold text-foreground">
              Script e conversões (CSV)
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
              Cole o <strong className="text-foreground/90">script</strong> no HTML da presell (head ou código da página). Use o{" "}
              <strong className="text-foreground/90">URL</strong> para importar conversões por POST. Postbacks e Google Ads:{" "}
              <Link className="text-primary underline underline-offset-4 hover:text-primary/90" to="/tracking/integrations">
                Integrações
              </Link>{" "}
              e{" "}
              <Link className="text-primary underline underline-offset-4 hover:text-primary/90" to="/tracking/plataformas">
                Plataformas
              </Link>
              .
            </p>
          </div>
          <TrackingScriptCsvBlocks
            csvUploadUrl={csvUploadUrl}
            csvPlaceholder={csvPlaceholder}
            trackingScript={trackingScript}
            copiedCsv={copiedCsv}
            copiedScript={copiedScript}
            handleCopy={handleCopy}
            embedSrcWasPatched={embedSrcWasPatched}
            scriptStillLocalhostOnDeploy={scriptStillLocalhostOnDeploy}
            showTechnicalNotes={false}
          />
        </section>

        <GoogleAdsConversionUploadCard
          googleAds={googleAds}
          gaEnabled={gaEnabled}
          setGaEnabled={setGaEnabled}
          gaCustomerId={gaCustomerId}
          setGaCustomerId={setGaCustomerId}
          gaActionId={gaActionId}
          setGaActionId={setGaActionId}
          gaLoginMcc={gaLoginMcc}
          setGaLoginMcc={setGaLoginMcc}
          gaRefresh={gaRefresh}
          setGaRefresh={setGaRefresh}
          saveGoogleAds={saveGoogleAds}
          integrationsLocked={integrationsLocked}
        />

        <GoogleAdsOfflineFileExportCard
          startDate={startDate}
          endDate={endDate}
          conversionActionIdHint={gaActionId}
        />

        <MetaCapiIntegrationCard
          metaCapi={metaCapi}
          metaEnabled={metaEnabled}
          setMetaEnabled={setMetaEnabled}
          metaPixelId={metaPixelId}
          setMetaPixelId={setMetaPixelId}
          metaToken={metaToken}
          setMetaToken={setMetaToken}
          metaTestCode={metaTestCode}
          setMetaTestCode={setMetaTestCode}
          saveMetaCapi={saveMetaCapi}
          integrationsLocked={integrationsLocked}
        />

        <TiktokEventsIntegrationCard
          tiktok={tiktokEvents}
          ttEnabled={ttEnabled}
          setTtEnabled={setTtEnabled}
          ttPixelId={ttPixelId}
          setTtPixelId={setTtPixelId}
          ttToken={ttToken}
          setTtToken={setTtToken}
          ttTestCode={ttTestCode}
          setTtTestCode={setTtTestCode}
          saveTiktok={saveTiktokEvents}
          integrationsLocked={integrationsLocked}
        />
      </div>
    );
  }

  return (
    <div className={cn(APP_PAGE_SHELL, "space-y-8")}>
      <DashboardHeroMetrics
        dashboard={dashboard}
        revenue={revenue}
        periodLabel={periodLabel}
        startDate={startDate}
        endDate={endDate}
        onDateRangeApply={({ from, to }) => {
          setStartDate(from);
          setEndDate(to);
        }}
        greeting={firstName ? `Bem-vindo, ${firstName}` : "Bem-vindo ao rastreamento"}
        adminExtras={
          <>
            {dashboard?.tracking_pipeline ? (
              <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-3 sm:px-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Estado</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      { ok: dashboard.tracking_pipeline.click_tracking, label: "Rastreamento de clique" },
                      { ok: dashboard.tracking_pipeline.campaign_tracking, label: "Rastreamento de campanha" },
                      { ok: dashboard.tracking_pipeline.sale_tracking, label: "Rastreamento de venda" },
                      { ok: dashboard.tracking_pipeline.google_ads_integration, label: "Integração Google Ads" },
                      { ok: Boolean(dashboard.tracking_pipeline.meta_capi_integration), label: "Meta CAPI (Pixel)" },
                      { ok: Boolean(dashboard.tracking_pipeline.tiktok_events_integration), label: "TikTok Events API (Pixel)" },
                    ] as const
                  ).map((row) => (
                    <li key={row.label} className="flex items-center gap-2 text-xs text-foreground">
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                          row.ok ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {row.ok ? <Check className="h-3 w-3" strokeWidth={3} /> : "—"}
                      </span>
                      {row.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" className="h-9 rounded-full px-4" asChild>
                <Link to="/presell/dashboard">Presell</Link>
              </Button>
              <Button variant="secondary" size="sm" className="h-9 rounded-full px-4" asChild>
                <Link to="/tracking/links">Links</Link>
              </Button>
              <Button variant="secondary" size="sm" className="h-9 rounded-full px-4" asChild>
                <Link to="/tracking/analytics">Analytics</Link>
              </Button>
              <Button variant="secondary" size="sm" className="h-9 rounded-full px-4" asChild>
                <Link to="/tracking/tools">Tools</Link>
              </Button>
            </div>
          </>
        }
      />

      <SyncHealthBanner dashboard={dashboard} />
      <DashboardUserGuide variant="tracking" />
      <SetupAssistantCallout />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Guia — instalação na presell</h2>
          <ol className="mt-3 list-decimal list-outside space-y-2 pl-5 text-sm text-muted-foreground max-w-3xl marker:font-semibold marker:text-foreground">
            <li>
              <strong className="text-foreground/90">Presell publicada:</strong> cola o <strong className="text-foreground/90">script</strong> (passo 2 desta página)
              no HTML da página; o teu ID está em <span className="font-mono text-[11px]">data-id</span>.
            </li>
            <li>
              <strong className="text-foreground/90">Google Ads:</strong> na campanha, <strong className="text-foreground/90">URL final</strong> = URL
              público da presell — o Google acrescenta o <span className="font-mono text-[11px]">gclid</span> ao clicar no anúncio.
            </li>
            <li>
              <strong className="text-foreground/90">Meta Ads:</strong> use o URL público da presell no anúncio — o Meta acrescenta{" "}
              <span className="font-mono text-[11px]">fbclid</span> ao clicar (necessário para a CAPI). O cookie{" "}
              <span className="font-mono text-[11px]">_fbp</span> (<span className="font-mono text-[11px]">fbp</span>) é opcional e reforça o matching se o Pixel estiver na página.
            </li>
            <li>
              <strong className="text-foreground/90">Rede de afiliados:</strong> em{" "}
              <strong className="text-foreground/90">Meu rastreamento → Plataformas</strong>, copia o postback e cola no painel da rede (Postback / IPN).
              Inclui o identificador de clique (ex.{" "}
              <span className="font-mono text-[11px]">{"subid1={SUBID}"}</span> ou o que a rede mostrar).
            </li>
            <li>
              <strong className="text-foreground/90">CSV (opcional):</strong> importação manual de conversões — usa <strong className="text-foreground/90">POST</strong>{" "}
              com o URL à esquerda; <strong className="text-foreground/90">GET</strong> só testa o token.
            </li>
            <li>
              <strong className="text-foreground/90">Enviar vendas ao Google Ads:</strong> preenche o bloco <strong className="text-foreground/90">Google Ads</strong>{" "}
              abaixo (conta, ação de conversão, OAuth).
            </li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3 max-w-3xl">
            API pública: <span className="font-mono text-[11px]">{apiBase}</span> (mesmo host do script e do CSV).
          </p>
        </div>
        <h3 className="text-base font-semibold text-foreground">Script e CSV</h3>

        <TrackingScriptCsvBlocks
          csvUploadUrl={csvUploadUrl}
          csvPlaceholder={csvPlaceholder}
          trackingScript={trackingScript}
          copiedCsv={copiedCsv}
          copiedScript={copiedScript}
          handleCopy={handleCopy}
          embedSrcWasPatched={embedSrcWasPatched}
          scriptStillLocalhostOnDeploy={scriptStillLocalhostOnDeploy}
          showTechnicalNotes
        />

        <GoogleAdsConversionUploadCard
          googleAds={googleAds}
          gaEnabled={gaEnabled}
          setGaEnabled={setGaEnabled}
          gaCustomerId={gaCustomerId}
          setGaCustomerId={setGaCustomerId}
          gaActionId={gaActionId}
          setGaActionId={setGaActionId}
          gaLoginMcc={gaLoginMcc}
          setGaLoginMcc={setGaLoginMcc}
          gaRefresh={gaRefresh}
          setGaRefresh={setGaRefresh}
          saveGoogleAds={saveGoogleAds}
          integrationsLocked={integrationsLocked}
        />

        <GoogleAdsOfflineFileExportCard
          startDate={startDate}
          endDate={endDate}
          conversionActionIdHint={gaActionId}
        />

        <MetaCapiIntegrationCard
          metaCapi={metaCapi}
          metaEnabled={metaEnabled}
          setMetaEnabled={setMetaEnabled}
          metaPixelId={metaPixelId}
          setMetaPixelId={setMetaPixelId}
          metaToken={metaToken}
          setMetaToken={setMetaToken}
          metaTestCode={metaTestCode}
          setMetaTestCode={setMetaTestCode}
          saveMetaCapi={saveMetaCapi}
          integrationsLocked={integrationsLocked}
        />

        <TiktokEventsIntegrationCard
          tiktok={tiktokEvents}
          ttEnabled={ttEnabled}
          setTtEnabled={setTtEnabled}
          ttPixelId={ttPixelId}
          setTtPixelId={setTtPixelId}
          ttToken={ttToken}
          setTtToken={setTtToken}
          ttTestCode={ttTestCode}
          setTtTestCode={setTtTestCode}
          saveTiktok={saveTiktokEvents}
          integrationsLocked={integrationsLocked}
        />
      </section>
    </div>
  );
}
