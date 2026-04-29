/**
 * Narrativas de produto: «porque fiz isto?» — motor automático e fila de aprovações.
 */

import type { OptimizerDecisionRow } from "@/services/paidAdsService";
import {
  campaignPlatformLabel,
  optimizerDecisionTypeLabel,
  optimizerRuleCodeLabel,
} from "@/lib/paidAdsUi";

export type OptimizerExplanation = {
  /** Linha curta para listagens */
  title: string;
  /** Texto principal — deve responder «porque». */
  why: string;
  /** Sinais numéricos ou de contexto (opcional). */
  signals: string[];
  /** Orientação prática — «o que fazer a seguir» (produto). */
  nextSuggestedAction: string | null;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Interpreta uma linha de auditoria do optimizer (`input_snapshot` inclui `reason` do backend). */
export function explainOptimizerDecision(row: OptimizerDecisionRow): OptimizerExplanation {
  const snap = row.input_snapshot && typeof row.input_snapshot === "object" ? row.input_snapshot : {};
  const rawReason = str((snap as Record<string, unknown>).reason);
  const spendPlat = num((snap as Record<string, unknown>).spend_usd_platform);
  const spendSnap = num((snap as Record<string, unknown>).spendUsd);
  const lookback = num((snap as Record<string, unknown>).lookback_hours);

  const signals: string[] = [];
  const spend = spendPlat ?? spendSnap;
  if (spend != null) signals.push(`Gasto na rede (referência): ~${formatUsdCompact(spend)}`);
  if (lookback != null) signals.push(`Janela analisada: ${Math.round(lookback)} h`);

  const decHuman = optimizerDecisionTypeLabel(row.decision_type);

  const why =
    rawReason ||
    fallbackOptimizerWhy(row.rule_code, row.decision_type, snap as Record<string, unknown>);

  const title = `${decHuman} · ${campaignPlatformLabel(row.platform)}`;

  const nextSuggestedAction = suggestedNextAction({
    ruleCode: row.rule_code,
    decisionType: row.decision_type,
    snap: snap as Record<string, unknown>,
    executionOk: row.execution_ok,
    dryRun: row.dry_run,
    executed: row.executed,
  });

  return { title, why, signals, nextSuggestedAction };
}

function formatUsdCompact(n: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

type NextActionArgs = {
  ruleCode: string;
  decisionType: string;
  snap: Record<string, unknown>;
  executionOk: boolean | null;
  dryRun: boolean;
  executed: boolean;
};

/** «Próxima acção sugerida» — orientação de produto; não substitui o Ads Manager. */
export function suggestedNextAction(args: NextActionArgs): string | null {
  const { ruleCode, decisionType, snap, executionOk, dryRun, executed } = args;

  if (dryRun) {
    return "Simulação (dry-run): validar critérios no servidor antes de permitir aplicação real na rede.";
  }

  if (executed && executionOk === false) {
    return "Execução falhou — rever «Detalhe técnico», ligação OAuth e requisitos mínimos da rede antes de repetir.";
  }

  const scaleFrac = num(snap.scaleFraction);

  switch (ruleCode) {
    case "pause_zero_conv_min_spend":
      return "Próximo passo: confirmar tracking de conversões e qualidade da landing; só depois reactivar ou aumentar investimento.";
    case "ctr_below_threshold":
      return "Próximo passo: testar novo criativo ou variante de copy; manter orçamento até haver dados estáveis.";
    case "scale_budget_high_roas": {
      const pct =
        scaleFrac != null && scaleFrac > 0 && scaleFrac <= 1
          ? Math.round(scaleFrac * 100)
          : 20;
      return `Próximo passo: observar ROAS nas próximas 48–72 h; se se mantiver forte, escalar orçamento gradualmente (~${pct}% por ciclo, dentro dos guardrails).`;
    }
    default:
      break;
  }

  switch (decisionType) {
    case "pause_campaign":
      return "Próximo passo: auditar oferta, público e eventos de conversão antes de voltar a activar.";
    case "scale_budget":
      return "Próximo passo: monitorizar gasto vs. receita diários; evitar picos bruscos enquanto o algoritmo adapta.";
    case "flag_creative_swap":
      return "Próximo passo: substituir ou A/B testar criativo e comparar CTR ao longo de uma semana.";
    default:
      return "Próximo passo: rever relatórios na rede alinhados ao objectivo da campanha.";
  }
}

function fallbackOptimizerWhy(
  ruleCode: string,
  decisionType: string,
  snap: Record<string, unknown>,
): string {
  const ctr = num(snap.ctr);
  const roas = num(snap.roas);
  switch (ruleCode) {
    case "pause_zero_conv_min_spend":
      return "Critérios de segurança: gasto mínimo atingido sem conversões atribuídas no tracking — por isso a regra sugere pausa.";
    case "ctr_below_threshold":
      return ctr != null
        ? `CTR ${(ctr * 100).toFixed(2)}% abaixo do limiar com tráfego suficiente — recomendação de rever criativo.`
        : "CTR abaixo do limiar configurado — vale testar novo criativo ou oferta.";
    case "scale_budget_high_roas":
      return roas != null
        ? `ROAS ${roas.toFixed(2)} acima do limiar — o motor propõe escalar orçamento com moderação.`
        : "Performance de receita vs. gasto acima do limiar — escala opcional de orçamento.";
    default:
      break;
  }
  switch (decisionType) {
    case "pause_campaign":
      return "Regra de controlo de risco no motor automático.";
    case "scale_budget":
      return "Oportunidade de escala com base em retorno vs. gasto.";
    case "flag_creative_swap":
      return "Sinal fraco de CTR ou engagement — rever criativo pode ajudar.";
    default:
      return optimizerRuleCodeLabel(ruleCode);
  }
}

/** Bullets para o cartão «Transparência» na fila de aprovações. */
export function approvalQueueTransparencyBullets(args: {
  paidMode: string;
  hasHardGuardrailBlocks: boolean;
}): string[] {
  const mode = args.paidMode === "autopilot" ? "Autopilot" : "Copilot";
  const out: string[] = [
    `Modo do projecto: ${mode}. Define se alterações podem ir directamente à rede ou passam por esta fila.`,
  ];
  if (args.paidMode === "copilot") {
    out.push(
      "Confirmação humana: até «Aplicar na rede», o Google/Meta/TikTok não recebem alterações deste pedido.",
    );
  } else {
    out.push(
      "Autopilot: dentro dos guardrails o sistema pode aplicar automaticamente; quando há bloqueio ou excepção, o pedido aparece aqui.",
    );
  }
  if (args.hasHardGuardrailBlocks) {
    out.push(
      "Motivos «limites»: violações que impedem publicação até corrigir orçamento, palavras-chave ou segmentação.",
    );
  } else {
    out.push(
      "Sem bloqueios rígidos de guardrail neste pedido — pode rever parâmetros e aplicar quando estiver alinhado com a sua estratégia.",
    );
  }
  return out;
}

export const TRANSPARENCY_TAGLINE =
  "Não substituímos as redes — tornamos a mediação automática, controlada e compreensível.";
