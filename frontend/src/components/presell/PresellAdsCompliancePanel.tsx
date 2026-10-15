import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, HelpCircle, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { tenantQueryKey } from "@/lib/tenantQueryKey";
import { useAuth } from "@/contexts/AuthContext";
import {
  presellService,
  type PresellComplianceAuditDto,
  type PresellComplianceResultDto,
} from "@/services/presellService";
import type { PresellConfigSettings } from "@/lib/presellConfigDefaults";

type Props = {
  presellId: string | null;
  configSettings: PresellConfigSettings;
  setConfigSettings: React.Dispatch<React.SetStateAction<PresellConfigSettings>>;
  affiliateDisclosureInContent?: string;
  onAffiliateDisclosureChange?: (value: string) => void;
  /** Nicho black: identidade não se preenche à mão. */
  lockIdentityFromSource?: boolean;
};

function gateLabel(
  gate: string | null | undefined,
  opts?: { warningCount?: number; notCheckedCount?: number },
): string {
  switch (gate) {
    case "ready_for_review": {
      const w = opts?.warningCount ?? 0;
      const n = opts?.notCheckedCount ?? 0;
      if (w > 0 || n > 0) {
        return "Verificações internas concluídas — com avisos ou itens não verificados (não é aprovação Google/Microsoft)";
      }
      return "Verificações internas concluídas (não é aprovação Google/Microsoft)";
    }
    case "needs_review":
      return "Revisão humana necessária";
    case "blocked":
      return "Foram detetados problemas que impedem a publicação";
    case "checking":
      return "Auditoria em curso";
    default:
      return "Ainda não auditada";
  }
}

function statusIcon(status: string) {
  if (status === "PASS") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
  if (status === "FAIL") return <ShieldAlert className="h-3.5 w-3.5 text-destructive" aria-hidden />;
  if (status === "WARNING") return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />;
  return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />;
}

function RuleRow({
  r,
  onDispute,
}: {
  r: PresellComplianceResultDto;
  onDispute?: (ruleId: string) => void;
}) {
  return (
    <li className="rounded-md border border-border/60 bg-background/80 px-3 py-2 text-sm">
      <div className="flex items-start gap-2">
        {statusIcon(r.status)}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{r.name}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.ruleId}</span>
            <span className="text-[10px] text-muted-foreground">{r.status}</span>
            <span className="text-[10px] text-muted-foreground">{r.severity}</span>
          </div>
          <p className="text-xs text-muted-foreground">{r.evidence?.summary}</p>
          {r.status !== "PASS" ? (
            <p className="text-xs text-foreground/90">
              <span className="font-medium">Correção: </span>
              {r.remediation}
            </p>
          ) : null}
          {r.sourceIds?.length ? (
            <p className="text-[10px] text-muted-foreground">
              Fontes: {r.sourceIds.join(", ")} · revisto {r.sourceReviewedAt}
            </p>
          ) : null}
          {r.status === "FAIL" && onDispute ? (
            <Button type="button" variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={() => onDispute(r.ruleId)}>
              Contestar falso positivo
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function PresellAdsCompliancePanel({
  presellId,
  configSettings,
  setConfigSettings,
  affiliateDisclosureInContent,
  onAffiliateDisclosureChange,
  lockIdentityFromSource = false,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [disputeRuleId, setDisputeRuleId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const queryKey = tenantQueryKey(user, ["presell-compliance", presellId]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    enabled: Boolean(presellId),
    queryFn: async () => {
      const { data: body, error: err } = await presellService.getCompliance(presellId!);
      if (err || !body) throw new Error(err || "Falha ao carregar conformidade");
      return body;
    },
  });

  const auditMutation = useMutation({
    mutationFn: async () => {
      const { data: body, error: err } = await presellService.runComplianceAudit(presellId!);
      if (err || !body) throw new Error(err || "Falha na auditoria");
      return body;
    },
    onSuccess: () => {
      toast.success("Auditoria concluída (verificações internas).");
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideMutation = useMutation({
    mutationFn: async () => {
      const auditId = data?.latest_audit?.id;
      if (!auditId || !disputeRuleId) throw new Error("Auditoria ou regra em falta.");
      const { data: body, error: err } = await presellService.submitComplianceDecision(presellId!, {
        audit_id: auditId,
        rule_id: disputeRuleId,
        decision: "override_pass",
        reason: disputeReason.trim(),
      });
      if (err || !body) throw new Error(err || "Falha ao registar decisão");
      return body;
    },
    onSuccess: () => {
      toast.success("Decisão humana registada. Reauditoria aplicada.");
      setDisputeRuleId(null);
      setDisputeReason("");
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setField = useCallback(
    (key: keyof PresellConfigSettings, value: string) => {
      setConfigSettings((prev) => ({ ...prev, [key]: value }));
    },
    [setConfigSettings],
  );

  const audit = data?.latest_audit as PresellComplianceAuditDto | null | undefined;
  const results = (audit?.results || []) as PresellComplianceResultDto[];
  const critical = results.filter((r) => r.status === "FAIL");
  const warnings = results.filter((r) => r.status === "WARNING");
  const notChecked = results.filter((r) => r.status === "NOT_CHECKED");
  const gate = data?.compliance_gate || "unchecked";
  const gateOpts = { warningCount: warnings.length, notCheckedCount: notChecked.length };

  if (!presellId) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Guarde a presell para executar a auditoria de conformidade publicitária.
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Conformidade publicitária
          </h3>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Verificações internas do Clickora para Google Ads e Microsoft Advertising. A aprovação final depende da
            plataforma publicitária — não há selo de aprovação nem garantia antibloqueio.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={auditMutation.isPending}
          onClick={() => auditMutation.mutate()}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", auditMutation.isPending && "animate-spin")} />
          Executar auditoria novamente
        </Button>
      </div>

      <div
        className={cn(
          "rounded-md border px-3 py-2 text-sm",
          gate === "blocked" && "border-destructive/40 bg-destructive/5",
          gate === "needs_review" && "border-amber-500/40 bg-amber-500/5",
          gate === "ready_for_review" && "border-emerald-600/30 bg-emerald-600/5",
          (gate === "unchecked" || gate === "checking") && "border-border/60 bg-muted/20",
        )}
      >
        <p className="font-medium">{gateLabel(gate, gateOpts)}</p>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Google: {gateLabel(audit?.google_gate || data?.compliance_gate, gateOpts)}</span>
          <span>Microsoft: {gateLabel(audit?.microsoft_gate || data?.compliance_gate, gateOpts)}</span>
          {data?.last_compliance_audit_at ? (
            <span>Última auditoria: {new Date(data.last_compliance_audit_at).toLocaleString()}</span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {lockIdentityFromSource ? (
          <div className="sm:col-span-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Nicho black: nome e contacto vêm da página original. Não preencha à mão.
          </div>
        ) : (
          <>
        <div className="space-y-1.5">
          <Label htmlFor="compliance-business">Identidade / responsável</Label>
          <Input
            id="compliance-business"
            value={String(configSettings.businessName ?? "")}
            onChange={(e) => setField("businessName", e.target.value)}
            placeholder="Nome real da empresa ou operador"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="compliance-email">Contacto</Label>
          <Input
            id="compliance-email"
            type="email"
            value={String(configSettings.contactEmail ?? "")}
            onChange={(e) => setField("contactEmail", e.target.value)}
            placeholder="email@exemplo.com"
          />
        </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="compliance-privacy">Política de privacidade (URL)</Label>
          <Input
            id="compliance-privacy"
            value={String(configSettings.privacyPolicyUrl ?? "")}
            onChange={(e) => setField("privacyPolicyUrl", e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="compliance-affiliate">Divulgação de afiliado</Label>
          <Input
            id="compliance-affiliate"
            value={
              affiliateDisclosureInContent ??
              String(configSettings.affiliateDisclosure ?? "")
            }
            onChange={(e) => {
              onAffiliateDisclosureChange?.(e.target.value);
              setField("affiliateDisclosure", e.target.value);
            }}
            placeholder="Texto visível de divulgação"
          />
        </div>
      </div>

      {isLoading ? <p className="text-xs text-muted-foreground">A carregar resultados…</p> : null}
      {error ? (
        <p className="text-xs text-destructive">{error instanceof Error ? error.message : "Erro"}</p>
      ) : null}

      {critical.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Problemas críticos</p>
          <ul className="space-y-2">
            {critical.map((r) => (
              <RuleRow key={r.ruleId} r={r} onDispute={setDisputeRuleId} />
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Avisos</p>
          <ul className="space-y-2">
            {warnings.map((r) => (
              <RuleRow key={r.ruleId} r={r} />
            ))}
          </ul>
        </div>
      ) : null}

      {notChecked.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ainda não verificadas
          </p>
          <ul className="space-y-2">
            {notChecked.map((r) => (
              <RuleRow key={r.ruleId} r={r} />
            ))}
          </ul>
        </div>
      ) : null}

      {disputeRuleId ? (
        <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
          <p className="text-sm font-medium">Contestar {disputeRuleId}</p>
          <Textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Explique porque é um falso positivo (mín. 8 caracteres). A decisão fica auditada."
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={decideMutation.isPending || disputeReason.trim().length < 8}
              onClick={() => decideMutation.mutate()}
            >
              Registar decisão humana
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDisputeRuleId(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {data?.decisions?.length ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico de decisões
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {data.decisions.slice(0, 8).map((d) => (
              <li key={d.id}>
                {new Date(d.created_at).toLocaleString()} · {d.rule_id} · {d.decision}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        {data?.disclaimer ||
          "A aprovação final depende da plataforma publicitária. Verificações internas concluídas ≠ anúncio aprovado."}
      </p>
    </section>
  );
}
