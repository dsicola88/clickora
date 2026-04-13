import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Copy,
  Check,
  Send,
  Save,
  Loader2,
  Radio,
  MessageCircle,
  CloudUpload,
  ArrowRight,
  Bell,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { analyticsService } from "@/services/analyticsService";
import { integrationsService } from "@/services/integrationsService";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import { subscribeToWebPush, unsubscribeFromWebPush } from "@/lib/webPushClient";
import { useAuth } from "@/contexts/AuthContext";

function SectionShell({
  accent,
  children,
  className,
}: {
  accent: "primary" | "accent" | "success" | "violet";
  children: ReactNode;
  className?: string;
}) {
  const ring =
    accent === "primary"
      ? "border-l-primary"
      : accent === "accent"
        ? "border-l-accent"
        : accent === "violet"
          ? "border-l-violet-500"
          : "border-l-success";
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/80 shadow-sm border-l-4 backdrop-blur-sm",
        ring,
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function Integrations() {
  const queryClient = useQueryClient();
  const apiBase = getApiBaseUrl();
  const { isSuperAdmin } = useAuth();

  const [copiedCsv, setCopiedCsv] = useState(false);
  const [telegramTokenDraft, setTelegramTokenDraft] = useState("");
  const [telegramChatDraft, setTelegramChatDraft] = useState("");
  const [notifySale, setNotifySale] = useState(true);
  const [notifyPostback, setNotifyPostback] = useState(true);
  const [notifyClick, setNotifyClick] = useState(false);
  const [discordWebhook, setDiscordWebhook] = useState("");

  const { data: dashboard } = useQuery({
    queryKey: ["integrations-dashboard-install"],
    queryFn: async () => {
      const { data, error: err } = await analyticsService.getDashboard();
      if (err) throw new Error(err);
      return data;
    },
  });

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

  const { data: telegram, isLoading: telegramLoading } = useQuery({
    queryKey: ["integrations-telegram"],
    queryFn: async () => {
      const { data, error: err } = await integrationsService.getTelegramSettings();
      if (err) throw new Error(err);
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
  });

  useEffect(() => {
    if (!telegram) return;
    setTelegramChatDraft(telegram.telegram_chat_id);
    setNotifySale(telegram.telegram_notify_sale);
    setNotifyPostback(telegram.telegram_notify_postback_error);
    setNotifyClick(telegram.telegram_notify_click);
    setTelegramTokenDraft("");
  }, [telegram]);

  const saveTelegram = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.patchTelegramSettings({
        ...(telegramTokenDraft.trim() ? { telegram_bot_token: telegramTokenDraft.trim() } : {}),
        telegram_chat_id: telegramChatDraft,
        telegram_notify_sale: notifySale,
        telegram_notify_postback_error: notifyPostback,
        telegram_notify_click: notifyClick,
      });
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: async () => {
      toast.success("Definições Telegram guardadas.");
      setTelegramTokenDraft("");
      await queryClient.invalidateQueries({ queryKey: ["integrations-telegram"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearTelegramToken = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.patchTelegramSettings({
        clear_telegram_bot_token: true,
      });
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: async () => {
      toast.success("Token do bot removido.");
      await queryClient.invalidateQueries({ queryKey: ["integrations-telegram"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testTelegram = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.testTelegramIntegration();
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: () => toast.success("Mensagem de teste enviada. Verifique o Telegram."),
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: webPush, isLoading: webPushLoading } = useQuery({
    queryKey: ["integrations-web-push"],
    queryFn: async () => {
      const { data, error: err } = await integrationsService.getWebPushConfig();
      if (err) throw new Error(err);
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
  });

  const activateWebPush = useMutation({
    mutationFn: async () => {
      const r = await subscribeToWebPush();
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: async () => {
      toast.success("Notificações ativadas neste dispositivo.");
      await queryClient.invalidateQueries({ queryKey: ["integrations-web-push"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateWebPush = useMutation({
    mutationFn: async () => {
      const r = await unsubscribeFromWebPush();
      if (!r.ok) throw new Error(r.error);
      return r;
    },
    onSuccess: async () => {
      toast.success("Subscrição removida.");
      await queryClient.invalidateQueries({ queryKey: ["integrations-web-push"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testWebPush = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.testWebPush();
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: () => toast.success("Se estiver tudo certo, deve aparecer uma notificação de teste."),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCopyCsv = () => {
    if (!csvUploadUrl) return;
    navigator.clipboard.writeText(csvUploadUrl);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
    toast.success("URL copiada.");
  };

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title="Integrações"
        description="Ligue o dclickora a canais externos: alertas no telemóvel, Telegram, upload CSV para o Google Ads e mais."
      />

      <Accordion type="multiple" defaultValue={["webpush", "google", "telegram"]} className="space-y-4">
        <AccordionItem value="webpush" className="border-0">
          <SectionShell accent="violet">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]]:border-b border-border/50">
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-400">
                  <Bell className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">Notificações no telemóvel ou no computador</p>
                  <p className="text-sm text-muted-foreground">
                    Aviso quando entra uma venda. No telemóvel <strong className="font-medium text-foreground/90">não precisa de
                    instalar app nem ir às definições do sistema</strong> — só abre o dclickora no browser e usa os botões
                    abaixo.
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-2 space-y-4">
              {webPushLoading || !webPush ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3 space-y-2">
                    <p className="text-sm font-medium text-foreground">Passos para si (assinante)</p>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5 marker:text-foreground/80">
                      <li>
                        Toque em <strong className="font-medium text-foreground/90">Ativar neste dispositivo</strong>. Se o
                        browser perguntar, aceite as notificações — não precisa de configurar o telemóvel noutro sítio.
                      </li>
                      <li>
                        Quando uma <strong className="font-medium text-foreground/90">venda for registada</strong>, deve
                        receber um aviso (mesmo com o site em segundo plano).
                      </li>
                      <li>
                        Pode usar <strong className="font-medium text-foreground/90">Testar</strong> para confirmar. Em alguns{" "}
                        <strong className="font-medium text-foreground/90">iPhones</strong> o Safari pode pedir o site no ecrã
                        inicial — continua a ser só no browser.
                      </li>
                    </ol>
                  </div>

                  {!webPush.configured ? (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-sm text-muted-foreground leading-relaxed">
                      {isSuperAdmin ? (
                        <>
                          Ainda não está ligado no servidor. Veja o que falta em{" "}
                          <Link to="/admin" className="font-medium text-primary hover:underline">
                            Painel do sistema → Visão geral
                          </Link>{" "}
                          (cartão sobre alertas no telemóvel). Os botões abaixo ficam ativos depois de configurar a API.
                        </>
                      ) : (
                        <>
                          Esta opção <strong className="font-medium text-foreground/90">ainda não está ativa</strong> na
                          plataforma. Os passos acima aplicam-se quando estiver disponível — os botões abaixo ativam-se nessa
                          altura. Se precisar de ajuda, contacte o suporte.
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Aparelhos ligados nesta conta:{" "}
                      <span className="font-medium text-foreground">{webPush.subscription_count}</span> (cada telemóvel ou
                      computador conta à parte).
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="gap-2"
                      disabled={!webPush.configured || activateWebPush.isPending}
                      onClick={() => activateWebPush.mutate()}
                    >
                      {activateWebPush.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                      Ativar neste dispositivo
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      disabled={!webPush.configured || deactivateWebPush.isPending}
                      onClick={() => deactivateWebPush.mutate()}
                    >
                      {deactivateWebPush.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Desativar neste dispositivo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={
                        !webPush.configured || testWebPush.isPending || webPush.subscription_count === 0
                      }
                      onClick={() => testWebPush.mutate()}
                    >
                      {testWebPush.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Testar
                    </Button>
                  </div>
                </>
              )}
            </AccordionContent>
          </SectionShell>
        </AccordionItem>

        <AccordionItem value="google" className="border-0">
          <SectionShell accent="primary">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]]:border-b border-border/50">
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <CloudUpload className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">Google Ads — conversões offline (CSV)</p>
                  <p className="text-sm text-muted-foreground">
                    URL assinada para importar GCLID e valores no Google Ads.
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                Cole esta URL no Google Ads como origem HTTPS de upload. A API de cliques e o script de tracking
                estão no{" "}
                <Link
                  to="/tracking/dashboard"
                  className="font-medium text-primary inline-flex items-center gap-1 hover:underline"
                >
                  painel de tracking
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                .
              </p>

              <div className="space-y-2">
                <Label htmlFor="csv-url">URL de upload (HTTPS)</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <Input
                    id="csv-url"
                    readOnly
                    value={csvUploadUrl || "A carregar…"}
                    className="font-mono text-xs sm:text-sm bg-muted/30"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 gap-2 sm:min-w-[8rem]"
                    disabled={!csvUploadUrl}
                    onClick={handleCopyCsv}
                  >
                    {copiedCsv ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    Copiar
                  </Button>
                </div>
              </div>

              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
                <li>Use apenas a URL fornecida; aceder ao link no browser pode invalidar o contexto esperado pelo Google.</li>
                <li>Confirme que o fuso horário e o formato de ficheiro no Google Ads correspondem à sua conta.</li>
              </ul>
            </AccordionContent>
          </SectionShell>
        </AccordionItem>

        <AccordionItem value="discord" className="border-0">
          <SectionShell accent="accent">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]]:border-b border-border/50">
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Radio className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">Discord</p>
                  <p className="text-sm text-muted-foreground">Webhooks para o seu servidor (pré-visualização).</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                O envio automático para Discord ainda não está ligado ao backend. Pode guardar o URL localmente para
                quando a funcionalidade estiver disponível.
              </p>
              <div className="space-y-2">
                <Label htmlFor="discord-hook">Webhook URL</Label>
                <Input
                  id="discord-hook"
                  placeholder="https://discord.com/api/webhooks/…"
                  value={discordWebhook}
                  onChange={(e) => setDiscordWebhook(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => toast.message("Rascunho guardado apenas neste dispositivo.")}
              >
                <Save className="h-4 w-4" /> Guardar rascunho
              </Button>
            </AccordionContent>
          </SectionShell>
        </AccordionItem>

        <AccordionItem value="telegram" className="border-0">
          <SectionShell accent="success">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]]:border-b border-border/50">
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">Telegram</p>
                  <p className="text-sm text-muted-foreground">
                    Já ativo no servidor — vendas, alertas de postback e opcionalmente novos cliques.
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-2 space-y-5">
              {telegramLoading || !telegram ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3 space-y-3">
                    <p className="text-sm font-medium text-foreground">Passo a passo</p>
                    <p className="text-sm text-muted-foreground">
                      Sim — já pode usar. Depois de guardar o token e o Chat ID, o servidor do dclickora envia as
                      notificações para o Telegram (não precisa de mais software no seu computador).
                    </p>
                    <ol className="text-sm text-muted-foreground space-y-2.5 list-decimal pl-5 marker:text-foreground/80">
                      <li className="pl-1">
                        No Telegram, abra uma conversa com{" "}
                        <span className="font-medium text-foreground/90">@BotFather</span> e envie o comando{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">/newbot</code>. Escolha um nome e um
                        username que termine em <code className="rounded bg-muted px-1 py-0.5 text-xs">bot</code>.
                      </li>
                      <li className="pl-1">
                        Quando o BotFather mostrar o <strong className="font-medium text-foreground/90">token</strong>{" "}
                        (números e letras, tipo <code className="rounded bg-muted px-1 py-0.5 text-xs">123456789:ABC…</code>
                        ), copie-o e cole no campo «Token do bot» abaixo.
                      </li>
                      <li className="pl-1">
                        Para o bot poder enviar-lhe mensagens, envie primeiro{" "}
                        <span className="font-medium text-foreground/90">qualquer mensagem ao seu bot</span> no Telegram
                        (abra o bot pelo link que o BotFather deu e toque em Iniciar ou escreva «olá»).
                      </li>
                      <li className="pl-1">
                        Obtenha o <strong className="font-medium text-foreground/90">Chat ID</strong>: no Telegram, use o
                        bot <span className="font-medium text-foreground/90">@userinfobot</span> ou{" "}
                        <span className="font-medium text-foreground/90">@RawDataBot</span> — ele responde com o seu ID
                        (número). Para um <strong className="font-medium text-foreground/90">grupo</strong>, adicione o
                        seu bot ao grupo, envie uma mensagem no grupo e use o mesmo tipo de bot de ID ou consulte o ID do
                        grupo (costuma ser negativo, ex.{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">-100…</code>).
                      </li>
                      <li className="pl-1">
                        Cole o Chat ID no campo abaixo, escolha que alertas quer (vendas, erros de postback, cliques) e
                        clique em <strong className="font-medium text-foreground/90">Guardar</strong>.
                      </li>
                      <li className="pl-1">
                        Use <strong className="font-medium text-foreground/90">Testar integração</strong> para confirmar
                        que recebe uma mensagem de teste. Se não chegar nada, confira o token, o Chat ID e se já falou com
                        o bot pelo menos uma vez.
                      </li>
                    </ol>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="tg-token">Token do bot</Label>
                      <Input
                        id="tg-token"
                        type="password"
                        autoComplete="off"
                        placeholder={telegram.has_bot_token ? "•••• token guardado — cole um novo para substituir" : "123456:ABC…"}
                        value={telegramTokenDraft}
                        onChange={(e) => setTelegramTokenDraft(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Crie um bot com @BotFather. O token não é mostrado depois de guardado.
                      </p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="tg-chat">Chat ID</Label>
                      <Input
                        id="tg-chat"
                        placeholder="-1001234567890"
                        value={telegramChatDraft}
                        onChange={(e) => setTelegramChatDraft(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 space-y-3">
                    <p className="text-sm font-medium text-foreground">Notificações</p>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">Nova venda (conversão registada)</span>
                      <Switch checked={notifySale} onCheckedChange={setNotifySale} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">Problema no postback (clique inválido ou sem ID)</span>
                      <Switch checked={notifyPostback} onCheckedChange={setNotifyPostback} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">Novo clique (pode gerar muito tráfego)</span>
                      <Switch checked={notifyClick} onCheckedChange={setNotifyClick} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="gap-2"
                      disabled={saveTelegram.isPending}
                      onClick={() => saveTelegram.mutate()}
                    >
                      {saveTelegram.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      disabled={!telegram.telegram_configured || testTelegram.isPending}
                      onClick={() => testTelegram.mutate()}
                    >
                      {testTelegram.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Testar integração
                    </Button>
                    {telegram.has_bot_token ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/5"
                        disabled={clearTelegramToken.isPending}
                        onClick={() => clearTelegramToken.mutate()}
                      >
                        Remover token
                      </Button>
                    ) : null}
                  </div>

                  {telegram.telegram_configured ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Telegram configurado e pronto a enviar.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Preencha token e Chat ID e guarde para ativar os alertas.</p>
                  )}
                </>
              )}
            </AccordionContent>
          </SectionShell>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
