import { useState } from "react";
import { ChevronDown, ChevronRight, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PresellConfigSettings } from "@/lib/presellConfigDefaults";
import { PresellProfessionalDocStrip } from "@/components/presell/PresellProfessionalDocStrip";

type Surface = "dashboard" | "editor";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configSettings: PresellConfigSettings;
  setConfigSettings: React.Dispatch<React.SetStateAction<PresellConfigSettings>>;
  trackingEmbedScript: string;
  surface?: Surface;
  /** Texto do trigger (ex.: mesma etiqueta no dashboard e no editor manual). */
  triggerLabel?: string;
};

/**
 * Bloco «Opcional: configurações e rastreamento» partilhado entre
 * criação automática (`PresellDashboard`) e editor manual (`PresellManualBuilderPage`).
 */
export function PresellAdvancedTrackingCollapsible({
  open,
  onOpenChange,
  configSettings,
  setConfigSettings,
  trackingEmbedScript,
  surface = "dashboard",
  triggerLabel = "Pixels de anúncios e configurações",
}: Props) {
  const [copiedTrackingScript, setCopiedTrackingScript] = useState(false);
  const isEditor = surface === "editor";

  return (
    <div className="space-y-2">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger
          className={cn(
            "w-full flex items-center justify-between gap-3 rounded-xl px-4 py-4 sm:px-6 border transition-colors cursor-pointer text-left min-w-0",
            isEditor
              ? "bg-editor-panel-2 border-editor-border text-editor-fg hover:bg-editor-border/80"
              : "bg-card border-border/50 hover:bg-muted/30 text-card-foreground",
          )}
        >
          <span className={cn("font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
            {triggerLabel}
          </span>
          {open ? (
            <ChevronDown className={cn("h-4 w-4 shrink-0", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")} />
          ) : (
            <ChevronRight className={cn("h-4 w-4 shrink-0", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")} />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div
            className={cn(
              "rounded-b-xl px-4 py-4 sm:px-6 border-x border-b space-y-6 w-full min-w-0",
              isEditor
                ? "bg-editor-panel border-editor-border text-editor-fg"
                : "bg-card border-border/50 text-card-foreground",
            )}
          >
            <PresellProfessionalDocStrip isEditor={isEditor} />

            <p
              className={cn(
                "text-[11px] leading-relaxed rounded-md border px-2.5 py-2",
                isEditor
                  ? "border-editor-border/80 bg-editor-bg/50 text-editor-fg-muted"
                  : "border-border/60 bg-muted/30 text-muted-foreground",
              )}
            >
              <span className={cn("font-medium", isEditor ? "text-editor-fg" : "text-foreground")}>
                Multi-conta:{" "}
              </span>
              estes valores aplicam-se só a esta presell. Cada afiliado ou página tem os seus próprios IDs e scripts —
              nada é misturado entre contas.
            </p>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  Popup de saída
                </p>
                <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Ao tentar sair da página
                </p>
              </div>
              <Switch
                checked={Boolean(configSettings.exitPopup)}
                onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, exitPopup: v }))}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  Contagem regressiva
                </p>
                <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Urgência com timer
                </p>
              </div>
              <Switch
                checked={Boolean(configSettings.countdownTimer)}
                onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, countdownTimer: v }))}
              />
            </div>
            {configSettings.countdownTimer ? (
              <div
                className={cn(
                  "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-dashed px-3 py-2",
                  isEditor ? "border-editor-border bg-editor-panel-2/50" : "border-border/60 bg-muted/20",
                )}
              >
                <Label className={cn("text-xs shrink-0", isEditor ? "text-editor-fg" : "")}>
                  Duração do timer (minutos)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  className={cn("max-w-[8rem] sm:max-w-[10rem]", isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "")}
                  value={String(configSettings.countdownDurationMinutes ?? "15")}
                  onChange={(e) =>
                    setConfigSettings((p) => ({ ...p, countdownDurationMinutes: e.target.value }))
                  }
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  Prova social
                </p>
                <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Notificações de compras
                </p>
              </div>
              <Switch
                checked={Boolean(configSettings.socialProof)}
                onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, socialProof: v }))}
              />
            </div>
            <div className="space-y-2 max-w-2xl">
              <Label htmlFor={isEditor ? "presell-offer-fwd-editor" : "presell-offer-fwd"}>
                Propagar parâmetros da URL para o hoplink
              </Label>
              <p
                className={cn(
                  "text-[10px] leading-snug",
                  isEditor ? "text-editor-fg-muted" : "text-muted-foreground",
                )}
              >
                <span className="font-mono">sub1</span> e <span className="font-mono">sub2</span> passam para o link da
                oferta quando lá ainda não existem. <span className="font-mono">sub3</span> não vai por defeito: é o
                identificador de clique da SmartAdv. Acrescenta aqui mais nomes (vírgula ou espaço): só{" "}
                <span className="font-mono">a-z</span>,{" "}
                <span className="font-mono">0-9</span>, <span className="font-mono">-</span> e{" "}
                <span className="font-mono">_</span>, até 32 nomes. Nunca sobrepõe o que o hoplink já define.
              </p>
              <Input
                id={isEditor ? "presell-offer-fwd-editor" : "presell-offer-fwd"}
                placeholder="ex.: txn_id, aff_sub, ext_click_id"
                value={String(configSettings.offerQueryForwardAllowlist ?? "")}
                onChange={(e) =>
                  setConfigSettings((p) => ({ ...p, offerQueryForwardAllowlist: e.target.value }))
                }
                className={cn(
                  "font-mono text-sm",
                  isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                )}
              />
            </div>
            {/* Pixels de anúncios — automático (IDs) ou manual (colar script) */}
            <div
              className={cn(
                "space-y-4 rounded-xl border px-3 py-3 sm:px-4",
                isEditor ? "border-editor-accent/35 bg-editor-panel-2/50" : "border-primary/20 bg-primary/[0.03]",
              )}
            >
              <div>
                <p className={cn("text-sm font-semibold", isEditor ? "text-editor-fg" : "text-foreground")}>
                  Pixels de anúncios (Meta, TikTok, Google, Bing)
                </p>
                <p className={cn("mt-1 text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  Para uma página feita para Facebook, TikTok ou outra rede: escolhe o modo, cola o ID ou o script do
                  painel da plataforma — a Clickora injeta na presell publicada. O rastreio Clickora (cliques / comissão)
                  continua automático.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "auto", label: "Automático (só IDs)" },
                    { id: "manual", label: "Manual (colar script)" },
                  ] as const
                ).map((opt) => {
                  const active =
                    String(configSettings.adPixelsMode ?? "auto").toLowerCase() === opt.id ||
                    (!configSettings.adPixelsMode && opt.id === "auto");
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const prev = String(configSettings.adPixelsMode ?? "auto").toLowerCase();
                        if (prev === opt.id) return;
                        if (opt.id === "manual") {
                          const hasIds = Boolean(
                            String(configSettings.fbPixelId ?? "").trim() ||
                              String(configSettings.tiktokPixelId ?? "").trim() ||
                              String(configSettings.bingUetTagId ?? "").trim() ||
                              String(configSettings.googleTrackingCode ?? "").trim() ||
                              String(configSettings.googleConversionEvent ?? "").trim(),
                          );
                          const hasScript = Boolean(
                            String(configSettings.conversionTrackingScript ?? "").trim(),
                          );
                          if (hasIds && !hasScript) {
                            toast.warning("Modo manual sem script", {
                              description:
                                "Os IDs deixam de gerar pixel. Cola o script completo da Meta/TikTok/Google/Bing no campo abaixo, ou fica em Automático.",
                            });
                          } else {
                            toast.message("Modo manual", {
                              description:
                                "Cola o script completo no campo abaixo. Os IDs não geram pixel automático (evita duplicar).",
                            });
                          }
                        } else {
                          toast.message("Modo automático", {
                            description:
                              "Usa só os IDs. Se já tiveres um script completo colado, esse continua no head — remove-o se for o mesmo pixel.",
                          });
                        }
                        setConfigSettings((p) => ({ ...p, adPixelsMode: opt.id }));
                      }}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? isEditor
                            ? "border-editor-accent bg-editor-accent/15 text-editor-fg"
                            : "border-primary bg-primary/10 text-foreground"
                          : isEditor
                            ? "border-editor-border bg-editor-bg text-editor-fg-muted hover:text-editor-fg"
                            : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {String(configSettings.adPixelsMode ?? "auto").toLowerCase() !== "manual" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 min-w-0">
                      <Label>Pixel Meta (Facebook / Instagram)</Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        Gestor de eventos → Pixel → só o ID (dígitos). PageView na carga.
                      </p>
                      <Input
                        placeholder="ex.: 1234567890123456"
                        inputMode="numeric"
                        value={String(configSettings.fbPixelId ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, fbPixelId: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor={isEditor ? "presell-fb-track-editor" : "fbTrackName"}>
                        Evento Meta extra (opcional)
                      </Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        Dispara <span className="font-mono">trackCustom</span> após o PageView.
                      </p>
                      <Input
                        id={isEditor ? "presell-fb-track-editor" : "fbTrackName"}
                        placeholder="ex.: Lead ou ViewContent"
                        value={String(configSettings.fbTrackName ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, fbTrackName: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label>Pixel TikTok</Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        TikTok Ads → Events → Pixel ID.
                      </p>
                      <Input
                        placeholder="ex.: CABCDEF1234567890"
                        value={String(configSettings.tiktokPixelId ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, tiktokPixelId: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label>Bing / Microsoft UET</Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        Microsoft Advertising → UET tag ID (só números).
                      </p>
                      <Input
                        placeholder="ex.: 12345678"
                        inputMode="numeric"
                        value={String(configSettings.bingUetTagId ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, bingUetTagId: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label>Google Analytics / tag</Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        <span className="font-mono">G-…</span>, <span className="font-mono">GTM-…</span> ou{" "}
                        <span className="font-mono">AW-…</span>
                      </p>
                      <Input
                        placeholder="G-XXXXXXXX ou GTM-XXXX ou AW-…"
                        value={String(configSettings.googleTrackingCode ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, googleTrackingCode: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <Label>Conversão Google Ads (opcional)</Label>
                      <p className={cn("text-[10px] leading-snug", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                        <span className="font-mono">AW-123/AbCdEf</span> — dispara conversion na carga.
                      </p>
                      <Input
                        placeholder="AW-123456789/AbCdEfGh"
                        value={String(configSettings.googleConversionEvent ?? "")}
                        onChange={(e) => setConfigSettings((p) => ({ ...p, googleConversionEvent: e.target.value }))}
                        className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Script / pixel completo</Label>
                  <p className={cn("text-[10px] leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    Cola o código que a Meta, TikTok, Google Ads ou Bing te dão (pode incluir vários{" "}
                    <span className="font-mono">&lt;script&gt;</span>). É injetado no{" "}
                    <span className="font-mono">&lt;head&gt;</span> da página publicada. Em modo manual os IDs acima
                    não geram script automático (evita duplicar o pixel).
                  </p>
                  <Textarea
                    rows={7}
                    placeholder={`<!-- Ex.: Pixel Meta ou TikTok completo -->\n<script>…</script>`}
                    value={String(configSettings.conversionTrackingScript ?? "")}
                    onChange={(e) =>
                      setConfigSettings((p) => ({ ...p, conversionTrackingScript: e.target.value }))
                    }
                    className={cn(
                      "font-mono text-xs min-h-[8rem]",
                      isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                    )}
                  />
                </div>
              )}
            </div>

            <div
              className={cn(
                "space-y-4 rounded-xl border px-3 py-3",
                isEditor ? "border-editor-border bg-editor-panel-2/60" : "border-border/60 bg-muted/20",
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                    Página segura por país
                  </p>
                  <p className={cn("text-xs", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    Os países desta lista vêem o texto seguro, sem oferta. O mesmo texto serve a IPs que
                    adicionares à blacklist (bloqueio manual) ou a regras opt-in (bot/proxy). Sem isso, a
                    presell completa é servida — não há bloqueio automático de cloud/datacenter.
                  </p>
                </div>
                <Switch
                  checked={Boolean(configSettings.enterpriseCloak)}
                  onCheckedChange={(v) => setConfigSettings((p) => ({ ...p, enterpriseCloak: v }))}
                />
              </div>
              {configSettings.enterpriseCloak ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Título da página segura</Label>
                    <Input
                      placeholder="Informação"
                      value={String(configSettings.cloakSafeTitle ?? "")}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, cloakSafeTitle: e.target.value }))}
                      className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto da página segura</Label>
                    <Textarea
                      rows={3}
                      placeholder="Conteúdo informativo…"
                      value={String(configSettings.cloakSafeBody ?? "")}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, cloakSafeBody: e.target.value }))}
                      className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Países bloqueados (ISO)</Label>
                    <Input
                      placeholder="CN, RU"
                      value={String(configSettings.cloakGeoDeny ?? "")}
                      onChange={(e) => setConfigSettings((p) => ({ ...p, cloakGeoDeny: e.target.value }))}
                      className={isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : ""}
                    />
                    <p className={cn("text-[10px]", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                      Códigos de 2 letras separados por vírgula. Esses países recebem a página segura.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={cn("space-y-4 border-t pt-6", isEditor ? "border-editor-border" : "border-border/50")}>
              <div>
                <p className={cn("text-sm font-medium", isEditor ? "text-editor-fg" : "text-card-foreground")}>
                  Scripts na página pública
                </p>
                <p className={cn("text-xs mt-1", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  O script Clickora da conta é aplicado ao <span className="opacity-90">head</span> ao guardar. Podes
                  acrescentar outros scripts (pixels de anúncios, ferramentas de terceiros). Executam na presell publicada em{" "}
                  <span className="opacity-90">&lt;head&gt;</span>, início do corpo e rodapé.
                </p>
              </div>

              {String(configSettings.adPixelsMode ?? "auto").toLowerCase() !== "manual" ? (
                <div
                  className={cn(
                    "rounded-xl border px-3 py-3 space-y-2",
                    isEditor ? "border-editor-accent/40 bg-editor-panel-2/80" : "border-primary/25 bg-muted/20",
                  )}
                >
                  <Label className={cn("text-sm", isEditor ? "text-editor-fg" : "")}>
                    Script extra de conversão (opcional)
                  </Label>
                  <p className={cn("text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    Além dos IDs acima, podes colar aqui um snippet adicional (ex. evento só de purchase). Injetado no{" "}
                    <span className="font-mono text-[11px]">&lt;head&gt;</span> antes do «Código no &lt;head&gt;».
                  </p>
                  <Textarea
                    rows={3}
                    placeholder={`<!-- Opcional — script extra -->`}
                    value={String(configSettings.conversionTrackingScript ?? "")}
                    onChange={(e) =>
                      setConfigSettings((p) => ({ ...p, conversionTrackingScript: e.target.value }))
                    }
                    className={cn(
                      "font-mono text-xs min-h-[4rem]",
                      isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                    )}
                    id={isEditor ? "presell-conversion-head-editor" : "conversionTrackingScript"}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                <div className="space-y-2 min-w-0">
                  <Label className="text-sm">Script Clickora (rastreamento)</Label>
                  <p className={cn("text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    O mesmo valor que em «Código no &lt;head&gt;» ao guardar (<span className="font-mono text-[11px]">data-id</span> = o teu
                    utilizador).
                  </p>
                  {trackingEmbedScript ? (
                    <div className="space-y-2">
                      <Textarea
                        readOnly
                        rows={3}
                        value={trackingEmbedScript}
                        className={cn(
                          "font-mono text-xs min-h-[4.5rem]",
                          isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "bg-muted/30 border-border/80",
                        )}
                        aria-label="Script de rastreamento Clickora"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn("gap-2", isEditor && "border-editor-border bg-editor-panel-2 text-editor-fg")}
                        onClick={() => {
                          void navigator.clipboard.writeText(trackingEmbedScript);
                          setCopiedTrackingScript(true);
                          setTimeout(() => setCopiedTrackingScript(false), 2000);
                          toast.success("Script copiado.");
                        }}
                      >
                        {copiedTrackingScript ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedTrackingScript ? "Copiado" : "Copiar script"}
                      </Button>
                    </div>
                  ) : (
                    <p
                      className={cn(
                        "text-xs rounded-lg border px-3 py-2",
                        isEditor
                          ? "border-editor-border bg-editor-bg text-editor-fg-muted"
                          : "border-dashed border-border/70 bg-muted/20 text-muted-foreground",
                      )}
                    >
                      Inicia sessão para gerar o teu script de rastreamento.
                    </p>
                  )}
                </div>

                <div className={cn("space-y-2 min-w-0", !isEditor && "lg:border-l lg:border-border/50 lg:pl-8")}>
                  <Label htmlFor={isEditor ? "presell-adv-head-editor" : "headerCode"} className="text-sm">
                    Código no &lt;head&gt;
                  </Label>
                  <p className={cn("text-xs leading-relaxed", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                    O Clickora é antecipado automaticamente; edita ou acrescenta outros scripts (pixels, ferramentas de
                    terceiros, etc.) se precisares.
                  </p>
                  <Textarea
                    id={isEditor ? "presell-adv-head-editor" : "headerCode"}
                    rows={3}
                    placeholder={`<script src="…/track/v2/clickora.min.js" data-id="…"></script>`}
                    value={String(configSettings.headerCode ?? "")}
                    onChange={(e) => setConfigSettings((p) => ({ ...p, headerCode: e.target.value }))}
                    className={cn(
                      "font-mono text-xs min-h-[4.5rem]",
                      isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor={isEditor ? "presell-adv-body-editor" : "bodyCode"}>Código no início do conteúdo</Label>
                <Textarea
                  id={isEditor ? "presell-adv-body-editor" : "bodyCode"}
                  rows={2}
                  placeholder="Opcional — após &lt;body&gt;"
                  value={String(configSettings.bodyCode ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, bodyCode: e.target.value }))}
                  className={cn(
                    "font-mono text-xs min-h-[3.5rem]",
                    isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                  )}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor={isEditor ? "presell-adv-foot-editor" : "footerCode"}>Código no rodapé (fim da página)</Label>
                <Textarea
                  id={isEditor ? "presell-adv-foot-editor" : "footerCode"}
                  rows={3}
                  placeholder="Opcional — antes de </body>"
                  value={String(configSettings.footerCode ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, footerCode: e.target.value }))}
                  className={cn(
                    "font-mono text-xs min-h-[4.5rem]",
                    isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                  )}
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor={isEditor ? "presell-adv-css-editor" : "customCss"}>CSS personalizado (opcional)</Label>
                <Textarea
                  id={isEditor ? "presell-adv-css-editor" : "customCss"}
                  rows={3}
                  placeholder=".minha-classe { ... }"
                  value={String(configSettings.customCss ?? "")}
                  onChange={(e) => setConfigSettings((p) => ({ ...p, customCss: e.target.value }))}
                  className={cn(
                    "font-mono text-xs min-h-[3.5rem]",
                    isEditor ? "bg-editor-bg border-editor-border text-editor-fg" : "",
                  )}
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
