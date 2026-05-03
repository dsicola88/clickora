import { useEffect, useState } from "react";
import { Globe, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GoogleAdsCountriesSelect } from "@/components/dpilot/GoogleAdsTargetingSelect";
import { GOOGLE_ADS_COUNTRY_OPTIONS } from "@/lib/googleAdsTargeting";
import { formatUsdFromMicros } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";

type Gr = {
  max_daily_budget_micros: number;
  max_monthly_spend_micros: number;
  max_cpc_micros: number | null;
  allowed_countries: string[];
  blocked_keywords: string[];
  require_approval_above_micros: number | null;
};

function microsToUsdInput(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(Number(m))) return "";
  const usd = Number(m) / 1_000_000;
  return Number.isFinite(usd) ? String(usd) : "";
}

/** Países permitidos, palavras bloqueadas e limites complementares (mensal, CPC, aprovação). Apenas admins do workspace. */
export function DpilotGuardrailsScopeCard() {
  const { projectId, overview, reload } = useDpilotPaid();
  const gr = overview?.guardrails as Gr | undefined;

  const [countries, setCountries] = useState<string[]>([]);
  const [blockedText, setBlockedText] = useState("");
  const [monthlyUsd, setMonthlyUsd] = useState("");
  const [maxCpcUsd, setMaxCpcUsd] = useState("");
  const [approvalUsd, setApprovalUsd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!gr) return;
    setCountries(
      Array.isArray(gr.allowed_countries)
        ? gr.allowed_countries.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
        : [],
    );
    setBlockedText(Array.isArray(gr.blocked_keywords) ? gr.blocked_keywords.join("\n") : "");
    setMonthlyUsd(microsToUsdInput(gr.max_monthly_spend_micros));
    setMaxCpcUsd(microsToUsdInput(gr.max_cpc_micros ?? null));
    setApprovalUsd(microsToUsdInput(gr.require_approval_above_micros ?? null));
  }, [gr]);

  const onSave = async () => {
    if (!gr) {
      toast.error("Guardrails ainda não carregados.");
      return;
    }
    const monthly = parseFloat(monthlyUsd.replace(",", ".").trim());
    if (!Number.isFinite(monthly) || monthly <= 0) {
      toast.error("Gasto mensal máximo: indique um valor USD positivo.");
      return;
    }

    let maxCpcMicros: number | null = null;
    if (maxCpcUsd.trim() !== "") {
      const x = parseFloat(maxCpcUsd.replace(",", "."));
      if (!Number.isFinite(x) || x <= 0) {
        toast.error("CPC máximo: número USD positivo ou deixe vazio.");
        return;
      }
      maxCpcMicros = Math.round(x * 1_000_000);
    }

    let requireApprovalAboveMicros: number | null = null;
    if (approvalUsd.trim() !== "") {
      const x = parseFloat(approvalUsd.replace(",", "."));
      if (!Number.isFinite(x) || x < 0) {
        toast.error("Limiar de aprovação: número USD ≥ 0 ou deixe vazio.");
        return;
      }
      requireApprovalAboveMicros = Math.round(x * 1_000_000);
    }

    const blockedArr = blockedText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);

    const allowedNorm = countries.map((c) => c.trim().toUpperCase()).filter(Boolean).slice(0, 50);

    setSaving(true);
    try {
      const { error } = await paidAdsService.upsertGuardrails({
        projectId,
        max_daily_budget_micros: gr.max_daily_budget_micros,
        max_monthly_spend_micros: Math.round(monthly * 1_000_000),
        max_cpc_micros: maxCpcMicros,
        allowed_countries: allowedNorm,
        blocked_keywords: blockedArr,
        require_approval_above_micros: requireApprovalAboveMicros,
      });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Escopo e políticas guardados.", {
        description:
          allowedNorm.length === 0
            ? "Sem lista de países nos guardrails — qualquer mercado ISO permitido nas campanhas (Google, Meta, TikTok)."
            : "Novos planos só aceitam segmentações nestes países; palavras-chave bloqueadas aplicam-se sobretudo ao Search.",
      });
      reload();
    } finally {
      setSaving(false);
    }
  };

  const dailyPreview =
    gr?.max_daily_budget_micros != null && Number.isFinite(Number(gr.max_daily_budget_micros))
      ? Number(gr.max_daily_budget_micros)
      : null;

  return (
    <Card id="dpilot-guardrails-scope" className="border-violet-500/15 bg-violet-500/[0.03]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          Escopo: país, bloqueios e limites extras
        </CardTitle>
        <CardDescription>
          Lista de país vazio = sem bloqueio geográfico específico neste projeto (dentro das regras de cada rede e do{" "}
          <strong>teto diário</strong>). Keywords bloqueadas aplicam‑se sobretudo ao Search.
        </CardDescription>
        {dailyPreview != null ? (
          <p className="text-xs text-muted-foreground pt-1">
            Teto diário (referência):{" "}
            <strong className="tabular-nums text-foreground">{formatUsdFromMicros(dailyPreview)}</strong> / dia.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <GoogleAdsCountriesSelect
          label="Restringir a países (opcional)"
          hint="Lista vazia = sem limite geográfico nos guardrails — todas as segmentações ISO válidas nas redes."
          searchPlaceholder="Pesquisar país…"
          emptyText="Nenhum país encontrado."
          options={GOOGLE_ADS_COUNTRY_OPTIONS}
          value={countries}
          onChange={setCountries}
          max={50}
        />

        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] text-muted-foreground w-full">Atalhos:</span>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCountries([])}>
            Todos os países (sem lista)
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCountries(["BR", "PT"])}>
            BR + PT
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCountries(["US"])}>
            Só US
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setCountries(["BR", "PT", "US", "GB", "DE", "FR", "ES"])}
          >
            BR · PT · US · UK · DE · FR · ES
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="gr-blocked">Palavras ou termos bloqueados (opcional)</Label>
            <Textarea
              id="gr-blocked"
              value={blockedText}
              onChange={(e) => setBlockedText(e.target.value)}
              rows={4}
              placeholder={"Um por linha — aplicável sobretudo a palavras-chave Search.\nex.: marca concorrente"}
              className="font-mono text-xs sm:text-sm"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O sistema rejeita planos que incluam estas palavras nas keywords geradas.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gr-monthly">Gasto mensal máximo — todas as campanhas (USD)</Label>
            <Input
              id="gr-monthly"
              inputMode="decimal"
              autoComplete="off"
              value={monthlyUsd}
              onChange={(e) => setMonthlyUsd(e.target.value)}
              placeholder="Ex.: 1500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gr-approval">Orçamento diário acima do qual exige aprovação (USD, opcional)</Label>
            <Input
              id="gr-approval"
              inputMode="decimal"
              autoComplete="off"
              value={approvalUsd}
              onChange={(e) => setApprovalUsd(e.target.value)}
              placeholder="Vazio = só limites rígidos"
            />
            <p className="text-[11px] text-muted-foreground">
              Acima deste valor diário, o pedido pode entrar na fila mesmo em Autopilot.
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="gr-cpc">CPC máximo por clique — Search (USD, opcional)</Label>
            <Input
              id="gr-cpc"
              inputMode="decimal"
              autoComplete="off"
              value={maxCpcUsd}
              onChange={(e) => setMaxCpcUsd(e.target.value)}
              placeholder="Ex.: 4.50 — vazio = sem teto por CPC"
            />
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          <Globe className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
          <p className="leading-relaxed">
            Se definir uma lista fechada aqui, só esses códigos ISO passam na validação. Com lista vazia, o sistema não
            bloqueia países nos guardrails — continua a aplicar orçamentos, palavras bloqueadas e demais limites.
          </p>
        </div>

        <Button type="button" size="sm" onClick={() => void onSave()} disabled={saving || !gr}>
          {saving ? "A guardar…" : "Guardar escopo e políticas"}
        </Button>
      </CardContent>
    </Card>
  );
}
