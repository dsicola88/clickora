import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search,
  Save,
  Copy,
  Check,
  Mail,
  Link2,
  AlertCircle,
  ExternalLink,
  Loader2,
  ListOrdered,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { integrationsService } from "@/services/integrationsService";
import { useAuth } from "@/contexts/AuthContext";
import { userCanWriteIntegrations } from "@/lib/workspaceCapabilities";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import {
  AFFILIATE_PLATFORMS,
  buildAffiliatePostbackExampleUrl,
  getAffiliatePostbackPreset,
} from "@/lib/marketingPlatforms";
import { ensureHttpsWebhookUrl } from "@/lib/webhookPublicUrl";

export default function Plataformas() {
  const { user, refreshUser, isAdmin } = useAuth();
  const intLocked = !userCanWriteIntegrations(user);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState("BuyGoods");
  const [emailField, setEmailField] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);

  const {
    data: info,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["integrations-affiliate-webhook-info"],
    queryFn: async () => {
      const { data, error: err } = await integrationsService.getAffiliateWebhookInfo();
      if (err) throw new Error(err);
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
  });

  useEffect(() => {
    if (info?.sale_notify_email !== undefined) {
      setEmailField(info.sale_notify_email);
    }
  }, [info?.sale_notify_email]);

  useEffect(() => {
    if (!info && user?.sale_notify_email) {
      setEmailField(user.sale_notify_email);
    }
  }, [info, user?.sale_notify_email]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = emailField.trim();
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        throw new Error("E-mail inválido.");
      }
      const { error: err } = await integrationsService.patchNotificationEmail(trimmed);
      if (err) throw new Error(err);
    },
    onSuccess: async () => {
      toast.success("E-mail de notificação guardado.");
      await queryClient.invalidateQueries({ queryKey: ["integrations-affiliate-webhook-info"] });
      await refreshUser();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.testSaleEmail();
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`E-mail de teste enviado para ${data?.sent_to ?? "o destino configurado"}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredPlatforms = AFFILIATE_PLATFORMS.filter((p) => p.toLowerCase().includes(filter.toLowerCase()));

  /** Base do webhook com HTTPS garantido no browser (produção). */
  const displayHookUrl = useMemo(
    () => (info?.hook_url ? ensureHttpsWebhookUrl(info.hook_url) : ""),
    [info?.hook_url],
  );

  const handleCopyHook = useCallback(() => {
    if (!displayHookUrl) return;
    navigator.clipboard.writeText(displayHookUrl);
    setCopied(true);
    toast.success("URL do webhook copiada!");
    setTimeout(() => setCopied(false), 2000);
  }, [displayHookUrl]);

  /** Exemplo alinhado à plataforma escolhida (macros + parâmetros que o servidor lê). */
  const examplePostbackUrl = useMemo(() => {
    if (!displayHookUrl) return "";
    return buildAffiliatePostbackExampleUrl(displayHookUrl, selected);
  }, [displayHookUrl, selected]);

  const postbackPresetHint = useMemo(() => getAffiliatePostbackPreset(selected).hint, [selected]);

  const handleCopyExample = useCallback(() => {
    if (!examplePostbackUrl) return;
    navigator.clipboard.writeText(examplePostbackUrl);
    setCopiedExample(true);
    toast.success("URL de exemplo (com macros) copiada!");
    setTimeout(() => setCopiedExample(false), 2000);
  }, [examplePostbackUrl]);

  if (isLoading) return <LoadingState message="Carregando integrações..." />;
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Erro ao carregar."}
        onRetry={() => refetch()}
      />
    );
  }

  if (!info) return <ErrorState message="Sem dados." onRetry={() => refetch()} />;

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Plataformas"
        description="Sincronize vendas da sua rede de afiliados com o dclickora: escolha a plataforma, configure o e-mail, copie o postback para a rede e teste. Depois disso, notificações e conversões ficam ligadas automaticamente."
      />

      {intLocked ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-950/90 dark:text-amber-100/90 mb-4">
          Só pode <strong>consultar</strong> estes dados: alterar o e-mail de notificação ou testar envio requer permissão para integrações neste workspace.
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.07] via-card to-violet-500/[0.05] p-5 sm:p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ListOrdered className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-base font-semibold text-foreground">Como configurar (fluxo do afiliado)</h2>
        </div>
        <ol className="list-decimal list-outside space-y-2.5 pl-5 text-sm text-muted-foreground leading-relaxed marker:font-semibold marker:text-foreground">
          <li>
            Escolhe a <strong className="text-foreground/90">rede</strong> na coluna à esquerda (ex.: BuyGoods).
          </li>
          <li>
            Indica o <strong className="text-foreground/90">e-mail</strong> para alertas e clica <strong className="text-foreground/90">Guardar e-mail</strong>.
          </li>
          <li>
            Clica <strong className="text-foreground/90">Copiar com macros</strong> e cola o URL no painel da rede (Postback / IPN / Webhook).
          </li>
          <li>
            Na rede, guarda o postback; confirma na doc da rede que o <strong className="text-foreground/90">SUBID</strong> (ou equivalente) volta no URL — liga a venda ao clique no dclickora.
          </li>
          <li>
            Opcional: <strong className="text-foreground/90">Testar e-mail</strong> (requer SMTP no servidor).
          </li>
          <li>
            Com <strong className="text-foreground/90">venda aprovada</strong>, a rede chama o dclickora; repete para outra rede mudando a seleção à esquerda.
          </li>
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-card shadow-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar redes..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              Lista de referência. A mesma URL de webhook serve para qualquer rede que permita Postback / IPN por HTTP.
            </p>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {filteredPlatforms.map((platform) => (
              <button
                key={platform}
                type="button"
                onClick={() => setSelected(platform)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-border/30 last:border-0 ${
                  selected === platform
                    ? "gradient-primary text-primary-foreground font-medium"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                {platform}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-card-foreground">
                <span className="text-muted-foreground font-normal text-sm uppercase tracking-wider">Rede</span>{" "}
                {selected}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Siga os passos do cartão <strong className="text-foreground/90">Como configurar</strong> acima. Na conta{" "}
                <strong className="text-foreground/90">{selected}</strong>, use o postback completo (com macros). Quando houver conversão, a rede
                chama o dclickora e recebe um e-mail com o resumo do pedido.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-semibold">
                <Mail className="h-4 w-4 text-muted-foreground" />
                E-mail para alertas de venda
              </Label>
              <p className="text-xs text-muted-foreground">
                Opcional. Se vazio, usa o e-mail da conta: <span className="font-mono text-[11px]">{info.fallback_account_email}</span>
              </p>
              <Input
                type="email"
                placeholder={info.fallback_account_email || "seu@email.com"}
                value={emailField}
                readOnly={intLocked}
                onChange={(e) => setEmailField(e.target.value)}
              />
              <Button
                type="button"
                className="gap-2"
                onClick={() => saveMutation.mutate()}
                disabled={intLocked || saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar e-mail
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">URL do webhook (Postback)</Label>
              {isAdmin ? (
                <p className="text-xs text-muted-foreground">
                  Em produção deve ser <strong className="text-foreground/90">https://</strong>. Já inclui{" "}
                  <span className="font-mono">?token=…</span> (segredo). Parâmetros extra usam{" "}
                  <span className="font-mono">&amp;</span>. Na API, defina <span className="font-mono">API_PUBLIC_URL=https://www.dclickora.com/api</span>{" "}
                  (ou o domínio público da API) para o URL gerado ser sempre correto.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Em produção use <strong className="text-foreground/90">https</strong>. O URL inclui um token secreto — não o partilhe. Parâmetros extra
                  usam <span className="font-mono">&amp;</span>.
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input readOnly value={displayHookUrl} className="font-mono text-xs bg-muted/30 h-11 sm:h-10" />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="icon" onClick={handleCopyHook} title="Copiar URL">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    className="gap-2 shrink-0"
                    onClick={() => testMutation.mutate()}
                    disabled={intLocked || testMutation.isPending || !info.smtp_configured}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    Testar e-mail
                  </Button>
                </div>
              </div>
              {!info.smtp_configured && (
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  {isAdmin ? (
                    <>
                      O servidor ainda não tem SMTP configurado (<span className="font-mono">SMTP_HOST</span>,{" "}
                      <span className="font-mono">SMTP_FROM</span>, etc.). O botão de teste fica desativado até isso existir no{" "}
                      <span className="font-mono">.env</span> da API.
                    </>
                  ) : (
                    <>O envio de e-mail de teste ainda não está disponível neste ambiente. Contacte o suporte se precisar de ajuda.</>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/[0.04] p-4">
              <Label className="font-semibold text-foreground">URL para colar na plataforma (com macros de sincronização)</Label>
              {isAdmin ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Em muitas redes o postback é <strong className="text-foreground/90">uma só linha de URL</strong>: o domínio e o caminho são do teu
                  servidor dclickora; depois vêm parâmetros com <strong>placeholders</strong> que a rede troca por valores reais na venda (o mesmo
                  conceito que URLs do tipo{" "}
                  <span className="font-mono text-[10px] break-all opacity-80">
                    …/aios-success/?buygoods-notify=1&amp;orderid=&#123;ORDERID&#125;…
                  </span>
                  ). <strong>Não uses o domínio de outro site</strong> — substitui pelo URL abaixo (começa pela tua API). Os nomes{" "}
                  <span className="font-mono">&#123;ORDERID&#125;</span>, <span className="font-mono">&#123;SUBID&#125;</span>, etc. devem coincidir
                  com a <strong>documentação oficial da rede</strong> (BuyGoods, Digistore24, ClickBank…); este bloco é um modelo que podes editar
                  antes de guardar na rede. O parâmetro <span className="font-mono">clickora_click_id</span> deve repetir o mesmo UUID que o link de
                  oferta envia no URL (ou num subid que a rede devolva no postback) — assim a venda fica ligada ao clique no presell.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Copie o URL abaixo para a rede de afiliados. Os nomes entre chaves (macros) devem coincidir com a documentação da rede. O parâmetro{" "}
                  <span className="font-mono text-[11px]">clickora_click_id</span> liga a venda ao clique na presell.
                </p>
              )}
              <p className="text-xs text-foreground/90 leading-snug rounded-lg bg-muted/40 border border-border/50 px-3 py-2">
                <span className="font-semibold text-foreground">{selected}:</span> {postbackPresetHint}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input readOnly value={examplePostbackUrl} className="font-mono text-[11px] leading-snug bg-background/80 h-auto min-h-[3rem] py-2" />
                <Button type="button" variant="secondary" className="gap-2 shrink-0 sm:self-start" onClick={handleCopyExample}>
                  {copiedExample ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  Copiar com macros
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Rede selecionada na lista: <span className="font-medium text-foreground/90">{selected}</span> → enviada como{" "}
                <span className="font-mono">platform=…</span> no e-mail de alerta.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>
                    <strong className="text-foreground/90">Google Ads / Microsoft Ads</strong> usam outro fluxo (conversões por GCLID). Use{" "}
                    <Link to="/tracking/tools" className="text-primary inline-flex items-center gap-1 hover:underline">
                      Tracking Tools <ExternalLink className="h-3 w-3" />
                    </Link>
                    .
                  </p>
                  {isAdmin ? (
                    <p>
                      <strong className="text-foreground/90">Webhook Hotmart do dclickora</strong> (assinaturas da app) é outro endpoint:{" "}
                      <span className="font-mono">/api/webhooks/hotmart</span> — não confundir com postback de afiliado.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
