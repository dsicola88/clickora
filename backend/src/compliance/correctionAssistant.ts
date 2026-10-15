import type { RuleResult } from "./types";

export type CorrectionSuggestion = {
  ruleId: string;
  title: string;
  requiresUserInput: string[];
  suggestedContentPatches: Array<{
    path: string;
    before: string | null;
    after: string | null;
    note: string;
  }>;
  warnings: string[];
  applyAutomatically: false;
};

/**
 * Sugere correções sem inventar factos, testemunhos, credenciais ou texto legal.
 * Nunca aplica automaticamente — o cliente deve confirmar e fornecer dados em falta.
 */
export function suggestCorrections(args: {
  results: RuleResult[];
  current: {
    salesText?: string;
    affiliateDisclosure?: string;
    businessName?: string | null;
    contactEmail?: string | null;
    privacyPolicyUrl?: string | null;
  };
}): CorrectionSuggestion[] {
  const failing = args.results.filter((r) => r.status === "FAIL" || r.status === "WARNING");
  const out: CorrectionSuggestion[] = [];

  for (const r of failing) {
    if (r.ruleId === "CT-001") {
      out.push({
        ruleId: r.ruleId,
        title: "Adicionar divulgação de afiliado",
        requiresUserInput: [],
        suggestedContentPatches: [
          {
            path: "content.affiliateDisclosure",
            before: args.current.affiliateDisclosure || null,
            after:
              "Divulgação: esta página pode conter links de afiliado. Se comprar através deles, posso receber uma comissão — sem custo extra para si.",
            note: "Texto neutro de divulgação; ajuste ao idioma e jurisdição.",
          },
        ],
        warnings: ["Não invente a marca do anunciante nem oculte a relação comercial."],
        applyAutomatically: false,
      });
      continue;
    }

    if (r.ruleId === "CT-002") {
      out.push({
        ruleId: r.ruleId,
        title: "Identidade comercial em falta",
        requiresUserInput: ["businessName", "contactEmail"],
        suggestedContentPatches: [],
        warnings: ["Não fabricamos nomes, moradas, NIF/CNPJ nem licenças."],
        applyAutomatically: false,
      });
      continue;
    }

    if (r.ruleId === "PRIV-001") {
      out.push({
        ruleId: r.ruleId,
        title: "Política de privacidade",
        requiresUserInput: ["privacyPolicyUrl"],
        suggestedContentPatches: [],
        warnings: ["Não geramos política de privacidade fictícia. Forneça um URL real."],
        applyAutomatically: false,
      });
      continue;
    }

    if (r.ruleId === "OC-001" || r.ruleId === "OC-002") {
      out.push({
        ruleId: r.ruleId,
        title: "Conteúdo original insuficiente",
        requiresUserInput: [
          "productFactsYouCanVerify",
          "whoThisIsFor",
          "keyLimitationsOrRisks",
          "howYouEvaluatedTheOffer",
        ],
        suggestedContentPatches: [],
        warnings: [
          "Não vamos gerar parágrafos genéricos só para passar a auditoria.",
          "Não copie o texto do vendedor como substituto de conteúdo original.",
          "Forneça factos que possa verificar; a IA só ajuda a estruturar o que você confirmar.",
        ],
        applyAutomatically: false,
      });
      continue;
    }

    if (r.ruleId.startsWith("CL-")) {
      out.push({
        ruleId: r.ruleId,
        title: "Alegações de risco",
        requiresUserInput: ["claimToKeepWithSource", "claimsToRemove"],
        suggestedContentPatches: [
          {
            path: "content.salesText",
            before: args.current.salesText || null,
            after: null,
            note: "Remova claims absolutos/saúde sem fonte. Não reescrevemos automaticamente para ‘parecer seguro’.",
          },
        ],
        warnings: ["A deteção automática não é decisão legal."],
        applyAutomatically: false,
      });
      continue;
    }

    out.push({
      ruleId: r.ruleId,
      title: r.name,
      requiresUserInput: [],
      suggestedContentPatches: [],
      warnings: [r.remediation, "Sugestão não aplica alterações automaticamente."],
      applyAutomatically: false,
    });
  }

  return out;
}
