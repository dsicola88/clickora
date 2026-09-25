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
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { integrationsService } from "@/services/integrationsService";
import { useAuth } from "@/contexts/AuthContext";
import { userCanWriteIntegrations } from "@/lib/workspaceCapabilities";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import {
  AFFILIATE_PLATFORMS,
  buildAffiliateFunnelEventUrl,
  buildAffiliatePostbackExampleUrl,
  getAffiliateFunnelGuide,
  getAffiliatePostbackPreset,
} from "@/lib/marketingPlatforms";
import { ensureHttpsWebhookUrl } from "@/lib/webhookPublicUrl";
import { PRO_PAGE_SHELL, ProPageHeader } from "@/components/enterprise/ProShell";

export default function Plataformas() {
  const { user, refreshUser, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const intLocked = !userCanWriteIntegrations(user);
  /** Reservado a planos com flag no admin; super_admin ignora para suporte. */
  const hookPlanDenied =
    !isSuperAdmin && Boolean(user?.plan && user.plan.affiliate_webhook_enabled === false);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState("BuyGoods");
  const [emailField, setEmailField] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);
  const [copiedFunnel, setCopiedFunnel] = useState<null | "checkout" | "lander" | "checkout_event">(null);

  const {
    data: info,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["integrations-affiliate-webhook-info"],
    enabled: !authLoading && !hookPlanDenied,
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
  const funnelGuide = useMemo(() => getAffiliateFunnelGuide(selected), [selected]);
  const funnelAssets = info?.funnel ?? info?.buygoods_funnel_pixels ?? null;

  const checkoutEventUrl = useMemo(() => {
    const raw = info?.funnel?.checkout_event_postback_url || "";
    if (!raw) return "";
    const base = raw.split("&funnel_step=")[0] || raw;
    return buildAffiliateFunnelEventUrl(base, selected, "checkout");
  }, [info?.funnel?.checkout_event_postback_url, selected]);

  const handleCopyExample = useCallback(() => {
    if (!examplePostbackUrl) return;
    navigator.clipboard.writeText(examplePostbackUrl);
    setCopiedExample(true);
    toast.success("URL de exemplo (com macros) copiada!");
    setTimeout(() => setCopiedExample(false), 2000);
  }, [examplePostbackUrl]);

  const handleCopyFunnel = useCallback(
    (kind: "checkout" | "lander" | "checkout_event") => {
      let text = "";
      if (kind === "checkout") text = funnelAssets?.checkout_html || "";
      else if (kind === "lander") text = funnelAssets?.lander_html || "";
      else text = checkoutEventUrl;
      if (!text) return;
      void navigator.clipboard.writeText(text);
      setCopiedFunnel(kind);
      const msgs = {
        checkout: `Pixel HTML Checkout — cole em: ${funnelGuide.panelPath}`,
        lander: `Pixel HTML Lander — cole em: ${funnelGuide.panelPath}`,
        checkout_event: `URL Event Checkout — postback tipo Event em ${selected}`,
      } as const;
      toast.success(msgs[kind]);
      setTimeout(() => setCopiedFunnel(null), 2000);
    },
    [checkoutEventUrl, funnelAssets?.checkout_html, funnelAssets?.lander_html, funnelGuide.panelPath, selected],
  );

  const testPostback = useMutation({
    mutationFn: async () => {
      const { data, error } = await integrationsService.testAffiliatePostback(selected);
      if (error) throw new Error(error);
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(data.message || "Ligação OK");
      } else {
        toast.error(data.error || data.message || "Teste falhou");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading) return <LoadingState message="A carregar sessão…" />;

  if (hookPlanDenied) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <ProPageHeader
          title="Postback"
          subtitle="URL para a rede notificar vendas aprovadas no dclickora."
        />
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-4 py-4 text-sm text-foreground space-y-2">
          <p className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            Webhook de afiliados não está activo no seu plano
          </p>
          <p className="text-muted-foreground leading-relaxed text-xs">
            O URL de postback e a documentação por rede estão disponíveis nos planos que incluem esta funcionalidade.
            Um administrador pode também activar a opção «Webhook de afiliados» no seu plano no painel de administração.
          </p>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/planos">Ver planos e preços</Link>
          </Button>
        </div>
      </div>
    );
  }

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
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Postback"
        subtitle="Vendas por postback · funil (Checkout) só quando a rede dispara pixel ou Event — sem inventar métricas."
      />

      {intLocked ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-950/90 dark:text-amber-100/90 mb-4">
          Só pode <strong>consultar</strong> estes dados: alterar o e-mail de notificação ou testar envio requer permissão para integrações neste workspace.
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 sm:p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ListOrdered className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-base font-semibold text-foreground">Como configurar (passos profissionais)</h2>
        </div>
        <ol className="list-decimal list-outside space-y-2.5 pl-5 text-sm text-muted-foreground leading-relaxed marker:font-semibold marker:text-foreground">
          <li>
            Escolha a <strong className="text-foreground/90">rede</strong> à esquerda. O cartão à direita adapta-se ao que essa rede permite de verdade.
          </li>
          <li>
            <strong className="text-foreground/90">Vendas:</strong> Copiar com macros → cole no postback / IPN da rede (Conversion).
          </li>
          <li>
            <strong className="text-foreground/90">Checkout (opcional):</strong> no bloco Funil — pixel HTML (ex. BuyGoods) ou Event postback (ex. SmartAdv). Se a rede só notifica venda, o bloco diz-lhe isso sem inventar Checkout Visitors.
          </li>
          <li>
            Na <strong className="text-foreground/90">presell</strong>, use o hoplink oficial — a Clickora acrescenta o ID do clique
            (BuyGoods → <span className="font-mono text-[11px]">subid</span>, SmartAdv →{" "}
            <span className="font-mono text-[11px]">sub3</span>, Digistore → <span className="font-mono text-[11px]">cid</span>).
          </li>
          <li>
            Venda aprovada → Conversões. Evento Checkout → Relatórios → Acessos (não conta como venda).
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground border-t border-border/50 pt-3">
          Se o postback de venda chegar sem ID de clique, a venda <strong className="text-foreground/90">ainda é registada</strong> como não atribuída — não se perde o registo; só falta a ligação ao anúncio.
        </p>
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

            <div className="space-y-2 rounded-xl border-2 border-primary/40 bg-primary/[0.06] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="font-semibold text-foreground text-base">
                  → Cole este URL na {selected}
                </Label>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Usar este
                </span>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">
                Clique <strong>Copiar com macros</strong> e cole em{" "}
                {selected === "BuyGoods" ? (
                  <>
                    BuyGoods → <strong>Setup → Affiliates → Postback Pixels → Add</strong>
                  </>
                ) : selected === "SmartAdv" ? (
                  <>SmartAdv → Postbacks (Global ou por oferta)</>
                ) : (
                  <>o painel de Postback / IPN da {selected}</>
                )}
                . As macros entre chaves são preenchidas pela rede na venda.
              </p>
              <p className="text-xs text-foreground/90 leading-snug rounded-lg bg-background/80 border border-border/50 px-3 py-2">
                <span className="font-semibold text-foreground">{selected}:</span> {postbackPresetHint}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:flex-wrap">
                <Input readOnly value={examplePostbackUrl} className="font-mono text-[11px] leading-snug bg-background h-auto min-h-[3rem] py-2 flex-1 min-w-[12rem]" />
                <Button type="button" className="gap-2 shrink-0 sm:self-start" onClick={handleCopyExample}>
                  {copiedExample ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copiar com macros
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2 shrink-0 sm:self-start"
                  disabled={intLocked || testPostback.isPending}
                  onClick={() => testPostback.mutate()}
                >
                  {testPostback.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Testar ligação
                </Button>
              </div>
              {testPostback.data ? (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                    testPostback.data.ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
                      : "border-amber-500/30 bg-amber-500/10 text-foreground"
                  }`}
                >
                  <p className="font-medium">
                    {testPostback.data.ok ? "Resultado do teste" : "Atenção"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {testPostback.data.message || testPostback.data.error}
                  </p>
                  {testPostback.data.next_step ? (
                    <p className="mt-1 text-muted-foreground">Próximo: {testPostback.data.next_step}</p>
                  ) : null}
                  {testPostback.data.conversion ? (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      conversion={testPostback.data.conversion}
                      {testPostback.data.attribution ? ` · attribution=${testPostback.data.attribution}` : ""}
                      {testPostback.data.click_id ? ` · click=${testPostback.data.click_id.slice(0, 8)}…` : ""}
                    </p>
                  ) : null}
                  {testPostback.data.ok ? (
                    <Button variant="link" className="h-auto px-0 mt-1 text-xs" asChild>
                      <Link to="/resultados/conversoes">Ver Conversões</Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2.5 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide">Como validar de ponta a ponta</p>
                <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
                  <li>
                    Cole o URL com macros na {selected} e guarde.
                  </li>
                  <li>
                    Abra o <strong className="text-foreground/90">link da campanha</strong> (o do anúncio) no browser e clique no CTA da oferta — gera um clique real.
                  </li>
                  <li>
                    Clique <strong className="text-foreground/90">Testar ligação</strong> — a Clickora simula a venda da {selected} com esse clique.
                  </li>
                  <li>
                    Confirme em <Link to="/resultados/conversoes" className="text-primary underline-offset-2 hover:underline">Conversões</Link>{" "}
                    (deve aparecer atribuída). Opcional: venda real de teste na rede.
                  </li>
                </ol>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Rede: <span className="font-medium text-foreground/90">{selected}</span> → parâmetro{" "}
                <span className="font-mono">platform=…</span> nos alertas.
              </p>
            </div>

            {funnelAssets ? (
              <div className="space-y-4 rounded-xl border border-border/60 bg-muted/15 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="font-semibold text-foreground text-base">
                      Funil: Checkout / Lander
                    </Label>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {funnelGuide.mode === "html_funnel_pixels"
                        ? "Pixel HTML"
                        : funnelGuide.mode === "event_postback"
                          ? "Event postback"
                          : "Só venda (típico)"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{funnelGuide.summary}</p>
                  <p className="mt-1 text-xs text-foreground/80">
                    Onde configurar: <span className="font-medium">{funnelGuide.panelPath}</span>
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed border-t border-border/40 pt-2">
                    Sempre disponível sem pixel: <strong className="text-foreground/85">Clique</strong> (saída para a
                    oferta) e <strong className="text-foreground/85">Venda</strong> (postback acima). Checkout na
                    dclickora só depois de a rede disparar pixel/evento.
                  </p>
                </div>

                {funnelGuide.mode === "html_funnel_pixels" || funnelGuide.mode === "sale_only" ? (
                  <div className="space-y-3">
                    {funnelGuide.mode === "sale_only" ? (
                      <p className="text-xs text-amber-900/90 dark:text-amber-100/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 leading-relaxed">
                        Esta rede, na documentação típica, <strong>não</strong> envia Checkout Visitors. Os campos
                        abaixo só servem se o painel tiver slot de pixel HTML no checkout/order form — caso contrário
                        ignore.
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Pixel HTML — Checkout</Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <Input
                          readOnly
                          value={funnelAssets.checkout_html}
                          className="font-mono text-[10px] leading-snug bg-background h-auto min-h-[2.75rem] py-2 flex-1"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          className="gap-2 shrink-0"
                          disabled={intLocked}
                          onClick={() => handleCopyFunnel("checkout")}
                        >
                          {copiedFunnel === "checkout" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          Copiar Checkout
                        </Button>
                      </div>
                    </div>
                    {(funnelGuide.supportsLander || funnelGuide.mode === "sale_only") && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Pixel HTML — Lander / VSL (opcional)</Label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                          <Input
                            readOnly
                            value={funnelAssets.lander_html}
                            className="font-mono text-[10px] leading-snug bg-background h-auto min-h-[2.75rem] py-2 flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2 shrink-0"
                            disabled={intLocked}
                            onClick={() => handleCopyFunnel("lander")}
                          >
                            {copiedFunnel === "lander" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            Copiar Lander
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {funnelGuide.mode === "event_postback" && checkoutEventUrl ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      URL Event postback — Checkout (não use como Conversion/venda)
                    </Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <Input
                        readOnly
                        value={checkoutEventUrl}
                        className="font-mono text-[10px] leading-snug bg-background h-auto min-h-[2.75rem] py-2 flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="gap-2 shrink-0"
                        disabled={intLocked}
                        onClick={() => handleCopyFunnel("checkout_event")}
                      >
                        {copiedFunnel === "checkout_event" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Copiar Event
                      </Button>
                    </div>
                    {funnelGuide.eventClickIdMacro ? (
                      <p className="text-[11px] text-muted-foreground">
                        Macro do click id nesta rede:{" "}
                        <span className="font-mono text-foreground/85">{funnelGuide.eventClickIdMacro}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Eventos de funil aparecem em{" "}
                  <Link to="/resultados/relatorios/acessos" className="text-primary underline-offset-2 hover:underline">
                    Relatórios → Acessos
                  </Link>{" "}
                  como <strong className="text-foreground/90">Checkout</strong> ou Lander / VSL — nunca como venda.
                </p>
              </div>
            ) : null}

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-0 h-auto text-muted-foreground gap-1">
                  Para que serve a outra URL? (avançado)
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-3">
                <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
                  <Label className="font-semibold text-muted-foreground">URL base (só o token)</Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    É a mesma base do URL de cima, <strong className="text-foreground/90">sem</strong> as macros{" "}
                    <span className="font-mono">{"{SUBID}"}</span>, <span className="font-mono">{"{ORDERID}"}</span>, etc.
                    Só precisa dela se a rede pedir o endpoint à parte e as macros noutro formulário — ou para suporte.
                    Na BuyGoods normalmente <strong className="text-foreground/90">não usa</strong> esta; usa «Copiar com macros».
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <Input readOnly value={displayHookUrl} className="font-mono text-xs bg-muted/30 h-11 sm:h-10 opacity-90" />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={handleCopyHook} title="Copiar URL base">
                        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
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
              </CollapsibleContent>
            </Collapsible>

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
