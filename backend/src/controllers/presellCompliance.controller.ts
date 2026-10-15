import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { actorUserId, billingUserId } from "../lib/requestContext";
import { denyIfCannotWritePresells } from "./workspace.controller";
import {
  getLatestComplianceAudit,
  mapAuditDto,
  recordComplianceDecision,
  runPresellComplianceAudit,
} from "../compliance/service";
import { COMPLIANCE_DISCLAIMER } from "../compliance/types";
import { listRuleDefinitions } from "../compliance/evaluate";
import { RULES_VERSION } from "../compliance/policySources";

const decisionSchema = z.object({
  audit_id: z.string().uuid(),
  rule_id: z.string().min(2).max(32),
  decision: z.enum(["override_pass", "acknowledge", "dispute"]),
  reason: z.string().min(8).max(2000),
});

export const presellComplianceController = {
  async getRules(_req: Request, res: Response) {
    res.json({
      rules_version: RULES_VERSION,
      disclaimer: COMPLIANCE_DISCLAIMER,
      rules: listRuleDefinitions(),
    });
  },

  async getLatest(req: Request, res: Response) {
    const userId = billingUserId(req);
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId },
      select: {
        id: true,
        complianceGate: true,
        lastComplianceAuditAt: true,
        lastComplianceAuditId: true,
        contentFingerprint: true,
        status: true,
      },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    const audit = await getLatestComplianceAudit(userId, page.id);
    const decisions = await prisma.presellComplianceDecision.findMany({
      where: { userId, presellId: page.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    res.json({
      disclaimer: COMPLIANCE_DISCLAIMER,
      compliance_gate: page.complianceGate,
      last_compliance_audit_at: page.lastComplianceAuditAt?.toISOString() ?? null,
      last_compliance_audit_id: page.lastComplianceAuditId,
      content_fingerprint: page.contentFingerprint,
      status: page.status,
      latest_audit: audit ? mapAuditDto(audit) : null,
      decisions: decisions.map((d) => ({
        id: d.id,
        audit_id: d.auditId,
        rule_id: d.ruleId,
        decision: d.decision,
        reason: d.reason,
        decided_by_user_id: d.decidedByUserId,
        created_at: d.createdAt.toISOString(),
      })),
    });
  },

  async runAudit(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const userId = billingUserId(req);
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    const skipProbe = req.query.skip_probe === "1" || req.body?.skip_probe === true;
    const result = await runPresellComplianceAudit({
      presell: page,
      skipDestinationProbe: skipProbe,
    });

    res.json({
      disclaimer: COMPLIANCE_DISCLAIMER,
      audit_id: result.auditId,
      evaluation: {
        rules_version: result.evaluation.rulesVersion,
        evaluated_at: result.evaluation.evaluatedAt,
        gate: result.evaluation.gate,
        google: result.evaluation.google,
        microsoft: result.evaluation.microsoft,
        results: result.evaluation.results,
        content_fingerprint: result.evaluation.contentFingerprint,
        disclaimer: result.evaluation.disclaimer,
      },
      suggestions: result.suggestions,
    });
  },

  async decide(req: Request, res: Response) {
    if (await denyIfCannotWritePresells(req, res)) return;
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const userId = billingUserId(req);
    const page = await prisma.presellPage.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });
    if (!page) return res.status(404).json({ error: "Página não encontrada" });

    try {
      const row = await recordComplianceDecision({
        userId,
        decidedByUserId: actorUserId(req),
        presellId: page.id,
        auditId: parsed.data.audit_id,
        ruleId: parsed.data.rule_id,
        decision: parsed.data.decision,
        reason: parsed.data.reason,
      });
      const latest = await getLatestComplianceAudit(userId, page.id);
      res.status(201).json({
        decision: {
          id: row.id,
          rule_id: row.ruleId,
          decision: row.decision,
          created_at: row.createdAt.toISOString(),
        },
        latest_audit: latest ? mapAuditDto(latest) : null,
        disclaimer: COMPLIANCE_DISCLAIMER,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao registar decisão";
      return res.status(400).json({ error: msg });
    }
  },
};
