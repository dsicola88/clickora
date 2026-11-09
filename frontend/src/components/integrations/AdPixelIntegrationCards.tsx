import { Loader2, Share2, Music2, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

const META_CAPI_DOC = "https://developers.facebook.com/docs/marketing-api/conversions-api/get-started";
const META_PIXEL_SETTINGS = "https://business.facebook.com/settings/pixels";
const TIKTOK_EVENTS_DOC = "https://ads.tiktok.com/help/article/events-api";
const TIKTOK_EVENTS_API_PORTAL = "https://business-api.tiktok.com/portal/docs";

export function MetaCapiIntegrationCard({
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
  autoMode = false,
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
  /** Esconde o interruptor — Pixel + token = envio automático. */
  autoMode?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
          <Share2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-semibold text-card-foreground">Meta — enviar vendas</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Envia vendas aprovadas para a Meta. Use o Pixel e a chave da sua conta.{" "}
            <a href={META_CAPI_DOC} target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2">
              Ajuda Meta
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
        <AlertTitle className="text-sm text-foreground">
          {autoMode ? "Uma vez na conta — todas as páginas" : "Boas práticas (Meta Business)"}
        </AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5 space-y-2">
          {autoMode ? (
            <p>
              Cole o <strong className="text-foreground/90">Pixel ID</strong> e a <strong className="text-foreground/90">chave</strong>.
              As vendas aprovadas enviam-se sozinhas — sem configurar página a página.
            </p>
          ) : (
            <p>
              Crie a chave no Gestor de Negócios / Pixel da Meta. Guarde-a em local seguro e substitua se a partilhar por engano.
            </p>
          )}
        </AlertDescription>
      </Alert>

      {!autoMode ? (
        <div className="flex items-center gap-3">
          <Switch id="meta-capi-enabled" checked={metaEnabled} disabled={integrationsLocked} onCheckedChange={setMetaEnabled} />
          <Label htmlFor="meta-capi-enabled" className="text-sm cursor-pointer">
            Ativar envio de conversões aprovadas
          </Label>
        </div>
      ) : metaCapi?.can_send ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Envio automático activo (Pixel + token).</p>
      ) : null}

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
          <Label className="text-xs">Token de acesso (API de conversões)</Label>
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

export function TiktokEventsIntegrationCard({
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
  autoMode = false,
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
  autoMode?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm md:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300">
          <Music2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-semibold text-card-foreground">TikTok — enviar vendas</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Envia vendas aprovadas para o TikTok. Use o Pixel e a chave da sua conta.{" "}
            <a href={TIKTOK_EVENTS_DOC} target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2">
              Ajuda TikTok
            </a>
            {" · "}
            <a href={TIKTOK_EVENTS_API_PORTAL} target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline underline-offset-2">
              Events Manager
            </a>
            .
          </p>
        </div>
      </div>

      <Alert className="border-rose-500/35 bg-rose-500/[0.07]">
        <Info className="h-4 w-4 text-rose-600 dark:text-rose-400" />
        <AlertTitle className="text-sm text-foreground">
          {autoMode ? "Uma vez na conta — todas as páginas" : "Credenciais no TikTok for Business"}
        </AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5 space-y-2">
          {autoMode ? (
            <p>
              Cole o Pixel e a chave. As vendas aprovadas enviam-se sozinhas.
            </p>
          ) : (
            <p>
              O <strong className="text-foreground/90">Pixel</strong> e a{" "}
              <strong className="text-foreground/90">chave</strong> vêm do Events Manager do TikTok.
            </p>
          )}
        </AlertDescription>
      </Alert>

      {!autoMode ? (
        <div className="flex items-center gap-3">
          <Switch id="tiktok-events-enabled" checked={ttEnabled} disabled={integrationsLocked} onCheckedChange={setTtEnabled} />
          <Label htmlFor="tiktok-events-enabled" className="text-sm cursor-pointer">
            Ativar envio de conversões aprovadas
          </Label>
        </div>
      ) : tiktok?.can_send ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Envio automático activo (pixel + token).</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">ID do pixel</Label>
          <p className="text-[11px] text-muted-foreground leading-snug">Código do pixel no Events Manager do TikTok.</p>
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

