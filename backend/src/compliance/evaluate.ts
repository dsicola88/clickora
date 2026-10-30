import { isThinBridgePage } from "./extractPresellSignals";
import { RULES_VERSION, getPolicySource, isPolicyPackStale } from "./policySources";
import type {
  AdsPlatform,
  ComplianceEvaluation,
  ComplianceGate,
  EvaluateComplianceInput,
  PlatformComplianceSummary,
  RuleDefinition,
  RuleResult,
  RuleResultStatus,
} from "./types";
import { COMPLIANCE_DISCLAIMER } from "./types";

function def(
  partial: RuleDefinition & {
    run: (input: EvaluateComplianceInput) => Pick<RuleResult, "status" | "confidence" | "evidence" | "remediation">;
  },
): typeof partial {
  return partial;
}

const RULES = [
  def({
    id: "OC-001",
    name: "Página ponte (imagem + nome + botão)",
    description:
      "Deteta presells cujo conteúdo essencial é apenas imagem, nome do produto e CTA para domínio externo — sinal de conteúdo original insuficiente.",
    platforms: ["google", "microsoft"],
    category: "original_content",
    severity: "critical",
    sourceIds: ["gads-insufficient-original-content", "msads-pilot-policy-cn"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (isThinBridgePage(signals)) {
        return {
          status: "FAIL",
          confidence: 0.9,
          evidence: {
            summary: "Página com sinal forte de bridge: pouco texto próprio e CTA externo.",
            details: [
              `palavras≈${signals.wordCount}`,
              `imagens=${signals.imageCount}`,
              `cta_externo=${signals.hasExternalCta}`,
              `espelho_chars=${signals.mirrorHtmlLength}`,
            ],
            excerpt: signals.salesText.slice(0, 160) || signals.productName,
          },
          remediation:
            "Adicione conteúdo original útil (explicação do produto, critérios de decisão, transparência). Não use texto genérico só para passar a auditoria.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.75,
        evidence: { summary: "Conteúdo acima do limiar de página ponte." },
        remediation: "Mantenha valor editorial próprio além do CTA.",
      };
    },
  }),
  def({
    id: "OC-002",
    name: "Conteúdo original substantivo",
    description: "Verifica se há texto próprio suficiente para ajudar a decisão do utilizador.",
    platforms: ["google", "microsoft"],
    category: "original_content",
    severity: "high",
    sourceIds: ["gads-insufficient-original-content", "msads-pilot-policy-cn"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (signals.wordCount >= 150 && signals.uniqueSentenceCount >= 4) {
        return {
          status: "PASS",
          confidence: 0.7,
          evidence: {
            summary: "Texto com volume e variedade de frases suficientes para revisão interna.",
            details: [`palavras=${signals.wordCount}`, `frases_únicas=${signals.uniqueSentenceCount}`],
          },
          remediation: "Continue a melhorar clareza e evidências verificáveis.",
        };
      }
      if (signals.wordCount >= 80) {
        return {
          status: "WARNING",
          confidence: 0.65,
          evidence: {
            summary: "Conteúdo marginal — pode ser insuficiente para as plataformas.",
            details: [`palavras=${signals.wordCount}`],
          },
          remediation: "Expanda com informação original e específica do produto (sem inventar factos).",
        };
      }
      return {
        status: "FAIL",
        confidence: 0.85,
        evidence: { summary: "Conteúdo textual insuficiente." },
        remediation: "Escreva conteúdo original substantivo antes de publicar para anúncios.",
      };
    },
  }),
  def({
    id: "OC-003",
    name: "Espelho do vendedor sem valor acrescentado",
    description: "Espelho HTML longo com pouco texto próprio pode indicar cópia sem valor.",
    platforms: ["google", "microsoft"],
    category: "original_content",
    severity: "medium",
    sourceIds: ["gads-insufficient-original-content"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      const mirrorHeavy = signals.mirrorHtmlLength >= 4000;
      const ownThin = signals.salesText.trim().length < 200;
      if (mirrorHeavy && ownThin) {
        // WARNING medium: o wizard usa captura estática; OC-001 continua a bloquear páginas ponte.
        return {
          status: "WARNING",
          confidence: 0.8,
          evidence: {
            summary: "Espelho extenso com pouco texto próprio — risco de conteúdo replicado sem valor.",
            details: [`mirror=${signals.mirrorHtmlLength}`, `sales_text=${signals.salesText.length}`],
          },
          remediation:
            "Acrescente análise/comparação própria e divulgação clara. Não trate o espelho como substituto de conteúdo original.",
        };
      }
      if (mirrorHeavy) {
        return {
          status: "WARNING",
          confidence: 0.55,
          evidence: { summary: "Há espelho HTML; confirme que existe valor próprio visível." },
          remediation: "Garanta que o visitante vê informação original além do HTML importado.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.6,
        evidence: { summary: "Sem padrão forte de espelho sem valor." },
        remediation: "Evite publicar clones sem contributo editorial.",
      };
    },
  }),
  def({
    id: "OC-004",
    name: "Texto genérico / placeholder",
    description: "Deteta placeholders e frases de enchimento típicas.",
    platforms: ["google", "microsoft"],
    category: "original_content",
    severity: "medium",
    sourceIds: ["gads-insufficient-original-content"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      const generic =
        /\b(lorem ipsum|click to edit|your (title|text) here|coming soon|under construction|texto de exemplo|descrição genérica|descricao generica)\b/i;
      if (generic.test(signals.claimsText) || generic.test(signals.title)) {
        return {
          status: "FAIL",
          confidence: 0.9,
          evidence: { summary: "Detetado placeholder ou texto genérico." },
          remediation: "Substitua por conteúdo real e específico do produto.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.7,
        evidence: { summary: "Sem placeholders óbvios." },
        remediation: "Evite templates pré-gerados duplicados.",
      };
    },
  }),
  def({
    id: "CT-001",
    name: "Divulgação de afiliado",
    description: "Quando existe link de oferta externo, a relação de afiliado deve estar visível.",
    platforms: ["google", "microsoft"],
    category: "commercial_transparency",
    severity: "high",
    sourceIds: ["gads-misrepresentation", "msads-agreement"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (!signals.affiliateLink) {
        return {
          status: "WARNING",
          confidence: 0.5,
          evidence: { summary: "Sem link de afiliado/oferta detetado." },
          remediation: "Se for afiliado, configure o link e a divulgação.",
        };
      }
      if (signals.hasAffiliateDisclosure) {
        return {
          status: "PASS",
          confidence: 0.75,
          evidence: { summary: "Divulgação de afiliado/relação comercial encontrada." },
          remediation: "Mantenha a divulgação visível sem a esconder.",
        };
      }
      return {
        status: "FAIL",
        confidence: 0.9,
        evidence: { summary: "Link de oferta presente sem divulgação de afiliado visível." },
        remediation:
          "Adicione divulgação clara e verdadeira de afiliado/comissão. Não invente dados — a analista do Google exige transparência.",
      };
    },
  }),
  def({
    id: "CT-002",
    name: "Identidade comercial",
    description: "Quem opera a página deve ser identificável (nome e contacto reais).",
    platforms: ["google", "microsoft"],
    category: "commercial_transparency",
    severity: "high",
    sourceIds: ["gads-misrepresentation"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (signals.generationNiche === "black" && (signals.sourceUrl || signals.productName)) {
        return {
          status: "PASS",
          confidence: 0.8,
          evidence: {
            summary: "Nicho black: identidade e contacto vêm da página original do produto.",
            details: [
              signals.sourceUrl ? `source=${signals.sourceUrl}` : "source=missing",
              signals.contactEmail ? "contact=from-source" : "contact=read-from-origin-when-present",
            ],
          },
          remediation: "Não preencha contacto à mão no black. Reimporte se a origem mudar.",
        };
      }
      const hasName = Boolean(signals.businessName?.trim());
      const hasContact = Boolean(signals.contactEmail?.trim());
      if (hasName && hasContact) {
        return {
          status: "PASS",
          confidence: 0.85,
          evidence: {
            summary: "Identidade comercial preenchida (nome + contacto).",
            details: [`business=${signals.businessName}`, "contact=present"],
          },
          remediation: "Mantenha nome e contacto actualizados e verdadeiros.",
        };
      }
      if (signals.hasBusinessIdentity && (hasName || hasContact)) {
        return {
          status: "WARNING",
          confidence: 0.7,
          evidence: {
            summary: "Identidade parcial — complete nome legal e e-mail de contacto.",
            details: [
              hasName ? `business=${signals.businessName}` : "business=missing",
              hasContact ? "contact=present" : "contact=missing",
            ],
          },
          remediation: "Preencha nome do operador e e-mail real. Não use placeholders.",
        };
      }
      return {
        status: "FAIL",
        confidence: 0.9,
        evidence: { summary: "Identidade empresarial/contacto ausentes ou fictícios." },
        remediation:
          "Preencha o responsável real pela página e um e-mail funcional nas definições. Nunca invente CNPJ, marca ou contacto.",
      };
    },
  }),
  def({
    id: "CT-003",
    name: "Alegações de autoridade falsa",
    description: "Deteta linguagem que sugere fabricante oficial, médico autorizado, etc.",
    platforms: ["google", "microsoft"],
    category: "commercial_transparency",
    severity: "critical",
    sourceIds: ["gads-misrepresentation"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      const re =
        /\b(fabricante\s+oficial|official\s+manufacturer|somos\s+o\s+fabricante|site\s+oficial\s+do\s+fabricante|médico\s+autorizado|medico\s+autorizado|FDA\s+approved\s+cure|aprovado\s+pela\s+OMS|cura\s+garantida|milagroso)\b/i;
      const falseAuthority = signals.claimsText.split(/[.!?\n]+/).some((sentence) => {
        const match = sentence.match(re);
        if (!match || match.index == null) return false;
        const before = sentence.slice(0, match.index);
        return !/\b(não|nao|not|never)\b/i.test(before);
      });
      if (falseAuthority) {
        return {
          status: "FAIL",
          confidence: 0.85,
          evidence: { summary: "Possível alegação de autoridade/identidade enganosa." },
          remediation:
            "Remova alegações não verificáveis e não se apresente como o fabricante. Use linguagem de afiliado transparente.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.6,
        evidence: { summary: "Sem padrões óbvios de autoridade falsa." },
        remediation: "Não se apresente como marca/fabricante sem autorização.",
      };
    },
  }),
  def({
    id: "CL-001",
    name: "Alegação de cura / tratamento de doença",
    description: "Claims de saúde de alto risco (cura/tratamento garantido).",
    platforms: ["google", "microsoft"],
    category: "claims",
    severity: "critical",
    sourceIds: ["gads-misrepresentation", "gads-policies-overview"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (signals.healthCureClaim) {
        return {
          status: "FAIL",
          confidence: 0.85,
          evidence: { summary: "Detetada alegação de cura/tratamento de alto risco." },
          remediation:
            "Remova claims terapêuticos não autorizados. A deteção automática não é aconselhamento legal; peça revisão humana.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.55,
        evidence: { summary: "Sem padrão de cura garantida detetado." },
        remediation: "Evite linguagem médica sem base e certificação.",
      };
    },
  }),
  def({
    id: "CL-002",
    name: "Resultados garantidos / extraordinários",
    description: "Promessas absolutas de resultado.",
    platforms: ["google", "microsoft"],
    category: "claims",
    severity: "critical",
    sourceIds: ["gads-misrepresentation"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (signals.guaranteedResultClaim) {
        return {
          status: "FAIL",
          confidence: 0.8,
          evidence: { summary: "Detetada promessa de resultado garantido/extraordinário." },
          remediation: "Substitua por linguagem factual verificável. Não invente garantias.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.55,
        evidence: { summary: "Sem padrão de garantia absoluta detetado." },
        remediation: "Evite absolutismos e prazos milagrosos.",
      };
    },
  }),
  def({
    id: "CL-003",
    name: "Testemunhos / estudos sem fonte",
    description: "Referências a estudos ou depoimentos sem URL/fonte.",
    platforms: ["google", "microsoft"],
    category: "claims",
    severity: "high",
    sourceIds: ["gads-misrepresentation"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (signals.unsourcedTestimonialOrStudy) {
        return {
          status: "WARNING",
          confidence: 0.65,
          evidence: { summary: "Possível estudo/testemunho sem fonte explícita." },
          remediation: "Peça fontes ao utilizador; não fabrique estudos nem depoimentos.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.5,
        evidence: { summary: "Sem padrão óbvio de estudo/testemunho sem fonte." },
        remediation: "Cite fontes quando mencionar evidências.",
      };
    },
  }),
  def({
    id: "CL-004",
    name: "Preço / promoção sem verificação",
    description: "Preços inventados ou promoções sem origem verificada.",
    platforms: ["google", "microsoft"],
    category: "claims",
    severity: "high",
    sourceIds: ["gads-misrepresentation"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (signals.inventedPriceSignal) {
        return {
          status: "FAIL",
          confidence: 0.75,
          evidence: {
            summary: "Padrão de preço promocional sem verificação da origem.",
            details: signals.priceMention ? [`price=${signals.priceMention}`] : undefined,
          },
          remediation: "Use apenas preços confirmados na origem ou remova a promoção.",
        };
      }
      if (signals.priceMention && signals.priceVerifiedFromSource === null) {
        return {
          status: "WARNING",
          confidence: 0.5,
          evidence: { summary: "Há menção de preço sem flag de verificação." },
          remediation: "Confirme o preço na página do vendedor antes de publicar.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.5,
        evidence: { summary: "Sem sinal claro de preço inventado." },
        remediation: "Mantenha preços sincronizados com a oferta real.",
      };
    },
  }),
  def({
    id: "DT-001",
    name: "HTTPS no destino",
    description: "O destino da oferta deve usar HTTPS.",
    platforms: ["google", "microsoft"],
    category: "destination",
    severity: "high",
    sourceIds: ["gads-destination-requirements", "msads-pilot-policy-cn"],
    sourceReviewedAt: "2026-10-15",
    run: ({ destination, signals }) => {
      if (!signals.affiliateLink && !destination?.attempted) {
        return {
          status: "NOT_CHECKED",
          confidence: 0,
          evidence: { summary: "Sem URL de destino para verificar HTTPS." },
          remediation: "Configure o link da oferta.",
        };
      }
      if (!destination?.attempted) {
        return {
          status: "NOT_CHECKED",
          confidence: 0,
          evidence: { summary: "Probe de destino não executado." },
          remediation: "Execute a auditoria completa com verificação de destino.",
        };
      }
      if (destination.https === true) {
        return {
          status: "PASS",
          confidence: 0.95,
          evidence: { summary: "Destino em HTTPS.", details: destination.finalUrl ? [destination.finalUrl] : undefined },
          remediation: "Mantenha certificado válido.",
        };
      }
      return {
        status: "FAIL",
        confidence: 0.95,
        evidence: { summary: "Destino sem HTTPS válido." },
        remediation: "Use apenas URLs https:// para a oferta.",
      };
    },
  }),
  def({
    id: "DT-002",
    name: "Destino HTTP funcional",
    description: "O destino deve responder sem erro fatal.",
    platforms: ["google", "microsoft"],
    category: "destination",
    severity: "high",
    sourceIds: ["gads-destination-requirements"],
    sourceReviewedAt: "2026-10-15",
    run: ({ destination }) => {
      if (!destination?.attempted) {
        return {
          status: "NOT_CHECKED",
          confidence: 0,
          evidence: { summary: "Probe não executado." },
          remediation: "Reexecute a auditoria com probe de destino.",
        };
      }
      if (destination.errorCode === "ssrf_blocked") {
        return {
          status: "FAIL",
          confidence: 1,
          evidence: { summary: "URL bloqueada por proteção SSRF (localhost/privado/metadata)." },
          remediation: "Use apenas URLs públicas da oferta.",
        };
      }
      if (destination.ok && destination.statusCode && destination.statusCode < 400) {
        return {
          status: "PASS",
          confidence: 0.85,
          evidence: { summary: `Resposta HTTP ${destination.statusCode}.` },
          remediation: "Monitore disponibilidade do destino.",
        };
      }
      // Timeout/rede/bot-wall: WARNING (não bloqueia o wizard). 404/ciclo/SSRF continuam FAIL.
      if (destination.errorCode === "timeout" || destination.errorCode === "network") {
        return {
          status: "WARNING",
          confidence: 0.6,
          evidence: {
            summary: "Não foi possível verificar o destino agora (rede/timeout).",
            details: [destination.errorCode],
          },
          remediation: "Confirme o URL da oferta manualmente e volte a auditar.",
        };
      }
      // Redes de afiliados costumam bloquear o nosso UA (403/401). Isso não prova URL morto.
      if (destination.crawlerBlocked) {
        return {
          status: "WARNING",
          confidence: 0.55,
          evidence: {
            summary: "Destino respondeu, mas bloqueou o bot de auditoria (possível WAF).",
            details: destination.statusCode != null ? [`status=${destination.statusCode}`] : undefined,
          },
          remediation: "Confirme o link no browser; AdsBot/Bingbot são distintos deste probe.",
        };
      }
      if (destination.statusCode != null && destination.statusCode >= 400) {
        return {
          status: "FAIL",
          confidence: 0.85,
          evidence: {
            summary: "Destino inacessível ou com erro.",
            details: [`status=${destination.statusCode}`],
          },
          remediation: "Corrija o URL ou a disponibilidade do destino antes de anunciar.",
        };
      }
      return {
        status: "WARNING",
        confidence: 0.55,
        evidence: {
          summary: "Destino sem resposta HTTP clara.",
          details: [destination.errorCode || "unknown"],
        },
        remediation: "Reexecute a auditoria com o link público da oferta.",
      };
    },
  }),
  def({
    id: "DT-003",
    name: "Ciclo de redirecionamento",
    description: "Deteta loops de redirect.",
    platforms: ["google", "microsoft"],
    category: "destination",
    severity: "critical",
    sourceIds: ["gads-destination-requirements"],
    sourceReviewedAt: "2026-10-15",
    run: ({ destination }) => {
      if (!destination?.attempted) {
        return {
          status: "NOT_CHECKED",
          confidence: 0,
          evidence: { summary: "Probe não executado." },
          remediation: "Reexecute a auditoria.",
        };
      }
      if (destination.redirectCycle) {
        return {
          status: "FAIL",
          confidence: 0.95,
          evidence: { summary: "Ciclo de redirecionamento detetado.", details: destination.hops.slice(0, 8) },
          remediation: "Elimine o loop de redirects no destino/tracking.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.8,
        evidence: { summary: `Redirects=${destination.redirectCount} sem ciclo.` },
        remediation: "Evite cadeias longas de redirect.",
      };
    },
  }),
  def({
    id: "DT-004",
    name: "Open redirect",
    description: "Deteta parâmetros de redirect arbitrários.",
    platforms: ["google", "microsoft"],
    category: "destination",
    severity: "critical",
    sourceIds: ["gads-destination-requirements", "gads-policies-overview"],
    sourceReviewedAt: "2026-10-15",
    run: ({ destination, signals }) => {
      const url = signals.affiliateLink || "";
      const openParam = /[?&](redirect|url|next|return|dest|destination|continue)=https?:\/\//i.test(url);
      if (destination?.openRedirectSuspect || openParam) {
        return {
          status: "FAIL",
          confidence: 0.8,
          evidence: { summary: "Suspeita de open redirect no URL da oferta." },
          remediation: "Remova parâmetros que aceitam destinos arbitrários.",
        };
      }
      if (!destination?.attempted && !url) {
        return {
          status: "NOT_CHECKED",
          confidence: 0,
          evidence: { summary: "Sem URL para analisar." },
          remediation: "Configure o destino.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.6,
        evidence: { summary: "Sem padrão óbvio de open redirect." },
        remediation: "Não encaminhe para URLs fornecidas pelo visitante.",
      };
    },
  }),
  def({
    id: "DT-005",
    name: "Mudança inesperada de domínio",
    description: "Redirect final para domínio diferente do anunciado/configurado.",
    platforms: ["google", "microsoft"],
    category: "destination",
    severity: "high",
    sourceIds: ["gads-destination-requirements"],
    sourceReviewedAt: "2026-10-15",
    run: ({ destination }) => {
      if (!destination?.attempted) {
        return {
          status: "NOT_CHECKED",
          confidence: 0,
          evidence: { summary: "Probe não executado." },
          remediation: "Reexecute a auditoria.",
        };
      }
      if (destination.domainChanged) {
        return {
          status: "WARNING",
          confidence: 0.75,
          evidence: {
            summary: "O domínio final difere do inicial.",
            details: [
              `from=${destination.initialHost || "?"}`,
              `to=${destination.finalHost || "?"}`,
            ],
          },
          remediation: "Confirme que o hop é um tracking legítimo e que o destino anunciado corresponde.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.7,
        evidence: { summary: "Domínio final alinhado com o inicial (ou sem redirect cross-domain)." },
        remediation: "Documente hops de tracking conhecidos.",
      };
    },
  }),
  def({
    id: "DT-006",
    name: "Acesso do crawler",
    description: "Destino bloqueou ou falhou para o user-agent de auditoria.",
    platforms: ["google", "microsoft"],
    category: "destination",
    severity: "high",
    sourceIds: ["gads-destination-requirements"],
    sourceReviewedAt: "2026-10-15",
    run: ({ destination }) => {
      if (!destination?.attempted) {
        return {
          status: "NOT_CHECKED",
          confidence: 0,
          evidence: { summary: "Probe não executado." },
          remediation: "Reexecute a auditoria.",
        };
      }
      if (destination.crawlerBlocked) {
        // WARNING: o nosso bot ≠ AdsBot. WAF em redes de afiliado não deve forçar rascunho no wizard.
        return {
          status: "WARNING",
          confidence: 0.65,
          evidence: { summary: "Possível bloqueio ao crawler de auditoria (WAF)." },
          remediation: "Permita AdsBot / bingbot; confirme o URL no browser antes de anunciar.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.55,
        evidence: { summary: "Sem sinal de bloqueio ao crawler nesta probe." },
        remediation: "Permita AdsBot / bingbot conforme documentação oficial.",
      };
    },
  }),
  def({
    id: "DT-007",
    name: "Cloaking / conteúdo diferencial",
    description: "Sinaliza enterprise cloak ou configuração que serve conteúdo diferente a bots.",
    platforms: ["google", "microsoft"],
    category: "destination",
    severity: "critical",
    sourceIds: ["gads-policies-overview"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (signals.cloakingEnabled) {
        return {
          status: "FAIL",
          confidence: 0.9,
          evidence: {
            summary:
              "Cloaking empresarial ativo — risco de conteúdo diferente para crawler vs visitante. Não use para enganar revisores de ads.",
          },
          remediation:
            "Desative cloaking destinado a esconder a oferta a revisores. Geo-safety legítima não substitui revisão de política de ads.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.7,
        evidence: { summary: "Cloaking empresarial não ativo nos settings." },
        remediation: "Nunca sirva HTML diferente a AdsBot para mascarar a página real.",
      };
    },
  }),
  def({
    id: "PS-001",
    name: "Scripts maliciosos em HTML importado",
    description: "Deteta padrões perigosos no HTML espelhado.",
    platforms: ["google", "microsoft"],
    category: "privacy_security",
    severity: "critical",
    sourceIds: ["gads-policies-overview", "msads-report-concern"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (signals.maliciousScriptInImport) {
        return {
          status: "FAIL",
          confidence: 0.85,
          evidence: { summary: "Padrão de script suspeito no HTML importado." },
          remediation: "Remova scripts do espelho; o importador já deve strippar scripts — reverta HTML manual inseguro.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.6,
        evidence: { summary: "Sem padrão de script malicioso no espelho analisado." },
        remediation: "Não cole JS arbitrário de terceiros no HTML da presell.",
      };
    },
  }),
  def({
    id: "PS-002",
    name: "SSRF / destino interno",
    description: "Bloqueia localhost, IPs privados e metadata endpoints.",
    platforms: ["google", "microsoft"],
    category: "privacy_security",
    severity: "critical",
    sourceIds: ["gads-destination-requirements"],
    sourceReviewedAt: "2026-10-15",
    run: ({ destination, signals }) => {
      const raw = signals.affiliateLink || "";
      const looksInternal =
        /^(https?:\/\/)?(localhost|127\.|10\.|192\.168\.|169\.254\.|metadata\.google|169\.254\.169\.254)/i.test(
          raw,
        );
      if (destination?.errorCode === "ssrf_blocked" || looksInternal) {
        return {
          status: "FAIL",
          confidence: 1,
          evidence: { summary: "URL aponta para destino interno/metadata (SSRF)." },
          remediation: "Use apenas URLs públicas https da oferta.",
        };
      }
      if (!raw && !destination?.attempted) {
        return {
          status: "NOT_CHECKED",
          confidence: 0,
          evidence: { summary: "Sem URL para validar SSRF." },
          remediation: "Configure o destino.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.8,
        evidence: { summary: "Sem sinal de SSRF no URL analisado." },
        remediation: "Continue a validar DNS/redirects no probe.",
      };
    },
  }),
  def({
    id: "TR-001",
    name: "Preservação GCLID / UTM / MSCLKID",
    description: "Verifica se parâmetros de tracking legítimos são preservados no fluxo de redirect.",
    platforms: ["google", "microsoft"],
    category: "tracking",
    severity: "medium",
    sourceIds: ["gads-destination-requirements", "msads-agreement"],
    sourceReviewedAt: "2026-10-15",
    run: ({ tracking }) => {
      if (!tracking?.attempted) {
        return {
          status: "NOT_CHECKED",
          confidence: 0,
          evidence: { summary: "Teste de preservação de parâmetros não executado." },
          remediation: "Execute o teste de tracking na auditoria.",
        };
      }
      const fails: string[] = [];
      if (tracking.gclidPreserved === false) fails.push("gclid");
      if (tracking.utmPreserved === false) fails.push("utm");
      if (tracking.msclkidPreserved === false) fails.push("msclkid");
      if (fails.length) {
        return {
          status: "FAIL",
          confidence: 0.85,
          evidence: { summary: `Parâmetros perdidos: ${fails.join(", ")}`, details: tracking.details },
          remediation: "Preserve GCLID/UTM/MSCLKID nos redirects; não remova identificadores legítimos.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.8,
        evidence: { summary: "Parâmetros de tracking preservados no teste.", details: tracking.details },
        remediation: "Não altere IDs de tracking sem necessidade.",
      };
    },
  }),
  def({
    id: "PRIV-001",
    name: "Política de privacidade acessível",
    description: "Microsoft Agreement exige link proeminente; Google também espera transparência de dados.",
    platforms: ["microsoft", "google"],
    category: "privacy_security",
    severity: "medium",
    sourceIds: ["msads-agreement", "gads-policies-overview"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      const privacy =
        signals.privacyPolicyUrl ||
        (signals.cookiePolicyUrl &&
        (/privacidade|privacy|cookie/i.test(signals.cookiePolicyUrl) || signals.cookiePolicyUrl.startsWith("/"))
          ? signals.cookiePolicyUrl
          : null);
      if (privacy) {
        return {
          status: "PASS",
          confidence: 0.7,
          evidence: { summary: "URL de política de privacidade/cookies configurada.", details: [privacy] },
          remediation: "Garanta que o link está visível na página publicada.",
        };
      }
      return {
        status: "WARNING",
        confidence: 0.75,
        evidence: { summary: "Política de privacidade não configurada." },
        remediation: "Adicione um URL real de política de privacidade. Não invente texto legal.",
      };
    },
  }),
  def({
    id: "UX-001",
    name: "Pop-up de saída agressivo",
    description: "Exit popups podem prejudicar a experiência de destino.",
    platforms: ["google", "microsoft"],
    category: "destination",
    severity: "medium",
    sourceIds: ["gads-destination-requirements", "msads-pilot-policy-cn"],
    sourceReviewedAt: "2026-10-15",
    run: ({ signals }) => {
      if (signals.exitPopup) {
        return {
          status: "WARNING",
          confidence: 0.7,
          evidence: { summary: "Exit popup ativo nos settings." },
          remediation: "Desative pop-ups que dificultem a saída ou a navegação.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.6,
        evidence: { summary: "Exit popup não ativo." },
        remediation: "Evite overlays abusivos.",
      };
    },
  }),
  def({
    id: "META-001",
    name: "Fontes de política desatualizadas / inacessíveis",
    description: "Assinala pacote de regras com fontes stale ou unreachable.",
    platforms: ["google", "microsoft"],
    category: "meta",
    severity: "medium",
    sourceIds: ["msads-apex-60280", "msads-relevance-quality"],
    sourceReviewedAt: "2026-10-15",
    run: ({ forcePolicyStale, now }) => {
      const stale = forcePolicyStale === true || isPolicyPackStale(now);
      const unreachable = ["msads-apex-60280", "msads-relevance-quality"]
        .map((id) => getPolicySource(id))
        .filter((s) => s && s.status === "unreachable");
      if (stale || unreachable.length) {
        return {
          status: "WARNING",
          confidence: 1,
          evidence: {
            summary: "Há fontes oficiais unreachable ou pacote potencialmente desatualizado.",
            details: unreachable.map((s) => `${s!.id}:${s!.status}`),
          },
          remediation:
            "Revalide políticas no POLICY_SOURCE_REGISTER e atualize RULES_VERSION. Não assuma paridade Google≡Microsoft.",
        };
      }
      return {
        status: "PASS",
        confidence: 0.9,
        evidence: { summary: "Pacote de fontes dentro do limiar de frescura." },
        remediation: "Reconsultar políticas periodicamente.",
      };
    },
  }),
  def({
    id: "META-002",
    name: "Serviço de auditoria indisponível",
    description: "Quando o serviço não consegue completar a auditoria.",
    platforms: ["google", "microsoft"],
    category: "meta",
    severity: "critical",
    sourceIds: ["gads-destination-requirements"],
    sourceReviewedAt: "2026-10-15",
    run: ({ auditServiceUnavailable }) => {
      if (auditServiceUnavailable) {
        return {
          status: "FAIL",
          confidence: 1,
          evidence: { summary: "Serviço de auditoria indisponível — publicação bloqueada." },
          remediation: "Tente novamente mais tarde. Não publique sem auditoria.",
        };
      }
      return {
        status: "PASS",
        confidence: 1,
        evidence: { summary: "Serviço de auditoria disponível." },
        remediation: "N/A",
      };
    },
  }),
];

function toResult(
  rule: (typeof RULES)[number],
  partial: Pick<RuleResult, "status" | "confidence" | "evidence" | "remediation">,
): RuleResult {
  return {
    ruleId: rule.id,
    name: rule.name,
    description: rule.description,
    platforms: rule.platforms,
    category: rule.category,
    severity: rule.severity,
    status: partial.status,
    confidence: partial.confidence,
    evidence: partial.evidence,
    remediation: partial.remediation,
    sourceIds: rule.sourceIds,
    sourceReviewedAt: rule.sourceReviewedAt,
  };
}

function summarizePlatform(platform: AdsPlatform, results: RuleResult[]): PlatformComplianceSummary {
  const scoped = results.filter((r) => r.platforms.includes(platform));
  const passCount = scoped.filter((r) => r.status === "PASS").length;
  const failCount = scoped.filter((r) => r.status === "FAIL").length;
  const warningCount = scoped.filter((r) => r.status === "WARNING").length;
  const notCheckedCount = scoped.filter((r) => r.status === "NOT_CHECKED").length;
  const criticalFailCount = scoped.filter(
    (r) => r.status === "FAIL" && (r.severity === "critical" || r.severity === "high"),
  ).length;
  return {
    platform,
    gate: deriveGate(scoped),
    passCount,
    failCount,
    warningCount,
    notCheckedCount,
    criticalFailCount,
  };
}

export function deriveGate(results: RuleResult[]): ComplianceGate {
  if (results.some((r) => r.ruleId === "META-002" && r.status === "FAIL")) return "blocked";
  const criticalFail = results.some(
    (r) => r.status === "FAIL" && (r.severity === "critical" || r.severity === "high"),
  );
  if (criticalFail) return "blocked";
  const hasFail = results.some((r) => r.status === "FAIL");
  if (hasFail) return "blocked";

  // Só WARNING *critical* exige revisão humana antes de publicar.
  // WARNING high/medium (divulgação, espelho, privacidade) ficam visíveis mas não bloqueiam o wizard.
  // NOT_CHECKED de destino (probe adiada/falhou de rede) também não bloqueia sozinho — DT FAIL sim.
  const needsHuman = results.some(
    (r) => r.status === "WARNING" && r.severity === "critical" && r.category !== "meta",
  );
  if (needsHuman) return "needs_review";
  return "ready_for_review";
}

export function mergeGate(a: ComplianceGate, b: ComplianceGate): ComplianceGate {
  const order: ComplianceGate[] = [
    "blocked",
    "needs_review",
    "checking",
    "unchecked",
    "ready_for_review",
  ];
  return order.indexOf(a) <= order.indexOf(b) ? a : b;
}

/** Aplica overrides humanos (falsos positivos) — só para regras explicitamente liberadas. */
export function applyHumanOverrides(
  results: RuleResult[],
  overrides: Array<{ ruleId: string; decision: "override_pass" | "acknowledge" }>,
): RuleResult[] {
  const map = new Map(overrides.map((o) => [o.ruleId, o.decision]));
  return results.map((r) => {
    const d = map.get(r.ruleId);
    if (!d) return r;
    if (d === "override_pass" && r.status === "FAIL") {
      return {
        ...r,
        status: "WARNING" as RuleResultStatus,
        // Baixar severidade para não ficar eternamente em needs_review após contestação válida.
        severity: "medium",
        confidence: Math.min(r.confidence, 0.4),
        evidence: {
          ...r.evidence,
          summary: `${r.evidence.summary} (falso positivo contestado por revisão humana)`,
        },
        remediation: "Override humano registado — a plataforma publicitária ainda pode reprovar.",
      };
    }
    return r;
  });
}

export function buildEvaluationFromResults(args: {
  results: RuleResult[];
  contentFingerprint: string;
  now?: Date;
}): ComplianceEvaluation {
  const google = summarizePlatform("google", args.results);
  const microsoft = summarizePlatform("microsoft", args.results);
  return {
    rulesVersion: RULES_VERSION,
    evaluatedAt: (args.now ?? new Date()).toISOString(),
    gate: mergeGate(google.gate, microsoft.gate),
    google,
    microsoft,
    results: args.results,
    contentFingerprint: args.contentFingerprint,
    disclaimer: COMPLIANCE_DISCLAIMER,
  };
}

export function evaluateCompliance(input: EvaluateComplianceInput): ComplianceEvaluation {
  const results = RULES.map((rule) => toResult(rule, rule.run(input)));
  return buildEvaluationFromResults({
    results,
    contentFingerprint: input.signals.contentFingerprint,
    now: input.now,
  });
}

export function listRuleDefinitions(): RuleDefinition[] {
  return RULES.map(({ run: _run, ...rest }) => rest);
}

/**
 * Gate interna de Ads (wizard / tipos gerados).
 * Editor visual (`builder`) publica de imediato — ver `isInstantPublishPresellType`.
 */
export function canPublishForAds(gate: ComplianceGate): boolean {
  return gate === "ready_for_review";
}

/** Editor manual / visual: Publicar = no ar de imediato (domínio + rastreio), sem fila de “aprovação” Clickora. */
export function isInstantPublishPresellType(type: string | null | undefined): boolean {
  return (type || "").trim().toLowerCase() === "builder";
}
