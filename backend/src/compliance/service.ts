import { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../lib/prisma";
import { extractPresellSignals } from "./extractPresellSignals";
import {
  applyHumanOverrides,
  buildEvaluationFromResults,
  canPublishForAds,
  evaluateCompliance,
  isInstantPublishPresellType,
} from "./evaluate";
import { probeDestinationUrl } from "./destinationProbe";
import { probeTrackingParamPreservation } from "./trackingProbe";
import { suggestCorrections } from "./correctionAssistant";
import { RULES_VERSION } from "./policySources";
import type { ComplianceEvaluation, ComplianceGate, RuleResult } from "./types";
import { COMPLIANCE_DISCLAIMER } from "./types";

export type PresellLike = {
  id: string;
  userId: string;
  title: string;
  type: string;
  language: string | null;
  category: string | null;
  content: unknown;
  settings: unknown;
  videoUrl?: string | null;
  status: string;
  complianceGate?: ComplianceGate | string | null;
  contentFingerprint?: string | null;
  updatedAt?: Date;
};

function asGate(value: unknown): ComplianceGate {
  const allowed: ComplianceGate[] = [
    "unchecked",
    "checking",
    "needs_review",
    "blocked",
    "ready_for_review",
  ];
  return allowed.includes(value as ComplianceGate) ? (value as ComplianceGate) : "unchecked";
}

export async function runPresellComplianceAudit(args: {
  presell: PresellLike;
  /** Skip outbound probe (unit tests / offline). */
  skipDestinationProbe?: boolean;
  auditServiceUnavailable?: boolean;
  forcePolicyStale?: boolean;
}): Promise<{
  evaluation: ComplianceEvaluation;
  auditId: string;
  suggestions: ReturnType<typeof suggestCorrections>;
}> {
  const userId = args.presell.userId;
  const pageId = args.presell.id;

  await systemPrisma.presellPage.update({
    where: { id: pageId },
    data: { complianceGate: "checking" },
  });

  try {
    if (args.auditServiceUnavailable) {
      const signals = extractPresellSignals({
        title: args.presell.title,
        type: args.presell.type,
        language: args.presell.language,
        category: args.presell.category,
        content: args.presell.content,
        settings: args.presell.settings,
        videoUrl: args.presell.videoUrl,
      });
      const evaluation = evaluateCompliance({
        signals,
        auditServiceUnavailable: true,
      });
      const saved = await persistAudit({
        userId,
        pageId,
        evaluation,
      });
      return {
        evaluation,
        auditId: saved.id,
        suggestions: suggestCorrections({
          results: evaluation.results,
          current: {},
        }),
      };
    }

    const signals = extractPresellSignals({
      title: args.presell.title,
      type: args.presell.type,
      language: args.presell.language,
      category: args.presell.category,
      content: args.presell.content,
      settings: args.presell.settings,
      videoUrl: args.presell.videoUrl,
    });

    const destination = args.skipDestinationProbe
      ? null
      : await probeDestinationUrl(signals.affiliateLink);

    const tracking = probeTrackingParamPreservation({ offerUrl: signals.affiliateLink });

    let evaluation = evaluateCompliance({
      signals,
      destination,
      tracking,
      forcePolicyStale: args.forcePolicyStale,
    });

    // Overrides só são válidos para o fingerprint da auditoria em que foram tomados.
    // Evita reutilizar decisões humanas após alteração de conteúdo/destino.
    const overrideRows = await systemPrisma.presellComplianceDecision.findMany({
      where: { presellId: pageId, userId, decision: "override_pass" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { audit: { select: { contentFingerprint: true } } },
    });
    const applicableOverrides = overrideRows.filter(
      (o) => o.audit.contentFingerprint === evaluation.contentFingerprint,
    );
    if (applicableOverrides.length) {
      const results = applyHumanOverrides(
        evaluation.results,
        applicableOverrides.map((o) => ({ ruleId: o.ruleId, decision: "override_pass" as const })),
      );
      evaluation = buildEvaluationFromResults({
        results,
        contentFingerprint: evaluation.contentFingerprint,
      });
    }

    const saved = await persistAudit({ userId, pageId, evaluation });
    const content = (args.presell.content && typeof args.presell.content === "object"
      ? args.presell.content
      : {}) as Record<string, unknown>;
    const settings = (args.presell.settings && typeof args.presell.settings === "object"
      ? args.presell.settings
      : {}) as Record<string, unknown>;

    return {
      evaluation,
      auditId: saved.id,
      suggestions: suggestCorrections({
        results: evaluation.results,
        current: {
          salesText: typeof content.sales_text === "string" ? content.sales_text : undefined,
          affiliateDisclosure:
            typeof content.affiliateDisclosure === "string"
              ? content.affiliateDisclosure
              : typeof content.affiliate_disclosure === "string"
                ? content.affiliate_disclosure
                : undefined,
          businessName:
            typeof settings.businessName === "string" ? settings.businessName : null,
          contactEmail:
            typeof settings.contactEmail === "string" ? settings.contactEmail : null,
          privacyPolicyUrl:
            typeof settings.privacyPolicyUrl === "string" ? settings.privacyPolicyUrl : null,
        },
      }),
    };
  } catch (error) {
    const signals = extractPresellSignals({
      title: args.presell.title,
      type: args.presell.type,
      language: args.presell.language,
      category: args.presell.category,
      content: args.presell.content,
      settings: args.presell.settings,
      videoUrl: args.presell.videoUrl,
    });
    const evaluation = evaluateCompliance({
      signals,
      auditServiceUnavailable: true,
    });
    const saved = await persistAudit({ userId, pageId, evaluation });
    // eslint-disable-next-line no-console
    console.error("[compliance] audit failed", {
      pageId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      evaluation,
      auditId: saved.id,
      suggestions: [],
    };
  }
}

async function persistAudit(args: {
  userId: string;
  pageId: string;
  evaluation: ComplianceEvaluation;
}) {
  const { evaluation } = args;
  const audit = await systemPrisma.presellComplianceAudit.create({
    data: {
      userId: args.userId,
      presellId: args.pageId,
      rulesVersion: evaluation.rulesVersion,
      gate: evaluation.gate,
      googleGate: evaluation.google.gate,
      microsoftGate: evaluation.microsoft.gate,
      contentFingerprint: evaluation.contentFingerprint,
      results: evaluation.results as unknown as Prisma.InputJsonValue,
      disclaimer: evaluation.disclaimer,
    },
  });

  await systemPrisma.presellPage.update({
    where: { id: args.pageId },
    data: {
      complianceGate: evaluation.gate,
      lastComplianceAuditAt: new Date(evaluation.evaluatedAt),
      lastComplianceAuditId: audit.id,
      contentFingerprint: evaluation.contentFingerprint,
    },
  });

  return audit;
}

export async function getLatestComplianceAudit(userId: string, presellId: string) {
  return prisma.presellComplianceAudit.findFirst({
    where: { userId, presellId },
    orderBy: { createdAt: "desc" },
  });
}

export async function recordComplianceDecision(args: {
  userId: string;
  decidedByUserId: string;
  presellId: string;
  auditId: string;
  ruleId: string;
  decision: "override_pass" | "acknowledge" | "dispute";
  reason: string;
}) {
  if (!args.reason.trim() || args.reason.trim().length < 8) {
    throw new Error("Indique um motivo (≥ 8 caracteres) para a decisão humana.");
  }
  const audit = await prisma.presellComplianceAudit.findFirst({
    where: { id: args.auditId, userId: args.userId, presellId: args.presellId },
  });
  if (!audit) throw new Error("Auditoria não encontrada.");

  const row = await systemPrisma.presellComplianceDecision.create({
    data: {
      userId: args.userId,
      presellId: args.presellId,
      auditId: args.auditId,
      ruleId: args.ruleId,
      decision: args.decision,
      reason: args.reason.trim().slice(0, 2000),
      decidedByUserId: args.decidedByUserId,
    },
  });

  // Reavaliar com overrides (sem rede se fingerprint igual — skip probe for speed)
  const page = await prisma.presellPage.findFirst({
    where: { id: args.presellId, userId: args.userId },
  });
  if (page) {
    await runPresellComplianceAudit({
      presell: page,
      skipDestinationProbe: true,
    });
  }

  return row;
}

/**
 * Impede publicação se a gate não permitir.
 * Se o conteúdo mudou desde a última auditoria, exige reauditoria.
 * Tipo `builder` (editor manual): publica de imediato — auditoria em background, sem bloquear.
 */
export async function assertPublishAllowed(args: {
  page: PresellLike;
  /** Se true, corre auditoria síncrona antes de decidir. */
  runIfStale?: boolean;
}): Promise<{ ok: true; evaluation?: ComplianceEvaluation } | { ok: false; status: number; body: Record<string, unknown> }> {
  const signals = extractPresellSignals({
    title: args.page.title,
    type: args.page.type,
    language: args.page.language,
    category: args.page.category,
    content: args.page.content,
    settings: args.page.settings,
    videoUrl: args.page.videoUrl,
  });

  /** Elementor-style: editar → domínio → Publicar → no ar (rastreio no head). */
  if (isInstantPublishPresellType(args.page.type)) {
    void runPresellComplianceAudit({
      presell: { ...args.page, contentFingerprint: signals.contentFingerprint },
      skipDestinationProbe: true,
    }).catch(() => undefined);
    return { ok: true };
  }

  const fingerprintChanged =
    Boolean(args.page.contentFingerprint) &&
    args.page.contentFingerprint !== signals.contentFingerprint;

  let gate = asGate(args.page.complianceGate);
  let evaluation: ComplianceEvaluation | undefined;

  if (gate === "unchecked" || gate === "checking" || fingerprintChanged || args.runIfStale) {
    // Probe de destino: timeouts/rede já não bloqueiam; 404/SSRF ainda falham.
    // Limite implícito no probe (8s) — evita prender o wizard indefinidamente.
    const ran = await runPresellComplianceAudit({
      presell: { ...args.page, contentFingerprint: signals.contentFingerprint },
      skipDestinationProbe: false,
    });
    evaluation = ran.evaluation;
    gate = ran.evaluation.gate;
  }

  if (!canPublishForAds(gate)) {
    const latest = await getLatestComplianceAudit(args.page.userId, args.page.id);
    const results = (latest?.results as RuleResult[] | null) || evaluation?.results || [];
    const critical = results.filter((r) => r.status === "FAIL").slice(0, 12);
    return {
      ok: false,
      status: 403,
      body: {
        error:
          gate === "blocked"
            ? "Foram detetados problemas que impedem a publicação."
            : "Revisão humana necessária antes da publicação.",
        code: "COMPLIANCE_GATE",
        compliance_gate: gate,
        disclaimer: COMPLIANCE_DISCLAIMER,
        rules_version: latest?.rulesVersion || RULES_VERSION,
        critical_issues: critical.map((r) => ({
          rule_id: r.ruleId,
          name: r.name,
          status: r.status,
          severity: r.severity,
          evidence: r.evidence.summary,
          remediation: r.remediation,
        })),
        message:
          "Verificações internas do Clickora. A aprovação final depende da plataforma publicitária.",
      },
    };
  }

  return { ok: true, evaluation };
}

export function mapAuditDto(audit: {
  id: string;
  rulesVersion: string;
  gate: string;
  googleGate: string;
  microsoftGate: string;
  contentFingerprint: string;
  results: unknown;
  disclaimer: string;
  createdAt: Date;
}) {
  return {
    id: audit.id,
    rules_version: audit.rulesVersion,
    gate: audit.gate,
    google_gate: audit.googleGate,
    microsoft_gate: audit.microsoftGate,
    content_fingerprint: audit.contentFingerprint,
    results: audit.results,
    disclaimer: audit.disclaimer,
    created_at: audit.createdAt.toISOString(),
  };
}
