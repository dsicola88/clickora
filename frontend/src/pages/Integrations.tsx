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

function SectionShell({
  accent,
  children,
  className,
}: {
  accent: "primary" | "accent" | "success";
  children: ReactNode;
  className?: string;
}) {
  const ring =
    accent === "primary"
      ? "border-l-primary"
      : accent === "accent"
        ? "border-l-accent"
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
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

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
        description="Ligue o dclickora a canais externos: alertas no Telegram, upload CSV para o Google Ads e mais."
      />

      <Accordion type="multiple" defaultValue={["google", "telegram"]} className="space-y-4">
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
                    Bot API — vendas, alertas de postback e opcionalmente novos cliques.
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
